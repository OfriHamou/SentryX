#!/usr/bin/env python3
from flask import Flask, jsonify
import cv2
import os
import json
import time
from datetime import datetime, timezone
import threading
import sys

sys.path.append("/home/jetson/projects/SentryX/robot/jetson-bridge/detectors")
from face_detector import FaceDetector

app = Flask(__name__)

EVENTS_DIR = "/home/jetson/projects/SentryX/robot/jetson-bridge/data/events"
COOLDOWN_SECONDS = 10

os.makedirs(EVENTS_DIR, exist_ok=True)

detector = FaceDetector()

latest_status = {
    "ok": True,
    "camera_opened": False,
    "faces_detected": 0,
    "last_event_id": None,
    "last_detection_time": None,
}

latest_event = None
last_event_ts = 0
state_lock = threading.Lock()


def build_pipeline():
    return (
        "nvarguscamerasrc ! "
        "video/x-raw(memory:NVMM), width=1280, height=720, framerate=30/1, format=NV12 ! "
        "nvvidconv ! "
        "video/x-raw, format=BGRx ! "
        "videoconvert ! "
        "video/x-raw, format=BGR ! "
        "appsink max-buffers=1 drop=true sync=false"
    )


def save_event(frame, detections):
    global latest_event, last_event_ts

    now = time.time()
    if now - last_event_ts < COOLDOWN_SECONDS:
        return None

    ts = datetime.now(timezone.utc)
    event_id = ts.strftime("%Y-%m-%dT%H-%M-%SZ")

    image_filename = f"{event_id}.jpg"
    json_filename = f"{event_id}.json"

    image_path = os.path.join(EVENTS_DIR, image_filename)
    json_path = os.path.join(EVENTS_DIR, json_filename)

    annotated = frame.copy()
    for det in detections:
        x = det["x"]
        y = det["y"]
        w = det["w"]
        h = det["h"]
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 255, 0), 2)

    cv2.imwrite(image_path, annotated)

    event = {
        "id": event_id,
        "type": "face_detected",
        "timestamp": ts.isoformat(),
        "image_filename": image_filename,
        "detections": detections,
        "source": "yahboom_haar_face_detector"
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(event, f, indent=2)

    last_event_ts = now
    latest_event = event
    return event


def list_events():
    events = []
    for name in sorted(os.listdir(EVENTS_DIR), reverse=True):
        if not name.endswith(".json"):
            continue

        path = os.path.join(EVENTS_DIR, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                events.append(json.load(f))
        except Exception:
            continue
    return events


def detection_loop():
    global latest_event

    cap = cv2.VideoCapture(build_pipeline(), cv2.CAP_GSTREAMER)
    time.sleep(2)

    with state_lock:
        latest_status["camera_opened"] = cap.isOpened()

    while True:
        ok, frame = cap.read()

        if not ok or frame is None:
            with state_lock:
                latest_status["camera_opened"] = False
            time.sleep(0.1)
            continue

        detections = detector.detect_faces(frame)

        with state_lock:
            latest_status["camera_opened"] = True
            latest_status["faces_detected"] = len(detections)

        if detections:
            event = save_event(frame, detections)
            with state_lock:
                latest_status["last_detection_time"] = datetime.now(timezone.utc).isoformat()
                if event is not None:
                    latest_status["last_event_id"] = event["id"]

        time.sleep(0.1)


@app.route("/health", methods=["GET"])
def health():
    with state_lock:
        return jsonify({
            "ok": True,
            "camera_opened": latest_status["camera_opened"],
            "faces_detected": latest_status["faces_detected"],
            "last_event_id": latest_status["last_event_id"]
        })


@app.route("/status", methods=["GET"])
def status():
    with state_lock:
        return jsonify(latest_status)


@app.route("/latest_event", methods=["GET"])
def get_latest_event():
    if latest_event is None:
        return jsonify({"ok": True, "event": None})
    return jsonify({"ok": True, "event": latest_event})


@app.route("/events", methods=["GET"])
def get_events():
    return jsonify({"ok": True, "events": list_events()})


if __name__ == "__main__":
    worker = threading.Thread(target=detection_loop, daemon=True)
    worker.start()
    app.run(host="0.0.0.0", port=5002, threaded=True)
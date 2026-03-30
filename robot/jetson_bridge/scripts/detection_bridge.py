#!/usr/bin/env python3
from flask import Flask, jsonify, send_from_directory
import cv2
import os
import json
import time
from datetime import datetime, timezone
import threading

from jetson_bridge.detectors.face_detector import FaceDetector

app = Flask(__name__)

EVENTS_DIR = "/home/jetson/projects/SentryX/robot/jetson_bridge/data/events"
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

    # Check if we have at least 1 known face in the frame
    any_known = any(det["is_known"] for det in detections)
    event_type = "face_recognized" if any_known else "face_detected_unknown"

    image_filename = f"{event_id}.jpg"
    json_filename = f"{event_id}.json"
    image_path = os.path.join(EVENTS_DIR, image_filename)
    json_path = os.path.join(EVENTS_DIR, json_filename)

    annotated = frame.copy()
    for det in detections:
        x, y, w, h = det["x"], det["y"], det["w"], det["h"]
        # Green for known, red for unknown
        color = (0, 255, 0) if det["is_known"] else (0, 0, 255)

        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
        label = f"{det['name']} ({det['confidence']}%)" if det["is_known"] else "Unknown Person"
        cv2.putText(annotated, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    cv2.imwrite(image_path, annotated)

    event = {
        "id": event_id,
        "type": event_type,
        "is_alert": not any_known,  # We would like to make this as alert if it is not a known face
        "timestamp": ts.isoformat(),
        "image_filename": image_filename,
        "detections": detections,
        "source": "SentryX_Smart_Vision"
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
    if latest_event is not None:
        return jsonify({"ok": True, "event": latest_event})

    events = list_events()
    if events:
        return jsonify({"ok": True, "event": events[0]})

    return jsonify({"ok": True, "event": None})


@app.route("/events", methods=["GET"])
def get_events():
    return jsonify({"ok": True, "events": list_events()})

@app.route("/image/<path:filename>", methods=["GET"])
def get_image(filename):
    return send_from_directory(EVENTS_DIR, filename)


if __name__ == "__main__":
    worker = threading.Thread(target=detection_loop, daemon=True)
    worker.start()
    app.run(host="0.0.0.0", port=5002, threaded=True)

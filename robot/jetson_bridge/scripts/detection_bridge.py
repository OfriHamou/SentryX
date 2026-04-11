#!/usr/bin/env python3
import os
import cv2
import json
import time
import uuid
import threading

from datetime import datetime, timezone
from flask import Flask, jsonify, send_from_directory

from jetson_bridge.detectors.face_detector import FaceDetector

app = Flask(__name__)

STREAM_URL = "http://127.0.0.1:5001/video_feed"
EVENTS_DIR = "/home/jetson/projects/SentryX/robot/jetson_bridge/data/events"
EVENT_COOLDOWN_SECONDS = 5

os.makedirs(EVENTS_DIR, exist_ok=True)

detector = FaceDetector()

state_lock = threading.Lock()

latest_event = None
latest_status = {
    "ok": True,
    "camera_opened": False,
    "faces_detected": 0,
    "detections": [],
    "last_event_id": None,
    "last_detection_time": None,
}


def open_stream():
    cap = cv2.VideoCapture(STREAM_URL)
    time.sleep(1.0)
    return cap


def save_event(frame, detections):
    annotated = frame.copy()

    any_known = any(d.get("is_known", False) for d in detections)
    event_type = "face_recognized" if any_known else "face_detected_unknown"
    is_alert = not any_known

    for det in detections:
        x = int(det["x"])
        y = int(det["y"])
        w = int(det["w"])
        h = int(det["h"])

        color = (0, 255, 0) if det.get("is_known") else (0, 0, 255)

        label = det.get("name", "Unknown")
        if det.get("is_known"):
            label = "{} ({}%)".format(label, det.get("confidence", 0))

        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
        cv2.putText(
            annotated,
            label,
            (x, max(20, y - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2
        )

    event_id = uuid.uuid4().hex[:12]
    timestamp = datetime.now(timezone.utc).isoformat()
    base_name = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ") + "_" + event_id

    image_filename = base_name + ".jpg"
    json_filename = base_name + ".json"

    image_path = os.path.join(EVENTS_DIR, image_filename)
    json_path = os.path.join(EVENTS_DIR, json_filename)

    cv2.imwrite(image_path, annotated)

    event = {
        "id": event_id,
        "timestamp": timestamp,
        "type": event_type,
        "is_alert": is_alert,
        "image_filename": image_filename,
        "detections": detections
    }

    with open(json_path, "w") as f:
        json.dump(event, f, indent=2)

    return event


def load_all_events():
    events = []

    for filename in os.listdir(EVENTS_DIR):
        if not filename.endswith(".json"):
            continue

        path = os.path.join(EVENTS_DIR, filename)
        try:
            with open(path, "r") as f:
                events.append(json.load(f))
        except Exception:
            pass

    events.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
    return events


def detection_loop():
    global latest_event

    cap = None
    last_saved_event_time = 0

    while True:
        if cap is None or not cap.isOpened():
            cap = open_stream()

            with state_lock:
                latest_status["camera_opened"] = bool(cap is not None and cap.isOpened())

            if cap is None or not cap.isOpened():
                time.sleep(1.0)
                continue

        ret, frame = cap.read()

        if not ret or frame is None:
            with state_lock:
                latest_status["camera_opened"] = False
                latest_status["faces_detected"] = 0
                latest_status["detections"] = []

            try:
                cap.release()
            except Exception:
                pass

            cap = None
            time.sleep(0.2)
            continue

        detections = detector.detect_faces(frame)
        now_iso = datetime.now(timezone.utc).isoformat()

        with state_lock:
            latest_status["camera_opened"] = True
            latest_status["faces_detected"] = len(detections)
            latest_status["detections"] = detections
            if detections:
                latest_status["last_detection_time"] = now_iso

        if detections and (time.time() - last_saved_event_time >= EVENT_COOLDOWN_SECONDS):
            event = save_event(frame, detections)

            with state_lock:
                latest_event = event
                latest_status["last_event_id"] = event["id"]

            last_saved_event_time = time.time()

        time.sleep(0.05)


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
        return jsonify(dict(latest_status))


@app.route("/latest_event", methods=["GET"])
def latest_event_route():
    with state_lock:
        return jsonify({
            "ok": True,
            "event": latest_event
        })


@app.route("/events", methods=["GET"])
def events_route():
    return jsonify({
        "ok": True,
        "events": load_all_events()
    })


@app.route("/image/<filename>", methods=["GET"])
def image_route(filename):
    return send_from_directory(EVENTS_DIR, filename)


if __name__ == "__main__":
    thread = threading.Thread(target=detection_loop, daemon=True)
    thread.start()

    app.run(host="0.0.0.0", port=5002, threaded=True)
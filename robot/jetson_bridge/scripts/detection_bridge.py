#!/usr/bin/env python3
from flask import Flask, jsonify
import cv2
import os
import json
import time
from datetime import datetime, timezone
import threading
import requests

from jetson_bridge.detectors.face_detector import FaceDetector

app = Flask(__name__)

COOLDOWN_SECONDS = 10
STREAM_URL = "http://127.0.0.1:5001/video_feed"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:4000").rstrip("/")
ROBOT_ID = os.environ.get("ROBOT_ID", "")

detector = FaceDetector()

latest_status = {
    "ok": True,
    "camera_opened": False,
    "faces_detected": 0,
    "detections": [],
    "last_event_id": None,
    "last_detection_time": None,
}

latest_event = None
last_event_ts = 0
state_lock = threading.Lock()

def build_event_type(detections):
    any_known = any(det["is_known"] for det in detections)
    return "face_recognized" if any_known else "face_detected_unknown"

def annotate_frame(frame, detections):
    annotated = frame.copy()

    for det in detections:
        x, y, w, h = det["x"], det["y"], det["w"], det["h"]

        color = (0, 255, 0) if det["is_known"] else (0, 0, 255)
        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)

        label = "{} ({}%)".format(det["name"], det["confidence"]) if det["is_known"] else "Unknown Person"

        cv2.putText(
            annotated,
            label,
            (x, y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2
        )

    return annotated

def report_event(frame, detections):
    if not ROBOT_ID:
        raise RuntimeError("ROBOT_ID environment variable is required for event uploads")

    event_type = build_event_type(detections)
    timestamp = datetime.now(timezone.utc).isoformat()
    annotated = annotate_frame(frame, detections)

    ok, encoded = cv2.imencode(".jpg", annotated)
    if not ok:
        raise RuntimeError("Failed to encode event frame as JPEG")

    metadata = {
        "timestamp": timestamp,
        "detections": detections,
        "source": "SentryX_Smart_Vision",
        "is_alert": event_type != "face_recognized",
    }

    response = requests.post(
        "{}/api/events/report".format(BACKEND_URL),
        files={"frame": ("event.jpg", encoded.tobytes(), "image/jpeg")},
        data={
            "robot_id": ROBOT_ID,
            "event_type": event_type,
            "metadata": json.dumps(metadata),
        },
        timeout=15,
    )
    response.raise_for_status()
    body = response.json()

    return {
        "id": body.get("eventId"),
        "type": event_type,
        "is_alert": metadata["is_alert"],
        "timestamp": timestamp,
        "detections": detections,
        "source": "SentryX_Smart_Vision"
    }

def detection_loop():
    global latest_event, last_event_ts

    cap = None

    while True:
        if cap is None or not cap.isOpened():
            cap = cv2.VideoCapture(STREAM_URL)
            time.sleep(1.0)

            with state_lock:
                latest_status["camera_opened"] = cap.isOpened()
                if not cap.isOpened():
                    latest_status["faces_detected"] = 0
                    latest_status["detections"] = []

            if not cap.isOpened():
                time.sleep(1.0)
                continue

        ok, frame = cap.read()

        if not ok or frame is None:
            with state_lock:
                latest_status["camera_opened"] = False
                latest_status["faces_detected"] = 0
                latest_status["detections"] = []

            try:
                cap.release()
            except Exception:
                pass

            cap = None
            time.sleep(0.1)
            continue

        detections = detector.detect_faces(frame)

        with state_lock:
            latest_status["camera_opened"] = True
            latest_status["faces_detected"] = len(detections)
            latest_status["detections"] = detections

            if detections:
                latest_status["last_detection_time"] = datetime.now(timezone.utc).isoformat()

        if detections:
            now = time.time()
            if now - last_event_ts >= COOLDOWN_SECONDS:
                try:
                    event = report_event(frame, detections)
                    last_event_ts = now
                    with state_lock:
                        latest_event = event
                        latest_status["last_event_id"] = event["id"]
                except Exception as error:
                    print("Failed to report event to backend: {}".format(error))

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

    return jsonify({"ok": True, "event": None})

@app.route("/events", methods=["GET"])
def get_events():
    if latest_event is None:
        return jsonify({"ok": True, "events": []})
    return jsonify({"ok": True, "events": [latest_event]})

@app.route("/faces-changed", methods=["POST"])
def faces_changed():
    if detector.sync_from_server():
        detector.load_from_db()
    return jsonify({"ok": True})

if __name__ == "__main__":
    worker = threading.Thread(target=detection_loop, daemon=True)
    worker.start()
    app.run(host="0.0.0.0", port=5002, threaded=True)
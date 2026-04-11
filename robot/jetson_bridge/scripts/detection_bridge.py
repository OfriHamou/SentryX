#!/usr/bin/env python3
import os
import cv2
import json
import time
from datetime import datetime, timezone
import threading
import requests
import numpy as np
import uuid
import logging
from typing import Dict, Any
from flask import Flask, jsonify, send_from_directory

from jetson_bridge.detectors.face_detector import FaceDetector

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

app = Flask(__name__)

STREAM_URL = "http://127.0.0.1:5001/video_feed"
EVENTS_DIR = "/home/jetson/projects/SentryX/robot/jetson_bridge/data/events"
EVENT_COOLDOWN_SECONDS = 5

os.makedirs(EVENTS_DIR, exist_ok=True)

detector = FaceDetector()

state_lock = threading.Lock()

latest_event = None
latest_status: Dict[str, Any] = {
    "ok": True,
    "camera_opened": False,
    "faces_detected": 0,
    "detections": [],
    "last_event_id": None,
    "last_detection_time": None,
}


def open_stream():
    logger.debug(f"Attempting to open cv2.VideoCapture at {STREAM_URL}")
    cap = cv2.VideoCapture(STREAM_URL)
    time.sleep(1.0)
    return cap


def save_event(frame, detections):
    logger.debug(f"Saving event for {len(detections)} detection(s).")
    annotated = frame.copy()

    any_known = any(d.get("is_known", False) for d in detections)
    event_type = "face_recognized" if any_known else "face_detected_unknown"
    is_alert = not any_known
    logger.info(f"Event type determined as: {event_type} (Alert: {is_alert})")

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
    logger.debug(f"Event image saved to {image_path}")

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

    logger.info(f"Event {event_id} successfully saved to {json_path}")
    return event


def load_all_events():
    logger.debug("Loading all events from disk.")
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
    logger.debug(f"Loaded {len(events)} events.")
    return events


def detection_loop():
    global latest_event

    logger.info("Starting detection loop worker...")
    time.sleep(2)

    # Use requests to manually parse the MJPEG stream instead of cv2.VideoCapture
    # This is much more robust on Jetson as cv2 may not have FFmpeg network support compiled
    try:
        logger.info(f"Connecting to MJPEG stream at {STREAM_URL}...")
        stream = requests.get(STREAM_URL, stream=True)
        with state_lock:
            latest_status["camera_opened"] = stream.status_code == 200
        logger.info(f"Stream connected with status code: {stream.status_code}")
    except Exception as e:
        logger.error(f"Failed to connect to stream: {e}")
        with state_lock:
            latest_status["camera_opened"] = False
        return

    logger.debug("Starting frame reading loop...")
    bytes_data = b""
    for chunk in stream.iter_content(chunk_size=4096):
        bytes_data += chunk
        a = bytes_data.find(b'\xff\xd8')
        b = bytes_data.find(b'\xff\xd9')
        if a != -1 and b != -1:
            jpg = bytes_data[a:b+2]
            bytes_data = bytes_data[b+2:]
            frame = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)

            if frame is None:
                logger.warning("Failed to decode JPEG frame.")
                continue

            detections = detector.detect_faces(frame)

            with state_lock:
                latest_status["camera_opened"] = True
                latest_status["faces_detected"] = len(detections)

            if detections:
                logger.info(f"Detected {len(detections)} face(s) in frame.")
                event = save_event(frame, detections)
                with state_lock:
                    latest_status["last_detection_time"] = datetime.now(timezone.utc).isoformat()
                    if event is not None:
                        latest_status["last_event_id"] = event["id"]



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
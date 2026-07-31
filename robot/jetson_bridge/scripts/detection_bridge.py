#!/usr/bin/env python3
from flask import Flask, jsonify, send_from_directory
import cv2
import os
import json
import time
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timezone
import threading

from jetson_bridge.detectors.face_detector import FaceDetector

app = Flask(__name__)

EVENTS_DIR = "/home/jetson/projects/SentryX/robot/jetson_bridge/data/events"
COOLDOWN_SECONDS = 10
STREAM_URL = "http://127.0.0.1:5001/video_feed"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:4000").rstrip("/")
ROBOT_ID = os.environ.get("ROBOT_ID", "be0ca78d-eff9-422b-8e07-7fdb50835185")

os.makedirs(EVENTS_DIR, exist_ok=True)

detector = FaceDetector()

latest_status = {
    "ok": True,
    "camera_opened": False,
    "faces_detected": 0,
    "detections": [],
    "last_event_id": None,
    "last_event_source": None,
    "last_report_error": None,
    "last_detection_time": None,
}

latest_event = None
last_event_ts = 0
state_lock = threading.Lock()

def build_annotated_frame(frame, detections):
    ts = datetime.now(timezone.utc)
    event_id = ts.strftime("%Y-%m-%dT%H-%M-%SZ")

    any_known = any(det["is_known"] for det in detections)
    event_type = "face_recognized" if any_known else "face_detected_unknown"

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

    metadata = {
        "detections": detections,
        "is_alert": not any_known,
        "source": "SentryX_Smart_Vision",
        "reported_at": ts.isoformat()
    }

    return {
        "local_id": event_id,
        "event_type": event_type,
        "metadata": metadata,
        "annotated": annotated,
        "timestamp": ts.isoformat(),
    }

def _encode_multipart_formdata(fields, files):
    boundary = "----SentryXBoundary{}".format(uuid.uuid4().hex)
    chunks = []

    for key, value in fields.items():
        chunks.append("--{}".format(boundary).encode("utf-8"))
        chunks.append('Content-Disposition: form-data; name="{}"'.format(key).encode("utf-8"))
        chunks.append(b"")
        chunks.append(str(value).encode("utf-8"))

    for file_field, filename, content_type, content in files:
        chunks.append("--{}".format(boundary).encode("utf-8"))
        chunks.append(
            'Content-Disposition: form-data; name="{}"; filename="{}"'.format(file_field, filename).encode("utf-8")
        )
        chunks.append("Content-Type: {}".format(content_type).encode("utf-8"))
        chunks.append(b"")
        chunks.append(content)

    chunks.append("--{}--".format(boundary).encode("utf-8"))
    chunks.append(b"")
    body = b"\r\n".join(chunks)
    content_type = "multipart/form-data; boundary={}".format(boundary)
    return body, content_type

def report_event_to_backend(event_payload):
    if not ROBOT_ID:
        return None, "ROBOT_ID is empty"

    ok, encoded = cv2.imencode(".jpg", event_payload["annotated"])
    if not ok:
        return None, "Failed to encode frame"

    fields = {
        "robot_id": ROBOT_ID,
        "event_type": event_payload["event_type"],
        "metadata": json.dumps(event_payload["metadata"]),
    }
    files = [
        (
            "frame",
            "{}.jpg".format(event_payload["local_id"]),
            "image/jpeg",
            encoded.tobytes(),
        )
    ]

    body, content_type = _encode_multipart_formdata(fields, files)
    request = urllib.request.Request(
        "{}/api/events/report".format(BACKEND_URL),
        data=body,
        method="POST",
        headers={"Content-Type": content_type, "Content-Length": str(len(body))},
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response_body = response.read().decode("utf-8")
            parsed = json.loads(response_body) if response_body else {}
            remote_event_id = parsed.get("eventId")
            event = {
                "id": remote_event_id or event_payload["local_id"],
                "type": event_payload["event_type"],
                "is_alert": event_payload["metadata"]["is_alert"],
                "timestamp": event_payload["timestamp"],
                "image_filename": None,
                "detections": event_payload["metadata"]["detections"],
                "source": "SentryX_Backend_Queue",
                "report_status": "api_accepted",
            }
            return event, None
    except urllib.error.HTTPError as error:
        try:
            body = error.read().decode("utf-8")
        except Exception:
            body = ""
        return None, "HTTP {} {} {}".format(error.code, error.reason, body)
    except Exception as error:
        return None, str(error)

def save_event_locally(event_payload):
    image_filename = "{}.jpg".format(event_payload["local_id"])
    json_filename = "{}.json".format(event_payload["local_id"])

    image_path = os.path.join(EVENTS_DIR, image_filename)
    json_path = os.path.join(EVENTS_DIR, json_filename)

    cv2.imwrite(image_path, event_payload["annotated"])

    event = {
        "id": event_payload["local_id"],
        "type": event_payload["event_type"],
        "is_alert": event_payload["metadata"]["is_alert"],
        "timestamp": event_payload["timestamp"],
        "image_filename": image_filename,
        "detections": event_payload["metadata"]["detections"],
        "source": "SentryX_Smart_Vision",
        "report_status": "local_fallback"
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(event, f, indent=2)

    return event

def save_event(frame, detections):
    global latest_event, last_event_ts

    now = time.time()
    if now - last_event_ts < COOLDOWN_SECONDS:
        return None

    event_payload = build_annotated_frame(frame, detections)
    reported_event, report_error = report_event_to_backend(event_payload)

    if reported_event is None:
        event = save_event_locally(event_payload)
        with state_lock:
            latest_status["last_report_error"] = report_error
            latest_status["last_event_source"] = "local"
    else:
        event = reported_event
        with state_lock:
            latest_status["last_report_error"] = None
            latest_status["last_event_source"] = "backend"

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
            event = save_event(frame, detections)

            if event is not None:
                with state_lock:
                    latest_event = event
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

@app.route("/image/<filename>", methods=["GET"])
def get_image(filename):
    return send_from_directory(EVENTS_DIR, filename)

@app.route("/faces-changed", methods=["POST"])
def faces_changed():
    if detector.sync_from_server():
        detector.load_from_db()
    return jsonify({"ok": True})

if __name__ == "__main__":
    worker = threading.Thread(target=detection_loop, daemon=True)
    worker.start()
    app.run(host="0.0.0.0", port=5002, threaded=True)
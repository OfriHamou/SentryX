#!/usr/bin/env python3
from flask import Flask, Response, jsonify
import cv2
import threading
import time

app = Flask(__name__)

JPEG_QUALITY = 70
OUTPUT_WIDTH = 1280
OUTPUT_HEIGHT = 720

camera = None
camera_lock = threading.Lock()


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


def open_camera():
    cap = cv2.VideoCapture(build_pipeline(), cv2.CAP_GSTREAMER)
    time.sleep(2)
    return cap


def get_camera():
    global camera
    with camera_lock:
        if camera is None or not camera.isOpened():
            camera = open_camera()
        return camera


def generate_frames():
    while True:
        cap = get_camera()

        ok, frame = cap.read()
        if not ok or frame is None:
            time.sleep(0.1)
            continue

        ok, buffer = cv2.imencode(
            ".jpg",
            frame,
            [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
        )

        if not ok:
            continue

        jpg_bytes = buffer.tobytes()

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n" + jpg_bytes + b"\r\n"
        )


@app.route("/health", methods=["GET"])
def health():
    cap = get_camera()
    return jsonify({
        "ok": True,
        "camera_opened": bool(cap is not None and cap.isOpened()),
        "source": "nvarguscamerasrc"
    })


@app.route("/video_feed", methods=["GET"])
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, threaded=True)
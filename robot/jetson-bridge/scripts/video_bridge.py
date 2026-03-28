#!/usr/bin/env python3
from flask import Flask, Response, jsonify
import cv2
import threading
import time

app = Flask(__name__)

CAMERA_INDEX = 0
JPEG_QUALITY = 70
OUTPUT_WIDTH = 960
OUTPUT_HEIGHT = 720

camera = None
camera_lock = threading.Lock()


def open_camera():
    cap = cv2.VideoCapture(CAMERA_INDEX)

    # Try to reduce output size from the very large default frame
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, OUTPUT_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, OUTPUT_HEIGHT)

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

        # Resize again just in case the camera ignores the requested size
        frame = cv2.resize(frame, (OUTPUT_WIDTH, OUTPUT_HEIGHT))

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
        "source": "/dev/video0"
    })


@app.route("/video_feed", methods=["GET"])
def video_feed():
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, threaded=True)
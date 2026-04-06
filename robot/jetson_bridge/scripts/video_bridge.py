#!/usr/bin/env python3
from flask import Flask, Response, jsonify
import cv2
import threading
import time

app = Flask(__name__)

JPEG_QUALITY = 70
OUTPUT_WIDTH = 1280
OUTPUT_HEIGHT = 720

current_frame = None
frame_condition = threading.Condition()
camera_opened_status = False


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


def camera_worker():
    global current_frame, camera_opened_status
    cap = cv2.VideoCapture(build_pipeline(), cv2.CAP_GSTREAMER)
    time.sleep(2)

    while True:
        ok, frame = cap.read()
        if not ok or frame is None:
            camera_opened_status = False
            time.sleep(0.1)
            continue

        camera_opened_status = True
        ok, buffer = cv2.imencode(
            ".jpg",
            frame,
            [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
        )

        if ok:
            with frame_condition:
                current_frame = buffer.tobytes()
                frame_condition.notify_all()

# Start the background capture thread
threading.Thread(target=camera_worker, daemon=True).start()


def generate_frames():
    while True:
        with frame_condition:
            frame_condition.wait()
            jpg_bytes = current_frame

        if jpg_bytes:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg_bytes + b"\r\n"
            )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "camera_opened": camera_opened_status,
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
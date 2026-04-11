#!/usr/bin/env python3
from flask import Flask, Response, jsonify
import cv2
import threading
import time

app = Flask(__name__)

JPEG_QUALITY = 90

camera = None
camera_lock = threading.Lock()

latest_jpeg = None
latest_frame_time = None
frame_cond = threading.Condition()

capture_thread = None


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


def capture_loop():
    global latest_jpeg, latest_frame_time

    while True:
        cap = get_camera()
        ok, frame = cap.read()

        if not ok or frame is None:
            time.sleep(0.05)
            continue

        ok, buffer = cv2.imencode(
            ".jpg",
            frame,
            [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
        )
        if not ok:
            continue

        jpg_bytes = buffer.tobytes()

        with frame_cond:
            latest_jpeg = jpg_bytes
            latest_frame_time = time.time()
            frame_cond.notify_all()


def ensure_capture_thread():
    global capture_thread
    with camera_lock:
        if capture_thread is None or not capture_thread.is_alive():
            capture_thread = threading.Thread(target=capture_loop, daemon=True)
            capture_thread.start()


def generate_frames():
    ensure_capture_thread()

    while True:
        with frame_cond:
            if latest_jpeg is None:
                frame_cond.wait(timeout=1.0)
                continue
            jpg_bytes = latest_jpeg

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Cache-Control: no-cache\r\n\r\n" +
            jpg_bytes +
            b"\r\n"
        )


@app.route("/health", methods=["GET"])
def health():
    ensure_capture_thread()
    cap = get_camera()
    return jsonify({
        "ok": True,
        "camera_opened": bool(cap is not None and cap.isOpened()),
        "source": "nvarguscamerasrc",
        "has_frame": latest_jpeg is not None,
        "last_frame_time": latest_frame_time,
    })


@app.route("/video_feed", methods=["GET"])
def video_feed():
    ensure_capture_thread()
    response = Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["Connection"] = "keep-alive"
    return response


if __name__ == "__main__":
    ensure_capture_thread()
    app.run(host="0.0.0.0", port=5001, threaded=True)
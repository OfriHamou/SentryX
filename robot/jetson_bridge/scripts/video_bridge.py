#!/usr/bin/env python3
import cv2
import threading
import time
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import uvicorn


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background capture thread
    threading.Thread(target=camera_worker, daemon=True).start()
    yield

app = FastAPI(lifespan=lifespan)

JPEG_QUALITY = 70
OUTPUT_WIDTH = 1280
OUTPUT_HEIGHT = 720

current_frame = None
current_frame_id = 0
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
    global current_frame, current_frame_id, camera_opened_status
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
            current_frame = buffer.tobytes()
            current_frame_id += 1


async def generate_frames():
    last_id = -1
    while True:
        # Check if a new frame is available by looking at the frame ID
        if current_frame_id == last_id or current_frame is None:
            await asyncio.sleep(0.01)  # Yield to event loop, 10ms poll
            continue

        last_id = current_frame_id
        jpg_bytes = current_frame

        if jpg_bytes is not None:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpg_bytes + b"\r\n"
            )


@app.get("/health")
def health():
    return {
        "ok": True,
        "camera_opened": camera_opened_status,
        "source": "nvarguscamerasrc"
    }


@app.get("/video_feed")
def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)

#!/usr/bin/env python3
import cv2
import time
import sys
sys.path.append("/home/jetson/projects/SentryX/robot/jetson-bridge/detectors")
from face_detector import FaceDetector

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

def main():
    detector = FaceDetector()

    cap = cv2.VideoCapture(build_pipeline(), cv2.CAP_GSTREAMER)
    time.sleep(2)

    ok, frame = cap.read()
    print("camera_opened:", cap.isOpened())
    print("frame_ok:", ok)

    if not ok or frame is None:
        print("No frame received")
        cap.release()
        return

    detections = detector.detect_faces(frame)
    print("detections:", detections)

    for det in detections:
        x = det["x"]
        y = det["y"]
        w = det["w"]
        h = det["h"]
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

    cv2.imwrite("/tmp/face_detector_test.jpg", frame)
    print("saved: /tmp/face_detector_test.jpg")

    cap.release()

if __name__ == "__main__":
    main()
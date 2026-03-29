#!/usr/bin/env python3
import cv2
import os


class FaceDetector:
    def __init__(self, cascade_path=None, detect_width=300, detect_height=300):
        self.detect_width = detect_width
        self.detect_height = detect_height

        if cascade_path is None:
            candidate_paths = [
                "/usr/share/opencv4/haarcascades/haarcascade_profileface.xml",
                "/usr/share/opencv/haarcascades/haarcascade_profileface.xml",
                "haarcascade_profileface.xml",
            ]

            for path in candidate_paths:
                if os.path.exists(path):
                    cascade_path = path
                    break

        if cascade_path is None:
            raise RuntimeError(
                "Could not find haarcascade_profileface.xml. "
                "Please locate it on the robot and set cascade_path explicitly."
            )

        self.face_cascade = cv2.CascadeClassifier(cascade_path)

        if self.face_cascade.empty():
            raise RuntimeError(f"Failed to load cascade classifier: {cascade_path}")

        self.cascade_path = cascade_path

    def detect_faces(self, frame):
        if frame is None:
            return []

        original_h, original_w = frame.shape[:2]

        resized = cv2.resize(frame, (self.detect_width, self.detect_height))
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        faces = self.face_cascade.detectMultiScale(gray)

        detections = []

        scale_x = original_w / float(self.detect_width)
        scale_y = original_h / float(self.detect_height)

        for (x, y, w, h) in faces:
            detections.append({
                "x": int(x * scale_x),
                "y": int(y * scale_y),
                "w": int(w * scale_x),
                "h": int(h * scale_y),
            })

        return detections
#!/usr/bin/env python3
import cv2


class FaceDetector:
    def __init__(self, cascade_path=None, detect_width=300, detect_height=300):
        self.detect_width = detect_width
        self.detect_height = detect_height

        if cascade_path is None:
            cascade_path = cv2.data.haarcascades + "haarcascade_profileface.xml"

        self.face_cascade = cv2.CascadeClassifier(cascade_path)

        if self.face_cascade.empty():
            raise RuntimeError(f"Failed to load cascade classifier: {cascade_path}")

    def detect_faces(self, frame):
        """
        Input:
            frame: BGR image (numpy array)

        Output:
            list of detections like:
            [
                {
                    "x": 100,
                    "y": 80,
                    "w": 120,
                    "h": 120
                }
            ]
        """
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
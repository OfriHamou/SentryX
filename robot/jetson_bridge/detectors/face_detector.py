import os
import json
import sqlite3

import cv2
import numpy as np
import face_recognition


class FaceDetector:
    def __init__(self, db_path="/home/jetson/projects/SentryX/robot/jetson_bridge/data/faces_data.db"):
        self.db_path = db_path
        self.known_encodings = []
        self.known_names = []
        self.face_cascade = self._load_face_cascade()
        self._load_known_faces()

    def _load_face_cascade(self):
        cascade_candidates = [
            "/usr/share/opencv4/haarcascades/haarcascade_frontalface_default.xml",
            "/usr/share/opencv/haarcascades/haarcascade_frontalface_default.xml",
            "/usr/local/share/opencv4/haarcascades/haarcascade_frontalface_default.xml",
        ]

        for candidate in cascade_candidates:
            if os.path.exists(candidate):
                cascade = cv2.CascadeClassifier(candidate)
                if not cascade.empty():
                    print("Loaded Haar cascade from: {}".format(candidate))
                    return cascade

        raise RuntimeError("Could not load haarcascade_frontalface_default.xml")

    def _load_known_faces(self):
        if not os.path.exists(self.db_path):
            print("Face DB not found at: {}".format(self.db_path))
            return

        conn = sqlite3.connect(self.db_path)
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name, embedding FROM users")
            rows = cursor.fetchall()

            for name, embedding_json in rows:
                try:
                    embedding = np.array(json.loads(embedding_json), dtype=np.float64)
                    if embedding.shape[0] != 128:
                        continue

                    self.known_names.append(name)
                    self.known_encodings.append(embedding)
                except Exception as e:
                    print("Failed to load embedding for {}: {}".format(name, e))

            print("Successfully loaded {} faces from DB.".format(len(self.known_names)))
        except Exception as e:
            print("Failed to load faces DB: {}".format(e))
        finally:
            conn.close()

    def detect_faces(self, frame):
        if frame is None:
            return []

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(60, 60)
        )

        rgb_frame = frame[:, :, ::-1]
        detections = []

        for (x, y, w, h) in faces:
            pad = int(0.15 * max(w, h))

            left = max(0, x - pad)
            top = max(0, y - pad)
            right = min(frame.shape[1], x + w + pad)
            bottom = min(frame.shape[0], y + h + pad)

            location = (top, right, bottom, left)

            name = "Unknown"
            confidence = 0
            is_known = False

            encodings = face_recognition.face_encodings(rgb_frame, [location])

            if encodings and self.known_encodings:
                encoding = encodings[0]
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_match_index = np.argmin(distances)

                if distances[best_match_index] < 0.5:
                    name = self.known_names[best_match_index]
                    confidence = round((1 - distances[best_match_index]) * 100, 2)
                    is_known = True

            detections.append({
                "x": int(left),
                "y": int(top),
                "w": int(right - left),
                "h": int(bottom - top),
                "name": name,
                "confidence": confidence,
                "is_known": is_known
            })

        return detections
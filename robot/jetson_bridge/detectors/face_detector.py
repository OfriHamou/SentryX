import face_recognition
import sqlite3
import numpy as np
import json
import cv2


class FaceDetector:
    def __init__(self, db_path: str = "/home/jetson/projects/SentryX/robot/jetson_bridge/data/faces_data.db"):
        self.db_path = db_path
        self.known_encodings = []
        self.known_names = []
        self.load_database()

    def load_database(self) -> None:
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name, embedding FROM users")
            for row in cursor.fetchall():
                self.known_names.append(row[0])
                self.known_encodings.append(np.array(json.loads(row[1])))
            conn.close()
            print(f"Successfully loaded {len(self.known_names)} faces from DB.")
        except Exception as e:
            print(f"Error loading face database: {e}")

    def detect_faces(self, frame) -> list[dict]:
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        # cv2 works with GBR coloring, we will convert to standard RGB
        rgb_small_frame = small_frame[:, :, ::-1]

        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        detections = []
        for location, encoding in zip(face_locations, face_encodings):
            name = "Unknown"
            confidence = 0
            is_known = False

            if self.known_encodings:
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_match_index = np.argmin(distances)
                if distances[best_match_index] < 0.5:
                    name = self.known_names[best_match_index]
                    confidence = round((1 - distances[best_match_index]) * 100, 2)
                    is_known = True

            top, right, bottom, left = location
            detections.append({
                "x": left * 4, "y": top * 4,
                "w": (right - left) * 4, "h": (bottom - top) * 4,
                "name": name,
                "confidence": confidence,
                "is_known": is_known
            })
        return detections

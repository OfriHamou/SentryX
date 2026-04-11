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

    def detect_faces(self, frame):
        """
        Debug-oriented version:
        - tries full frame first
        - if nothing is found, tries half-size with more upsampling
        - returns boxes even if encoding fails
        """

        attempts = [
            {
                "name": "full_frame",
                "image": frame,
                "scale": 1.0,
                "upsample": 1,
            },
            {
                "name": "half_frame",
                "image": cv2.resize(frame, (0, 0), fx=0.5, fy=0.5),
                "scale": 0.5,
                "upsample": 2,
            },
        ]

        chosen_rgb = None
        chosen_locations = []
        chosen_scale = 1.0

        for attempt in attempts:
            img = attempt["image"]
            rgb = img[:, :, ::-1]

            locations = face_recognition.face_locations(
                rgb,
                number_of_times_to_upsample=attempt["upsample"],
                model="hog"
            )

            print(
                "[detect_faces]",
                attempt["name"],
                "scale=", attempt["scale"],
                "upsample=", attempt["upsample"],
                "locations=", len(locations)
            )

            if locations:
                chosen_rgb = rgb
                chosen_locations = locations
                chosen_scale = attempt["scale"]
                break

        if not chosen_locations:
            return []

        inv = int(round(1.0 / chosen_scale))
        detections = []

        for location in chosen_locations:
            name = "Unknown"
            confidence = 0
            is_known = False

            encodings = face_recognition.face_encodings(chosen_rgb, [location])

            print("[detect_faces] location=", location, "encodings=", len(encodings))

            if encodings and self.known_encodings:
                encoding = encodings[0]
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_match_index = np.argmin(distances)

                if distances[best_match_index] < 0.5:
                    name = self.known_names[best_match_index]
                    confidence = round((1 - distances[best_match_index]) * 100, 2)
                    is_known = True

            top, right, bottom, left = location
            detections.append({
                "x": left * inv,
                "y": top * inv,
                "w": (right - left) * inv,
                "h": (bottom - top) * inv,
                "name": name,
                "confidence": confidence,
                "is_known": is_known
            })

        return detections

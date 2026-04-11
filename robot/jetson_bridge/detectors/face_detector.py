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
        Test version:
        - use OpenCV Haar cascade for face detection
        - use face_recognition only for encoding + matching
        """

        if not hasattr(self, "_haar_face"):
            self._haar_face = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        faces = self._haar_face.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80)
        )

        print("[detect_faces] haar faces =", len(faces))

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
            print("[detect_faces] location =", location, "encodings =", len(encodings))

            if encodings and self.known_encodings:
                encoding = encodings[0]
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_match_index = np.argmin(distances)

                if distances[best_match_index] < 0.5:
                    name = self.known_names[best_match_index]
                    confidence = round((1 - distances[best_match_index]) * 100, 2)
                    is_known = True

            detections.append({
                "x": left,
                "y": top,
                "w": right - left,
                "h": bottom - top,
                "name": name,
                "confidence": confidence,
                "is_known": is_known
            })

        return detections

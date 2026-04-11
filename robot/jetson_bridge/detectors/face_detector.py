import face_recognition
import sqlite3
import logging

import numpy as np
import json
import cv2

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)


class FaceDetector:
    def __init__(self, db_path="/home/jetson/projects/SentryX/robot/jetson_bridge/data/faces_data.db"):
        self.db_path = db_path
        self.known_encodings = []
        self.known_names = []
        logger.info(f"Initializing FaceDetector with DB path: {self.db_path}")
        self._load_known_faces()

    def _load_known_faces(self):
        if not os.path.exists(self.db_path):
            logger.error("Face DB not found at: {}".format(self.db_path))
            return

        conn = sqlite3.connect(self.db_path)
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name, embedding FROM users")
            rows = cursor.fetchall()
            logger.debug(f"Fetched {len(rows)} rows from database.")

            for name, embedding_json in rows:
                try:
                    embedding = np.array(json.loads(embedding_json), dtype=np.float64)
                    if embedding.shape[0] != 128:
                        logger.warning(f"Invalid embedding shape for {name}: {embedding.shape}")
                        continue

                    self.known_names.append(name)
                    self.known_encodings.append(embedding)
                    logger.debug(f"Loaded valid embedding for user: {name}")
                except Exception as e:
                    logger.error("Failed to load embedding for {}: {}".format(name, e))

            logger.info("Successfully loaded {} faces from DB.".format(len(self.known_names)))
        except Exception as e:
            logger.error("Failed to load faces DB: {}".format(e))
        finally:
            conn.close()
            logger.debug("Database connection closed.")

    def detect_faces(self, frame):
        if frame is None:
            logger.warning("Received empty frame for detection.")
            return []

        logger.debug("Starting face detection on new frame.")
        rgb_frame = frame[:, :, ::-1]

        # Use CNN model for face detection to leverage the Jetson's NVIDIA GPU hardware acceleration
        logger.debug("Running face_recognition.face_locations (Model: CNN)...")
        face_locations = face_recognition.face_locations(rgb_frame, model="cnn")
        logger.debug(f"Found {len(face_locations)} face(s) in frame.")

        logger.debug("Extracting face encodings...")
        face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

        detections = []

        for (top, right, bottom, left), encoding in zip(face_locations, face_encodings):
            name = "Unknown"
            confidence = 0
            is_known = False

            if self.known_encodings:
                distances = face_recognition.face_distance(self.known_encodings, encoding)
                best_match_index = int(np.argmin(distances))
                best_distance = float(distances[best_match_index])
                logger.debug(f"Face distance to best match ({self.known_names[best_match_index]}): {best_distance:.4f}")

                if best_distance < 0.5:
                    name = self.known_names[best_match_index]
                    confidence = round((1 - best_distance) * 100, 2)
                    is_known = True
                    logger.info(f"Recognized known face: {name} with confidence: {confidence}%")
                else:
                    logger.info(f"Face detected but unrecognized. Best match was {self.known_names[best_match_index]} (distance: {best_distance:.4f})")
            else:
                logger.warning("No known encodings loaded. Recognizing all faces as Unknown.")

            top, right, bottom, left = location

            detections.append({
                "x": left * 4,
                "y": top * 4,
                "w": (right - left) * 4,
                "h": (bottom - top) * 4,
                "name": name,
                "confidence": confidence,
                "is_known": is_known
            })

        logger.debug(f"Finished processing frame. Total detections returning: {len(detections)}")
        return detections


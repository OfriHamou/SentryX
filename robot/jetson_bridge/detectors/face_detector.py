""" import face_recognition
import sqlite3
import numpy as np
import json
import cv2


class FaceDetector:
    def __init__(self, db_path="/home/jetson/projects/SentryX/robot/jetson_bridge/data/faces_data.db"):
        self.db_path = db_path
        self.known_encodings = []
        self.known_names = []
        self.load_database()

    def load_database(self):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name, embedding FROM users")

            for row in cursor.fetchall():
                self.known_names.append(row[0])
                self.known_encodings.append(np.array(json.loads(row[1])))

            conn.close()
            print("Successfully loaded {} faces from DB.".format(len(self.known_names)))
        except Exception as e:
            print("Error loading face database: {}".format(e))

    def detect_faces(self, frame):
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)

        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        rgb_small_frame = np.ascontiguousarray(rgb_small_frame)

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
                "x": left * 4,
                "y": top * 4,
                "w": (right - left) * 4,
                "h": (bottom - top) * 4,
                "name": name,
                "confidence": confidence,
                "is_known": is_known
            })

        return detections """

import face_recognition
import sqlite3
import numpy as np
import json
import cv2
import os
import time
import threading
import urllib.request
from io import BytesIO


class FaceDetector:
    def __init__(self, db_path=None, backend_url=None, robot_id=None, refresh_interval=300):
        self.db_path = db_path or os.environ.get(
            "FACES_DB_PATH", "/home/jetson/projects/SentryX/robot/jetson_bridge/data/faces_data.db")
        self.backend_url = (backend_url or os.environ.get("BACKEND_URL", "http://localhost:4000")).rstrip("/")
        self.robot_id = robot_id or os.environ.get("ROBOT_ID", "")
        self.refresh_interval = int(os.environ.get("FACES_REFRESH_INTERVAL", refresh_interval))  # seconds

        self.known_encodings = []
        self.known_names = []
        self._lock = threading.Lock()

        # boot: try to sync the local DB from the server, then load it (works even if offline)
        self.sync_from_server()
        self.load_from_db()

        # keep it fresh in the background
        if self.refresh_interval > 0:
            threading.Thread(target=self._refresh_loop, daemon=True).start()

    def sync_from_server(self):
        """Pull faces from the server, compute encodings, rebuild the local sqlite. Skips on failure."""
        try:
            url = "{}/api/faces/by-robot/{}".format(self.backend_url, self.robot_id)
            with urllib.request.urlopen(url, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            rows = []  # (name, embedding_json)
            for person in data.get("faces", []):
                name = person.get("name", "Unknown")
                for img_path in person.get("images", []):
                    try:
                        with urllib.request.urlopen(self.backend_url + img_path, timeout=10) as img_resp:
                            image = face_recognition.load_image_file(BytesIO(img_resp.read()))
                        encs = face_recognition.face_encodings(image)
                        if encs:
                            rows.append((name, json.dumps(encs[0].tolist())))
                    except Exception as e:
                        print("Skipping image {}: {}".format(img_path, e))

            # rebuild local DB (same schema Dor uses)
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("DROP TABLE IF EXISTS users")
            cur.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, embedding TEXT)")
            cur.executemany("INSERT INTO users (name, embedding) VALUES (?, ?)", rows)
            conn.commit()
            conn.close()
            print("Synced {} encodings from server into local DB.".format(len(rows)))
            return True
        except Exception as e:
            print("Sync failed (keeping existing local DB): {}".format(e))
            return False

    def load_from_db(self):
        """Load encodings from the local sqlite into memory (Dor's original logic)."""
        encodings, names = [], []
        try:
            conn = sqlite3.connect(self.db_path)
            cur = conn.cursor()
            cur.execute("SELECT name, embedding FROM users")
            for row in cur.fetchall():
                names.append(row[0])
                encodings.append(np.array(json.loads(row[1])))
            conn.close()
            print("Loaded {} faces from local DB.".format(len(names)))
        except Exception as e:
            print("Error loading local DB: {}".format(e))
        with self._lock:
            self.known_encodings = encodings
            self.known_names = names

    def _refresh_loop(self):
        while True:
            time.sleep(self.refresh_interval)
            if self.sync_from_server():
                self.load_from_db()

    def detect_faces(self, frame):
        small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
        rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
        rgb_small_frame = np.ascontiguousarray(rgb_small_frame)

        face_locations = face_recognition.face_locations(rgb_small_frame)
        face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

        with self._lock:
            known_encodings = list(self.known_encodings)
            known_names = list(self.known_names)

        detections = []
        for location, encoding in zip(face_locations, face_encodings):
            name = "Unknown"
            confidence = 0
            is_known = False
            if known_encodings:
                distances = face_recognition.face_distance(known_encodings, encoding)
                best_match_index = np.argmin(distances)
                if distances[best_match_index] < 0.5:
                    name = known_names[best_match_index]
                    confidence = round((1 - distances[best_match_index]) * 100, 2)
                    is_known = True
            top, right, bottom, left = location
            detections.append({
                "x": left * 4, "y": top * 4, "w": (right - left) * 4, "h": (bottom - top) * 4,
                "name": name, "confidence": confidence, "is_known": is_known,
            })
        return detections
#!/usr/bin/env python3
import cv2
import face_recognition
import numpy as np
import sqlite3
import json
import time
import os

DB_PATH = "/home/jetson/projects/SentryX/robot/jetson-bridge/data/faces_data.db"
OUTPUT_PATH = "/tmp/face_recognition_test.jpg"


def load_known_faces(db_path):
    known_encodings = []
    known_names = []

    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        return [], []

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name, embedding FROM users")
    rows = cursor.fetchall()

    for row in rows:
        known_names.append(row[0])
        known_encodings.append(np.array(json.loads(row[1])))

    conn.close()
    print(f"Loaded {len(known_names)} faces from database.")
    return known_encodings, known_names


def build_pipeline():
    """ה-Pipeline האופטימלי למצלמת ה-CSI של ה-Jetson"""
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
    known_encodings, known_names = load_known_faces(DB_PATH)
    cap = cv2.VideoCapture(build_pipeline(), cv2.CAP_GSTREAMER)
    time.sleep(2)

    ok, frame = cap.read()
    if not ok or frame is None:
        print("Failed to capture image")
        cap.release()
        return

    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)
    rgb_small_frame = small_frame[:, :, ::-1]

    face_locations = face_recognition.face_locations(rgb_small_frame)
    face_encodings = face_recognition.face_encodings(rgb_small_frame, face_locations)

    print(f"Found {len(face_locations)} faces in frame.")

    for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
        name = "Unknown"
        confidence = 0
        color = (0, 0, 255)

        if known_encodings:
            face_distances = face_recognition.face_distance(known_encodings, face_encoding)
            best_match_index = np.argmin(face_distances)

            if face_distances[best_match_index] < 0.5:
                name = known_names[best_match_index]
                confidence = (1 - face_distances[best_match_index]) * 100
                color = (0, 255, 0)

        top, right, bottom, left = top * 4, right * 4, bottom * 4, left * 4

        cv2.rectangle(frame, (left, top), (right, bottom), color, 2)

        label = f"{name} ({confidence:.1f}%)" if name != "Unknown" else "Unknown"
        cv2.putText(frame, label, (left, top - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    cv2.imwrite(OUTPUT_PATH, frame)
    print(f"Result saved to: {OUTPUT_PATH}")

    cap.release()


if __name__ == "__main__":
    main()
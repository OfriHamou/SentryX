import face_recognition
import sqlite3
import os
import json


def create_face_db(images_folder_path: str, db_path: str = 'faces_data.db'):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('DROP TABLE IF EXISTS users')  # Delete the table if exists
    cursor.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, embedding TEXT)')

    for filename in os.listdir(images_folder_path):
        if filename.endswith((".jpg", ".png", ".jpeg")):
            path = os.path.join(images_folder_path, filename)
            # Person's name from the file, meaning multiple Dor's images need to be
            # "Dor_1.jpeg", "Dor_2.jpeg" etc ..
            name = os.path.splitext(filename)[0].split('_')[0].lower().capitalize()
            print(f"Processing: [{name}]")
            image = face_recognition.load_image_file(path)
            encodings = face_recognition.face_encodings(image)

            if len(encodings) > 0:
                encoding_json = json.dumps(encodings[0].tolist())
                cursor.execute("INSERT INTO users (name, embedding) VALUES (?, ?)", (name, encoding_json))
                print(f"[{name}] was added succesfully")
            else:
                print(f"[{name}] was not added to database, because we culdn't find a face")
        else:
            print(f"Couldn't process [{filename}] as it doesn't have supported suffix")

    conn.commit()
    conn.close()
    print(f"Finish createing DB with name [{db_path}]")


if __name__ == '__main__':
    # Step 1 - build the DB
    create_face_db(
        images_folder_path=r'C:\Users\Ofri\Desktop\CS Colman\3rd year\Final_CS_Project\SentryX\faces',
        db_path=r'C:\Users\Ofri\Desktop\CS Colman\3rd year\Final_CS_Project\SentryX\faces_data.db'
    )
    # Step 2 - copy to robot
    # scp faces_data.db jetson_user@<jetson_ip>:/home/jetson_user/robot_project/

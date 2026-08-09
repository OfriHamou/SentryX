#!/usr/bin/env python3
"""
Auto Patrol Bridge

Implements obstacle-avoidance autonomous patrol mode for SentryX.
Reads from video_bridge MJPEG stream, runs TensorFlow object detection,
and sends movement commands to web_bridge via HTTP.

Limitation: Uses Yahboom COCO model which detects objects (people, chairs, etc.)
but NOT walls, glass, ledges, or every physical obstacle.
"""

import os
import sys
import json
import time
import threading
import urllib.request
import urllib.error
from io import BytesIO
from flask import Flask, jsonify
import cv2
import numpy as np

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from jetson_bridge.detectors.object_detector import YahboomObjectDetector

app = Flask(__name__)

# --- Configuration ---
VIDEO_STREAM_URL = "http://127.0.0.1:5001/video_feed"
WEB_BRIDGE_URL = "http://127.0.0.1:5000"

# Movement constants (m/s, radians, seconds)
FORWARD_SPEED = 0.35
REVERSE_SPEED = -0.30
TURN_ROTATION = 0.65
REVERSE_SECONDS = 0.45
TURN_SECONDS = 0.70
INFERENCE_INTERVAL_SECONDS = 0.35

# Obstacle detection constants
OBSTACLE_SCORE_THRESHOLD = 0.50
OBSTACLE_CENTER_MIN = 0.20
OBSTACLE_CENTER_MAX = 0.80
OBSTACLE_YMAX_MIN = 0.50
OBSTACLE_AREA_MIN = 0.08
CONSECUTIVE_OBSTACLE_THRESHOLD = 2  # detections in a row

# Timeouts
FRAME_TIMEOUT_SECONDS = 1.0
INFERENCE_TIMEOUT_SECONDS = 2.0

# --- Shared state ---
detector = None
detector_lock = threading.Lock()

latest_frame = None
latest_frame_time = None
frame_lock = threading.Lock()

active = False
active_lock = threading.Lock()

stream_enabled = False
stream_enabled_lock = threading.Lock()
stream_thread = None

last_action = "idle"
action_lock = threading.Lock()

last_detection = None
detection_lock = threading.Lock()

obstacle_counter = 0
turn_direction = -1.0  # -1 for left, 1 for right; alternates

last_error = None
error_lock = threading.Lock()

model_loaded = False
stream_connected = False

def is_stream_enabled():
    with stream_enabled_lock:
        return stream_enabled

def set_stream_enabled(enabled):
    global stream_enabled, stream_connected, latest_frame, latest_frame_time
    with stream_enabled_lock:
        stream_enabled = enabled
    if not enabled:
        stream_connected = False
        with frame_lock:
            latest_frame = None
            latest_frame_time = None

def set_error(msg):
    global last_error
    with error_lock:
        last_error = msg
    print("ERROR: {}".format(msg))

def http_request(url, method="GET", json_data=None):
    """Make HTTP request, return response or None on error."""
    try:
        if method == "GET":
            response = urllib.request.urlopen(url, timeout=3)
        else:  # POST
            req = urllib.request.Request(url, method=method)
            if json_data:
                req.add_header('Content-Type', 'application/json')
                data = json.dumps(json_data).encode('utf-8')
                response = urllib.request.urlopen(req, data=data, timeout=3)
            else:
                response = urllib.request.urlopen(req, timeout=3)
        
        result = response.read().decode('utf-8')
        return json.loads(result)
    except Exception as e:
        set_error("HTTP request failed: {}".format(e))
        return None

def read_mjpeg_stream():
    """
    Read MJPEG stream from video_bridge and keep latest frame.
    Runs in background thread.
    """
    global latest_frame, latest_frame_time, stream_connected
    
    boundary = b'--frame'
    
    while True:
        if not is_stream_enabled():
            time.sleep(0.1)
            continue

        try:
            response = urllib.request.urlopen(VIDEO_STREAM_URL, timeout=5)
            stream_connected = True
            
            buffer = b''
            
            while True:
                if not is_stream_enabled():
                    stream_connected = False
                    try:
                        response.close()
                    except Exception:
                        pass
                    break

                chunk = response.read(4096)
                if not chunk:
                    break
                
                buffer += chunk
                
                # Look for frame boundary
                idx = buffer.find(boundary)
                if idx == -1:
                    continue
                
                # Find content
                header_end = buffer.find(b'\r\n\r\n', idx)
                if header_end == -1:
                    continue
                
                content_start = header_end + 4
                next_boundary = buffer.find(boundary, content_start)
                if next_boundary == -1:
                    continue
                
                # Extract JPEG
                jpeg_data = buffer[content_start:next_boundary-2]
                
                # Decode and store
                try:
                    frame = cv2.imdecode(np.frombuffer(jpeg_data, np.uint8), cv2.IMREAD_COLOR)
                    if frame is not None:
                        with frame_lock:
                            latest_frame = frame
                            latest_frame_time = time.time()
                except Exception as e:
                    pass
                
                # Keep buffer small
                buffer = buffer[next_boundary:]
        
        except Exception as e:
            stream_connected = False
            if is_stream_enabled():
                set_error("Video stream error: {}".format(e))
            time.sleep(1)

def ensure_stream_thread():
    global stream_thread
    if stream_thread is None or not stream_thread.is_alive():
        stream_thread = threading.Thread(target=read_mjpeg_stream, daemon=True)
        stream_thread.start()

def wait_for_stream_frame(timeout_seconds):
    start = time.time()
    while time.time() - start < timeout_seconds:
        frame, _ = get_latest_frame()
        if frame is not None:
            return True
        time.sleep(0.05)
    return False

def load_detector():
    """Load TensorFlow object detector from environment variables."""
    global detector, model_loaded
    
    model_path = os.environ.get("YAHBOOM_OBJECT_MODEL_PATH")
    label_path = os.environ.get("YAHBOOM_COCO_LABEL_PATH")
    
    if not model_path or not label_path:
        set_error("YAHBOOM_OBJECT_MODEL_PATH or YAHBOOM_COCO_LABEL_PATH not set")
        model_loaded = False
        return False
    
    try:
        with detector_lock:
            detector = YahboomObjectDetector(model_path, label_path)
        model_loaded = True
        return True
    except Exception as e:
        set_error("Failed to load detector: {}".format(e))
        model_loaded = False
        return False

def get_latest_frame():
    """Get latest frame if recent enough."""
    with frame_lock:
        if latest_frame is None:
            return None, None
        
        elapsed = time.time() - latest_frame_time
        if elapsed > FRAME_TIMEOUT_SECONDS:
            return None, None
        
        return latest_frame.copy(), latest_frame_time

def detect_obstacles(frame):
    """Run detection and return list of obstacles (detections)."""
    global last_detection
    
    if not model_loaded or detector is None:
        return []
    
    try:
        with detector_lock:
            detections = detector.detect(frame)
        
        # Filter for obstacles
        obstacles = []
        for det in detections:
            if detector.is_forward_obstacle(det):
                obstacles.append(det)
                # Keep last detection for status
                with detection_lock:
                    last_detection = det
        
        return obstacles
    except Exception as e:
        set_error("Detection error: {}".format(e))
        return []

def send_move_command(speed, rotation):
    """Send movement command to web_bridge."""
    global last_action
    
    url = "{}/api/autonomy/move".format(WEB_BRIDGE_URL)
    response = http_request(url, method="POST", json_data={
        "speed": speed,
        "rotation": rotation
    })
    
    if response and response.get("ok"):
        with action_lock:
            last_action = "moving"
        return True
    
    set_error("Movement command failed")
    return False

def send_stop_command():
    """Send stop command to web_bridge."""
    global last_action
    
    url = "{}/api/autonomy/stop".format(WEB_BRIDGE_URL)
    response = http_request(url, method="POST")
    
    if response and response.get("ok"):
        with action_lock:
            last_action = "stopped"
        return True
    
    return False

def perform_avoidance():
    """Execute avoidance maneuver: stop, reverse, turn, continue."""
    global turn_direction
    
    with action_lock:
        last_action = "avoiding"
    
    # Stop
    send_stop_command()
    time.sleep(0.1)
    
    # Check if still active (allow immediate stop)
    with active_lock:
        if not active:
            return
    
    # Reverse
    send_move_command(REVERSE_SPEED, 0.0)
    start = time.time()
    while time.time() - start < REVERSE_SECONDS:
        time.sleep(0.05)
        with active_lock:
            if not active:
                send_stop_command()
                return
    
    # Stop
    send_stop_command()
    time.sleep(0.1)
    
    # Check if still active
    with active_lock:
        if not active:
            return
    
    # Turn (alternate direction)
    turn_rot = TURN_ROTATION * turn_direction
    send_move_command(0.0, turn_rot)
    start = time.time()
    while time.time() - start < TURN_SECONDS:
        time.sleep(0.05)
        with active_lock:
            if not active:
                send_stop_command()
                return
    
    # Stop
    send_stop_command()
    time.sleep(0.1)
    
    # Toggle turn direction for next obstacle
    turn_direction *= -1.0

def patrol_loop():
    """Main patrol loop: detect, decide, move."""
    global obstacle_counter
    global active
    global last_action
    
    obstacle_counter = 0
    
    while True:
        # Check if still active
        with active_lock:
            if not active:
                break
        
        # Get latest frame
        frame, frame_time = get_latest_frame()
        if frame is None:
            set_error("No recent video frame")
            with active_lock:
                active = False
            send_stop_command()
            http_request("{}/api/mode/manual".format(WEB_BRIDGE_URL), method="POST")
            set_stream_enabled(False)
            with action_lock:
                last_action = "stopped"
            break
        
        # Run detection
        obstacles = detect_obstacles(frame)
        
        if len(obstacles) > 0:
            obstacle_counter += 1
        else:
            obstacle_counter = 0
        
        # Decide action
        if obstacle_counter >= CONSECUTIVE_OBSTACLE_THRESHOLD:
            # Trigger avoidance
            obstacle_counter = 0
            perform_avoidance()
            
            # Resume forward after maneuver
            with active_lock:
                if not active:
                    break
        
        # Move forward if no obstacle
        if obstacle_counter == 0:
            send_move_command(FORWARD_SPEED, 0.0)
            with action_lock:
                last_action = "forward"
        
        # Sleep for inference interval
        time.sleep(INFERENCE_INTERVAL_SECONDS)

# --- REST API Endpoints ---

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "service": "autopatrol-bridge"})

@app.route("/status", methods=["GET"])
def status():
    with active_lock:
        is_active = active
    
    with action_lock:
        current_action = last_action
    
    with detection_lock:
        last_det = last_detection
    
    with error_lock:
        error = last_error
    
    # Mode from web_bridge
    mode_response = http_request("{}/api/mode".format(WEB_BRIDGE_URL))
    current_mode = mode_response.get("mode", "unknown") if mode_response else "unknown"
    
    return jsonify({
        "ok": True,
        "active": is_active,
        "mode": current_mode,
        "state": current_action,
        "model_loaded": model_loaded,
        "stream_connected": stream_connected,
        "obstacle_detected": obstacle_counter >= CONSECUTIVE_OBSTACLE_THRESHOLD,
        "last_action": current_action,
        "last_detection": {
            "name": last_det.get("name") if last_det else None,
            "score": last_det.get("score") if last_det else None
        } if last_det else None,
        "last_error": error
    })

@app.route("/start", methods=["POST"])
def start_patrol():
    global active, obstacle_counter, turn_direction, last_action
    with active_lock:
        if active:
            return jsonify({
                "ok": True,
                "message": "Auto Patrol already active"
            })
    
    # Check model
    if not model_loaded:
        return jsonify({
            "ok": False,
            "error": "Model failed to load"
        }), 400
    
    # Activate video stream processing only while Auto Patrol is active
    set_stream_enabled(True)
    ensure_stream_thread()
    if not wait_for_stream_frame(2.0):
        set_stream_enabled(False)
        return jsonify({
            "ok": False,
            "error": "No video stream available"
        }), 400
    
    # Switch web_bridge to auto mode
    mode_response = http_request("{}/api/mode/auto".format(WEB_BRIDGE_URL), method="POST")
    if not mode_response or not mode_response.get("ok"):
        set_stream_enabled(False)
        return jsonify({
            "ok": False,
            "error": "Failed to switch to auto mode"
        }), 500
    
    # Reset state
    obstacle_counter = 0
    turn_direction = -1.0  # Start with left turn
    with action_lock:
        last_action = "starting"
    
    # Start patrol
    with active_lock:
        active = True
    
    # Start patrol thread
    threading.Thread(target=patrol_loop, daemon=True).start()
    
    return jsonify({
        "ok": True,
        "message": "Auto Patrol started"
    })

@app.route("/stop", methods=["POST"])
def stop_patrol():
    global active, obstacle_counter, turn_direction, last_action, last_detection
    
    # Mark inactive
    with active_lock:
        active = False
    
    obstacle_counter = 0
    turn_direction = -1.0
    with detection_lock:
        last_detection = None
    with action_lock:
        last_action = "stopped"
    
    # Stop motors
    send_stop_command()
    time.sleep(0.1)
    
    # Switch web_bridge back to manual mode
    http_request("{}/api/mode/manual".format(WEB_BRIDGE_URL), method="POST")
    set_stream_enabled(False)
    
    return jsonify({
        "ok": True,
        "message": "Auto Patrol stopped"
    })

if __name__ == "__main__":
    # Start reader thread in idle mode; it only reads/decodes when stream is enabled.
    ensure_stream_thread()
    
    # Load detector
    if not load_detector():
        print("WARNING: Detector failed to load; Auto Patrol will not work")
    
    print("Starting autopatrol-bridge on port 5003")
    app.run(host="0.0.0.0", port=5003)

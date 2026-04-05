#!/usr/bin/env python3
from flask import Flask, request, jsonify
import rospy
from jetbotmini_msgs.srv import Motor
from jetbotmini_msgs.msg import Battery
import threading

app = Flask(__name__)

# --- Tuning knobs ---
SCALE = 1.0        # keep 1.0 for now since 0.6 already works
DEADZONE = 0.6     # minimum motor command that actually moves
MAX_OUT = 1.0      # keep within [-1,1] unless you discover higher works

# --- Shared battery state ---
latest_voltage = None
battery_lock = threading.Lock()

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def apply_deadzone(x):
    # If command is tiny, treat as stop
    if abs(x) < 0.05:
        return 0.0
    # If command is non-zero but below deadzone, push it to deadzone
    if 0.0 < abs(x) < DEADZONE:
        return DEADZONE if x > 0 else -DEADZONE
    return x

def voltage_to_status(voltage):
    if voltage is None:
        return None

    # Match Yahboom's helper thresholds
    if voltage >= 12.0:
        return "Battery_High"
    elif voltage >= 11.1:
        return "Battery_Medium"
    elif voltage >= 10.05:
        return "Battery_Low"
    elif voltage <= 9.9:
        return "Battery_Empty"
    elif voltage <= 10.95:
        return "Battery_Low"
    elif voltage <= 11.85:
        return "Battery_Medium"

    return "Battery_Unknown"

def battery_callback(msg):
    global latest_voltage
    with battery_lock:
        latest_voltage = msg.Voltage

# --- ROS setup ---
rospy.init_node("web_bridge", anonymous=True)

# Listen for Yahboom battery topic
rospy.Subscriber("/voltage", Battery, battery_callback)

# Keep existing motor service flow
rospy.wait_for_service("/Motor")
motor_srv = rospy.ServiceProxy("/Motor", Motor)

@app.route("/api/move", methods=["POST"])
def api_move():
    data = request.get_json(silent=True) or {}

    speed = float(data.get("speed", 0.0))       # [-1..1]
    rotation = float(data.get("rotation", 0.0)) # [-1..1]

    speed = clamp(speed, -1.0, 1.0)
    rotation = clamp(rotation, -1.0, 1.0)

    # Differential drive
    left = (speed - rotation) * SCALE
    right = (speed + rotation) * SCALE

    left = clamp(left, -MAX_OUT, MAX_OUT)
    right = clamp(right, -MAX_OUT, MAX_OUT)

    # Apply deadzone so the robot actually moves
    left = apply_deadzone(left)
    right = apply_deadzone(right)

    try:
        resp = motor_srv(rightspeed=right, leftspeed=left)
        return jsonify({
            "ok": True,
            "inputs": {"speed": speed, "rotation": rotation},
            "outputs": {"rightspeed": right, "leftspeed": left},
            "result": bool(resp.result)
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/stop", methods=["POST"])
def api_stop():
    try:
        resp = motor_srv(rightspeed=0.0, leftspeed=0.0)
        return jsonify({"ok": True, "result": bool(resp.result)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/battery", methods=["GET"])
def api_battery():
    with battery_lock:
        voltage = latest_voltage

    if voltage is None:
        return jsonify({
            "ok": False,
            "error": "No battery data received yet",
            "source": "ros_topic:/voltage"
        }), 503

    voltage = float(voltage)

    return jsonify({
        "ok": True,
        "voltage": round(voltage, 2),
        "status": voltage_to_status(voltage),
        "source": "ros_topic:/voltage"
    })

@app.route("/health", methods=["GET"])
def health():
    with battery_lock:
        has_battery_data = latest_voltage is not None

    return jsonify({
        "ok": True,
        "battery_data_received": has_battery_data
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
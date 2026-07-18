#!/usr/bin/env python3
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROBOT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if ROBOT_ROOT not in sys.path:
    sys.path.insert(0, ROBOT_ROOT)

from flask import Flask, request, jsonify
import rospy
from jetbotmini_msgs.srv import Motor
from jetbotmini_msgs.msg import Battery
import threading

from jetson_bridge.motor_control import MotorController

CONTROL_MODE_MANUAL = "manual"
CONTROL_MODE_AUTO = "auto"

app = Flask(__name__)

# --- Shared battery state ---
latest_voltage = None
battery_lock = threading.Lock()
control_mode = CONTROL_MODE_MANUAL
control_mode_lock = threading.Lock()

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
motor_controller = MotorController(motor_srv)


def get_control_mode():
    with control_mode_lock:
        return control_mode


def set_control_mode(mode):
    global control_mode
    with control_mode_lock:
        control_mode = mode

@app.route("/api/move", methods=["POST"])
def api_move():
    if get_control_mode() != CONTROL_MODE_MANUAL:
        return jsonify({
            "ok": False,
            "error": "Auto mode currently owns motor control",
            "mode": get_control_mode(),
        }), 409

    data = request.get_json(silent=True) or {}

    speed = float(data.get("speed", 0.0))       # [-1..1]
    rotation = float(data.get("rotation", 0.0)) # [-1..1]

    try:
        resp, command = motor_controller.move(speed, rotation)
        return jsonify({
            "ok": True,
            "mode": get_control_mode(),
            "inputs": {"speed": command["speed"], "rotation": command["rotation"]},
            "outputs": {
                "rightspeed": command["rightspeed"],
                "leftspeed": command["leftspeed"],
            },
            "result": bool(resp.result)
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/stop", methods=["POST"])
def api_stop():
    try:
        resp = motor_controller.stop()
        return jsonify({"ok": True, "mode": get_control_mode(), "result": bool(resp.result)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/control-mode", methods=["GET"])
def api_get_control_mode():
    return jsonify({
        "ok": True,
        "mode": get_control_mode(),
    })


@app.route("/api/control-mode", methods=["POST"])
def api_set_control_mode():
    data = request.get_json(silent=True) or {}
    mode = str(data.get("mode", "")).strip().lower()

    if mode not in (CONTROL_MODE_MANUAL, CONTROL_MODE_AUTO):
        return jsonify({
            "ok": False,
            "error": "mode must be 'manual' or 'auto'",
        }), 400

    try:
        motor_controller.stop()
        set_control_mode(mode)
        return jsonify({
            "ok": True,
            "mode": get_control_mode(),
        })
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
        "battery_data_received": has_battery_data,
        "control_mode": get_control_mode(),
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
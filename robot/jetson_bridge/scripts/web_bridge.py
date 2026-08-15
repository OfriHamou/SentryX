#!/usr/bin/env python3

from flask import Flask, request, jsonify
import rospy
from jetbotmini_msgs.srv import Motor
from jetbotmini_msgs.msg import Battery
import threading
import time

app = Flask(__name__)

# --- Tuning knobs ---
SCALE = 1.0        # keep 1.0 for now since 0.6 already works
DEADZONE = 0.6     # minimum motor command that actually moves
MAX_OUT = 1.0      # keep within [-1,1] unless you discover higher works

# --- Motor calibration ---
# Robot currently drifts left when driving forward,
# so slightly reduce the right motor output.
LEFT_MOTOR_TRIM = 0.50
RIGHT_MOTOR_TRIM = 1.00

# --- Shared battery state ---
latest_voltage = None
battery_lock = threading.Lock()

# --- Control mode state ---
control_mode = "manual"  # "manual" or "auto"
mode_lock = threading.Lock()

# --- Watchdog for autonomous mode ---
last_autonomy_command_time = None
autonomy_watchdog_timeout = 5.0  # seconds


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


def apply_motor_trim(left, right):
    """
    Apply physical motor calibration.

    The robot currently drifts left, so the right motor
    is reduced slightly to make straight driving straighter.
    """
    left *= LEFT_MOTOR_TRIM
    right *= RIGHT_MOTOR_TRIM

    left = clamp(left, -MAX_OUT, MAX_OUT)
    right = clamp(right, -MAX_OUT, MAX_OUT)

    return left, right


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


# --- Manual movement ---

@app.route("/api/move", methods=["POST"])
def api_move():
    with mode_lock:
        current_mode = control_mode

    # Reject manual movement during auto mode
    if current_mode == "auto":
        return jsonify({
            "ok": False,
            "error": "Manual control is disabled during Auto Patrol",
            "mode": "auto"
        }), 409

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

    # Apply left/right motor calibration
    left, right = apply_motor_trim(left, right)

    try:
        resp = motor_srv(
            rightspeed=right,
            leftspeed=left
        )

        return jsonify({
            "ok": True,
            "inputs": {
                "speed": speed,
                "rotation": rotation
            },
            "outputs": {
                "rightspeed": right,
                "leftspeed": left
            },
            "result": bool(resp.result)
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@app.route("/api/stop", methods=["POST"])
def api_stop():
    global control_mode

    try:
        resp = motor_srv(
            rightspeed=0.0,
            leftspeed=0.0
        )

        # Reset mode to manual
        with mode_lock:
            control_mode = "manual"

        return jsonify({
            "ok": True,
            "result": bool(resp.result)
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


# --- Battery ---

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


# --- Mode management endpoints ---

@app.route("/api/mode", methods=["GET"])
def api_get_mode():
    with mode_lock:
        current_mode = control_mode

    return jsonify({
        "ok": True,
        "mode": current_mode
    })


@app.route("/api/mode/manual", methods=["POST"])
def api_mode_manual():
    global control_mode

    try:
        # Stop motors first
        motor_srv(
            rightspeed=0.0,
            leftspeed=0.0
        )

        # Switch to manual mode
        with mode_lock:
            control_mode = "manual"

        return jsonify({
            "ok": True,
            "mode": "manual"
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@app.route("/api/mode/auto", methods=["POST"])
def api_mode_auto():
    global control_mode, last_autonomy_command_time

    try:
        # Stop motors first
        motor_srv(
            rightspeed=0.0,
            leftspeed=0.0
        )

        # Reset watchdog timestamp when entering auto mode
        last_autonomy_command_time = None

        # Switch to auto mode
        with mode_lock:
            control_mode = "auto"

        return jsonify({
            "ok": True,
            "mode": "auto"
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


# --- Autonomous movement endpoints ---

@app.route("/api/autonomy/move", methods=["POST"])
def api_autonomy_move():
    global last_autonomy_command_time

    with mode_lock:
        current_mode = control_mode

    # Only allow autonomous movement when in auto mode
    if current_mode != "auto":
        return jsonify({
            "ok": False,
            "error": "Autonomous movement only allowed in auto mode",
            "mode": current_mode
        }), 409

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

    # Apply the same motor calibration used by manual control
    left, right = apply_motor_trim(left, right)

    try:
        resp = motor_srv(
            rightspeed=right,
            leftspeed=left
        )

        # Update watchdog timer
        last_autonomy_command_time = time.time()

        return jsonify({
            "ok": True,
            "inputs": {
                "speed": speed,
                "rotation": rotation
            },
            "outputs": {
                "rightspeed": right,
                "leftspeed": left
            },
            "result": bool(resp.result)
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


@app.route("/api/autonomy/stop", methods=["POST"])
def api_autonomy_stop():
    global last_autonomy_command_time

    try:
        resp = motor_srv(
            rightspeed=0.0,
            leftspeed=0.0
        )

        # Update watchdog timer
        last_autonomy_command_time = time.time()

        return jsonify({
            "ok": True,
            "result": bool(resp.result)
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


# --- Watchdog background thread ---

def watchdog_loop():
    global control_mode

    """
    Watchdog timer:
    if in auto mode and no autonomy command is received
    for autonomy_watchdog_timeout seconds, stop the robot
    and return to manual mode.
    """

    while True:
        time.sleep(0.1)

        with mode_lock:
            current_mode = control_mode

        if current_mode != "auto":
            continue

        if last_autonomy_command_time is None:
            continue

        elapsed = time.time() - last_autonomy_command_time

        if elapsed > autonomy_watchdog_timeout:
            try:
                motor_srv(
                    rightspeed=0.0,
                    leftspeed=0.0
                )

                with mode_lock:
                    control_mode = "manual"

            except Exception:
                pass


watchdog_thread = threading.Thread(
    target=watchdog_loop,
    daemon=True
)
watchdog_thread.start()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000
    )

#!/usr/bin/env python3
from flask import Flask, request, jsonify
import rospy
from jetbotmini_msgs.srv import Motor

app = Flask(__name__)

# --- Tuning knobs ---
SCALE = 1.0        # keep 1.0 for now since 0.6 already works
DEADZONE = 0.6     # minimum motor command that actually moves
MAX_OUT = 1.0      # keep within [-1,1] unless you discover higher works

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

# --- ROS setup ---
rospy.init_node("web_bridge", anonymous=True)
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

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

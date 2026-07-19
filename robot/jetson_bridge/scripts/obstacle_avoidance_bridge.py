#!/usr/bin/env python3
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROBOT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))
if ROBOT_ROOT not in sys.path:
    sys.path.insert(0, ROBOT_ROOT)

import json
import logging
import threading
import urllib.request

from flask import Flask, jsonify
import rospy
from jetbotmini_msgs.srv import Motor

from jetson_bridge.avoidance import (
    AvoidanceConfig,
    MjpegStreamClient,
    ObstacleAvoidanceController,
    create_classifier,
)
from jetson_bridge.motor_control import MotorController

LOG_LEVEL = os.environ.get("AVOIDANCE_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
LOGGER = logging.getLogger("obstacle_avoidance_bridge")

WEB_BRIDGE_URL = os.environ.get("WEB_BRIDGE_URL", "http://127.0.0.1:5000").rstrip("/")
CONTROL_MODE_URL = "{}/api/control-mode".format(WEB_BRIDGE_URL)
PORT = int(os.environ.get("AVOIDANCE_PORT", "5003"))
CONTROL_MODE_TIMEOUT_SECONDS = float(os.environ.get("CONTROL_MODE_TIMEOUT_SECONDS", "2"))
CONFIG = AvoidanceConfig()

app = Flask(__name__)


class RosMotorServiceClient:
    def __init__(self, service_name: str = "/Motor"):
        self.service_name = service_name
        self._lock = threading.Lock()
        self._service = None

    def is_available(self) -> bool:
        try:
            rospy.wait_for_service(self.service_name, timeout=0.2)
            return True
        except Exception:
            return False

    def _ensure_service(self):
        with self._lock:
            if self._service is None:
                rospy.wait_for_service(self.service_name, timeout=2)
                self._service = rospy.ServiceProxy(self.service_name, Motor)
            return self._service

    def __call__(self, rightspeed: float, leftspeed: float):
        service = self._ensure_service()
        return service(rightspeed=rightspeed, leftspeed=leftspeed)


def get_control_mode() -> str:
    with urllib.request.urlopen(CONTROL_MODE_URL, timeout=CONTROL_MODE_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
    mode = payload.get("mode")
    if mode not in ("manual", "auto"):
        raise RuntimeError("Unexpected control mode response: {}".format(payload))
    return mode


def json_error(message: str, status_code: int):
    return jsonify({"ok": False, "error": message}), status_code


rospy.init_node("obstacle_avoidance_bridge", anonymous=True)
ros_motor_client = RosMotorServiceClient()
controller = ObstacleAvoidanceController(
    motor_controller=MotorController(ros_motor_client),
    classifier=create_classifier(CONFIG),
    stream_client=MjpegStreamClient(CONFIG.video_stream_url, CONFIG.mjpeg_timeout_seconds),
    control_mode_getter=get_control_mode,
    motor_health_checker=ros_motor_client.is_available,
    config=CONFIG,
)
controller.start_worker()


@app.route("/start", methods=["POST"])
def start():
    try:
        status = controller.start()
        return jsonify(status)
    except RuntimeError as error:
        message = str(error)
        status_code = 409 if "Control mode" in message else 503
        return json_error(message, status_code)
    except Exception as error:
        LOGGER.exception("Failed to start obstacle avoidance")
        return json_error(str(error), 500)


@app.route("/stop", methods=["POST"])
def stop():
    try:
        return jsonify(controller.stop())
    except Exception as error:
        LOGGER.exception("Failed to stop obstacle avoidance")
        return json_error(str(error), 500)


@app.route("/pause", methods=["POST"])
def pause():
    try:
        return jsonify(controller.pause())
    except Exception as error:
        LOGGER.exception("Failed to pause obstacle avoidance")
        return json_error(str(error), 500)


@app.route("/resume", methods=["POST"])
def resume():
    try:
        return jsonify(controller.resume())
    except RuntimeError as error:
        message = str(error)
        status_code = 409 if "enabled" in message or "Control mode" in message else 503
        return json_error(message, status_code)
    except Exception as error:
        LOGGER.exception("Failed to resume obstacle avoidance")
        return json_error(str(error), 500)


@app.route("/status", methods=["GET"])
def status():
    return jsonify(controller.snapshot_status())


@app.route("/health", methods=["GET"])
def health():
    return jsonify(controller.health_status())


if __name__ == "__main__":
    LOGGER.info("Starting obstacle avoidance bridge on port %s", PORT)
    app.run(host="0.0.0.0", port=PORT, threaded=True)

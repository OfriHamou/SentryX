import logging
import os
import random
import threading
import time
import urllib.request
from datetime import datetime, timezone
from typing import Callable, Dict, Optional

import cv2
import numpy as np

from jetson_bridge.motor_control import MotorController

LOGGER = logging.getLogger("obstacle_avoidance")

CONTROL_MODE_MANUAL = "manual"
CONTROL_MODE_AUTO = "auto"

STATE_IDLE = "IDLE"
STATE_FORWARD = "FORWARD"
STATE_BLOCKED = "BLOCKED"
STATE_REVERSING = "REVERSING"
STATE_TURNING = "TURNING"
STATE_PAUSED = "PAUSED"
STATE_ERROR = "ERROR"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class StreamUnavailableError(RuntimeError):
    pass


class AvoidanceConfig:
    def __init__(
        self,
        video_stream_url=None,
        blocked_threshold=None,
        blocked_confirmation_frames=None,
        forward_speed=None,
        reverse_speed=None,
        turn_speed=None,
        stop_delay_seconds=None,
        reverse_duration_seconds=None,
        turn_duration_seconds=None,
        turn_duration_increment_seconds=None,
        max_turn_duration_seconds=None,
        mjpeg_timeout_seconds=None,
        frame_retry_delay_seconds=None,
        loop_sleep_seconds=None,
        forward_refresh_seconds=None,
        model_path=None,
        model_device=None,
        blocked_class_index=None,
        free_class_index=None,
    ):
        self.video_stream_url = video_stream_url or os.environ.get("VIDEO_STREAM_URL", "http://127.0.0.1:5001/video_feed")
        self.blocked_threshold = float(
            blocked_threshold if blocked_threshold is not None else os.environ.get("AVOIDANCE_BLOCKED_THRESHOLD", "0.75")
        )
        self.blocked_confirmation_frames = max(
            1,
            int(
                blocked_confirmation_frames
                if blocked_confirmation_frames is not None
                else os.environ.get("AVOIDANCE_BLOCKED_CONFIRMATION_FRAMES", "3")
            ),
        )
        self.forward_speed = float(forward_speed if forward_speed is not None else os.environ.get("AVOIDANCE_FORWARD_SPEED", "0.35"))
        self.reverse_speed = float(reverse_speed if reverse_speed is not None else os.environ.get("AVOIDANCE_REVERSE_SPEED", "-0.3"))
        self.turn_speed = float(turn_speed if turn_speed is not None else os.environ.get("AVOIDANCE_TURN_SPEED", "0.45"))
        self.stop_delay_seconds = float(
            stop_delay_seconds if stop_delay_seconds is not None else os.environ.get("AVOIDANCE_STOP_DELAY_SECONDS", "0.2")
        )
        self.reverse_duration_seconds = float(
            reverse_duration_seconds
            if reverse_duration_seconds is not None
            else os.environ.get("AVOIDANCE_REVERSE_DURATION_SECONDS", "0.5")
        )
        self.turn_duration_seconds = float(
            turn_duration_seconds if turn_duration_seconds is not None else os.environ.get("AVOIDANCE_TURN_DURATION_SECONDS", "0.7")
        )
        self.turn_duration_increment_seconds = float(
            turn_duration_increment_seconds
            if turn_duration_increment_seconds is not None
            else os.environ.get("AVOIDANCE_TURN_DURATION_INCREMENT_SECONDS", "0.15")
        )
        self.max_turn_duration_seconds = float(
            max_turn_duration_seconds
            if max_turn_duration_seconds is not None
            else os.environ.get("AVOIDANCE_MAX_TURN_DURATION_SECONDS", "1.2")
        )
        self.mjpeg_timeout_seconds = float(
            mjpeg_timeout_seconds if mjpeg_timeout_seconds is not None else os.environ.get("AVOIDANCE_STREAM_TIMEOUT_SECONDS", "5")
        )
        self.frame_retry_delay_seconds = float(
            frame_retry_delay_seconds
            if frame_retry_delay_seconds is not None
            else os.environ.get("AVOIDANCE_STREAM_RETRY_DELAY_SECONDS", "0.5")
        )
        self.loop_sleep_seconds = float(
            loop_sleep_seconds if loop_sleep_seconds is not None else os.environ.get("AVOIDANCE_LOOP_SLEEP_SECONDS", "0.05")
        )
        self.forward_refresh_seconds = float(
            forward_refresh_seconds
            if forward_refresh_seconds is not None
            else os.environ.get("AVOIDANCE_FORWARD_REFRESH_SECONDS", "1.0")
        )
        self.model_path = (model_path if model_path is not None else os.environ.get("AVOIDANCE_MODEL_PATH", "")).strip()
        self.model_device = (model_device if model_device is not None else os.environ.get("AVOIDANCE_MODEL_DEVICE", "cpu")).strip() or "cpu"
        self.blocked_class_index = int(
            blocked_class_index if blocked_class_index is not None else os.environ.get("AVOIDANCE_BLOCKED_CLASS_INDEX", "0")
        )
        self.free_class_index = int(
            free_class_index if free_class_index is not None else os.environ.get("AVOIDANCE_FREE_CLASS_INDEX", "1")
        )


class MjpegStreamClient:
    def __init__(self, url: str, timeout_seconds: float):
        self.url = url
        self.timeout_seconds = timeout_seconds
        self._response = None
        self._buffer = bytearray()

    def close(self):
        if self._response is not None:
            try:
                self._response.close()
            except Exception:
                pass
        self._response = None
        self._buffer = bytearray()

    def _connect(self):
        self.close()
        LOGGER.info("Connecting to MJPEG stream", extra={"url": self.url})
        self._response = urllib.request.urlopen(self.url, timeout=self.timeout_seconds)
        self._buffer = bytearray()

    def _extract_jpeg(self) -> Optional[bytes]:
        start = self._buffer.find(b"\xff\xd8")
        end = self._buffer.find(b"\xff\xd9", start + 2 if start != -1 else 0)
        if start == -1 or end == -1:
            return None
        jpg = bytes(self._buffer[start:end + 2])
        del self._buffer[:end + 2]
        return jpg

    def get_frame(self):
        if self._response is None:
            self._connect()

        deadline = time.time() + self.timeout_seconds

        while True:
            jpg_bytes = self._extract_jpeg()
            if jpg_bytes is not None:
                frame_array = np.frombuffer(jpg_bytes, dtype=np.uint8)
                frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
                if frame is None:
                    continue
                return frame

            if time.time() > deadline:
                self.close()
                raise StreamUnavailableError("Timed out waiting for MJPEG frame")

            try:
                chunk = self._response.read(4096)
            except Exception as error:
                self.close()
                raise StreamUnavailableError(str(error))

            if not chunk:
                self.close()
                raise StreamUnavailableError("MJPEG stream disconnected")

            self._buffer.extend(chunk)


class ConfigurableBlockedFreeClassifier:
    def __init__(
        self,
        model_path: str,
        device: str = "cpu",
        blocked_class_index: int = 0,
        free_class_index: int = 1,
    ):
        self.model_path = model_path
        self.device = device
        self.blocked_class_index = blocked_class_index
        self.free_class_index = free_class_index
        self._model = None
        self._torch = None
        self.load_error: Optional[str] = None
        self._loaded_path: Optional[str] = None
        self.ensure_loaded()

    def ensure_loaded(self) -> bool:
        if self._model is not None and self._loaded_path == self.model_path:
            return True

        self._model = None
        self._torch = None

        if not self.model_path:
            self.load_error = "AVOIDANCE_MODEL_PATH is not configured"
            return False

        if not os.path.isfile(self.model_path):
            self.load_error = "Model file not found at {}".format(self.model_path)
            return False

        try:
            import torch
        except Exception as error:
            self.load_error = "PyTorch is not available: {}".format(error)
            return False

        try:
            LOGGER.info("Loading blocked/free model", extra={"model_path": self.model_path, "device": self.device})
            try:
                model = torch.jit.load(self.model_path, map_location=self.device)
            except Exception:
                from torchvision import models

                checkpoint = torch.load(self.model_path, map_location=self.device)
                state_dict = checkpoint.get("state_dict", checkpoint) if isinstance(checkpoint, dict) else checkpoint
                cleaned_state_dict = {}
                for key, value in state_dict.items():
                    normalized_key = key
                    if normalized_key.startswith("module."):
                        normalized_key = normalized_key[len("module."):]
                    cleaned_state_dict[normalized_key] = value

                model = models.resnet18(weights=None)
                model.fc = torch.nn.Linear(model.fc.in_features, 2)
                model.load_state_dict(cleaned_state_dict, strict=True)

            model.eval()
            self._model = model
            self._torch = torch
            self._loaded_path = self.model_path
            self.load_error = None
            return True
        except Exception as error:
            self._model = None
            self._torch = None
            self.load_error = "Failed to load model: {}".format(error)
            LOGGER.error(self.load_error)
            return False

    def is_loaded(self) -> bool:
        return self._model is not None

    def predict(self, frame) -> Dict[str, float]:
        if not self.ensure_loaded():
            raise RuntimeError(self.load_error or "Model is not loaded")

        assert self._model is not None
        assert self._torch is not None

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb, (224, 224), interpolation=cv2.INTER_AREA)
        normalized = resized.astype(np.float32) / 255.0
        normalized = (normalized - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array(
            [0.229, 0.224, 0.225],
            dtype=np.float32,
        )
        chw = np.transpose(normalized, (2, 0, 1))
        tensor = self._torch.from_numpy(chw).unsqueeze(0).to(self.device)

        with self._torch.no_grad():
            outputs = self._model(tensor)
            probabilities = self._torch.softmax(outputs, dim=1).cpu().numpy()[0]

        blocked_probability = float(probabilities[self.blocked_class_index])
        free_probability = float(probabilities[self.free_class_index])

        return {
            "blocked_probability": blocked_probability,
            "free_probability": free_probability,
        }


class ObstacleAvoidanceController:
    def __init__(
        self,
        motor_controller: MotorController,
        classifier,
        stream_client: MjpegStreamClient,
        control_mode_getter: Callable[[], str],
        motor_health_checker: Callable[[], bool],
        config: Optional[AvoidanceConfig] = None,
        randomizer: Optional[random.Random] = None,
    ):
        self.motor_controller = motor_controller
        self.classifier = classifier
        self.stream_client = stream_client
        self.control_mode_getter = control_mode_getter
        self.motor_health_checker = motor_health_checker
        self.config = config or AvoidanceConfig()
        self.randomizer = randomizer or random.Random()
        self.state_lock = threading.RLock()
        self._worker: Optional[threading.Thread] = None
        self._shutdown = False
        self._next_turn_direction: Optional[str] = None
        self._avoidance_attempts = 0
        self._clear_frames = 0
        self._last_forward_command_at = 0.0

        self.status = {
            "ok": True,
            "enabled": False,
            "mode": "MANUAL",
            "state": STATE_IDLE,
            "blocked_probability": None,
            "free_probability": None,
            "blocked_frames": 0,
            "last_action": "idle",
            "last_turn_direction": None,
            "stream_connected": False,
            "model_loaded": bool(getattr(self.classifier, "is_loaded", lambda: False)()),
            "last_frame_time": None,
            "error": getattr(self.classifier, "load_error", None),
        }

    def start_worker(self):
        with self.state_lock:
            if self._worker is not None and self._worker.is_alive():
                return
            self._worker = threading.Thread(target=self._run_loop, daemon=True)
            self._worker.start()

    def shutdown(self):
        self._shutdown = True
        self.stream_client.close()

    def snapshot_status(self):
        with self.state_lock:
            snapshot = dict(self.status)
        snapshot["model_loaded"] = bool(getattr(self.classifier, "is_loaded", lambda: False)())
        snapshot["mode"] = "AUTO" if self._safe_control_mode() == CONTROL_MODE_AUTO else "MANUAL"
        snapshot["ok"] = snapshot["error"] is None
        return snapshot

    def health_status(self):
        snapshot = self.snapshot_status()
        return {
            "ok": True,
            "service_running": True,
            "stream_connected": bool(snapshot["stream_connected"]),
            "model_loaded": bool(snapshot["model_loaded"]),
            "ros_motor_service_available": bool(self.motor_health_checker()),
            "enabled": bool(snapshot["enabled"]),
            "state": snapshot["state"],
        }

    def start(self):
        self.start_worker()
        self._require_auto_mode()
        self._ensure_dependencies()
        self._stop_robot()
        self.stream_client.close()

        with self.state_lock:
            self.status["enabled"] = True
            self.status["state"] = STATE_FORWARD
            self.status["blocked_frames"] = 0
            self.status["error"] = None
            self.status["last_action"] = "start_auto"

        self._clear_frames = 0
        self._avoidance_attempts = 0
        try:
            self._move_forward(force=True)
        except Exception:
            with self.state_lock:
                self.status["enabled"] = False
                self.status["state"] = STATE_ERROR
                self.status["last_action"] = "start_failed"
            raise
        return self.snapshot_status()

    def stop(self):
        self._stop_robot()
        self.stream_client.close()
        with self.state_lock:
            self.status["enabled"] = False
            self.status["state"] = STATE_IDLE
            self.status["blocked_frames"] = 0
            self.status["last_action"] = "stop_auto"
            self.status["error"] = None
        self._clear_frames = 0
        self._avoidance_attempts = 0
        return self.snapshot_status()

    def pause(self):
        self._stop_robot()
        with self.state_lock:
            if self.status["enabled"]:
                self.status["state"] = STATE_PAUSED
                self.status["last_action"] = "pause_auto"
            else:
                self.status["state"] = STATE_IDLE
                self.status["last_action"] = "pause_auto_idle"
        return self.snapshot_status()

    def resume(self):
        with self.state_lock:
            if not self.status["enabled"]:
                raise RuntimeError("Autonomous mode is not enabled")
        self._require_auto_mode()
        self._ensure_dependencies()
        with self.state_lock:
            self.status["state"] = STATE_FORWARD
            self.status["error"] = None
            self.status["last_action"] = "resume_auto"
        try:
            self._move_forward(force=True)
        except Exception:
            with self.state_lock:
                self.status["state"] = STATE_ERROR
                self.status["last_action"] = "resume_failed"
            raise
        return self.snapshot_status()

    def _safe_control_mode(self) -> str:
        try:
            mode = self.control_mode_getter()
        except Exception as error:
            LOGGER.warning("Failed reading control mode: %s", error)
            return CONTROL_MODE_MANUAL
        return mode if mode in (CONTROL_MODE_MANUAL, CONTROL_MODE_AUTO) else CONTROL_MODE_MANUAL

    def _require_auto_mode(self):
        if self._safe_control_mode() != CONTROL_MODE_AUTO:
            raise RuntimeError("Control mode must be auto before starting obstacle avoidance")

    def _ensure_dependencies(self):
        if not self.motor_health_checker():
            raise RuntimeError("ROS motor service is unavailable")

        if not self.classifier.ensure_loaded():
            raise RuntimeError(getattr(self.classifier, "load_error", "Blocked/free model is unavailable"))

        frame = self.stream_client.get_frame()
        with self.state_lock:
            self.status["stream_connected"] = True
            self.status["last_frame_time"] = utc_now_iso()
        _ = frame

    def _set_error(self, error_message: str):
        with self.state_lock:
            self.status["state"] = STATE_ERROR
            self.status["error"] = error_message
            self.status["last_action"] = "error"

    def _transition_state(self, new_state: str, last_action: str):
        with self.state_lock:
            old_state = self.status["state"]
            self.status["state"] = new_state
            self.status["last_action"] = last_action
        if old_state != new_state:
            LOGGER.info("State transition: %s -> %s", old_state, new_state)

    def _stop_robot(self):
        response = self.motor_controller.stop()
        result = bool(getattr(response, "result", True))
        if not result:
            raise RuntimeError("Motor stop command was not acknowledged")
        LOGGER.info("Motor action: stop")

    def _send_motion(self, speed: float, rotation: float, action: str):
        response, outputs = self.motor_controller.move(speed, rotation)
        result = bool(getattr(response, "result", True))
        if not result:
            raise RuntimeError("Motor command '{}' was not acknowledged".format(action))
        LOGGER.info(
            "Motor action: %s (speed=%.2f rotation=%.2f right=%.2f left=%.2f)",
            action,
            speed,
            rotation,
            outputs["rightspeed"],
            outputs["leftspeed"],
        )

    def _move_forward(self, force: bool = False):
        now = time.monotonic()
        if not force and now - self._last_forward_command_at < self.config.forward_refresh_seconds:
            return
        self._transition_state(STATE_FORWARD, "move_forward")
        self._send_motion(self.config.forward_speed, 0.0, "move_forward")
        self._last_forward_command_at = now

    def _sleep_interruptibly(self, seconds: float) -> bool:
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if self._shutdown:
                return False
            with self.state_lock:
                enabled = bool(self.status["enabled"])
                state = self.status["state"]
            if not enabled or state == STATE_PAUSED or self._safe_control_mode() != CONTROL_MODE_AUTO:
                return False
            time.sleep(min(0.05, max(0.0, deadline - time.monotonic())))
        return True

    def _choose_turn_direction(self) -> str:
        if self._next_turn_direction is None:
            direction = self.randomizer.choice(["left", "right"])
        else:
            direction = self._next_turn_direction
        self._next_turn_direction = "right" if direction == "left" else "left"
        return direction

    def _run_avoidance_sequence(self):
        self._avoidance_attempts += 1
        direction = self._choose_turn_direction()
        turn_sign = -1.0 if direction == "left" else 1.0
        turn_duration = min(
            self.config.turn_duration_seconds + max(0, self._avoidance_attempts - 1) * self.config.turn_duration_increment_seconds,
            self.config.max_turn_duration_seconds,
        )

        self._transition_state(STATE_BLOCKED, "obstacle_detected")
        self._stop_robot()
        if not self._sleep_interruptibly(self.config.stop_delay_seconds):
            return

        self._transition_state(STATE_REVERSING, "reverse")
        self._send_motion(self.config.reverse_speed, 0.0, "reverse")
        if not self._sleep_interruptibly(self.config.reverse_duration_seconds):
            self._stop_robot()
            return

        self._stop_robot()
        self._transition_state(STATE_TURNING, "turn_{}".format(direction))
        with self.state_lock:
            self.status["last_turn_direction"] = direction
        self._send_motion(0.0, turn_sign * self.config.turn_speed, "turn_{}".format(direction))
        if not self._sleep_interruptibly(turn_duration):
            self._stop_robot()
            return

        self._stop_robot()
        with self.state_lock:
            self.status["blocked_frames"] = 0
        self._move_forward(force=True)

    def _handle_stream_failure(self, error: Exception):
        LOGGER.warning("MJPEG stream unavailable: %s", error)
        try:
            self._stop_robot()
        except Exception as stop_error:
            LOGGER.error("Failed stopping robot after stream failure: %s", stop_error)
        with self.state_lock:
            self.status["stream_connected"] = False
        self._set_error("Camera stream unavailable: {}".format(error))
        self.stream_client.close()

    def _handle_inference_failure(self, error: Exception):
        LOGGER.error("Blocked/free inference failed: %s", error)
        try:
            self._stop_robot()
        except Exception as stop_error:
            LOGGER.error("Failed stopping robot after inference error: %s", stop_error)
        with self.state_lock:
            self.status["model_loaded"] = bool(getattr(self.classifier, "is_loaded", lambda: False)())
        self._set_error("Inference failed: {}".format(error))

    def process_once(self):
        with self.state_lock:
            enabled = bool(self.status["enabled"])
            state = self.status["state"]

        if not enabled:
            return "idle"

        if self._safe_control_mode() != CONTROL_MODE_AUTO:
            try:
                self._stop_robot()
            except Exception as error:
                LOGGER.error("Failed stopping robot after control mode loss: %s", error)
            with self.state_lock:
                self.status["enabled"] = False
                self.status["state"] = STATE_IDLE
                self.status["last_action"] = "control_mode_lost"
            return "control_mode_lost"

        if state == STATE_PAUSED:
            return "paused"

        try:
            frame = self.stream_client.get_frame()
            probabilities = self.classifier.predict(frame)
        except StreamUnavailableError as error:
            self._handle_stream_failure(error)
            return "stream_error"
        except Exception as error:
            self._handle_inference_failure(error)
            return "inference_error"

        blocked_probability = float(probabilities["blocked_probability"])
        free_probability = float(probabilities["free_probability"])

        with self.state_lock:
            self.status["stream_connected"] = True
            self.status["model_loaded"] = True
            self.status["last_frame_time"] = utc_now_iso()
            self.status["blocked_probability"] = blocked_probability
            self.status["free_probability"] = free_probability
            if self.status["error"] is not None:
                self.status["error"] = None

        if blocked_probability >= self.config.blocked_threshold:
            with self.state_lock:
                self.status["blocked_frames"] = int(self.status["blocked_frames"]) + 1
                blocked_frames = int(self.status["blocked_frames"])
            self._clear_frames = 0
            LOGGER.info(
                "Obstacle probability crossed threshold: blocked=%.3f free=%.3f frames=%s",
                blocked_probability,
                free_probability,
                blocked_frames,
            )
            if blocked_frames >= self.config.blocked_confirmation_frames:
                self._run_avoidance_sequence()
                return "avoidance"
            return "blocked"

        self._clear_frames += 1
        with self.state_lock:
            self.status["blocked_frames"] = 0
        if self._clear_frames >= self.config.blocked_confirmation_frames:
            self._avoidance_attempts = 0
        self._move_forward()
        return "forward"

    def _run_loop(self):
        while not self._shutdown:
            outcome = self.process_once()
            if outcome in ("stream_error", "inference_error"):
                time.sleep(self.config.frame_retry_delay_seconds)
                continue
            time.sleep(self.config.loop_sleep_seconds)

#!/usr/bin/env python3
import sys
import types
import unittest
from unittest.mock import ANY

import numpy as np

if "cv2" not in sys.modules:
    cv2_stub = types.SimpleNamespace(
        COLOR_BGR2RGB=0,
        INTER_AREA=0,
        IMREAD_COLOR=1,
        cvtColor=lambda frame, code: frame,
        resize=lambda frame, size, interpolation=None: frame,
        imdecode=lambda data, flags: np.zeros((224, 224, 3), dtype=np.uint8),
    )
    sys.modules["cv2"] = cv2_stub

from jetson_bridge.avoidance import (
    AvoidanceConfig,
    CONTROL_MODE_AUTO,
    ObstacleAvoidanceController,
    STATE_ERROR,
    STATE_FORWARD,
    STATE_IDLE,
    compute_blocked_probability_from_detections,
)


class FakeMotorResponse:
    def __init__(self, result=True):
        self.result = result


class FakeMotorController:
    def __init__(self):
        self.actions = []

    def move(self, speed, rotation):
        self.actions.append(("move", speed, rotation))
        return FakeMotorResponse(True), {
            "rightspeed": speed + rotation,
            "leftspeed": speed - rotation,
        }

    def stop(self):
        self.actions.append(("stop",))
        return FakeMotorResponse(True)


class FakeClassifier:
    def __init__(self, outputs=None):
        self.outputs = list(outputs or [{"blocked_probability": 0.1, "free_probability": 0.9}])
        self.load_error = None

    def ensure_loaded(self):
        return True

    def is_loaded(self):
        return True

    def predict(self, frame):
        output = self.outputs.pop(0)
        if isinstance(output, Exception):
            raise output
        return output


class FakeStreamClient:
    def __init__(self, frames=None):
        self.frames = list(frames or [np.zeros((224, 224, 3), dtype=np.uint8)])
        self.closed = False

    def get_frame(self):
        frame = self.frames.pop(0)
        if isinstance(frame, Exception):
            raise frame
        return frame

    def close(self):
        self.closed = True


class ObstacleAvoidanceControllerTests(unittest.TestCase):
    def make_controller(self, classifier=None, stream_client=None):
        controller = ObstacleAvoidanceController(
            motor_controller=FakeMotorController(),
            classifier=classifier or FakeClassifier(),
            stream_client=stream_client or FakeStreamClient(frames=[np.zeros((224, 224, 3), dtype=np.uint8)] * 10),
            control_mode_getter=lambda: CONTROL_MODE_AUTO,
            motor_health_checker=lambda: True,
            config=AvoidanceConfig(
                blocked_threshold=0.75,
                blocked_confirmation_frames=3,
                forward_speed=0.35,
                reverse_speed=-0.3,
                turn_speed=0.45,
                stop_delay_seconds=0.01,
                reverse_duration_seconds=0.01,
                turn_duration_seconds=0.01,
                turn_duration_increment_seconds=0.01,
                max_turn_duration_seconds=0.05,
                frame_retry_delay_seconds=0.01,
                loop_sleep_seconds=0.01,
                forward_refresh_seconds=0.0,
                model_path="",
            ),
        )
        controller._sleep_interruptibly = lambda seconds: True
        controller.start_worker = lambda: None
        return controller

    def test_auto_start_stops_before_driving(self):
        controller = self.make_controller()

        status = controller.start()

        self.assertTrue(status["enabled"])
        self.assertEqual(status["state"], STATE_FORWARD)
        self.assertEqual(controller.motor_controller.actions[0], ("stop",))
        self.assertEqual(controller.motor_controller.actions[1], ("move", 0.35, 0.0))

    def test_one_blocked_frame_does_not_trigger_avoidance(self):
        classifier = FakeClassifier(outputs=[
            {"blocked_probability": 0.8, "free_probability": 0.2},
        ])
        controller = self.make_controller(classifier=classifier)
        controller.start()
        controller.motor_controller.actions.clear()

        outcome = controller.process_once()

        self.assertEqual(outcome, "blocked")
        self.assertEqual(controller.snapshot_status()["blocked_frames"], 1)
        self.assertEqual(controller.motor_controller.actions, [])

    def test_consecutive_blocked_frames_trigger_stop_reverse_turn(self):
        classifier = FakeClassifier(outputs=[
            {"blocked_probability": 0.8, "free_probability": 0.2},
            {"blocked_probability": 0.81, "free_probability": 0.19},
            {"blocked_probability": 0.82, "free_probability": 0.18},
        ])
        controller = self.make_controller(classifier=classifier)
        controller.start()
        controller.motor_controller.actions.clear()

        controller.process_once()
        controller.process_once()
        outcome = controller.process_once()

        self.assertEqual(outcome, "avoidance")
        self.assertEqual(controller.snapshot_status()["state"], STATE_FORWARD)
        self.assertEqual(
            controller.motor_controller.actions,
            [
                ("stop",),
                ("move", -0.3, 0.0),
                ("stop",),
                ("move", 0.0, ANY),
                ("stop",),
                ("move", 0.35, 0.0),
            ],
        )

    def test_missing_frames_stop_the_robot(self):
        from jetson_bridge.avoidance import StreamUnavailableError

        controller = self.make_controller(
            stream_client=FakeStreamClient(frames=[np.zeros((224, 224, 3), dtype=np.uint8), StreamUnavailableError("stream lost")]),
        )
        controller.start()
        controller.motor_controller.actions.clear()

        outcome = controller.process_once()

        self.assertEqual(outcome, "stream_error")
        self.assertEqual(controller.snapshot_status()["state"], STATE_ERROR)
        self.assertIn(("stop",), controller.motor_controller.actions)

    def test_inference_errors_stop_the_robot(self):
        controller = self.make_controller(
            classifier=FakeClassifier(outputs=[RuntimeError("bad inference")]),
        )
        controller.start()
        controller.motor_controller.actions.clear()

        outcome = controller.process_once()

        self.assertEqual(outcome, "inference_error")
        self.assertEqual(controller.snapshot_status()["state"], STATE_ERROR)
        self.assertIn(("stop",), controller.motor_controller.actions)

    def test_status_snapshot_returns_expected_fields(self):
        controller = self.make_controller()
        controller.start()
        status = controller.snapshot_status()

        for field in (
            "ok",
            "enabled",
            "mode",
            "state",
            "blocked_probability",
            "free_probability",
            "blocked_frames",
            "last_action",
            "last_turn_direction",
            "stream_connected",
            "model_loaded",
            "last_frame_time",
            "error",
        ):
            self.assertIn(field, status)

    def test_stop_sets_idle_and_disables_mode(self):
        controller = self.make_controller()
        controller.start()

        status = controller.stop()

        self.assertFalse(status["enabled"])
        self.assertEqual(status["state"], STATE_IDLE)


class DetectionDecisionTests(unittest.TestCase):
    def test_centered_large_obstacle_counts_as_blocked(self):
        blocked_probability = compute_blocked_probability_from_detections(
            boxes=np.array([[0.20, 0.30, 0.90, 0.80]], dtype=np.float32),
            scores=np.array([0.88], dtype=np.float32),
            classes=np.array([1.0], dtype=np.float32),
            num_detections=1,
            detection_min_score=0.5,
            obstacle_class_ids={1},
            obstacle_min_box_area=0.04,
            center_x_min=0.25,
            center_x_max=0.75,
            center_y_min=0.20,
            center_y_max=1.00,
        )
        self.assertAlmostEqual(blocked_probability, 0.88, places=5)

    def test_side_obstacle_is_ignored(self):
        blocked_probability = compute_blocked_probability_from_detections(
            boxes=np.array([[0.20, 0.00, 0.90, 0.20]], dtype=np.float32),
            scores=np.array([0.95], dtype=np.float32),
            classes=np.array([1.0], dtype=np.float32),
            num_detections=1,
            detection_min_score=0.5,
            obstacle_class_ids={1},
            obstacle_min_box_area=0.04,
            center_x_min=0.25,
            center_x_max=0.75,
            center_y_min=0.20,
            center_y_max=1.00,
        )
        self.assertEqual(blocked_probability, 0.0)


if __name__ == "__main__":
    unittest.main()

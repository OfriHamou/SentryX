from __future__ import annotations

from typing import Callable, Dict

SCALE = 1.0
DEADZONE = 0.6
MAX_OUT = 1.0


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def apply_deadzone(value: float) -> float:
    if abs(value) < 0.05:
        return 0.0
    if 0.0 < abs(value) < DEADZONE:
        return DEADZONE if value > 0 else -DEADZONE
    return value


def mix_drive(speed: float, rotation: float) -> Dict[str, float]:
    speed = clamp(float(speed), -1.0, 1.0)
    rotation = clamp(float(rotation), -1.0, 1.0)

    left = clamp((speed - rotation) * SCALE, -MAX_OUT, MAX_OUT)
    right = clamp((speed + rotation) * SCALE, -MAX_OUT, MAX_OUT)

    return {
        "rightspeed": apply_deadzone(right),
        "leftspeed": apply_deadzone(left),
        "speed": speed,
        "rotation": rotation,
    }


class MotorController:
    def __init__(self, motor_caller: Callable[..., object]):
        self._motor_caller = motor_caller

    def move(self, speed: float, rotation: float):
        command = mix_drive(speed, rotation)
        response = self._motor_caller(
            rightspeed=command["rightspeed"],
            leftspeed=command["leftspeed"],
        )
        return response, command

    def stop(self):
        return self._motor_caller(rightspeed=0.0, leftspeed=0.0)

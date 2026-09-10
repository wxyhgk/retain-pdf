from __future__ import annotations

from math import exp


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def sigmoid(value: float, *, slope: float = 8.0) -> float:
    return 1.0 / (1.0 + exp(-slope * value))


def centered_sigmoid_force(value: float, *, slope: float = 8.0) -> float:
    return clamp((sigmoid(value, slope=slope) - 0.5) * 2.0)


def exp_decay(value: float, *, strength: float = 2.2, floor: float = 0.2) -> float:
    return max(floor, exp(-strength * max(0.0, value)))


__all__ = [
    "centered_sigmoid_force",
    "clamp",
    "exp_decay",
    "sigmoid",
]

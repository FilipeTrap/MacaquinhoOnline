import math


def clamp_hunger(value: float) -> float:
    return min(100.0, max(0.0, float(value)))


def normalize(value: float, scale: float = 100.0) -> float:
    return float(value) / scale


def sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))

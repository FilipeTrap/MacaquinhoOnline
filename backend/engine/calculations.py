import math


def clamp_hunger(value: float) -> float:
    return min(100.0, max(0.0, float(value)))


def clamp(value: int, low: int, high: int) -> int:
    return min(high, max(low, value))


def normalize(value: float, scale: float = 100.0) -> float:
    return float(value) / scale


def sigmoid(value: float) -> float:
    return 1.0 / (1.0 + math.exp(-value))


def chebyshev_distance(a: dict, b: dict) -> int:
    return max(abs(a["x"] - b["x"]), abs(a["y"] - b["y"]))


def relieve_joy(joy_raw: float, feast: float, aversion_relief: float) -> float:
    """Felicidade boa satura com refeições seguidas; felicidade ruim alivia com desespero."""
    return max(joy_raw, 0.0) / (1.0 + feast) + min(joy_raw, 0.0) * aversion_relief


def relieve_harm(harm: float, aversion_weight: float, aversion_relief: float) -> float:
    """Quanto mais desesperado (fome perto de 100), menos o dano pesa contra comer."""
    return harm * aversion_weight * aversion_relief

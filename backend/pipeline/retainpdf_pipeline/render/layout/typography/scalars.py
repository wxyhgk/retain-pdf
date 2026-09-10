from __future__ import annotations


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def percentile_value(values: list[float], q: float) -> float:
    filtered = sorted(value for value in values if value > 0)
    if not filtered:
        return 0.0
    if len(filtered) == 1:
        return filtered[0]
    q = clamp(q, 0.0, 1.0)
    pos = (len(filtered) - 1) * q
    low = int(pos)
    high = min(len(filtered) - 1, low + 1)
    frac = pos - low
    return filtered[low] * (1.0 - frac) + filtered[high] * frac

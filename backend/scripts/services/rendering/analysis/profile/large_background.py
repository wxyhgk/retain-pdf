from __future__ import annotations


def has_large_background(coverage_ratio: float, *, threshold: float = 0.75) -> bool:
    return coverage_ratio >= threshold

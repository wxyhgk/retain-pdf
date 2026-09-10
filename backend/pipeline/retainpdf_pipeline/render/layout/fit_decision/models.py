from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FitFeatures:
    bbox_width_pt: float
    bbox_height_pt: float
    font_size_pt: float
    leading_em: float
    estimated_height_pt: float
    estimated_overflow_ratio: float
    formula_ratio: float
    confidence: float
    max_safe_shrink_pt: float
    formula_complexity: float = 0.0
    inline_formula_count: int = 0
    complex_formula_count: int = 0
    formula_count_ratio: float = 0.0
    height_estimate_discount: float = 1.0
    trust: float = 1.0


@dataclass(frozen=True)
class FitDecision:
    font_size_pt: float
    mode: str
    confidence: float
    reason_codes: tuple[str, ...] = field(default_factory=tuple)
    estimated_height_pt: float = 0.0
    overflow_ratio: float = 0.0
    formula_ratio: float = 0.0
    growth_pt: float = 0.0
    shrink_pt: float = 0.0


__all__ = [
    "FitDecision",
    "FitFeatures",
]

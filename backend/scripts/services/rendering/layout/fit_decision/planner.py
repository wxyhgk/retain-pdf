from __future__ import annotations

import re
from dataclasses import dataclass

from services.rendering.layout.chinese_body_fit import estimate_chinese_body_height_pt
from services.rendering.layout.fit_decision.curves import centered_sigmoid_force
from services.rendering.layout.fit_decision.curves import clamp
from services.rendering.layout.fit_decision.curves import exp_decay
from services.rendering.layout.fit_decision.models import FitDecision
from services.rendering.layout.fit_decision.models import FitFeatures


TARGET_FILL_RATIO = 0.86
MAX_GROWTH_PT = 0.35
MAX_SHRINK_PT = 0.6
FORMULA_COMPLEXITY_COMMAND_RE = re.compile(r"\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|delta|Delta|partial|mathbf|begin|overline|underline)")


@dataclass(frozen=True)
class _FormulaFeatures:
    inline_count: int
    complex_count: int
    count_ratio: float
    complexity: float


def _formula_text(entry: dict) -> str:
    return str(entry.get("formula_text", entry.get("latex", "")) or "")


def _formula_features(formula_map: list[dict], *, text: str) -> _FormulaFeatures:
    if not formula_map:
        return _FormulaFeatures(inline_count=0, complex_count=0, count_ratio=0.0, complexity=0.0)
    inline_count = len(formula_map)
    complex_count = 0
    complexity = 0.0
    for entry in formula_map:
        formula = _formula_text(entry)
        command_count = len(FORMULA_COMPLEXITY_COMMAND_RE.findall(formula))
        script_count = formula.count("^") + formula.count("_")
        complex_count += 1 if command_count > 0 else 0
        complexity += command_count * 0.16
        complexity += min(0.12, script_count * 0.025)
        complexity += min(0.06, max(0, len(formula) - 48) * 0.0015)
    text_units = max(1.0, len(re.sub(r"\s+", "", text)))
    count_ratio = inline_count / (inline_count + text_units / 12.0)
    return _FormulaFeatures(
        inline_count=inline_count,
        complex_count=complex_count,
        count_ratio=round(clamp(count_ratio), 3),
        complexity=round(clamp(complexity), 3),
    )


def _formula_trust(*, formula_ratio: float, formula_features: _FormulaFeatures) -> float:
    simple_count = max(0, formula_features.inline_count - formula_features.complex_count)
    formula_force = (
        formula_ratio * 0.65
        + formula_features.count_ratio * 0.55
        + simple_count * 0.055
        + formula_features.complex_count * 0.26
        + formula_features.complexity * 0.45
    )
    return exp_decay(formula_force, strength=1.35, floor=0.22)


def _height_estimate_discount(*, formula_ratio: float, formula_features: _FormulaFeatures) -> float:
    uncertainty = formula_ratio * 0.42 + formula_features.count_ratio * 0.38 + formula_features.complex_count * 0.05
    return 1.0 - 0.18 * centered_sigmoid_force(uncertainty, slope=3.0)


def _features(
    *,
    bbox_width_pt: float,
    bbox_height_pt: float,
    text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
) -> FitFeatures:
    estimate = estimate_chinese_body_height_pt(
        bbox_width_pt,
        text,
        formula_map,
        font_size_pt,
        leading_em,
    )
    formula_features = _formula_features(formula_map, text=text)
    trust = _formula_trust(formula_ratio=estimate.formula_ratio, formula_features=formula_features)
    height_discount = _height_estimate_discount(formula_ratio=estimate.formula_ratio, formula_features=formula_features)
    estimated_height_pt = estimate.estimated_height_pt * height_discount
    return FitFeatures(
        bbox_width_pt=bbox_width_pt,
        bbox_height_pt=bbox_height_pt,
        font_size_pt=font_size_pt,
        leading_em=leading_em,
        estimated_height_pt=estimated_height_pt,
        estimated_overflow_ratio=estimated_height_pt / max(bbox_height_pt, 1.0),
        formula_ratio=estimate.formula_ratio,
        confidence=estimate.confidence,
        max_safe_shrink_pt=estimate.max_safe_shrink_pt,
        formula_complexity=formula_features.complexity,
        inline_formula_count=formula_features.inline_count,
        complex_formula_count=formula_features.complex_count,
        formula_count_ratio=formula_features.count_ratio,
        height_estimate_discount=height_discount,
        trust=trust,
    )


def _reason_codes(features: FitFeatures, *, growth_pt: float, shrink_pt: float) -> tuple[str, ...]:
    reasons: list[str] = []
    if growth_pt > 0:
        reasons.append("underfilled_body")
    if shrink_pt > 0:
        reasons.append("height_pressure")
    if features.formula_ratio > 0:
        reasons.append("formula_weighted")
    if features.formula_complexity > 0:
        reasons.append("formula_complexity")
    if features.inline_formula_count > 0:
        reasons.append("formula_count_weighted")
    return tuple(reasons)


def _delta_font_pt(features: FitFeatures, max_growth_font_size_pt: float | None) -> tuple[float, float]:
    fill_ratio = features.estimated_overflow_ratio
    underfill_force = centered_sigmoid_force((TARGET_FILL_RATIO - fill_ratio) / TARGET_FILL_RATIO, slope=5.0)
    overflow_force = centered_sigmoid_force(fill_ratio - TARGET_FILL_RATIO, slope=4.2)
    growth_cap = MAX_GROWTH_PT
    if max_growth_font_size_pt is not None:
        growth_cap = min(growth_cap, max(0.0, max_growth_font_size_pt - features.font_size_pt))
    growth_pt = growth_cap * underfill_force * features.trust
    shrink_pt = min(MAX_SHRINK_PT, features.max_safe_shrink_pt) * overflow_force * features.trust * features.trust
    return round(growth_pt, 3), round(shrink_pt, 3)


def plan_chinese_body_fit(
    *,
    bbox_width_pt: float,
    bbox_height_pt: float,
    text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    max_growth_font_size_pt: float | None = None,
) -> FitDecision:
    features = _features(
        bbox_width_pt=bbox_width_pt,
        bbox_height_pt=bbox_height_pt,
        text=text,
        formula_map=formula_map,
        font_size_pt=font_size_pt,
        leading_em=leading_em,
    )
    growth_pt, shrink_pt = _delta_font_pt(features, max_growth_font_size_pt)
    next_font_size = round(font_size_pt + growth_pt - shrink_pt, 2)
    if max_growth_font_size_pt is not None:
        next_font_size = min(next_font_size, max_growth_font_size_pt)
    next_font_size = round(max(7.8, next_font_size), 2)
    reason_codes = _reason_codes(features, growth_pt=growth_pt, shrink_pt=shrink_pt)
    mode = "continuous_fit" if abs(next_font_size - font_size_pt) >= 0.005 else "fast_estimate"
    return FitDecision(
        font_size_pt=next_font_size,
        mode=mode,
        confidence=features.trust,
        reason_codes=reason_codes,
        estimated_height_pt=features.estimated_height_pt,
        overflow_ratio=features.estimated_overflow_ratio,
        formula_ratio=features.formula_ratio,
        growth_pt=round(growth_pt, 2),
        shrink_pt=round(shrink_pt, 2),
    )


__all__ = [
    "plan_chinese_body_fit",
]

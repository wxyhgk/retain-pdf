from __future__ import annotations

from retainpdf_pipeline.render.layout.payload.fit_common import TYPST_BINARY_FORMULA_RATIO_TRIGGER
from retainpdf_pipeline.render.layout.payload.fit_typst_context import TypstFitContext


def resolve_fit_height_pt(
    context: TypstFitContext,
    *,
    adjacent_collision_risk: bool,
    adjacent_available_height_pt: float | None,
) -> float:
    fit_height_pt = context.effective_container_height_pt
    if adjacent_collision_risk and adjacent_available_height_pt and adjacent_available_height_pt > 0:
        fit_height_pt = min(fit_height_pt, adjacent_available_height_pt)
    if context.source_height_limit_pt > 0:
        fit_height_pt = min(fit_height_pt, context.source_height_limit_pt)
    return max(8.0, fit_height_pt)


def resolve_min_font_size_pt(
    context: TypstFitContext,
    *,
    font_size_pt: float,
    page_body_font_size_pt: float | None,
) -> float:
    floor_gap = 1.1 if context.heavy_dense_small_box else (0.86 if context.dense_small_box else 0.62)
    if context.is_body and page_body_font_size_pt is not None:
        preferred_min_font = max(
            7.4 if context.heavy_dense_small_box else 7.8,
            min(font_size_pt, page_body_font_size_pt - floor_gap),
        )
    else:
        preferred_min_font = max(8.4, font_size_pt - (0.44 if context.dense_small_box else 0.3))

    overflow_excess = max(0.0, context.effective_overflow_ratio - 1.0)
    overflow_relief_font = overflow_excess / (overflow_excess + 0.75) if overflow_excess > 0 else 0.0
    if context.is_body:
        min_font_floor = 6.6 if context.heavy_dense_small_box else (6.9 if context.dense_small_box else 7.1)
        shrink_cap = 0.52 if context.heavy_dense_small_box else (0.48 if context.dense_small_box else 0.42)
    else:
        min_font_floor = 7.0
        shrink_cap = 0.36
    dynamic_font_scale = 1.0 - shrink_cap * (overflow_relief_font**1.35)
    dynamic_min_font = max(min_font_floor, font_size_pt * dynamic_font_scale)
    preferred_min_font = min(preferred_min_font, dynamic_min_font)
    if context.inherited_font_floor > 0:
        preferred_min_font = max(preferred_min_font, min(font_size_pt, context.inherited_font_floor))
    if preferred_min_font >= font_size_pt - 0.04:
        return max(
            min_font_floor,
            font_size_pt - (0.18 if context.effective_overflow_ratio >= 1.12 or context.heavy_dense_small_box else 0.12),
        )
    return preferred_min_font


def resolve_min_leading_em(
    context: TypstFitContext,
    *,
    leading_em: float,
) -> float:
    if leading_em <= 0.54 and context.is_body:
        leading_floor_base = 0.46 if context.formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else 0.44
        leading_delta = 0.01
    elif not context.is_body:
        leading_floor_base = 0.22 if context.formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else 0.18
        leading_delta = 0.06 if context.effective_overflow_ratio >= 1.08 else 0.04
    else:
        leading_floor_base = 0.56 if context.formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else 0.54
        leading_delta = (
            0.02
            if context.formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER
            else (0.04 if context.effective_overflow_ratio >= 1.12 else 0.03)
        )
    if context.effective_overflow_ratio > 1.0:
        overflow_relief = min(1.0, (context.effective_overflow_ratio - 1.0) / 1.2)
        dynamic_leading_floor = leading_em - overflow_relief * (0.08 if context.is_body else 0.12)
        absolute_leading_floor = 0.42 if context.is_body else 0.18
        leading_floor_base = min(leading_floor_base, max(absolute_leading_floor, dynamic_leading_floor))
        leading_delta = max(leading_delta, 0.02 + overflow_relief * (0.04 if context.is_body else 0.06))
    min_leading = max(leading_floor_base, leading_em - leading_delta)
    return min(min_leading, leading_em)

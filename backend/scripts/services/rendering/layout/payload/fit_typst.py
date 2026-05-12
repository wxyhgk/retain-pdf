from __future__ import annotations

from services.rendering.layout.payload.capacity import box_capacity_units
from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.capacity import text_demand_units
from services.rendering.layout.payload.fit_common import TYPST_BINARY_COLLISION_OVERFLOW_TRIGGER
from services.rendering.layout.payload.fit_common import TYPST_BINARY_DEMAND_TRIGGER
from services.rendering.layout.payload.fit_common import TYPST_BINARY_DENSE_LAYOUT_TRIGGER
from services.rendering.layout.payload.fit_common import TYPST_BINARY_FORMULA_OVERFLOW_TRIGGER
from services.rendering.layout.payload.fit_common import TYPST_BINARY_FORMULA_RATIO_TRIGGER
from services.rendering.layout.payload.fit_common import TYPST_BINARY_OVERFLOW_TRIGGER
from services.rendering.layout.payload.fit_common import TYPST_BINARY_SOURCE_HEIGHT_TRIGGER
from services.rendering.layout.payload.fit_common import fit_inner_bbox
from services.rendering.layout.payload.shared import layout_density_ratio
from services.rendering.layout.typography.measurement import formula_ratio
from services.rendering.layout.typography.measurement import source_text_height_limit_pt
from services.rendering.layout.typography.measurement import visual_line_count


def resolve_typst_binary_fit(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    *,
    page_body_font_size_pt: float | None = None,
    prefer_typst_fit: bool = False,
    adjacent_collision_risk: bool = False,
    adjacent_available_height_pt: float | None = None,
) -> tuple[bool, float, float, float]:
    inner = fit_inner_bbox(item)
    if len(inner) != 4:
        return False, 0.0, 0.0, 0.0

    container_height_pt = max(8.0, inner[3] - inner[1])
    source_height_limit = min(container_height_pt, source_text_height_limit_pt(item))
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    demand = text_demand_units(protected_text, formula_map)
    capacity = box_capacity_units(inner, font_size_pt, leading_em, visual_lines=visual_line_count(item))
    estimated_height = estimated_render_height_pt(inner, protected_text, formula_map, font_size_pt, leading_em)
    layout_density = layout_density_ratio(inner, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
    overflow_ratio = estimated_height / max(container_height_pt, 1.0)
    source_overflow_ratio = estimated_height / max(source_height_limit, 1.0) if source_height_limit > 0 else 0.0
    adjacent_overflow_ratio = (
        estimated_height / max(adjacent_available_height_pt, 1.0)
        if adjacent_collision_risk and adjacent_available_height_pt and adjacent_available_height_pt > 0
        else 0.0
    )
    effective_overflow_ratio = max(overflow_ratio, adjacent_overflow_ratio, source_overflow_ratio)
    demand_ratio = demand / max(capacity, 1.0)
    formula_weight = formula_ratio(item)
    dense_small_box = bool(item.get("_dense_small_box", False))
    heavy_dense_small_box = bool(item.get("_heavy_dense_small_box", False))
    is_body = bool(item.get("_is_body_text_candidate", False))

    should_fit = (
        prefer_typst_fit
        or overflow_ratio >= TYPST_BINARY_OVERFLOW_TRIGGER
        or source_overflow_ratio >= TYPST_BINARY_SOURCE_HEIGHT_TRIGGER
        or demand_ratio >= TYPST_BINARY_DEMAND_TRIGGER
        or (is_body and dense_small_box and layout_density >= TYPST_BINARY_DENSE_LAYOUT_TRIGGER)
        or (
            formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER
            and overflow_ratio >= TYPST_BINARY_FORMULA_OVERFLOW_TRIGGER
        )
        or (adjacent_collision_risk and adjacent_overflow_ratio >= TYPST_BINARY_COLLISION_OVERFLOW_TRIGGER)
    )
    if not should_fit:
        return False, 0.0, 0.0, 0.0

    fit_height_pt = container_height_pt
    if adjacent_collision_risk and adjacent_available_height_pt and adjacent_available_height_pt > 0:
        fit_height_pt = min(fit_height_pt, adjacent_available_height_pt)
    if source_height_limit > 0:
        fit_height_pt = min(fit_height_pt, source_height_limit)
    fit_height_pt = max(8.0, fit_height_pt)

    floor_gap = 0.52 if heavy_dense_small_box else (0.38 if dense_small_box else 0.24)
    if is_body and page_body_font_size_pt is not None:
        preferred_min_font = max(8.85, min(font_size_pt, page_body_font_size_pt - floor_gap))
    else:
        preferred_min_font = max(8.4, font_size_pt - (0.44 if dense_small_box else 0.3))
    overflow_excess = max(0.0, effective_overflow_ratio - 1.0)
    overflow_relief_font = overflow_excess / (overflow_excess + 0.75) if overflow_excess > 0 else 0.0
    if is_body:
        min_font_floor = 6.8 if heavy_dense_small_box else (7.0 if dense_small_box else 7.2)
        shrink_cap = 0.42 if heavy_dense_small_box else (0.38 if dense_small_box else 0.34)
    else:
        min_font_floor = 7.0
        shrink_cap = 0.36
    dynamic_font_scale = 1.0 - shrink_cap * (overflow_relief_font**1.35)
    dynamic_min_font = max(min_font_floor, font_size_pt * dynamic_font_scale)
    preferred_min_font = min(preferred_min_font, dynamic_min_font)
    if preferred_min_font >= font_size_pt - 0.04:
        min_font = max(min_font_floor, font_size_pt - (0.18 if effective_overflow_ratio >= 1.12 or heavy_dense_small_box else 0.12))
    else:
        min_font = preferred_min_font

    if leading_em <= 0.54 and is_body:
        leading_floor_base = 0.26 if formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else 0.24
        leading_delta = 0.02
    elif not is_body:
        leading_floor_base = 0.22 if formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else 0.18
        leading_delta = 0.06 if effective_overflow_ratio >= 1.08 else 0.04
    else:
        leading_floor_base = 0.56 if formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else 0.54
        leading_delta = 0.02 if formula_weight >= TYPST_BINARY_FORMULA_RATIO_TRIGGER else (0.04 if effective_overflow_ratio >= 1.12 else 0.03)
    if effective_overflow_ratio > 1.0:
        overflow_relief = min(1.0, (effective_overflow_ratio - 1.0) / 1.2)
        dynamic_leading_floor = leading_em - overflow_relief * (0.22 if is_body else 0.12)
        absolute_leading_floor = 0.36 if is_body else 0.18
        leading_floor_base = min(leading_floor_base, max(absolute_leading_floor, dynamic_leading_floor))
        leading_delta = max(leading_delta, 0.03 + overflow_relief * (0.11 if is_body else 0.06))
    min_leading = max(leading_floor_base, leading_em - leading_delta)
    min_leading = min(min_leading, leading_em)

    return True, round(min_font, 2), round(min_leading, 2), round(fit_height_pt, 2)

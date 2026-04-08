from __future__ import annotations

from services.rendering.layout.payload.capacity import box_capacity_units
from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.capacity import text_demand_units
from services.rendering.layout.payload.shared import COMPACT_TRIGGER_RATIO
from services.rendering.layout.payload.shared import HEAVY_COMPACT_RATIO
from services.rendering.layout.payload.shared import LAYOUT_COMPACT_TRIGGER_RATIO
from services.rendering.layout.payload.shared import LAYOUT_HEAVY_COMPACT_RATIO
from services.rendering.layout.payload.shared import layout_density_ratio
from services.rendering.layout.payload.shared import translation_density_ratio
from services.rendering.layout.typography.geometry import inner_bbox
from services.rendering.layout.typography.measurement import formula_ratio
from services.rendering.layout.typography.measurement import source_text_height_limit_pt
from services.rendering.layout.typography.measurement import visual_line_count


VERTICAL_COLLISION_GAP_PT = 0.9
LAYOUT_DENSITY_SAFE_MAX = 0.89
LAYOUT_DENSITY_SAFE_MIN = 0.62
AGGRESSIVE_DEMAND_RATIO = 1.16
AGGRESSIVE_LAYOUT_DENSITY_MARGIN = 0.12
TYPST_BINARY_OVERFLOW_TRIGGER = 1.08
TYPST_BINARY_DEMAND_TRIGGER = 1.10
TYPST_BINARY_DENSE_LAYOUT_TRIGGER = 0.92
TYPST_BINARY_FORMULA_RATIO_TRIGGER = 0.08
TYPST_BINARY_FORMULA_OVERFLOW_TRIGGER = 1.04
TYPST_BINARY_COLLISION_OVERFLOW_TRIGGER = 1.02
TYPST_BINARY_SOURCE_HEIGHT_TRIGGER = 1.01


def fit_translated_block_metrics(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    page_body_font_size_pt: float | None = None,
) -> tuple[float, float]:
    demand = text_demand_units(protected_text, formula_map)
    box = inner_bbox(item)
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    length_density_ratio = translation_density_ratio(item, protected_text)
    layout_density = layout_density_ratio(box, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
    is_dense_block = length_density_ratio >= COMPACT_TRIGGER_RATIO or layout_density >= LAYOUT_COMPACT_TRIGGER_RATIO
    is_heavy_dense_block = length_density_ratio >= HEAVY_COMPACT_RATIO or layout_density >= LAYOUT_HEAVY_COMPACT_RATIO
    dense_small_box = bool(item.get("_dense_small_box", False))
    heavy_dense_small_box = bool(item.get("_heavy_dense_small_box", False))
    visual_lines = visual_line_count(item)
    wide_aspect_body_text = bool(item.get("_wide_aspect_body_text", False))

    if item.get("_is_body_text_candidate", False) and page_body_font_size_pt is not None:
        floor_gap = 0.58 if heavy_dense_small_box else (0.34 if dense_small_box else 0.12)
        if wide_aspect_body_text:
            floor_gap = max(0.0, floor_gap - 0.1)
        font_size_pt = round(max(font_size_pt, page_body_font_size_pt - floor_gap), 2)
    if demand <= 0:
        return font_size_pt, leading_em

    capacity = box_capacity_units(box, font_size_pt, leading_em, visual_lines=visual_lines)
    safe_capacity_ratio = 1.0 if wide_aspect_body_text else 0.96
    safe_layout_density = (LAYOUT_DENSITY_SAFE_MAX + 0.03) if wide_aspect_body_text else LAYOUT_DENSITY_SAFE_MAX
    if capacity <= 0 or (demand <= capacity * safe_capacity_ratio and layout_density < safe_layout_density):
        return font_size_pt, leading_em

    aggressive_fit = (
        heavy_dense_small_box
        or (
            dense_small_box
            and capacity > 0
            and demand > capacity * 1.04
            and layout_density >= LAYOUT_DENSITY_SAFE_MAX + 0.03
        )
        or (
            capacity > 0
            and demand > capacity * (AGGRESSIVE_DEMAND_RATIO + 0.1)
            and layout_density >= LAYOUT_DENSITY_SAFE_MAX + AGGRESSIVE_LAYOUT_DENSITY_MARGIN
        )
    )
    best_font = font_size_pt
    best_leading = leading_em

    if item.get("_is_body_text_candidate", False):
        if wide_aspect_body_text:
            max_steps = 1 if aggressive_fit else 0
        else:
            max_steps = 2 if aggressive_fit else (1 if is_dense_block else 0)
    else:
        max_steps = 4 if aggressive_fit else (2 if is_dense_block else 1)
    min_font = max(
        8.9 if dense_small_box or is_dense_block else 9.05,
        (page_body_font_size_pt - (0.62 if heavy_dense_small_box else 0.4 if dense_small_box else 0.18))
        if page_body_font_size_pt is not None
        else (8.9 if dense_small_box or is_dense_block else 9.05),
    )
    if wide_aspect_body_text:
        min_font = max(min_font, font_size_pt - 0.06)
    for step in range(1, max_steps + 1):
        candidate_font = round(max(min_font, font_size_pt - step * 0.12), 2)
        candidate_capacity = box_capacity_units(box, candidate_font, leading_em, visual_lines=visual_lines)
        if demand <= candidate_capacity * 0.98:
            return candidate_font, leading_em
        best_font = candidate_font

    if item.get("_is_body_text_candidate", False):
        if not aggressive_fit:
            return best_font, best_leading
        emergency_leading = round(
            max(0.56 if dense_small_box or is_dense_block else 0.58, leading_em - (0.02 if dense_small_box or is_dense_block else 0.01)),
            2,
        )
        emergency_min_font = max(
            8.85 if dense_small_box or is_dense_block else 8.95,
            (page_body_font_size_pt - (0.7 if heavy_dense_small_box else 0.5 if dense_small_box else 0.28))
            if page_body_font_size_pt is not None
            else (8.85 if dense_small_box or is_dense_block else 8.95),
        )
        for step in range(1, 4 if dense_small_box or is_dense_block else 2):
            candidate_font = round(max(emergency_min_font, best_font - step * 0.1), 2)
            candidate_capacity = box_capacity_units(box, candidate_font, emergency_leading, visual_lines=visual_lines)
            if demand <= candidate_capacity * 0.98:
                return candidate_font, emergency_leading
            best_font = candidate_font
        return best_font, emergency_leading

    return best_font, best_leading


def fit_block_to_vertical_limit(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    max_height_pt: float,
    *,
    page_body_font_size_pt: float | None = None,
) -> tuple[float, float]:
    inner = inner_bbox(item)
    if len(inner) != 4 or max_height_pt <= 0:
        return font_size_pt, leading_em
    estimated_height = estimated_render_height_pt(inner, protected_text, formula_map, font_size_pt, leading_em)
    if estimated_height <= max_height_pt * 1.02:
        return font_size_pt, leading_em

    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    length_density_ratio = translation_density_ratio(item, protected_text)
    layout_density = layout_density_ratio(inner, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
    is_dense_block = length_density_ratio >= COMPACT_TRIGGER_RATIO or layout_density >= LAYOUT_COMPACT_TRIGGER_RATIO
    is_body = bool(item.get("_is_body_text_candidate", False))
    min_font = 8.95 if is_dense_block else 9.05
    if is_body and page_body_font_size_pt is not None:
        min_font = min(min_font, page_body_font_size_pt - 0.5)
    min_font = max(8.2, min_font)

    best_font = font_size_pt
    best_leading = leading_em
    for _ in range(10):
        if estimated_height <= max_height_pt * 1.01:
            return round(best_font, 2), round(best_leading, 2)
        if best_font > min_font:
            best_font = max(min_font, best_font - (0.1 if is_dense_block else 0.08))
        elif best_leading > (0.54 if is_body else 0.3):
            best_leading = max((0.54 if is_body else 0.3), best_leading - 0.01)
        else:
            break
        estimated_height = estimated_render_height_pt(inner, protected_text, formula_map, best_font, best_leading)

    overflow_ratio = estimated_height / max(max_height_pt, 1.0)
    if overflow_ratio > 1.02:
        severe_overflow = overflow_ratio > 1.22
        extreme_overflow = overflow_ratio > 1.5
        compressed_leading_boost = 1.10
        floor_leading = 0.5 if is_body else 0.28
        if is_dense_block:
            floor_leading = 0.46 if is_body else 0.24
        if severe_overflow:
            floor_leading = min(floor_leading, 0.28 if is_body else 0.22)
        if extreme_overflow:
            floor_leading = min(floor_leading, 0.18 if is_body else 0.16)
        floor_leading = min(leading_em, floor_leading * compressed_leading_boost)
        dense_min_font = min_font
        if is_body and page_body_font_size_pt is not None:
            dense_min_font = max(6.6, min(dense_min_font, page_body_font_size_pt - (2.0 if severe_overflow else 1.2)))
        else:
            dense_min_font = max(6.4, dense_min_font - (1.8 if severe_overflow else 1.0))
        for _ in range(18):
            if estimated_height <= max_height_pt * 1.01:
                break
            if best_leading > floor_leading:
                best_leading = max(floor_leading, best_leading - (0.05 if severe_overflow else 0.04))
            if estimated_height > max_height_pt * 1.04 and best_font > dense_min_font:
                best_font = max(dense_min_font, best_font - (0.18 if severe_overflow else 0.14))
            estimated_height = estimated_render_height_pt(inner, protected_text, formula_map, best_font, best_leading)

    return round(best_font, 2), round(best_leading, 2)


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
    inner = inner_bbox(item)
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

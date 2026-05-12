from __future__ import annotations

from services.rendering.layout.payload.capacity import box_capacity_units
from services.rendering.layout.payload.capacity import text_demand_units
from services.rendering.layout.payload.fit_common import AGGRESSIVE_DEMAND_RATIO
from services.rendering.layout.payload.fit_common import AGGRESSIVE_LAYOUT_DENSITY_MARGIN
from services.rendering.layout.payload.fit_common import LAYOUT_DENSITY_SAFE_MAX
from services.rendering.layout.payload.fit_common import fit_inner_bbox
from services.rendering.layout.payload.shared import COMPACT_TRIGGER_RATIO
from services.rendering.layout.payload.shared import HEAVY_COMPACT_RATIO
from services.rendering.layout.payload.shared import LAYOUT_COMPACT_TRIGGER_RATIO
from services.rendering.layout.payload.shared import LAYOUT_HEAVY_COMPACT_RATIO
from services.rendering.layout.payload.shared import layout_density_ratio
from services.rendering.layout.payload.shared import translation_density_ratio
from services.rendering.layout.typography.measurement import visual_line_count


def fit_translated_block_metrics(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    page_body_font_size_pt: float | None = None,
) -> tuple[float, float]:
    demand = text_demand_units(protected_text, formula_map)
    box = fit_inner_bbox(item)
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    length_density_ratio = translation_density_ratio(item, protected_text)
    layout_density = layout_density_ratio(box, protected_text, font_size_pt=font_size_pt, line_step_pt=line_step)
    is_dense_block = length_density_ratio >= COMPACT_TRIGGER_RATIO or layout_density >= LAYOUT_COMPACT_TRIGGER_RATIO
    heavy_dense_small_box = bool(item.get("_heavy_dense_small_box", False))
    dense_small_box = bool(item.get("_dense_small_box", False))
    wide_aspect_body_text = bool(item.get("_wide_aspect_body_text", False))
    visual_lines = visual_line_count(item)

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

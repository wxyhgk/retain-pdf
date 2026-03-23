from __future__ import annotations

import re

from rendering.font_fit import estimate_font_size_pt
from rendering.font_fit import estimate_leading_em
from rendering.font_fit import inner_bbox
from rendering.font_fit import is_body_text_candidate
from rendering.font_fit import visual_line_count
from rendering.render_payload_parts.shared import COMPACT_TRIGGER_RATIO
from rendering.render_payload_parts.shared import HEAVY_COMPACT_RATIO
from rendering.render_payload_parts.shared import tokenize_protected_text
from rendering.render_payload_parts.shared import token_units
from rendering.render_payload_parts.shared import translation_density_ratio


def block_metrics(
    item: dict,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
    page_text_width_med: float,
) -> tuple[float, float]:
    item = dict(item)
    item["_is_body_text_candidate"] = is_body_text_candidate(item, page_text_width_med)
    font_size_pt = estimate_font_size_pt(
        item,
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
    )
    leading_em = estimate_leading_em(item, page_line_pitch, font_size_pt)
    return font_size_pt, leading_em


def box_capacity_units(
    inner: list[float],
    font_size_pt: float,
    leading_em: float,
    visual_lines: int | None = None,
) -> float:
    if len(inner) != 4:
        return 0.0
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    line_step = max(font_size_pt * 1.02, font_size_pt * (1.0 + leading_em))
    lines = max(1, int(height / line_step))
    if visual_lines and visual_lines > 1:
        lines = min(lines, max(1, visual_lines + 1))
    chars_per_line = max(4.0, width / max(font_size_pt * 0.92, 1.0))
    return lines * chars_per_line * 0.98


def text_demand_units(protected_text: str, formula_map: list[dict]) -> float:
    if not protected_text:
        return 0.0
    formula_lookup = {entry["placeholder"]: entry["formula_text"] for entry in formula_map}
    return sum(token_units(token, formula_lookup) for token in tokenize_protected_text(protected_text))


def fit_translated_block_metrics(
    item: dict,
    protected_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
    page_body_font_size_pt: float | None = None,
) -> tuple[float, float]:
    demand = text_demand_units(protected_text, formula_map)
    density_ratio = translation_density_ratio(item, protected_text)
    is_dense_block = density_ratio >= COMPACT_TRIGGER_RATIO
    is_heavy_dense_block = density_ratio >= HEAVY_COMPACT_RATIO
    visual_lines = visual_line_count(item)
    if item.get("_is_body_text_candidate", False) and page_body_font_size_pt is not None:
        floor_gap = 0.85 if is_heavy_dense_block else (0.65 if is_dense_block else 0.45)
        font_size_pt = round(max(font_size_pt, page_body_font_size_pt - floor_gap), 2)
    if demand <= 0:
        return font_size_pt, leading_em

    box = inner_bbox(item)
    capacity = box_capacity_units(box, font_size_pt, leading_em, visual_lines=visual_lines)
    if capacity <= 0 or demand <= capacity * 0.96:
        return font_size_pt, leading_em

    best_font = font_size_pt
    best_leading = leading_em

    max_steps = 7 if (item.get("_is_body_text_candidate", False) and is_dense_block) else (4 if item.get("_is_body_text_candidate", False) else 7)
    min_font = max(
        8.8 if is_dense_block else 9.0,
        (page_body_font_size_pt - (0.7 if is_heavy_dense_block else 0.55 if is_dense_block else 0.4))
        if page_body_font_size_pt is not None
        else (8.8 if is_dense_block else 9.0),
    )
    for step in range(1, max_steps + 1):
        candidate_font = round(max(min_font, font_size_pt - step * 0.15), 2)
        candidate_capacity = box_capacity_units(box, candidate_font, leading_em, visual_lines=visual_lines)
        if demand <= candidate_capacity * 0.98:
            return candidate_font, leading_em
        best_font = candidate_font

    if item.get("_is_body_text_candidate", False):
        emergency_leading = round(max(0.42 if is_dense_block else 0.5, leading_em - (0.12 if is_dense_block else 0.08)), 2)
        emergency_min_font = max(
            8.6 if is_dense_block else 8.8,
            (page_body_font_size_pt - (0.9 if is_heavy_dense_block else 0.75 if is_dense_block else 0.6))
            if page_body_font_size_pt is not None
            else (8.6 if is_dense_block else 8.8),
        )
        for step in range(1, 9 if is_dense_block else 6):
            candidate_font = round(max(emergency_min_font, best_font - step * 0.12), 2)
            candidate_capacity = box_capacity_units(box, candidate_font, emergency_leading, visual_lines=visual_lines)
            if demand <= candidate_capacity * 0.98:
                return candidate_font, emergency_leading
            best_font = candidate_font
        return best_font, emergency_leading

    return best_font, best_leading

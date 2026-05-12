from __future__ import annotations

from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.fit_common import fit_inner_bbox
from services.rendering.layout.payload.shared import COMPACT_TRIGGER_RATIO
from services.rendering.layout.payload.shared import LAYOUT_COMPACT_TRIGGER_RATIO
from services.rendering.layout.payload.shared import layout_density_ratio
from services.rendering.layout.payload.shared import translation_density_ratio


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
    inner = fit_inner_bbox(item)
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

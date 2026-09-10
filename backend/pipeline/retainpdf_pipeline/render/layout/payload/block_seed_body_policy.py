from __future__ import annotations

from retainpdf_pipeline.render.layout.payload.capacity import estimated_render_height_pt


SMALL_PAGE_BOX_RATIO = 0.06
ULTRA_SMALL_PAGE_BOX_RATIO = 0.04
GEOMETRY_DENSE_TRIGGER = 0.86
GEOMETRY_HEAVY_DENSE_TRIGGER = 0.98
LENGTH_DENSITY_AUX_TRIGGER = 1.18
WIDE_ASPECT_BODY_RATIO = 3.6
WIDE_ASPECT_BODY_FONT_BOOST_PT = 0.28
WIDE_ASPECT_BODY_LEADING_TARGET = 0.46
WIDE_ASPECT_BODY_LEADING_STEP = 0.02
WIDE_ASPECT_BODY_MIN_SLACK_PT = 2.8
DENSE_BODY_FONT_MAX_PT = 10.35
HEAVY_DENSE_BODY_FONT_MAX_PT = 10.2


def relax_wide_aspect_body_leading(
    inner: list[float],
    translated_text: str,
    formula_map: list[dict],
    font_size_pt: float,
    leading_em: float,
) -> float:
    if len(inner) != 4:
        return leading_em
    available_height_pt = max(8.0, inner[3] - inner[1])
    candidate = leading_em
    while candidate + WIDE_ASPECT_BODY_LEADING_STEP <= WIDE_ASPECT_BODY_LEADING_TARGET:
        next_leading = round(candidate + WIDE_ASPECT_BODY_LEADING_STEP, 2)
        next_height = estimated_render_height_pt(inner, translated_text, formula_map, font_size_pt, next_leading)
        if next_height > available_height_pt - WIDE_ASPECT_BODY_MIN_SLACK_PT:
            break
        candidate = next_leading
    return candidate


def is_dense_small_box(
    *,
    density_ratio: float,
    layout_density: float,
    page_box_area_ratio: float,
) -> bool:
    if not 0 < page_box_area_ratio <= SMALL_PAGE_BOX_RATIO:
        return False
    if layout_density >= GEOMETRY_DENSE_TRIGGER:
        return True
    return density_ratio >= LENGTH_DENSITY_AUX_TRIGGER and layout_density >= GEOMETRY_DENSE_TRIGGER - 0.08


def is_heavy_dense_small_box(
    *,
    density_ratio: float,
    layout_density: float,
    page_box_area_ratio: float,
    heavy_compact_ratio: float,
) -> bool:
    if not 0 < page_box_area_ratio <= ULTRA_SMALL_PAGE_BOX_RATIO:
        return False
    if layout_density >= GEOMETRY_HEAVY_DENSE_TRIGGER:
        return True
    return density_ratio >= max(heavy_compact_ratio, LENGTH_DENSITY_AUX_TRIGGER) and layout_density >= GEOMETRY_DENSE_TRIGGER


def is_wide_aspect_body_text(
    *,
    is_body: bool,
    block_width: float,
    block_height: float,
) -> bool:
    return bool(is_body and block_height > 0 and (block_width / block_height) >= WIDE_ASPECT_BODY_RATIO)


def adjust_body_seed_font_size(
    *,
    font_size_pt: float,
    page_body_font_size_pt: float | None,
    is_body: bool,
    dense_small_box: bool,
    heavy_dense_small_box: bool,
    wide_aspect_body_text: bool,
) -> float:
    if not is_body or page_body_font_size_pt is None:
        return font_size_pt

    down_band = 0.34 if heavy_dense_small_box else (0.2 if dense_small_box else 0.06)
    up_band = 0.18 if dense_small_box else 0.24
    adjusted = round(min(max(font_size_pt, page_body_font_size_pt - down_band), page_body_font_size_pt + up_band), 2)
    if dense_small_box:
        dense_cap = HEAVY_DENSE_BODY_FONT_MAX_PT if heavy_dense_small_box else DENSE_BODY_FONT_MAX_PT
        adjusted = round(min(adjusted, dense_cap), 2)
    if wide_aspect_body_text:
        adjusted = round(min(page_body_font_size_pt + up_band, adjusted + WIDE_ASPECT_BODY_FONT_BOOST_PT), 2)
    return adjusted

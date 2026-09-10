from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from retainpdf_pipeline.render.semantics.item_view import is_caption_like_block
from retainpdf_pipeline.render.semantics.item_view import is_footnote_like_block
from retainpdf_pipeline.render.layout.font_fit import estimate_font_size_pt
from retainpdf_pipeline.render.layout.font_fit import estimate_leading_em
from retainpdf_pipeline.render.layout.font_fit import is_body_text_candidate
from retainpdf_pipeline.render.layout.font_fit import page_baseline_font_size
from retainpdf_pipeline.render.layout.font_fit import percentile_value
from retainpdf_pipeline.render.layout.payload.geometry_adjustments import build_effective_inner_bboxes
from retainpdf_pipeline.render.layout.typography.measurement import bbox_width
from retainpdf_pipeline.render.semantics.item_view import block_kind


BODY_PAGE_FONT_ANCHOR_PERCENTILE = 0.46
BODY_PAGE_FONT_FLOOR_DELTA_PT = 0.38


@dataclass(frozen=True)
class PageSeedMetrics:
    page_font_size: float
    page_line_pitch: float
    page_line_height: float
    density_baseline: float
    page_text_width_med: float
    body_flags: dict[int, bool]
    base_metrics: dict[int, tuple[float, float]]
    effective_inner_bboxes: dict[int, list[float]]
    page_body_font_size_pt: float | None
    page_body_width_pt: float | None


def is_annotation_like(item: dict) -> bool:
    return is_caption_like_block(item) or is_footnote_like_block(item)


def collect_page_seed_metrics(
    translated_items: list[dict],
    *,
    page_width: float | None = None,
) -> PageSeedMetrics:
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(translated_items)
    text_widths = [bbox_width(item) for item in translated_items if block_kind(item) == "text" and not is_annotation_like(item)]
    page_text_width_med = median(text_widths) if text_widths else 0.0
    body_base_sizes: list[float] = []
    body_flags: dict[int, bool] = {}
    base_metrics: dict[int, tuple[float, float]] = {}

    for index, item in enumerate(translated_items):
        is_body = is_body_text_candidate(item, page_text_width_med)
        item_with_flag = {**item, "_is_body_text_candidate": is_body}
        body_flags[index] = is_body
        font_size_pt = estimate_font_size_pt(
            item_with_flag,
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
        )
        leading_em = estimate_leading_em(item_with_flag, page_line_pitch, font_size_pt)
        base_metrics[index] = (font_size_pt, leading_em)
        if is_body:
            body_base_sizes.append(font_size_pt)

    page_body_font_size_pt = round(percentile_value(body_base_sizes, BODY_PAGE_FONT_ANCHOR_PERCENTILE), 2) if body_base_sizes else None
    if page_body_font_size_pt is not None and page_font_size > 0:
        page_body_font_size_pt = round(max(page_body_font_size_pt, page_font_size - BODY_PAGE_FONT_FLOOR_DELTA_PT), 2)
    body_widths = [bbox_width(item) for index, item in enumerate(translated_items) if body_flags.get(index)]
    page_body_width_pt = median(body_widths) if body_widths else None
    effective_inner_bboxes = build_effective_inner_bboxes(
        translated_items,
        body_flags=body_flags,
        page_width=page_width,
    )

    return PageSeedMetrics(
        page_font_size=page_font_size,
        page_line_pitch=page_line_pitch,
        page_line_height=page_line_height,
        density_baseline=density_baseline,
        page_text_width_med=page_text_width_med,
        body_flags=body_flags,
        base_metrics=base_metrics,
        effective_inner_bboxes=effective_inner_bboxes,
        page_body_font_size_pt=page_body_font_size_pt,
        page_body_width_pt=page_body_width_pt,
    )

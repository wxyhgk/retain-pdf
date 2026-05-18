from __future__ import annotations

from foundation.config import fonts
from foundation.config import layout
from services.rendering.layout.font_roles import is_caption_like_block
from services.rendering.layout.font_roles import is_footnote_like_block
from services.rendering.layout.font_roles import is_local_textual_item
from services.rendering.layout.typography.measurement import clamp
from services.rendering.layout.typography.measurement import local_font_metric
from services.rendering.layout.typography.measurement import local_line_pitch
from services.rendering.layout.typography.measurement import median_line_height
from services.rendering.layout.typography.measurement import median_line_pitch
from services.rendering.layout.typography.measurement import source_compactness_score


MIN_FONT_SIZE_PT = 8.4
MAX_FONT_SIZE_PT = 11.6
MAX_LOCAL_FONT_SIZE_PT = 14.2
LOCAL_BLOCK_SCALE_MIN = 0.97
LOCAL_BLOCK_SCALE_MAX = 1.03
CAPTION_FONT_SCALE = 0.92
FOOTNOTE_FONT_SCALE = 0.78
FOOTNOTE_MIN_FONT_SIZE_PT = 6.6
BODY_PAGE_BLEND_BASE = 0.86
BODY_PAGE_BLEND_MIN = 0.74
BODY_COMPACT_FONT_SCALE_MAX = 0.04
WIDE_ASPECT_PAGE_BLEND_REDUCTION = 0.14
WIDE_ASPECT_COMPACT_FONT_SCALE_MAX = 0.018


def local_font_size_pt(item: dict) -> float:
    if not is_local_textual_item(item):
        return fonts.DEFAULT_FONT_SIZE
    metric = local_font_metric(item)
    if metric <= 0:
        return fonts.DEFAULT_FONT_SIZE
    base_size = metric * layout.BODY_FONT_SIZE_FACTOR
    if is_footnote_like_block(item):
        return round(clamp(base_size * FOOTNOTE_FONT_SCALE, FOOTNOTE_MIN_FONT_SIZE_PT, MAX_LOCAL_FONT_SIZE_PT), 2)
    if is_caption_like_block(item):
        return round(clamp(base_size * CAPTION_FONT_SCALE, MIN_FONT_SIZE_PT, MAX_LOCAL_FONT_SIZE_PT), 2)
    return round(clamp(base_size, MIN_FONT_SIZE_PT, MAX_LOCAL_FONT_SIZE_PT), 2)


def estimate_font_size_pt(
    item: dict,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
) -> float:
    del density_baseline
    if not is_local_textual_item(item):
        return fonts.DEFAULT_FONT_SIZE
    local_font = local_font_size_pt(item)
    if not item.get("_is_body_text_candidate", False):
        return local_font

    block_scale = 1.0
    block_line_pitch = local_line_pitch(item) or median_line_pitch(item)
    block_line_height = median_line_height(item)
    if page_line_pitch > 0 and block_line_pitch > 0:
        block_scale = clamp(block_line_pitch / page_line_pitch, LOCAL_BLOCK_SCALE_MIN, LOCAL_BLOCK_SCALE_MAX)
    elif page_line_height > 0 and block_line_height > 0:
        block_scale = clamp(block_line_height / page_line_height, LOCAL_BLOCK_SCALE_MIN, LOCAL_BLOCK_SCALE_MAX)

    compactness = source_compactness_score(item)
    wide_aspect_body_text = bool(item.get("_wide_aspect_body_text", False))
    page_estimate = page_font_size * block_scale if page_font_size > 0 else local_font
    page_weight = max(BODY_PAGE_BLEND_MIN, BODY_PAGE_BLEND_BASE - compactness * 0.18)
    if wide_aspect_body_text:
        page_weight = max(BODY_PAGE_BLEND_MIN - 0.1, page_weight - WIDE_ASPECT_PAGE_BLEND_REDUCTION)
    local_weight = 1.0 - page_weight
    blended = (page_estimate * page_weight) + (local_font * local_weight)
    if compactness > 0:
        compact_scale_max = WIDE_ASPECT_COMPACT_FONT_SCALE_MAX if wide_aspect_body_text else BODY_COMPACT_FONT_SCALE_MAX
        blended *= 1.0 - min(compact_scale_max, compactness * 0.055)
    return round(clamp(blended, MIN_FONT_SIZE_PT, MAX_LOCAL_FONT_SIZE_PT), 2)


__all__ = [
    "BODY_COMPACT_FONT_SCALE_MAX",
    "BODY_PAGE_BLEND_BASE",
    "BODY_PAGE_BLEND_MIN",
    "CAPTION_FONT_SCALE",
    "FOOTNOTE_FONT_SCALE",
    "FOOTNOTE_MIN_FONT_SIZE_PT",
    "LOCAL_BLOCK_SCALE_MAX",
    "LOCAL_BLOCK_SCALE_MIN",
    "MAX_FONT_SIZE_PT",
    "MAX_LOCAL_FONT_SIZE_PT",
    "MIN_FONT_SIZE_PT",
    "WIDE_ASPECT_COMPACT_FONT_SCALE_MAX",
    "WIDE_ASPECT_PAGE_BLEND_REDUCTION",
    "estimate_font_size_pt",
    "local_font_size_pt",
]

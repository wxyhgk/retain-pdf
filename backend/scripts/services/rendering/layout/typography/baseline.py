from __future__ import annotations

import re
from statistics import median

from foundation.config import fonts
from foundation.config import layout
from services.rendering.layout.typography.constants import BODY_FORMULA_RATIO_MAX
from services.rendering.layout.typography.constants import LINE_HEIGHT_TO_FONT_SCALE
from services.rendering.layout.typography.constants import LINE_PITCH_TO_FONT_SCALE
from services.rendering.layout.typography.constants import MAX_LOCAL_FONT_SIZE_PT
from services.rendering.layout.typography.constants import MIN_FONT_SIZE_PT
from services.rendering.layout.typography.constants import PAGE_BASELINE_PERCENTILE
from services.rendering.layout.typography.content import formula_ratio
from services.rendering.layout.typography.content import plain_text_chars_per_line
from services.rendering.layout.typography.line_count import source_visual_line_count
from services.rendering.layout.typography.line_metrics import bbox_width
from services.rendering.layout.typography.line_metrics import local_font_metric
from services.rendering.layout.typography.line_metrics import local_line_pitch
from services.rendering.layout.typography.line_metrics import median_line_height
from services.rendering.layout.typography.line_metrics import median_line_pitch
from services.rendering.layout.typography.scalars import percentile_value
from services.translation.item_reader import item_block_kind
from services.translation.item_reader import item_is_caption_like


def candidate_text_items(items: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    widths = [bbox_width(item) for item in items if item_block_kind(item) == "text" and not item_is_caption_like(item)]
    page_text_width_med = median(widths) if widths else 0.0
    for item in items:
        if item_block_kind(item) != "text":
            continue
        if item_is_caption_like(item):
            continue
        if source_visual_line_count(item) < 3:
            continue
        if len(re.sub(r"\s+", "", item.get("source_text", ""))) < 40:
            continue
        if formula_ratio(item) > BODY_FORMULA_RATIO_MAX:
            continue
        if page_text_width_med > 0 and bbox_width(item) < page_text_width_med * 0.6:
            continue
        candidates.append(item)
    return candidates


def page_baseline_font_size(items: list[dict]) -> tuple[float, float, float, float]:
    candidates = candidate_text_items(items)
    line_pitches = [local_line_pitch(item) or median_line_pitch(item) for item in candidates]
    line_pitches = [pitch for pitch in line_pitches if pitch > 0]
    line_heights = [median_line_height(item) for item in candidates]
    line_heights = [height for height in line_heights if height > 0]
    font_metrics = [local_font_metric(item) for item in candidates]
    font_metrics = [metric for metric in font_metrics if metric > 0]
    baseline_line_pitch = percentile_value(line_pitches, PAGE_BASELINE_PERCENTILE) if line_pitches else 0.0
    baseline_line_height = percentile_value(line_heights, PAGE_BASELINE_PERCENTILE) if line_heights else 0.0
    metric = percentile_value(font_metrics, PAGE_BASELINE_PERCENTILE) if font_metrics else 0.0
    if metric <= 0:
        metric = (baseline_line_height * LINE_HEIGHT_TO_FONT_SCALE) if baseline_line_height > 0 else baseline_line_pitch * LINE_PITCH_TO_FONT_SCALE
    if metric <= 0:
        return fonts.DEFAULT_FONT_SIZE, 0.0, 0.0, 0.0
    page_font_size = max(
        MIN_FONT_SIZE_PT,
        min(MAX_LOCAL_FONT_SIZE_PT, metric * layout.BODY_FONT_SIZE_FACTOR),
    )
    chars_per_line = [plain_text_chars_per_line(item) for item in candidates]
    chars_per_line = [value for value in chars_per_line if value > 0]
    density_baseline = median(chars_per_line) if chars_per_line else 0.0
    return page_font_size, baseline_line_pitch, baseline_line_height, density_baseline

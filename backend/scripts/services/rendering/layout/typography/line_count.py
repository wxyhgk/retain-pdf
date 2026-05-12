from __future__ import annotations

import re
from math import ceil

from services.rendering.layout.typography.constants import APPROX_TEXT_CHAR_WIDTH_PT
from services.rendering.layout.typography.constants import FORMULA_CHARS_PER_LINE_PENALTY
from services.rendering.layout.typography.constants import LINE_COUNT_GROW_THRESHOLD
from services.rendering.layout.typography.constants import LINE_COUNT_PREDICT_TRIGGER_CHARS
from services.rendering.layout.typography.constants import MIN_TEXT_LINE_PITCH_PT
from services.rendering.layout.typography.constants import SINGLE_LINE_GLUE_HEIGHT_TRIGGER_LINES
from services.rendering.layout.typography.constants import SINGLE_LINE_GLUE_WIDTH_CHAR_RATIO
from services.rendering.layout.typography.constants import VISUAL_LINE_COUNT_MAX
from services.rendering.layout.typography.content import formula_ratio
from services.rendering.layout.typography.content import plain_text_chars_per_line
from services.rendering.layout.typography.line_metrics import bbox_height
from services.rendering.layout.typography.line_metrics import bbox_width
from services.rendering.layout.typography.line_metrics import median_line_height
from services.rendering.layout.typography.scalars import clamp
from services.translation.item_reader import item_is_bodylike
from services.translation.item_reader import item_semantic_role


def _predicted_wrapped_line_count(item: dict, *, width: float, text_len: int) -> int:
    if width <= 0 or text_len < LINE_COUNT_PREDICT_TRIGGER_CHARS:
        return 0
    observed_chars = plain_text_chars_per_line(item)
    geometric_chars_per_line = clamp(width / APPROX_TEXT_CHAR_WIDTH_PT, 10.0, 88.0)
    approx_chars_per_line = observed_chars or geometric_chars_per_line
    tall_single_line_glue = is_tall_single_line_glue(
        item,
        text_len=text_len,
        observed_chars=observed_chars,
        geometric_chars_per_line=geometric_chars_per_line,
    )
    if tall_single_line_glue:
        approx_chars_per_line = geometric_chars_per_line
    if formula_ratio(item) > 0:
        approx_chars_per_line *= FORMULA_CHARS_PER_LINE_PENALTY
    semantic_role = item_semantic_role(item)
    if semantic_role in {"body", "abstract"} or item_is_bodylike(item):
        approx_chars_per_line *= 0.96
    effective_chars_per_line = max(8.0, approx_chars_per_line * 1.02)
    return max(1, ceil(text_len / effective_chars_per_line))


def visual_line_count(item: dict) -> int:
    observed = len(item.get("lines", []))
    width = bbox_width(item)
    block_height = bbox_height(item)
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    observed = max(1, observed)
    predicted_by_text = _predicted_wrapped_line_count(item, width=width, text_len=text_len)
    max_lines_by_height = max(1, int(block_height / MIN_TEXT_LINE_PITCH_PT)) if block_height > 0 else observed
    predicted_lower_bound = min(max_lines_by_height, predicted_by_text) if predicted_by_text > 0 else observed

    if predicted_lower_bound <= observed:
        return min(VISUAL_LINE_COUNT_MAX, observed)

    growth_ratio = predicted_lower_bound / max(1, observed)
    if observed == 1:
        return min(VISUAL_LINE_COUNT_MAX, max(observed, predicted_lower_bound))

    if growth_ratio >= LINE_COUNT_GROW_THRESHOLD:
        return min(VISUAL_LINE_COUNT_MAX, predicted_lower_bound)
    return min(VISUAL_LINE_COUNT_MAX, observed)


def source_visual_line_count(item: dict) -> int:
    line_count = len(item.get("lines", []))
    if line_count > 0:
        return line_count
    explicit_lines = [line for line in str(item.get("source_text", "") or "").splitlines() if line.strip()]
    return max(1, len(explicit_lines))


def is_tall_single_line_glue(
    item: dict,
    *,
    text_len: int | None = None,
    observed_chars: float | None = None,
    geometric_chars_per_line: float | None = None,
) -> bool:
    observed_line_count = len(item.get("lines", []))
    if observed_line_count > 1:
        return False
    block_height = bbox_height(item)
    if block_height <= 0:
        return False
    if text_len is None:
        text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    if text_len < LINE_COUNT_PREDICT_TRIGGER_CHARS:
        return False
    if observed_chars is None:
        observed_chars = plain_text_chars_per_line(item)
    if geometric_chars_per_line is None:
        geometric_chars_per_line = clamp(bbox_width(item) / APPROX_TEXT_CHAR_WIDTH_PT, 10.0, 88.0)
    median_height = median_line_height(item)
    return bool(
        block_height >= max(MIN_TEXT_LINE_PITCH_PT * SINGLE_LINE_GLUE_HEIGHT_TRIGGER_LINES, median_height * 3.0)
        or (observed_chars > 0 and observed_chars >= geometric_chars_per_line * SINGLE_LINE_GLUE_WIDTH_CHAR_RATIO)
    )

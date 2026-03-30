from __future__ import annotations

import re
from math import ceil
from statistics import median

from foundation.config import fonts
from foundation.config import layout


MIN_FONT_SIZE_PT = 8.4
MAX_FONT_SIZE_PT = 11.6
ZH_FONT_SCALE = 0.91
PAGE_BASELINE_PERCENTILE = 0.42
MIN_TEXT_LINE_PITCH_PT = 10.8
APPROX_TEXT_CHAR_WIDTH_PT = 5.2
TEXT_HEIGHT_PADDING_RATIO = 0.22
TEXT_HEIGHT_PADDING_MAX_PT = 2.2
SOURCE_HEIGHT_LIMIT_MIN_PT = 8.0
SOURCE_HEIGHT_LIMIT_RATIO = 1.02
VISUAL_LINE_COUNT_MAX = 24
LINE_COUNT_PREDICT_TRIGGER_CHARS = 48
LINE_COUNT_GROW_THRESHOLD = 1.12
FORMULA_CHARS_PER_LINE_PENALTY = 0.82
SOURCE_COMPACTNESS_TEXT_TRIGGER = 52
SOURCE_COMPACTNESS_LINE_TRIGGER = 3
SOURCE_COMPACTNESS_X_TRIGGER = 0.76
SOURCE_COMPACTNESS_Y_TRIGGER = 0.40
SOURCE_COMPACTNESS_MAX = 0.7
BODY_FORMULA_RATIO_MAX = 0.5


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def line_height(line: dict) -> float:
    bbox = line.get("bbox", [])
    if len(bbox) != 4:
        return 0.0
    return max(0.0, bbox[3] - bbox[1])


def median_line_height(item: dict) -> float:
    heights = [line_height(line) for line in item.get("lines", [])]
    heights = [height for height in heights if height > 0]
    return median(heights) if heights else 0.0


def line_centers(item: dict) -> list[float]:
    centers: list[float] = []
    for line in item.get("lines", []):
        bbox = line.get("bbox", [])
        if len(bbox) != 4:
            continue
        centers.append((bbox[1] + bbox[3]) / 2)
    return centers


def median_line_pitch(item: dict) -> float:
    centers = line_centers(item)
    if len(centers) < 2:
        return 0.0
    diffs = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
    diffs = [diff for diff in diffs if diff > 0]
    return median(diffs) if diffs else 0.0


def percentile_value(values: list[float], q: float) -> float:
    filtered = sorted(value for value in values if value > 0)
    if not filtered:
        return 0.0
    if len(filtered) == 1:
        return filtered[0]
    q = clamp(q, 0.0, 1.0)
    pos = (len(filtered) - 1) * q
    low = int(pos)
    high = min(len(filtered) - 1, low + 1)
    frac = pos - low
    return filtered[low] * (1.0 - frac) + filtered[high] * frac


def plain_text_chars_per_line(item: dict) -> float:
    counts: list[int] = []
    for line in item.get("lines", []):
        text_chunks: list[str] = []
        for span in line.get("spans", []):
            if span.get("type") != "text":
                continue
            text_chunks.append(span.get("content", ""))
        plain = re.sub(r"\s+", "", "".join(text_chunks))
        if plain:
            counts.append(len(plain))
    return median(counts) if counts else 0.0


def formula_ratio(item: dict) -> float:
    text_spans = 0
    formula_spans = 0
    for line in item.get("lines", []):
        for span in line.get("spans", []):
            span_type = span.get("type")
            if span_type == "inline_equation":
                formula_spans += 1
            elif span_type == "text":
                text_spans += 1
    total = text_spans + formula_spans
    return formula_spans / total if total else 0.0


def bbox_width(item: dict) -> float:
    bbox = item.get("bbox", [])
    return max(0.0, bbox[2] - bbox[0]) if len(bbox) == 4 else 0.0


def bbox_height(item: dict) -> float:
    bbox = item.get("bbox", [])
    return max(0.0, bbox[3] - bbox[1]) if len(bbox) == 4 else 0.0


def effective_text_height(item: dict) -> float:
    line_boxes = []
    for line in item.get("lines", []):
        bbox = line.get("bbox", [])
        if len(bbox) != 4:
            continue
        line_boxes.append(bbox)
    if not line_boxes:
        return bbox_height(item)

    top = min(box[1] for box in line_boxes)
    bottom = max(box[3] for box in line_boxes)
    raw_height = max(0.0, bottom - top)
    median_height = median_line_height(item)
    if raw_height <= 0:
        return bbox_height(item)
    padding = min(TEXT_HEIGHT_PADDING_MAX_PT, median_height * TEXT_HEIGHT_PADDING_RATIO) if median_height > 0 else 0.0
    return min(bbox_height(item), raw_height + padding)


def _predicted_wrapped_line_count(item: dict, *, width: float, text_len: int) -> int:
    if width <= 0 or text_len < LINE_COUNT_PREDICT_TRIGGER_CHARS:
        return 0
    observed_chars = plain_text_chars_per_line(item)
    approx_chars_per_line = observed_chars or clamp(width / APPROX_TEXT_CHAR_WIDTH_PT, 10.0, 88.0)
    if formula_ratio(item) > 0:
        approx_chars_per_line *= FORMULA_CHARS_PER_LINE_PENALTY
    structure_role = str((item.get("metadata", {}) or {}).get("structure_role", "") or "")
    if structure_role in {"body", "example_line"}:
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


def local_line_pitch(item: dict) -> float:
    block_height = effective_text_height(item)
    lines = visual_line_count(item)
    if block_height <= 0 or lines <= 0:
        return 0.0
    return block_height / lines


def source_text_height_limit_pt(item: dict) -> float:
    text_height = effective_text_height(item)
    if text_height <= 0:
        text_height = bbox_height(item)
    if text_height <= 0:
        return 0.0
    return max(SOURCE_HEIGHT_LIMIT_MIN_PT, min(bbox_height(item), text_height * SOURCE_HEIGHT_LIMIT_RATIO))


def occupied_ratio(item: dict) -> float:
    block_height = bbox_height(item)
    if block_height <= 0:
        return 0.0
    total_line_height = sum(line_height(line) for line in item.get("lines", []))
    return total_line_height / block_height


def line_widths(item: dict) -> list[float]:
    widths: list[float] = []
    for line in item.get("lines", []):
        bbox = line.get("bbox", [])
        if len(bbox) != 4:
            continue
        widths.append(max(0.0, bbox[2] - bbox[0]))
    return widths


def occupied_ratio_x(item: dict) -> float:
    block_width = bbox_width(item)
    if block_width <= 0:
        return 0.0
    widths = line_widths(item)
    if len(widths) > 1:
        widths = widths[:-1]
    widths = [width for width in widths if width > 0]
    return median(widths) / block_width if widths else 0.0


def source_compactness_score(item: dict) -> float:
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    if text_len < 36:
        return 0.0

    lines = visual_line_count(item)
    density_x = occupied_ratio_x(item)
    density_y = occupied_ratio(item)
    score = 0.0

    if text_len >= SOURCE_COMPACTNESS_TEXT_TRIGGER:
        score += min(0.22, (text_len - SOURCE_COMPACTNESS_TEXT_TRIGGER) / 220.0)
    if lines >= SOURCE_COMPACTNESS_LINE_TRIGGER:
        score += min(0.3, max(0, lines - (SOURCE_COMPACTNESS_LINE_TRIGGER - 1)) * 0.08)
    if density_x >= SOURCE_COMPACTNESS_X_TRIGGER:
        score += min(0.24, ((density_x - SOURCE_COMPACTNESS_X_TRIGGER) / 0.16) * 0.24)
    if density_y >= SOURCE_COMPACTNESS_Y_TRIGGER:
        score += min(0.12, ((density_y - SOURCE_COMPACTNESS_Y_TRIGGER) / 0.24) * 0.12)
    if formula_ratio(item) >= 0.08:
        score += 0.08

    return clamp(score, 0.0, SOURCE_COMPACTNESS_MAX)


def _item_tags(item: dict) -> set[str]:
    metadata = item.get("metadata", {}) or {}
    return {str(tag or "") for tag in (metadata.get("tags", []) or [])}


def _derived_role(item: dict) -> str:
    metadata = item.get("metadata", {}) or {}
    derived = metadata.get("derived", {}) or {}
    return str(derived.get("role", "") or "")


def _is_caption_like(item: dict) -> bool:
    return (
        _derived_role(item) == "caption"
        or str(item.get("block_type", "") or "") in {"image_caption", "table_caption", "table_footnote"}
        or "caption" in _item_tags(item)
    )


def candidate_text_items(items: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    widths = [bbox_width(item) for item in items if item.get("block_type") == "text" and not _is_caption_like(item)]
    page_text_width_med = median(widths) if widths else 0.0
    for item in items:
        if item.get("block_type") != "text":
            continue
        if _is_caption_like(item):
            continue
        if visual_line_count(item) < 3:
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
    baseline_line_pitch = percentile_value(line_pitches, PAGE_BASELINE_PERCENTILE) if line_pitches else 0.0
    baseline_line_height = percentile_value(line_heights, PAGE_BASELINE_PERCENTILE) if line_heights else 0.0
    metric = baseline_line_pitch or baseline_line_height
    if metric <= 0:
        return fonts.DEFAULT_FONT_SIZE, 0.0, 0.0, 0.0
    page_font_size = max(
        MIN_FONT_SIZE_PT,
        min(MAX_FONT_SIZE_PT, metric * ZH_FONT_SCALE),
    )
    chars_per_line = [plain_text_chars_per_line(item) for item in candidates]
    chars_per_line = [value for value in chars_per_line if value > 0]
    density_baseline = median(chars_per_line) if chars_per_line else 0.0
    return page_font_size, baseline_line_pitch, baseline_line_height, density_baseline

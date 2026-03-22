import re
from math import ceil
from statistics import median

from common import config


MIN_FONT_SIZE_PT = 8.4
MAX_FONT_SIZE_PT = 11.6
ZH_FONT_SCALE = 0.91
BLOCK_SCALE_MIN = 0.985
BLOCK_SCALE_MAX = 1.015
DEFAULT_LEADING_EM = 0.40
BODY_LEADING_MIN = 0.58
BODY_LEADING_MAX = 0.82
BODY_FORMULA_RATIO_MAX = 0.5
LOCAL_BLOCK_SCALE_MIN = 0.94
LOCAL_BLOCK_SCALE_MAX = 1.08
NON_BODY_LEADING_MIN = 0.26
NON_BODY_LEADING_MAX = 0.72
MIN_TEXT_LINE_PITCH_PT = 10.8
APPROX_TEXT_CHAR_WIDTH_PT = 5.2
LOCAL_TEXTUAL_BLOCK_TYPES = {"text", "title", "image_caption", "table_caption", "table_footnote"}


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


def visual_line_count(item: dict) -> int:
    observed = len(item.get("lines", []))
    if observed >= 2:
        return observed

    width = bbox_width(item)
    block_height = bbox_height(item)
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    if observed == 1 and width > 0 and block_height > 0 and text_len >= 80:
        approx_chars_per_line = max(14.0, min(80.0, width / APPROX_TEXT_CHAR_WIDTH_PT))
        inferred_by_text = ceil(text_len / (approx_chars_per_line * 1.35))
        max_lines_by_height = max(1, int(block_height / MIN_TEXT_LINE_PITCH_PT))
        if inferred_by_text >= 2 and max_lines_by_height >= 2:
            inferred = min(max_lines_by_height, inferred_by_text)
            return max(2, min(24, inferred))

    return max(1, observed)


def local_line_pitch(item: dict) -> float:
    block_height = bbox_height(item)
    lines = visual_line_count(item)
    if block_height <= 0 or lines <= 0:
        return 0.0
    return block_height / lines


def local_font_size_pt(item: dict) -> float:
    if item.get("block_type") not in LOCAL_TEXTUAL_BLOCK_TYPES:
        return config.DEFAULT_FONT_SIZE
    metric = local_line_pitch(item) or median_line_height(item)
    if metric <= 0:
        return config.DEFAULT_FONT_SIZE
    return round(clamp(metric * ZH_FONT_SCALE * config.BODY_FONT_SIZE_FACTOR, MIN_FONT_SIZE_PT, MAX_FONT_SIZE_PT), 2)


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


def inner_bbox(item: dict) -> list[float]:
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return bbox

    x0, y0, x1, y1 = bbox
    width = x1 - x0
    height = y1 - y0
    shrink_x = width * config.INNER_BBOX_SHRINK_X
    shrink_y = height * config.INNER_BBOX_SHRINK_Y

    rho_x = occupied_ratio_x(item)
    rho_y = occupied_ratio(item)
    if rho_x > 0.82:
        shrink_x = width * config.INNER_BBOX_DENSE_SHRINK_X
    if rho_y > 0.82:
        shrink_y = height * config.INNER_BBOX_DENSE_SHRINK_Y

    nx0 = x0 + shrink_x
    nx1 = x1 - shrink_x
    ny0 = y0 + shrink_y
    ny1 = y1 - shrink_y
    if nx1 - nx0 < width * 0.7:
        nx0, nx1 = x0 + width * 0.015, x1 - width * 0.015
    if ny1 - ny0 < height * 0.7:
        ny0, ny1 = y0 + height * 0.015, y1 - height * 0.015
    return [nx0, ny0, nx1, ny1]


def candidate_text_items(items: list[dict]) -> list[dict]:
    candidates: list[dict] = []
    widths = [bbox_width(item) for item in items if item.get("block_type") == "text"]
    page_text_width_med = median(widths) if widths else 0.0
    for item in items:
        if item.get("block_type") != "text":
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


def is_body_text_candidate(item: dict, page_text_width_med: float) -> bool:
    if item.get("block_type") != "text":
        return False
    if formula_ratio(item) > BODY_FORMULA_RATIO_MAX:
        return False
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    width = bbox_width(item)
    if page_text_width_med > 0 and width < page_text_width_med * 0.75:
        return False
    return text_len >= 40


def is_default_text_block(item: dict) -> bool:
    if item.get("block_type") == "title":
        return True
    if item.get("block_type") != "text":
        return False
    line_count = len(item.get("lines", []))
    text_len = len(re.sub(r"\s+", "", item.get("source_text", "")))
    return line_count <= 1 and text_len < 60


def page_baseline_font_size(items: list[dict]) -> tuple[float, float, float, float]:
    candidates = candidate_text_items(items)
    line_pitches = [local_line_pitch(item) or median_line_pitch(item) for item in candidates]
    line_pitches = [pitch for pitch in line_pitches if pitch > 0]
    line_heights = [median_line_height(item) for item in candidates]
    line_heights = [height for height in line_heights if height > 0]
    baseline_line_pitch = median(line_pitches) if line_pitches else 0.0
    baseline_line_height = median(line_heights) if line_heights else 0.0
    metric = baseline_line_pitch or baseline_line_height
    if metric <= 0:
        return config.DEFAULT_FONT_SIZE, 0.0, 0.0, 0.0
    page_font_size = max(
        MIN_FONT_SIZE_PT,
        min(MAX_FONT_SIZE_PT, metric * ZH_FONT_SCALE),
    )
    chars_per_line = [plain_text_chars_per_line(item) for item in candidates]
    chars_per_line = [value for value in chars_per_line if value > 0]
    density_baseline = median(chars_per_line) if chars_per_line else 0.0
    return page_font_size, baseline_line_pitch, baseline_line_height, density_baseline


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def estimate_font_size_pt(
    item: dict,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
) -> float:
    del density_baseline
    if item.get("block_type") not in LOCAL_TEXTUAL_BLOCK_TYPES:
        return config.DEFAULT_FONT_SIZE
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

    page_estimate = page_font_size * block_scale * config.BODY_FONT_SIZE_FACTOR if page_font_size > 0 else local_font
    blended = (page_estimate * 0.72) + (local_font * 0.28)
    return round(clamp(blended, MIN_FONT_SIZE_PT, MAX_FONT_SIZE_PT), 2)


def estimate_leading_em(item: dict, page_line_pitch: float, font_size_pt: float) -> float:
    block_pitch = local_line_pitch(item) or median_line_pitch(item)
    if item.get("_is_body_text_candidate", False):
        pitch = block_pitch or page_line_pitch
        if pitch > 0 and font_size_pt > 0:
            ocr_estimated = (pitch / font_size_pt) - 1.0
            zh_target = 0.66
            mixed = (ocr_estimated * 0.35) + (zh_target * 0.65)
            return round(clamp(mixed * config.BODY_LEADING_FACTOR, BODY_LEADING_MIN, BODY_LEADING_MAX), 2)
        return round(clamp(0.66 * config.BODY_LEADING_FACTOR, BODY_LEADING_MIN, BODY_LEADING_MAX), 2)
    if block_pitch > 0 and font_size_pt > 0:
        ocr_estimated = (block_pitch / font_size_pt) - 1.0
        mixed = (ocr_estimated * 0.55) + (DEFAULT_LEADING_EM * 0.45)
        return round(clamp(mixed * config.BODY_LEADING_FACTOR, NON_BODY_LEADING_MIN, NON_BODY_LEADING_MAX), 2)
    return round(clamp(DEFAULT_LEADING_EM * config.BODY_LEADING_FACTOR, NON_BODY_LEADING_MIN, NON_BODY_LEADING_MAX), 2)

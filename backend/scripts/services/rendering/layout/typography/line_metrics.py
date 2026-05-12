from __future__ import annotations

from statistics import median

from services.rendering.layout.typography.constants import LINE_HEIGHT_TO_FONT_SCALE
from services.rendering.layout.typography.constants import LINE_PITCH_TO_FONT_SCALE
from services.rendering.layout.typography.constants import LOOSE_LINE_PITCH_RATIO
from services.rendering.layout.typography.constants import SOURCE_HEIGHT_LIMIT_MIN_PT
from services.rendering.layout.typography.constants import SOURCE_HEIGHT_LIMIT_RATIO
from services.rendering.layout.typography.constants import TEXT_HEIGHT_PADDING_MAX_PT
from services.rendering.layout.typography.constants import TEXT_HEIGHT_PADDING_RATIO


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


def local_glyph_height(item: dict) -> float:
    height = median_line_height(item)
    return height if height > 0 else 0.0


def local_font_metric(item: dict) -> float:
    glyph_height = local_glyph_height(item)
    pitch = median_line_pitch(item)
    if glyph_height > 0:
        if pitch > 0 and pitch / glyph_height >= LOOSE_LINE_PITCH_RATIO:
            return glyph_height * LINE_HEIGHT_TO_FONT_SCALE
        return glyph_height * LINE_HEIGHT_TO_FONT_SCALE
    if pitch > 0:
        return pitch * LINE_PITCH_TO_FONT_SCALE
    return 0.0


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


def local_line_pitch(item: dict) -> float:
    from services.rendering.layout.typography.line_count import source_visual_line_count

    block_height = effective_text_height(item)
    lines = source_visual_line_count(item)
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

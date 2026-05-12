from __future__ import annotations

import re
from statistics import median

from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_LINE_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_MAX
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_TEXT_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_X_TRIGGER
from services.rendering.layout.typography.constants import SOURCE_COMPACTNESS_Y_TRIGGER
from services.rendering.layout.typography.content import formula_ratio
from services.rendering.layout.typography.line_count import source_visual_line_count
from services.rendering.layout.typography.line_metrics import bbox_height
from services.rendering.layout.typography.line_metrics import bbox_width
from services.rendering.layout.typography.line_metrics import line_height
from services.rendering.layout.typography.scalars import clamp


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

    lines = source_visual_line_count(item)
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

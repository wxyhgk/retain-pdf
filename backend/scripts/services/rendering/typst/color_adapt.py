from __future__ import annotations

import fitz

from services.rendering.layout.typography.geometry import cover_bbox
from services.rendering.redaction.redaction_fill import sample_local_background_fill


DARK_BACKGROUND_BRIGHTNESS_MAX = 0.42


def relative_brightness(color: tuple[float, float, float]) -> float:
    r, g, b = color
    return 0.299 * r + 0.587 * g + 0.114 * b


def text_color_for_fill(fill: tuple[float, float, float]) -> tuple[float, float, float]:
    if relative_brightness(fill) <= DARK_BACKGROUND_BRIGHTNESS_MAX:
        return (1, 1, 1)
    return (0, 0, 0)


def apply_adaptive_overlay_colors(page: fitz.Page, items: list[dict]) -> list[dict]:
    adapted: list[dict] = []
    for item in items:
        next_item = dict(item)
        bbox = cover_bbox(next_item)
        if len(bbox) == 4:
            fill = sample_local_background_fill(page, fitz.Rect(bbox))
        else:
            fill = (1, 1, 1)
        next_item["_render_cover_fill"] = fill
        next_item["_render_text_color"] = text_color_for_fill(fill)
        adapted.append(next_item)
    return adapted


__all__ = [
    "apply_adaptive_overlay_colors",
    "relative_brightness",
    "text_color_for_fill",
]

from __future__ import annotations

from services.rendering.layout.font_roles import is_title_like_block
from services.rendering.layout.typography.geometry import inner_bbox


TITLE_FILL_MAX_FONT_SIZE_PT = 72.0
TITLE_FILL_HEIGHT_TO_FONT_RATIO = 0.92
TITLE_FILL_GROW_SCALE = 2.6
TITLE_FILL_MAX_FONT_SCALE = 3.0


def resolve_title_fill_max_font_size_pt(item: dict, base_font_size_pt: float) -> float:
    if not is_title_like_block(item):
        return round(base_font_size_pt, 2)
    scaled_cap = max(base_font_size_pt, base_font_size_pt * TITLE_FILL_MAX_FONT_SCALE)
    inner = inner_bbox(item)
    if len(inner) != 4:
        return round(
            min(
                TITLE_FILL_MAX_FONT_SIZE_PT,
                scaled_cap,
                base_font_size_pt,
            ),
            2,
        )
    height_pt = max(8.0, inner[3] - inner[1])
    height_cap = height_pt * TITLE_FILL_HEIGHT_TO_FONT_RATIO
    optimistic = min(
        TITLE_FILL_MAX_FONT_SIZE_PT,
        scaled_cap,
        max(base_font_size_pt, min(base_font_size_pt * TITLE_FILL_GROW_SCALE, height_cap)),
    )
    return round(max(base_font_size_pt, optimistic), 2)


__all__ = [
    "TITLE_FILL_GROW_SCALE",
    "TITLE_FILL_HEIGHT_TO_FONT_RATIO",
    "TITLE_FILL_MAX_FONT_SCALE",
    "TITLE_FILL_MAX_FONT_SIZE_PT",
    "resolve_title_fill_max_font_size_pt",
]

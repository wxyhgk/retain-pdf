from __future__ import annotations

import fitz

from services.rendering.source.cleanup.ops import cover_rects_from_valid_items
from services.rendering.source.cleanup.ops import new_redaction_diagnostics
from services.rendering.source.cleanup.ops import remove_text_under_rects
from services.rendering.source.cleanup.fill import draw_flat_white_covers
from services.rendering.source.cleanup.fill import draw_white_covers


def apply_visual_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    remove_text_layer: bool = False,
    flat_cover: bool = False,
    route: str = "visual_cover",
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    cover_rects = cover_rects_from_valid_items(valid_items)
    if flat_cover:
        draw_flat_white_covers(page, cover_rects)
    else:
        draw_white_covers(page, cover_rects)
    if remove_text_layer:
        remove_text_under_rects(page, cover_rects)
    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = True
    diagnostics["route"] = route
    diagnostics["strategy"] = "visual_cover_and_remove_text" if remove_text_layer else "visual_cover"
    return diagnostics

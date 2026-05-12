from __future__ import annotations

import fitz

from services.rendering.source.cleanup.ops import new_redaction_diagnostics
from services.rendering.source.cleanup.ops import remove_text_under_rects
from services.rendering.source.cleanup.fill import apply_prepared_background_covers
from services.rendering.source.cleanup.fill import draw_white_covers
from services.rendering.source.cleanup.fill import prepare_background_covers


def apply_image_page_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    rects = [rect for rect, _item, _translated_text in valid_items]
    diagnostics["cover_rects"] = len(rects)
    diagnostics["route"] = "image_page_redaction"
    diagnostics["strategy"] = "text_layer_only"
    prepared_covers = prepare_background_covers(page, rects)
    remove_text_under_rects(page, rects)
    apply_prepared_background_covers(page, prepared_covers)
    return diagnostics


def apply_vector_heavy_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    rects = [rect for rect, _item, _translated_text in valid_items]
    diagnostics["cover_rects"] = len(rects)
    diagnostics["route"] = "vector_heavy_redaction"
    diagnostics["strategy"] = "text_layer_only"
    draw_white_covers(page, rects)
    remove_text_under_rects(page, rects)
    return diagnostics

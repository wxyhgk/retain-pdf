from __future__ import annotations

from collections.abc import Callable

import fitz

from services.rendering.source.background.fill import draw_flat_white_covers
from services.rendering.source.cleanup.diagnostics import new_redaction_diagnostics
from services.rendering.source.cleanup.item_rects import cover_rects_from_valid_items
from services.rendering.source.cleanup.item_rects import text_removal_rects_from_valid_items
from services.rendering.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction

DrawCovers = Callable[[fitz.Page, list[fitz.Rect]], None]
RemoveText = Callable[[fitz.Page, list[fitz.Rect]], None]


def apply_cover_only_count_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    draw_covers: DrawCovers = draw_flat_white_covers,
    remove_text: RemoveText = remove_text_under_rects_with_pymupdf_redaction,
) -> dict[str, object]:
    cover_rects = cover_rects_from_valid_items(valid_items)
    text_removal_rects = text_removal_rects_from_valid_items(valid_items)
    draw_covers(page, cover_rects)
    remove_text(page, text_removal_rects)
    diagnostics = new_redaction_diagnostics(valid_items)
    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = True
    diagnostics["route"] = "cover_only_count"
    diagnostics["strategy"] = "text_layer_only"
    diagnostics["uses_pymupdf_redaction"] = bool(text_removal_rects)
    diagnostics["legacy_pdf_write_reason"] = "cover_only_count_text_cleanup" if text_removal_rects else ""
    return diagnostics

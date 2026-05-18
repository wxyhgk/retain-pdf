from __future__ import annotations

from collections.abc import Callable

import fitz

from services.rendering.source.background.fill import draw_white_covers
from services.rendering.source.cleanup.diagnostics import new_redaction_diagnostics
from services.rendering.source.cleanup.layer_items import bbox_text_strip_rects
from services.rendering.source.cleanup.layer_items import visual_cover_rects
from services.rendering.source.text_redaction import remove_text_under_rects_with_pymupdf_redaction

DrawCovers = Callable[[fitz.Page, list[fitz.Rect]], None]
RemoveText = Callable[[fitz.Page, list[fitz.Rect]], None]


def apply_vector_heavy_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    draw_covers: DrawCovers = draw_white_covers,
    remove_text: RemoveText = remove_text_under_rects_with_pymupdf_redaction,
) -> dict[str, object]:
    diagnostics = new_redaction_diagnostics(valid_items)
    cover_rects = visual_cover_rects(valid_items)
    rects = bbox_text_strip_rects(valid_items)
    diagnostics["cover_rects"] = len(rects) + len(cover_rects)
    diagnostics["route"] = "vector_heavy_redaction"
    diagnostics["strategy"] = "text_layer_only"
    draw_covers(page, rects + cover_rects)
    remove_text(page, rects)
    diagnostics["uses_pymupdf_redaction"] = bool(rects)
    diagnostics["legacy_pdf_write_reason"] = "vector_heavy_text_layer_cleanup" if rects else ""
    return diagnostics

from __future__ import annotations

from collections.abc import Callable

import fitz

from services.rendering.source.cleanup.item_rects import cover_rects_from_valid_items
from services.rendering.source.cleanup.item_rects import text_removal_rects_from_valid_items


DrawCovers = Callable[[fitz.Page, list[fitz.Rect]], None]
RemoveText = Callable[[fitz.Page, list[fitz.Rect]], None]
ResolveFill = Callable[[fitz.Page, fitz.Rect, tuple[float, float, float] | None], object]


def apply_page_cover_text_cleanup(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    diagnostics: dict[str, object],
    *,
    route: str,
    reason: str,
    draw_covers: DrawCovers,
    remove_text: RemoveText,
) -> dict[str, object]:
    cover_rects = cover_rects_from_valid_items(valid_items)
    text_removal_rects = text_removal_rects_from_valid_items(valid_items)
    draw_covers(page, cover_rects)
    remove_text(page, text_removal_rects)
    diagnostics["cover_rects"] = len(cover_rects)
    diagnostics["fast_page_cover_only"] = True
    diagnostics["route"] = route
    diagnostics["uses_pymupdf_redaction"] = bool(text_removal_rects)
    diagnostics["legacy_pdf_write_reason"] = reason if text_removal_rects else ""
    return diagnostics


def apply_redaction_annotations(
    page: fitz.Page,
    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]],
    diagnostics: dict[str, object],
    *,
    resolve_fill: ResolveFill,
) -> None:
    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=resolve_fill(page, rect, fill))
    if not redactions:
        return
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    diagnostics["uses_pymupdf_redaction"] = True
    diagnostics["legacy_pdf_write_reason"] = "standard_redaction"

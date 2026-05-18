from __future__ import annotations

import fitz


def remove_text_under_rects_with_pymupdf_redaction(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    if not rects:
        return
    for rect in rects:
        if rect.is_empty:
            continue
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_NONE,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )


def remove_text_under_rects(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    remove_text_under_rects_with_pymupdf_redaction(page, rects)

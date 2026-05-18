from __future__ import annotations

import fitz

from services.rendering.source.background.fill import apply_prepared_background_covers
from services.rendering.source.background.fill import prepare_background_covers
from services.rendering.source.vector_text import collect_vector_text_rects


def cleanup_vector_text_drawings(page: fitz.Page, target_rects: list[fitz.Rect]) -> int:
    rects = collect_vector_text_rects(page, target_rects)
    if not rects:
        return 0
    prepared_covers = prepare_background_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_NONE,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_NONE,
    )
    apply_prepared_background_covers(page, prepared_covers)
    return len(rects)

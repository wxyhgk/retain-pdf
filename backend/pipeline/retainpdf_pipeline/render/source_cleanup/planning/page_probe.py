from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source_cleanup.pdf.constants import BBOX_TEXT_STRIP_CONTENT_STREAM_SIZE_THRESHOLD
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import unsafe_text_strip_drawing_rects


def page_has_text_overlap(
    page: fitz.Page,
    target_rects: list[fitz.Rect],
) -> bool:
    _drawing_count, text_overlap_count = page_bboxlog_stats(page, target_rects)
    return text_overlap_count > 0


def text_rects_overlap_targets(
    text_rects: tuple[fitz.Rect, ...],
    target_rects: list[fitz.Rect],
) -> bool:
    return any(
        not (text_rect & target_rect).is_empty
        for text_rect in text_rects
        for target_rect in target_rects
    )


def page_has_vector_overlap_in_text_rects(
    page: fitz.Page,
    target_rects: list[fitz.Rect],
) -> bool:
    if not target_rects:
        return False
    drawing_rects = unsafe_text_strip_drawing_rects(page)
    if not drawing_rects:
        return False
    return any(
        not (target_rect & drawing_rect).is_empty
        for target_rect in target_rects
        for drawing_rect in drawing_rects
    )


def page_content_stream_too_large(doc: fitz.Document, page: fitz.Page) -> bool:
    return page_content_stream_size(doc, page) >= BBOX_TEXT_STRIP_CONTENT_STREAM_SIZE_THRESHOLD


def page_has_form_xobjects(page: fitz.Page) -> bool:
    try:
        return bool(page.get_xobjects())
    except Exception:
        return True


def page_bboxlog_stats(
    page: fitz.Page,
    target_rects: list[fitz.Rect],
) -> tuple[int, int]:
    try:
        bboxlog = page.get_bboxlog()
    except Exception:
        return 0, 0
    nontext_count = 0
    text_overlap_count = 0
    for entry in bboxlog:
        kind = str(entry[0])
        if "text" not in kind:
            nontext_count += 1
            continue
        if len(entry) < 2:
            continue
        try:
            text_rect = fitz.Rect(entry[1])
        except Exception:
            continue
        if any(not (text_rect & target_rect).is_empty for target_rect in target_rects):
            text_overlap_count += 1
    return nontext_count, text_overlap_count


def page_content_stream_size(doc: fitz.Document, page: fitz.Page) -> int:
    try:
        content_xrefs = page.get_contents() or []
    except Exception:
        return 0
    total = 0
    for xref in content_xrefs:
        try:
            total += len(doc.xref_stream(xref) or b"")
        except Exception:
            continue
        if total >= BBOX_TEXT_STRIP_CONTENT_STREAM_SIZE_THRESHOLD:
            return total
    return total

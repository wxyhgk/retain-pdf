from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_fill import apply_prepared_background_covers
from services.rendering.redaction.redaction_fill import prepare_background_covers


MAX_GLYPH_HEIGHT_PT = 20.0
MIN_GLYPH_ITEM_COUNT = 8
MIN_LARGE_TEXT_CLUSTER_ITEM_COUNT = 400
MIN_BLACK_FILL = 0.2
MAX_BLACK_FILL = 0.8


def _looks_like_black_filled_glyph(drawing: dict) -> bool:
    if drawing.get("type") != "f":
        return False
    fill = drawing.get("fill")
    if not isinstance(fill, tuple) or len(fill) != 3:
        return False
    if not all(isinstance(v, (int, float)) for v in fill):
        return False
    if max(fill) > MIN_BLACK_FILL:
        return False
    rect = drawing.get("rect")
    if not rect:
        return False
    draw_rect = fitz.Rect(rect)
    if draw_rect.is_empty or draw_rect.height > MAX_GLYPH_HEIGHT_PT:
        return False
    if len(drawing.get("items", []) or []) < MIN_GLYPH_ITEM_COUNT:
        return False
    return True


def _looks_like_large_black_text_cluster(drawing: dict) -> bool:
    if drawing.get("type") != "f":
        return False
    fill = drawing.get("fill")
    if not isinstance(fill, tuple) or len(fill) != 3:
        return False
    if not all(isinstance(v, (int, float)) for v in fill):
        return False
    if max(fill) > MIN_BLACK_FILL:
        return False
    rect = drawing.get("rect")
    if not rect:
        return False
    draw_rect = fitz.Rect(rect)
    if draw_rect.is_empty:
        return False
    if len(drawing.get("items", []) or []) < MIN_LARGE_TEXT_CLUSTER_ITEM_COUNT:
        return False
    return True


def collect_vector_text_rects(page: fitz.Page, target_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    try:
        drawings = page.get_drawings()
    except Exception:
        return rects

    for drawing in drawings:
        small_glyph = _looks_like_black_filled_glyph(drawing)
        large_cluster = _looks_like_large_black_text_cluster(drawing)
        if not small_glyph and not large_cluster:
            continue
        draw_rect = fitz.Rect(drawing["rect"])
        for target_rect in target_rects:
            inter = draw_rect & target_rect
            if inter.is_empty:
                continue
            rects.append(draw_rect if small_glyph else inter)
            break
    return rects


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

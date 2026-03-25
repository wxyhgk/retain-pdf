from __future__ import annotations

import fitz

from rendering.pdf_overlay_parts.redaction_analysis import (
    collect_page_drawing_rects,
    collect_page_math_protection_rects,
    collect_page_non_math_span_heights,
    extract_page_words,
    item_has_formula,
    item_has_removable_text,
    item_removable_text_rects,
    item_should_use_cover_only,
    page_has_intrusive_math_protection,
    page_should_use_cover_only,
)
from rendering.pdf_overlay_parts.redaction_fill import draw_white_covers, resolved_fill_color
from rendering.pdf_overlay_parts.redaction_geometry import subtract_protected_rects
from rendering.pdf_overlay_parts.shared import iter_valid_translated_items


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
) -> None:
    valid_items = iter_valid_translated_items(translated_items)
    if not valid_items:
        return

    protected_math_rects = collect_page_math_protection_rects(page)
    non_math_span_heights = collect_page_non_math_span_heights(page)
    math_sensitive_page = page_has_intrusive_math_protection(
        valid_items,
        protected_math_rects,
        non_math_span_heights,
    )

    if cover_only:
        draw_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    if fill_background is None and math_sensitive_page:
        # For math-sensitive pages, prefer the simplest stable strategy:
        # cover the translated-item OCR boxes directly with white rectangles,
        # then place the translated overlay on top. This follows the OCR JSON
        # coordinates and avoids fragile partial-redaction interactions with
        # large math glyph bounding boxes.
        draw_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    drawing_rects = collect_page_drawing_rects(page)
    if fill_background is None and page_should_use_cover_only(drawing_rects):
        non_formula_rects: list[fitz.Rect] = []
        for rect, item, _translated_text in valid_items:
            if item_has_formula(item):
                continue
            non_formula_rects.extend(subtract_protected_rects([rect], protected_math_rects))
        draw_white_covers(page, non_formula_rects)
        valid_items = [(rect, item, text) for rect, item, text in valid_items if item_has_formula(item)]
        if not valid_items:
            return

    page_words = extract_page_words(page) if fill_background is None else None
    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    cover_rects: list[fitz.Rect] = []
    for rect, item, _translated_text in valid_items:
        has_formula = item_has_formula(item)
        if fill_background is None:
            removable_rects = item_removable_text_rects(
                page,
                item,
                rect,
                page_words=page_words,
                special_math_rects=protected_math_rects,
            )
            if not has_formula:
                removable_rects = subtract_protected_rects(removable_rects, protected_math_rects)
            if removable_rects:
                fill = (1, 1, 1) if math_sensitive_page else None
                redactions.extend((target_rect, fill) for target_rect in removable_rects)
                continue
            elif has_formula:
                # Formula-bearing blocks are risky: whole-box cover can erase radicals,
                # brackets, superscripts, and other vector/text math glyphs.
                continue
            elif item_should_use_cover_only(rect, drawing_rects):
                cover_rects.extend(subtract_protected_rects([rect], protected_math_rects))
                continue
            else:
                fill = (1, 1, 1)
        else:
            fill = (1, 1, 1) if fill_background else None
        redaction_rects = subtract_protected_rects([rect], protected_math_rects)
        redactions.extend((target_rect, fill) for target_rect in redaction_rects)

    draw_white_covers(page, cover_rects)

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=resolved_fill_color(page, rect, fill))
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )


__all__ = [
    "item_has_removable_text",
    "item_removable_text_rects",
    "redact_translated_text_areas",
]

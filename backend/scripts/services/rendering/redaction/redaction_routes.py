from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_analysis import collect_page_drawing_rects
from services.rendering.redaction.redaction_analysis import item_has_removable_text
from services.rendering.redaction.redaction_analysis import item_should_use_cover_only
from services.rendering.redaction.redaction_analysis import page_drawing_count
from services.rendering.redaction.redaction_analysis import page_has_large_background_image
from services.rendering.redaction.redaction_analysis import page_is_vector_heavy_count
from services.rendering.redaction.redaction_analysis import page_should_use_cover_only
from services.rendering.redaction.redaction_analysis import page_should_use_cover_only_count
from services.rendering.redaction.redaction_fill import apply_prepared_background_covers
from services.rendering.redaction.redaction_fill import draw_flat_white_covers
from services.rendering.redaction.redaction_fill import draw_white_covers
from services.rendering.redaction.redaction_fill import prepare_background_covers
from services.rendering.redaction.redaction_fill import resolved_fill_color
from services.rendering.redaction.redaction_geometry import expand_image_page_item_rect
from services.rendering.redaction.redaction_geometry import expand_item_rect
from services.rendering.redaction.shared import iter_valid_translated_items


def iter_valid_redaction_items(
    translated_items: list[dict],
    *,
    image_page: bool = False,
) -> list[tuple[fitz.Rect, dict, str]]:
    redaction_items: list[tuple[fitz.Rect, dict, str]] = []
    for rect, item, translated_text in iter_valid_translated_items(translated_items):
        expanded = expand_image_page_item_rect(rect) if image_page else expand_item_rect(rect)
        if expanded.is_empty:
            continue
        redaction_items.append((expanded, item, translated_text))
    return redaction_items


def apply_image_page_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> None:
    rects = [rect for rect, _item, _translated_text in valid_items]
    prepared_covers = prepare_background_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    apply_prepared_background_covers(page, prepared_covers)


def apply_vector_heavy_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> None:
    rects = [rect for rect, _item, _translated_text in valid_items]
    draw_white_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )


def apply_standard_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
) -> None:
    drawing_rects = collect_page_drawing_rects(page)
    if fill_background is None and page_should_use_cover_only(drawing_rects):
        draw_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    cover_rects: list[fitz.Rect] = []
    for rect, item, _translated_text in valid_items:
        if fill_background is None:
            if item_has_removable_text(page, item, rect):
                redactions.append((rect, None))
                continue
            if item_should_use_cover_only(rect, drawing_rects):
                cover_rects.append(rect)
                continue
            fill = (1, 1, 1)
        else:
            fill = (1, 1, 1) if fill_background else None
        redactions.append((rect, fill))

    draw_white_covers(page, cover_rects)

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=resolved_fill_color(page, rect, fill))
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )


def apply_redaction_route(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
    cover_only: bool = False,
) -> None:
    if cover_only:
        draw_flat_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    if page_has_large_background_image(page):
        apply_image_page_redaction(page, valid_items)
        return

    drawing_count = page_drawing_count(page)
    if fill_background is None and page_should_use_cover_only_count(drawing_count):
        draw_flat_white_covers(page, [rect for rect, _item, _translated_text in valid_items])
        return

    if fill_background is None and page_is_vector_heavy_count(drawing_count):
        apply_vector_heavy_redaction(page, valid_items)
        return

    apply_standard_redaction(page, valid_items, fill_background=fill_background)

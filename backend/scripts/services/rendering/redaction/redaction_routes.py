from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_analysis import collect_page_drawing_rects
from services.rendering.redaction.redaction_analysis import item_has_removable_text
from services.rendering.redaction.redaction_analysis import item_removable_text_rects
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

ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 24
PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 180
PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD = 24.0
PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT = 8
RECT_MERGE_GAP_X_PT = 3.0
RECT_MERGE_GAP_Y_PT = 2.0
RECT_MERGE_MAX_VERTICAL_MISALIGN_PT = 6.0


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


def _rects_should_merge(left: fitz.Rect, right: fitz.Rect) -> bool:
    if not ((left & right).is_empty):
        return True
    same_row = (
        abs(left.y0 - right.y0) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
        and abs(left.y1 - right.y1) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
    )
    horizontal_gap = max(0.0, max(left.x0, right.x0) - min(left.x1, right.x1))
    vertical_gap = max(0.0, max(left.y0, right.y0) - min(left.y1, right.y1))
    if same_row and horizontal_gap <= RECT_MERGE_GAP_X_PT:
        return True
    if vertical_gap <= RECT_MERGE_GAP_Y_PT and horizontal_gap <= RECT_MERGE_GAP_X_PT:
        return True
    return False


def _merge_rects(rects: list[fitz.Rect]) -> list[fitz.Rect]:
    merged: list[fitz.Rect] = []
    for rect in sorted(rects, key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2))):
        current = fitz.Rect(rect)
        changed = True
        while changed:
            changed = False
            kept: list[fitz.Rect] = []
            for existing in merged:
                if _rects_should_merge(existing, current):
                    current |= existing
                    changed = True
                else:
                    kept.append(existing)
            merged = kept
        merged.append(current)
    return sorted(merged, key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2)))


def _cover_rects_from_valid_items(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    return _merge_rects([rect for rect, _item, _translated_text in valid_items])


def _should_force_bbox_redaction(item: dict) -> bool:
    return True


def _new_redaction_diagnostics(valid_items: list[tuple[fitz.Rect, dict, str]]) -> dict[str, object]:
    return {
        "items": len(valid_items),
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "fast_page_cover_only": False,
        "item_fast_cover_count": 0,
        "route": "",
    }


def apply_image_page_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    rects = [rect for rect, _item, _translated_text in valid_items]
    diagnostics["cover_rects"] = len(rects)
    diagnostics["route"] = "image_page_redaction"
    prepared_covers = prepare_background_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    apply_prepared_background_covers(page, prepared_covers)
    return diagnostics


def apply_vector_heavy_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    rects = [rect for rect, _item, _translated_text in valid_items]
    diagnostics["cover_rects"] = len(rects)
    diagnostics["route"] = "vector_heavy_redaction"
    draw_white_covers(page, rects)
    for rect in rects:
        page.add_redact_annot(rect, fill=False)
    page.apply_redactions(
        images=fitz.PDF_REDACT_IMAGE_PIXELS,
        graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        text=fitz.PDF_REDACT_TEXT_REMOVE,
    )
    return diagnostics


def apply_standard_redaction(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
) -> dict[str, object]:
    diagnostics = _new_redaction_diagnostics(valid_items)
    drawing_rects = collect_page_drawing_rects(page)
    if fill_background is None and page_should_use_cover_only(drawing_rects):
        cover_rects = _cover_rects_from_valid_items(valid_items)
        draw_white_covers(page, cover_rects)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only_page"
        return diagnostics

    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    cover_rects: list[fitz.Rect] = []
    removable_counts: list[int] = []
    for rect, item, _translated_text in valid_items:
        if fill_background is None:
            if _should_force_bbox_redaction(item):
                redactions.append((rect, None))
                continue
            removable_rects = item_removable_text_rects(page, item, rect)
            raw_count = len(removable_rects)
            diagnostics["raw_removable_rects"] = int(diagnostics["raw_removable_rects"]) + raw_count
            if raw_count:
                removable_counts.append(raw_count)
            merged_removable_rects = _merge_rects(removable_rects)
            merged_count = len(merged_removable_rects)
            diagnostics["merged_removable_rects"] = int(diagnostics["merged_removable_rects"]) + merged_count
            removable = bool(merged_removable_rects)
            vector_overlap = item_should_use_cover_only(rect, drawing_rects)
            if raw_count >= ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD:
                cover_rects.append(rect)
                diagnostics["item_fast_cover_count"] = int(diagnostics["item_fast_cover_count"]) + 1
                continue
            if removable:
                for removable_rect in merged_removable_rects:
                    redactions.append((removable_rect, None))
                continue
            if vector_overlap:
                cover_rects.append(rect)
                continue
            fill = (1, 1, 1)
        else:
            fill = (1, 1, 1) if fill_background else None
        redactions.append((rect, fill))

    if fill_background is None and removable_counts:
        total_raw_rects = sum(removable_counts)
        avg_raw_rects = total_raw_rects / max(len(removable_counts), 1)
        if (
            total_raw_rects >= PAGE_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
            or avg_raw_rects >= PAGE_AVG_REMOVABLE_RECTS_FAST_COVER_THRESHOLD
            or len([count for count in removable_counts if count >= ITEM_REMOVABLE_RECTS_FAST_COVER_THRESHOLD])
            >= PAGE_ITEM_REMOVABLE_RECTS_FAST_COVER_COUNT
        ):
            page_cover_rects = _cover_rects_from_valid_items(valid_items)
            draw_white_covers(page, page_cover_rects)
            diagnostics["cover_rects"] = len(page_cover_rects)
            diagnostics["fast_page_cover_only"] = True
            diagnostics["route"] = "fast_page_cover_only"
            return diagnostics

    merged_cover_rects = _merge_rects(cover_rects)
    diagnostics["cover_rects"] = len(merged_cover_rects)
    draw_white_covers(page, merged_cover_rects)

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=resolved_fill_color(page, rect, fill))
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )
    diagnostics["route"] = "standard_redaction"
    return diagnostics


def apply_redaction_route(
    page: fitz.Page,
    valid_items: list[tuple[fitz.Rect, dict, str]],
    *,
    fill_background: bool | None = None,
    cover_only: bool = False,
) -> dict[str, object]:
    if cover_only:
        cover_rects = _cover_rects_from_valid_items(valid_items)
        draw_flat_white_covers(page, cover_rects)
        diagnostics = _new_redaction_diagnostics(valid_items)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only"
        return diagnostics

    if page_has_large_background_image(page):
        return apply_image_page_redaction(page, valid_items)

    drawing_count = page_drawing_count(page)
    if fill_background is None and page_should_use_cover_only_count(drawing_count):
        cover_rects = _cover_rects_from_valid_items(valid_items)
        draw_flat_white_covers(page, cover_rects)
        diagnostics = _new_redaction_diagnostics(valid_items)
        diagnostics["cover_rects"] = len(cover_rects)
        diagnostics["fast_page_cover_only"] = True
        diagnostics["route"] = "cover_only_count"
        return diagnostics

    if fill_background is None and page_is_vector_heavy_count(drawing_count):
        return apply_vector_heavy_redaction(page, valid_items)

    return apply_standard_redaction(page, valid_items, fill_background=fill_background)

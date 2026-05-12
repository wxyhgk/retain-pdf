from __future__ import annotations

import fitz

from services.rendering.source.cleanup.geometry import rect_area


RECT_MERGE_GAP_X_PT = 3.0
RECT_MERGE_GAP_Y_PT = 2.0
RECT_MERGE_MAX_VERTICAL_MISALIGN_PT = 6.0
RECT_MERGE_MAX_AREA_GROWTH_RATIO = 2.4
RECT_MERGE_MIN_COLUMN_X_OVERLAP_RATIO = 0.6
RECT_MERGE_MIN_OVERLAP_RATIO = 0.8


def new_redaction_diagnostics(valid_items: list[tuple[fitz.Rect, dict, str]]) -> dict[str, object]:
    return {
        "items": len(valid_items),
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "fast_page_cover_only": False,
        "item_fast_cover_count": 0,
        "route": "",
    }


def rects_should_merge(left: fitz.Rect, right: fitz.Rect) -> bool:
    union = left | right
    combined_area = rect_area(left) + rect_area(right)
    if combined_area <= 0.0:
        return False
    area_growth_ratio = rect_area(union) / combined_area
    same_row = (
        abs(left.y0 - right.y0) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
        and abs(left.y1 - right.y1) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
    )
    horizontal_gap = max(0.0, max(left.x0, right.x0) - min(left.x1, right.x1))
    if area_growth_ratio > RECT_MERGE_MAX_AREA_GROWTH_RATIO:
        return False
    inter = left & right
    if not inter.is_empty:
        min_area = max(1.0, min(rect_area(left), rect_area(right)))
        overlap_ratio = rect_area(inter) / min_area
        return same_row or overlap_ratio >= RECT_MERGE_MIN_OVERLAP_RATIO
    return bool(same_row and horizontal_gap <= RECT_MERGE_GAP_X_PT)


def merge_rects(rects: list[fitz.Rect]) -> list[fitz.Rect]:
    merged: list[fitz.Rect] = []
    for rect in sorted(rects, key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2))):
        current = fitz.Rect(rect)
        changed = True
        while changed:
            changed = False
            kept: list[fitz.Rect] = []
            for existing in merged:
                if rects_should_merge(existing, current):
                    current |= existing
                    changed = True
                else:
                    kept.append(existing)
            merged = kept
        merged.append(current)
    return sorted(merged, key=lambda value: (round(value.y0, 2), round(value.x0, 2), round(value.y1, 2)))


def cover_rects_from_valid_items(valid_items: list[tuple[fitz.Rect, dict, str]]) -> list[fitz.Rect]:
    return merge_rects([rect for rect, _item, _translated_text in valid_items])


def remove_text_under_rects(page: fitz.Page, rects: list[fitz.Rect]) -> None:
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

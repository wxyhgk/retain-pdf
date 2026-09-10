from __future__ import annotations

import fitz


def item_rect(item: dict) -> fitz.Rect | None:
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return None
    try:
        rect = fitz.Rect(float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    except Exception:
        return None
    return None if rect.is_empty else rect


def x_overlap_ratio(left: fitz.Rect, right: fitz.Rect) -> float:
    overlap = max(0.0, min(left.x1, right.x1) - max(left.x0, right.x0))
    width = max(1.0, min(left.width, right.width))
    return overlap / width


def rect_list(rect: fitz.Rect) -> list[float]:
    return [
        round(float(rect.x0), 3),
        round(float(rect.y0), 3),
        round(float(rect.x1), 3),
        round(float(rect.y1), 3),
    ]


def rects_should_merge(left: fitz.Rect, right: fitz.Rect) -> bool:
    union = left | right
    combined_area = _rect_area(left) + _rect_area(right)
    if combined_area <= 0.0:
        return False
    area_growth_ratio = _rect_area(union) / combined_area
    same_row = abs(left.y0 - right.y0) <= 6.0 and abs(left.y1 - right.y1) <= 6.0
    horizontal_gap = max(0.0, max(left.x0, right.x0) - min(left.x1, right.x1))
    if area_growth_ratio > 2.4:
        return False
    inter = left & right
    if not inter.is_empty:
        min_area = max(1.0, min(_rect_area(left), _rect_area(right)))
        overlap_ratio = _rect_area(inter) / min_area
        return same_row or overlap_ratio >= 0.8
    return bool(same_row and horizontal_gap <= 3.0)


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


def _rect_area(rect: fitz.Rect) -> float:
    return max(0.0, float(rect.width)) * max(0.0, float(rect.height))

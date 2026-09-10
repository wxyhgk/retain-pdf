from __future__ import annotations

import fitz


RECT_MERGE_GAP_X_PT = 3.0
RECT_MERGE_MAX_VERTICAL_MISALIGN_PT = 6.0
RECT_MERGE_MAX_AREA_GROWTH_RATIO = 2.4
RECT_MERGE_MIN_OVERLAP_RATIO = 0.8


def rect_key(rect: fitz.Rect) -> tuple[int, int, int, int]:
    return (
        int(round(rect.x0 * 10)),
        int(round(rect.y0 * 10)),
        int(round(rect.x1 * 10)),
        int(round(rect.y1 * 10)),
    )


def clip_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)


def rect_area(rect: fitz.Rect) -> float:
    return max(0.0, float(rect.x1) - float(rect.x0)) * max(0.0, float(rect.y1) - float(rect.y0))


def rects_overlap_area(a: fitz.Rect, b: fitz.Rect) -> float:
    inter = a & b
    if inter.is_empty:
        return 0.0
    return rect_area(inter)


def rects_should_merge(left: fitz.Rect, right: fitz.Rect) -> bool:
    union = left | right
    combined_area = rect_area(left) + rect_area(right)
    if combined_area <= 0.0:
        return False
    area_growth_ratio = rect_area(union) / combined_area
    if area_growth_ratio > RECT_MERGE_MAX_AREA_GROWTH_RATIO:
        return False

    same_row = (
        abs(left.y0 - right.y0) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
        and abs(left.y1 - right.y1) <= RECT_MERGE_MAX_VERTICAL_MISALIGN_PT
    )
    inter = left & right
    if not inter.is_empty:
        min_area = max(1.0, min(rect_area(left), rect_area(right)))
        overlap_ratio = rect_area(inter) / min_area
        return same_row or overlap_ratio >= RECT_MERGE_MIN_OVERLAP_RATIO

    horizontal_gap = max(0.0, max(left.x0, right.x0) - min(left.x1, right.x1))
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


def rect_intersects_protected(rect: fitz.Rect, protected_rects: list[fitz.Rect]) -> bool:
    for protected in protected_rects:
        inter = rect & protected
        if not inter.is_empty and rect_area(inter) > 0.5:
            return True
    return False


def normalize_rect(rect: fitz.Rect) -> fitz.Rect | None:
    normalized = fitz.Rect(rect)
    if normalized.is_empty or rect_area(normalized) <= 0.5:
        return None
    return normalized


def subtract_one_rect(rect: fitz.Rect, protected: fitz.Rect) -> list[fitz.Rect]:
    inter = rect & protected
    if inter.is_empty or rect_area(inter) <= 0.5:
        return [rect]

    pieces: list[fitz.Rect] = []
    if rect.x0 < inter.x0:
        pieces.append(fitz.Rect(rect.x0, rect.y0, inter.x0, rect.y1))
    if inter.x1 < rect.x1:
        pieces.append(fitz.Rect(inter.x1, rect.y0, rect.x1, rect.y1))
    if rect.y0 < inter.y0:
        pieces.append(fitz.Rect(inter.x0, rect.y0, inter.x1, inter.y0))
    if inter.y1 < rect.y1:
        pieces.append(fitz.Rect(inter.x0, inter.y1, inter.x1, rect.y1))

    normalized: list[fitz.Rect] = []
    for piece in pieces:
        fixed = normalize_rect(piece)
        if fixed is not None:
            normalized.append(fixed)
    return normalized


def subtract_protected_rects(rects: list[fitz.Rect], protected_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    if not protected_rects:
        return rects

    current = rects
    for protected in protected_rects:
        next_rects: list[fitz.Rect] = []
        for rect in current:
            next_rects.extend(subtract_one_rect(rect, protected))
        current = next_rects
        if not current:
            break
    return current


def merge_dedup_rects(*rect_groups: list[fitz.Rect]) -> list[fitz.Rect]:
    merged: list[fitz.Rect] = []
    seen: set[tuple[int, int, int, int]] = set()
    for group in rect_groups:
        for rect in group:
            key = rect_key(rect)
            if key in seen:
                continue
            seen.add(key)
            merged.append(rect)
    return merged

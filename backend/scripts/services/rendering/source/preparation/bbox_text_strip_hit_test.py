from __future__ import annotations

import fitz


def inside_any_rect(x: float, y: float, rects: list[fitz.Rect]) -> bool:
    probe = fitz.Point(x, y)
    return any(rect.contains(probe) for rect in rects)


def intersects_any_rect(rect: fitz.Rect, rects: list[fitz.Rect]) -> bool:
    return any(not (rect & target).is_empty for target in rects)


def is_protected_text_op(
    *,
    user_point: tuple[float, float],
    text_rect: fitz.Rect,
    protected_rects: list[fitz.Rect],
) -> bool:
    if not protected_rects:
        return False
    if inside_any_rect(user_point[0], user_point[1], protected_rects):
        return True
    return intersects_any_rect(text_rect, protected_rects)

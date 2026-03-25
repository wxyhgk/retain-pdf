from __future__ import annotations

import fitz

from rendering.pdf_overlay_parts.redaction_config import (
    FORMULA_REDACTION_PAD_X,
    FORMULA_REDACTION_PAD_Y,
    WORD_REDACTION_PAD_X,
    WORD_REDACTION_PAD_Y,
)


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


def expand_word_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - WORD_REDACTION_PAD_X,
        rect.y0 - WORD_REDACTION_PAD_Y,
        rect.x1 + WORD_REDACTION_PAD_X,
        rect.y1 + WORD_REDACTION_PAD_Y,
    )


def expand_formula_rect(rect: fitz.Rect) -> fitz.Rect:
    return fitz.Rect(
        rect.x0 - FORMULA_REDACTION_PAD_X,
        rect.y0 - FORMULA_REDACTION_PAD_Y,
        rect.x1 + FORMULA_REDACTION_PAD_X,
        rect.y1 + FORMULA_REDACTION_PAD_Y,
    )


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

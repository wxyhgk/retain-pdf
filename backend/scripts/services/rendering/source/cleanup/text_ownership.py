from __future__ import annotations

import fitz

from services.rendering.source.cleanup.text_extract import rect_center
from services.rendering.source.cleanup.text_extract import rect_contains_point


def squared_distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return dx * dx + dy * dy


def owned_word_entries(
    rect: fitz.Rect,
    entries: list[tuple[fitz.Rect, str]],
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    return owned_text_entries(rect, entries, competing_rects=competing_rects)


def owned_text_block_entries(
    rect: fitz.Rect,
    entries: list[tuple[fitz.Rect, str]],
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    return owned_text_entries(rect, entries, competing_rects=competing_rects)


def owned_text_entries(
    rect: fitz.Rect,
    entries: list[tuple[fitz.Rect, str]],
    *,
    competing_rects: list[fitz.Rect] | None = None,
) -> list[tuple[fitz.Rect, str]]:
    if not entries:
        return []

    competing = [candidate for candidate in (competing_rects or []) if not candidate.is_empty]
    owned: list[tuple[fitz.Rect, str]] = []
    for entry_rect, text in entries:
        center = rect_center(entry_rect)
        if not rect_contains_point(rect, center[0], center[1]):
            continue

        owners = [candidate for candidate in competing if rect_contains_point(candidate, center[0], center[1])]
        if owners:
            best_owner = min(owners, key=lambda candidate: squared_distance(rect_center(candidate), center))
            if best_owner != rect:
                continue
        owned.append((entry_rect, text))
    return owned

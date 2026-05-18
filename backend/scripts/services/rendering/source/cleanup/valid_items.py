from __future__ import annotations

import fitz

from services.rendering.source.items import iter_valid_translated_items


def iter_valid_redaction_items(
    translated_items: list[dict],
    *,
    image_page: bool = False,
) -> list[tuple[fitz.Rect, dict, str]]:
    del image_page
    redaction_items: list[tuple[fitz.Rect, dict, str]] = []
    for rect, item, translated_text in iter_valid_translated_items(translated_items):
        if rect.is_empty:
            continue
        redaction_items.append((fitz.Rect(rect), item, translated_text))
    return redaction_items

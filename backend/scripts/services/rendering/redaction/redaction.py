from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_analysis import (
    item_has_removable_text,
    page_has_large_background_image,
)
from services.rendering.redaction.redaction_routes import iter_valid_redaction_items
from services.rendering.redaction.redaction_routes import apply_redaction_route


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
) -> None:
    image_page = page_has_large_background_image(page)
    valid_items = iter_valid_redaction_items(translated_items, image_page=image_page)
    if not valid_items:
        return

    apply_redaction_route(page, valid_items, fill_background=fill_background, cover_only=cover_only)


__all__ = [
    "item_has_removable_text",
    "redact_translated_text_areas",
]

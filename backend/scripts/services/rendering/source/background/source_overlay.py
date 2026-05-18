from __future__ import annotations

import time

import fitz

from services.rendering.source.background.image_route import replace_background_image_page
from services.rendering.source.background.redaction_plan import should_redact_source_page
from services.rendering.source.background.redaction_plan import should_use_cover_only_for_vector_text
from services.rendering.source.document_ops import strip_page_links
from services.rendering.source.redaction import redact_source_text_areas


def apply_source_page_overlay(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    cover_only: bool = False,
    redaction_strategy: str | None = None,
    redaction_items: list[dict] | None = None,
) -> dict[str, object]:
    started = time.perf_counter()
    strip_page_links(page)
    redaction_items = redaction_items if redaction_items is not None else translated_items
    if not should_redact_source_page(page):
        replace_background_image_page(page, translated_items)
        redaction = redact_source_text_areas(page, redaction_items, cover_only=False, strategy=redaction_strategy)
        redaction["elapsed_seconds"] = time.perf_counter() - started
        redaction["source_overlay_mode"] = "background_image"
        return redaction

    vector_cover_only = should_use_cover_only_for_vector_text(page, translated_items)
    redaction = redact_source_text_areas(
        page,
        redaction_items,
        cover_only=cover_only or vector_cover_only,
        strategy=redaction_strategy,
    )
    redaction["elapsed_seconds"] = time.perf_counter() - started
    redaction["source_overlay_mode"] = str(redaction.get("strategy") or redaction.get("route") or "visual_cover")
    return redaction

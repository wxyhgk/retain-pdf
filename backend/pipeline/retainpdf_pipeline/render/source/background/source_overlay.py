from __future__ import annotations

import time

import fitz

from retainpdf_pipeline.render.source.background.image_route import replace_background_image_page
from retainpdf_pipeline.render.source.background.redaction_plan import should_redact_source_page
from retainpdf_pipeline.render.source.background.redaction_plan import should_use_cover_only_for_vector_text
from retainpdf_pipeline.render.source.document_ops import strip_page_links
from retainpdf_pipeline.render.source.redaction import redact_source_text_areas
from retainpdf_pipeline.render.visual_profile import load_visual_profile_runtime


def apply_source_page_overlay(
    page: fitz.Page,
    translated_items: list[dict],
    *,
    cover_only: bool = False,
    redaction_strategy: str | None = None,
    redaction_items: list[dict] | None = None,
    visual_profile_path=None,
) -> dict[str, object]:
    started = time.perf_counter()
    strip_page_links(page)
    redaction_items = redaction_items if redaction_items is not None else translated_items
    visual_profile = load_visual_profile_runtime(visual_profile_path)
    if not should_redact_source_page(page):
        replace_background_image_page(page, translated_items)
        redaction = redact_source_text_areas(
            page,
            redaction_items,
            cover_only=False,
            strategy=redaction_strategy,
            visual_profile=visual_profile if visual_profile.loaded else None,
        )
        redaction["elapsed_seconds"] = time.perf_counter() - started
        redaction["source_overlay_mode"] = "background_image"
        redaction["visual_profile_cover"] = dict(visual_profile.diagnostics)
        return redaction

    vector_cover_only = should_use_cover_only_for_vector_text(page, translated_items)
    redaction = redact_source_text_areas(
        page,
        redaction_items,
        cover_only=cover_only or vector_cover_only,
        strategy=redaction_strategy,
        visual_profile=visual_profile if visual_profile.loaded else None,
    )
    redaction["elapsed_seconds"] = time.perf_counter() - started
    redaction["source_overlay_mode"] = str(redaction.get("strategy") or redaction.get("route") or "visual_cover")
    redaction["visual_profile_cover"] = dict(visual_profile.diagnostics)
    return redaction

from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.source.background.detect import page_has_large_background_image
from services.rendering.source.vector_profile import collect_page_drawing_rects


@dataclass(frozen=True)
class RedactionPageFacts:
    image_page: bool
    drawing_rects: list[fitz.Rect]
    drawing_count: int


def collect_redaction_page_facts(page: fitz.Page) -> RedactionPageFacts:
    drawing_rects = collect_page_drawing_rects(page)
    return RedactionPageFacts(
        image_page=page_has_large_background_image(page),
        drawing_rects=drawing_rects,
        drawing_count=len(drawing_rects),
    )

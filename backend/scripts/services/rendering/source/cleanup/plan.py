from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.source.cleanup.analysis import collect_page_drawing_rects
from services.rendering.source.cleanup.analysis import page_drawing_count
from services.rendering.source.cleanup.analysis import page_has_large_background_image
from services.rendering.source.cleanup.analysis import page_is_vector_heavy_count
from services.rendering.source.cleanup.analysis import page_should_use_cover_only
from services.rendering.source.cleanup.analysis import page_should_use_cover_only_count
from services.rendering.source.cleanup.shared import iter_valid_translated_items


@dataclass(frozen=True)
class RedactionPlan:
    valid_items: list[tuple[fitz.Rect, dict, str]]
    image_page: bool
    drawing_rects: list[fitz.Rect]
    drawing_count: int


def build_redaction_plan(page: fitz.Page, translated_items: list[dict]) -> RedactionPlan:
    image_page = page_has_large_background_image(page)
    valid_items = [
        (fitz.Rect(rect), item, translated_text)
        for rect, item, translated_text in iter_valid_translated_items(translated_items)
        if not rect.is_empty
    ]
    drawing_rects = collect_page_drawing_rects(page)
    return RedactionPlan(
        valid_items=valid_items,
        image_page=image_page,
        drawing_rects=drawing_rects,
        drawing_count=page_drawing_count(page),
    )


def page_prefers_cover_only(plan: RedactionPlan) -> bool:
    return page_should_use_cover_only(plan.drawing_rects)


def page_prefers_cover_only_by_count(plan: RedactionPlan) -> bool:
    return page_should_use_cover_only_count(plan.drawing_count)


def page_is_vector_heavy_by_count(plan: RedactionPlan) -> bool:
    return page_is_vector_heavy_count(plan.drawing_count)

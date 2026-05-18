from __future__ import annotations

import fitz

from services.rendering.source.cleanup.page_facts import collect_redaction_page_facts
from services.rendering.source.cleanup.plan_types import RedactionPlan
from services.rendering.source.cleanup.valid_items import iter_valid_redaction_items


def build_redaction_plan(page: fitz.Page, translated_items: list[dict]) -> RedactionPlan:
    page_facts = collect_redaction_page_facts(page)
    return RedactionPlan(
        valid_items=iter_valid_redaction_items(translated_items),
        image_page=page_facts.image_page,
        drawing_rects=page_facts.drawing_rects,
        drawing_count=page_facts.drawing_count,
    )

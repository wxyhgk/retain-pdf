from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.source.background.detect import page_has_large_background_image
from services.rendering.source.cleanup.plan_types import RedactionPlan
from services.rendering.source.vector_profile import page_drawing_count


@dataclass(frozen=True)
class RedactionRouteContext:
    image_page: bool
    drawing_count: int


def build_redaction_route_context(
    page: fitz.Page,
    plan: RedactionPlan | None,
) -> RedactionRouteContext:
    if plan is not None:
        return RedactionRouteContext(
            image_page=plan.image_page,
            drawing_count=plan.drawing_count,
        )
    return RedactionRouteContext(
        image_page=page_has_large_background_image(page),
        drawing_count=page_drawing_count(page),
    )

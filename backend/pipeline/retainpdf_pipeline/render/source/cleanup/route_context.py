from __future__ import annotations

from dataclasses import dataclass

import fitz

from retainpdf_pipeline.render.source.background.detect import page_has_large_background_image
from retainpdf_pipeline.render.source.vector_profile import page_drawing_count
from retainpdf_pipeline.render.source.cleanup.plan_types import RedactionPlan


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

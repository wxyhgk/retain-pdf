from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.analysis.profile.builder import build_render_page_profile
from services.rendering.analysis.profile.models import RenderPageKind
from services.rendering.analysis.route.builder import build_render_page_route
from services.rendering.analysis.route.models import RenderPageRoute


@dataclass(frozen=True)
class RenderPageClassification:
    kind: RenderPageKind
    large_background_image: bool
    visible_text_traces: int
    hidden_text_traces: int
    drawing_count: int
    background_coverage_ratio: float
    route: RenderPageRoute | None = None


def classify_render_page(
    page: fitz.Page,
    *,
    background_threshold: float = 0.75,
) -> RenderPageClassification:
    profile = build_render_page_profile(page, background_threshold=background_threshold)
    route = build_render_page_route(profile)
    return RenderPageClassification(
        kind=profile.kind,
        large_background_image=profile.image_background.has_large_background,
        visible_text_traces=profile.text_layer.visible_traces,
        hidden_text_traces=profile.text_layer.hidden_traces,
        drawing_count=profile.vector_layer.drawing_count,
        background_coverage_ratio=profile.image_background.coverage_ratio,
        route=route,
    )

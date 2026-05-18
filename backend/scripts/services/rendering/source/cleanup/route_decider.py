from __future__ import annotations

from services.rendering.source.cleanup.route_context import RedactionRouteContext
from services.rendering.source.cleanup.route_decision import RedactionRouteDecision
from services.rendering.source.cleanup.route_decision import ResolvedRedactionExecution
from services.rendering.source.cleanup.strategy import RedactionRoute
from services.rendering.source.vector_profile import page_is_vector_heavy_count
from services.rendering.source.vector_profile import page_should_use_cover_only_count


def decide_redaction_execution(
    route: RedactionRoute,
    context: RedactionRouteContext,
    *,
    fill_background: bool | None,
) -> RedactionRouteDecision:
    if route == "auto":
        return _decision("auto", route)
    if route == "visual_cover":
        return _decision("visual_cover", route)
    if route == "visual_cover_and_remove_text":
        return _decision("visual_cover_and_remove_text", route)

    if context.image_page:
        execution = "image_page_redaction"
    elif fill_background is None and page_should_use_cover_only_count(context.drawing_count):
        execution = "cover_only_count"
    elif fill_background is None and page_is_vector_heavy_count(context.drawing_count):
        execution = "vector_heavy_redaction"
    else:
        execution = "standard_redaction"

    return RedactionRouteDecision(
        execution=execution,
        route=route,
        image_page=context.image_page,
        drawing_count=context.drawing_count,
    )


def _decision(execution: ResolvedRedactionExecution, route: RedactionRoute) -> RedactionRouteDecision:
    return RedactionRouteDecision(
        execution=execution,
        route=route,
        image_page=False,
        drawing_count=0,
    )

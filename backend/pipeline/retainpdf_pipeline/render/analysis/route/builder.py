from __future__ import annotations

from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile
from retainpdf_pipeline.render.analysis.route.background_route import decide_page_background_route
from retainpdf_pipeline.render.analysis.route.compose_route import decide_page_compose_route
from retainpdf_pipeline.render.analysis.route.layout_route import decide_page_layout_route
from retainpdf_pipeline.render.analysis.route.models import RenderPageRoute
from retainpdf_pipeline.render.analysis.route.reason import page_route_reason
from retainpdf_pipeline.render.analysis.route.redaction_route import decide_page_redaction_route


def build_render_page_route(profile: RenderPageProfile) -> RenderPageRoute:
    return RenderPageRoute(
        redaction=decide_page_redaction_route(profile),
        background=decide_page_background_route(profile),
        compose=decide_page_compose_route(profile),
        layout=decide_page_layout_route(profile),
        reason=page_route_reason(profile),
    )

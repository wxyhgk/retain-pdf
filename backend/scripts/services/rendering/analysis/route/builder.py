from __future__ import annotations

from services.rendering.analysis.profile.models import RenderPageProfile
from services.rendering.analysis.route.background_route import decide_page_background_route
from services.rendering.analysis.route.compose_route import decide_page_compose_route
from services.rendering.analysis.route.layout_route import decide_page_layout_route
from services.rendering.analysis.route.models import RenderPageRoute
from services.rendering.analysis.route.reason import page_route_reason
from services.rendering.analysis.route.redaction_route import decide_page_redaction_route


def build_render_page_route(profile: RenderPageProfile) -> RenderPageRoute:
    return RenderPageRoute(
        redaction=decide_page_redaction_route(profile),
        background=decide_page_background_route(profile),
        compose=decide_page_compose_route(profile),
        layout=decide_page_layout_route(profile),
        reason=page_route_reason(profile),
    )

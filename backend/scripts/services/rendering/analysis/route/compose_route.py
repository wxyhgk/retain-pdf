from __future__ import annotations

from services.rendering.analysis.profile.models import RenderPageProfile
from services.rendering.analysis.route.models import PageComposeRoute


def decide_page_compose_route(profile: RenderPageProfile) -> PageComposeRoute:
    if profile.kind == "editable_text":
        return "typst_overlay"
    return "typst_background"

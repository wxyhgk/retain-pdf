from __future__ import annotations

from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile
from retainpdf_pipeline.render.analysis.route.models import PageComposeRoute


def decide_page_compose_route(profile: RenderPageProfile) -> PageComposeRoute:
    if profile.kind == "editable_text":
        return "typst_overlay"
    return "typst_background"

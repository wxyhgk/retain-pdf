from __future__ import annotations

from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile
from retainpdf_pipeline.render.analysis.route.models import PageRedactionRoute


def decide_page_redaction_route(profile: RenderPageProfile) -> PageRedactionRoute:
    if profile.kind == "editable_text":
        return "text_layer_only"
    if profile.kind == "pseudo_editable_scan":
        return "visual_cover_and_remove_text"
    return "visual_cover"

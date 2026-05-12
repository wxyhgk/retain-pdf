from __future__ import annotations

from services.rendering.analysis.profile.models import RenderPageProfile
from services.rendering.analysis.route.models import PageBackgroundRoute


def decide_page_background_route(profile: RenderPageProfile) -> PageBackgroundRoute:
    if profile.kind == "scan_image":
        return "image_background"
    if profile.kind == "pseudo_editable_scan":
        return "hidden_text_stripped_source"
    if profile.kind in {"vector_heavy", "mixed_complex"}:
        return "cleaned_background"
    return "source_pdf_page"

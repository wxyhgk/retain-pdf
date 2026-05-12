from __future__ import annotations

from services.rendering.analysis.profile.models import RenderPageProfile


def page_route_reason(profile: RenderPageProfile) -> str:
    if profile.kind == "pseudo_editable_scan":
        return "large background image with hidden text layer"
    if profile.kind == "scan_image":
        return "large background image without visible text"
    if profile.kind == "vector_heavy":
        return "vector drawing count exceeds safe text-layer cleanup threshold"
    if profile.kind == "mixed_complex":
        return "large background image with additional page content"
    return "visible editable text layer"

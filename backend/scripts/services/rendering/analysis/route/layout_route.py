from __future__ import annotations

from services.rendering.analysis.profile.models import RenderPageProfile
from services.rendering.analysis.route.models import PageLayoutRoute


def decide_page_layout_route(profile: RenderPageProfile) -> PageLayoutRoute:
    del profile
    return "ocr_bbox_overlay"

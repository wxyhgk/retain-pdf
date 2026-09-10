from __future__ import annotations

from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile
from retainpdf_pipeline.render.analysis.route.models import PageLayoutRoute


def decide_page_layout_route(profile: RenderPageProfile) -> PageLayoutRoute:
    del profile
    return "ocr_bbox_overlay"

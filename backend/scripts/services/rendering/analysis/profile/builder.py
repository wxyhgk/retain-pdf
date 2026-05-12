from __future__ import annotations

import fitz

from services.rendering.analysis.profile.geometry import build_page_geometry_profile
from services.rendering.analysis.profile.image_background import build_image_background_profile
from services.rendering.analysis.profile.kind import classify_profile_kind
from services.rendering.analysis.profile.models import RenderPageProfile
from services.rendering.analysis.profile.ocr_blocks import build_ocr_block_profile
from services.rendering.analysis.profile.text_layer import build_text_layer_profile
from services.rendering.analysis.profile.vector_layer import build_vector_layer_profile


def build_render_page_profile(
    page: fitz.Page,
    *,
    ocr_items: list[dict] | None = None,
    background_threshold: float = 0.75,
) -> RenderPageProfile:
    geometry = build_page_geometry_profile(page)
    text_layer = build_text_layer_profile(page)
    image_background = build_image_background_profile(page, background_threshold=background_threshold)
    vector_layer = build_vector_layer_profile(page)
    ocr_blocks = build_ocr_block_profile(
        ocr_items,
        page_width=geometry.width_pt,
        page_height=geometry.height_pt,
    )
    return RenderPageProfile(
        geometry=geometry,
        text_layer=text_layer,
        image_background=image_background,
        vector_layer=vector_layer,
        ocr_blocks=ocr_blocks,
        kind=classify_profile_kind(
            text_layer=text_layer,
            image_background=image_background,
            vector_layer=vector_layer,
        ),
    )

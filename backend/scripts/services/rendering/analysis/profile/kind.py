from __future__ import annotations

from services.rendering.analysis.profile.image_background import ImageBackgroundProfile
from services.rendering.analysis.profile.models import RenderPageKind
from services.rendering.analysis.profile.text_layer import TextLayerProfile
from services.rendering.analysis.profile.vector_layer import VectorLayerProfile


def classify_profile_kind(
    *,
    text_layer: TextLayerProfile,
    image_background: ImageBackgroundProfile,
    vector_layer: VectorLayerProfile,
) -> RenderPageKind:
    if image_background.has_large_background and text_layer.has_hidden_text and not text_layer.has_visible_text:
        return "pseudo_editable_scan"
    if image_background.has_large_background and not text_layer.has_visible_text:
        return "scan_image"
    if vector_layer.vector_heavy:
        return "vector_heavy"
    if image_background.has_large_background:
        return "mixed_complex"
    return "editable_text"

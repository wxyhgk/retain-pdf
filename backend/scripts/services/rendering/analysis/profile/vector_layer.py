from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.analysis.profile.drawing_count import drawing_count
from services.rendering.analysis.profile.vector_cover_preference import prefers_vector_cover_only
from services.rendering.analysis.profile.vector_heavy import is_vector_heavy


@dataclass(frozen=True)
class VectorLayerProfile:
    drawing_count: int
    vector_heavy: bool
    cover_only_preferred: bool


def build_vector_layer_profile(page: fitz.Page) -> VectorLayerProfile:
    count = drawing_count(page)
    return VectorLayerProfile(
        drawing_count=count,
        vector_heavy=is_vector_heavy(count),
        cover_only_preferred=prefers_vector_cover_only(count),
    )

from __future__ import annotations

from services.rendering.analysis.profile.vector_thresholds import VECTOR_COVER_ONLY_DRAWINGS_THRESHOLD


def prefers_vector_cover_only(drawing_count: int) -> bool:
    return drawing_count >= VECTOR_COVER_ONLY_DRAWINGS_THRESHOLD

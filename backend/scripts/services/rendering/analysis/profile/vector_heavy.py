from __future__ import annotations

from services.rendering.analysis.profile.vector_thresholds import VECTOR_HEAVY_DRAWINGS_THRESHOLD


def is_vector_heavy(drawing_count: int) -> bool:
    return drawing_count >= VECTOR_HEAVY_DRAWINGS_THRESHOLD

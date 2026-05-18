from __future__ import annotations

from services.rendering.source.cleanup.config import SPECIAL_MATH_FONT_MARKERS


def is_special_math_font(font_name: str) -> bool:
    normalized = str(font_name or "").strip().lower()
    if not normalized:
        return False
    return any(marker in normalized for marker in SPECIAL_MATH_FONT_MARKERS)

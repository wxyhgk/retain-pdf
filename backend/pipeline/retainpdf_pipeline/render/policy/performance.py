from __future__ import annotations

import os


BBOX_TEXT_STRIP_DEFAULT_MAX_SECONDS = 30.0


def source_cleanup_max_seconds() -> float:
    raw = str(os.environ.get("RETAIN_BBOX_TEXT_STRIP_MAX_SECONDS", "") or "").strip()
    if not raw:
        return BBOX_TEXT_STRIP_DEFAULT_MAX_SECONDS
    try:
        return max(0.0, float(raw))
    except ValueError:
        return BBOX_TEXT_STRIP_DEFAULT_MAX_SECONDS


__all__ = [
    "BBOX_TEXT_STRIP_DEFAULT_MAX_SECONDS",
    "source_cleanup_max_seconds",
]

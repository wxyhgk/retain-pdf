from __future__ import annotations

import fitz

from services.rendering.source.background.detect import pick_primary_background_image


def primary_background_image(page: fitz.Page) -> tuple[int, fitz.Rect] | None:
    return pick_primary_background_image(page, coverage_ratio_threshold=0.0)

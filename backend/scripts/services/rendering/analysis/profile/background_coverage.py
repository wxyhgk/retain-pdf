from __future__ import annotations

import fitz

from services.rendering.analysis.profile.rect_area import rect_area


def background_coverage_ratio(page: fitz.Page, rect: fitz.Rect | None) -> float:
    if rect is None:
        return 0.0
    page_area = max(rect_area(page.rect), 1.0)
    return rect_area(rect & page.rect) / page_area

from __future__ import annotations

import fitz

from services.rendering.redaction.redaction_analysis import page_has_large_background_image
from services.rendering.redaction.redaction_geometry import rect_area


def pick_primary_background_image(
    page: fitz.Page,
    *,
    coverage_ratio_threshold: float = 0.75,
) -> tuple[int, fitz.Rect] | None:
    page_area = max(rect_area(page.rect), 1.0)
    best: tuple[float, int, fitz.Rect] | None = None
    try:
        images = page.get_images(full=True)
    except Exception:
        return None

    for image in images:
        if not image:
            continue
        xref = image[0]
        try:
            rects = page.get_image_rects(xref)
        except Exception:
            continue
        for rect in rects:
            if rect.is_empty:
                continue
            coverage_ratio = rect_area(rect & page.rect) / page_area
            if coverage_ratio < coverage_ratio_threshold:
                continue
            candidate = (coverage_ratio, xref, rect)
            if best is None or candidate[0] > best[0]:
                best = candidate
    if best is None:
        return None
    return best[1], best[2]


__all__ = [
    "page_has_large_background_image",
    "pick_primary_background_image",
]

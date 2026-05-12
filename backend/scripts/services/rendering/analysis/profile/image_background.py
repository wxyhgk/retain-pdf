from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.analysis.profile.background_coverage import background_coverage_ratio
from services.rendering.analysis.profile.large_background import has_large_background
from services.rendering.analysis.profile.primary_image import primary_background_image


@dataclass(frozen=True)
class ImageBackgroundProfile:
    has_large_background: bool
    coverage_ratio: float
    xref: int | None
    bbox: tuple[float, float, float, float] | None


def build_image_background_profile(
    page: fitz.Page,
    *,
    background_threshold: float = 0.75,
) -> ImageBackgroundProfile:
    primary = primary_background_image(page)
    if primary is None:
        return ImageBackgroundProfile(
            has_large_background=False,
            coverage_ratio=0.0,
            xref=None,
            bbox=None,
        )
    xref, rect = primary
    coverage_ratio = background_coverage_ratio(page, rect)
    return ImageBackgroundProfile(
        has_large_background=has_large_background(coverage_ratio, threshold=background_threshold),
        coverage_ratio=coverage_ratio,
        xref=int(xref),
        bbox=(float(rect.x0), float(rect.y0), float(rect.x1), float(rect.y1)),
    )

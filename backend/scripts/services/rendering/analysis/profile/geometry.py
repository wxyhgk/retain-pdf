from __future__ import annotations

from dataclasses import dataclass

import fitz

from services.rendering.analysis.profile.page_cropbox import page_cropbox
from services.rendering.analysis.profile.page_index import page_index
from services.rendering.analysis.profile.page_rotation import page_rotation
from services.rendering.analysis.profile.page_size import page_size_pt


@dataclass(frozen=True)
class PageGeometryProfile:
    page_index: int
    width_pt: float
    height_pt: float
    rotation: int
    cropbox: tuple[float, float, float, float]


def build_page_geometry_profile(page: fitz.Page) -> PageGeometryProfile:
    width, height = page_size_pt(page)
    return PageGeometryProfile(
        page_index=page_index(page),
        width_pt=width,
        height_pt=height,
        rotation=page_rotation(page),
        cropbox=page_cropbox(page),
    )

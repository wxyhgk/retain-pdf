from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from services.rendering.analysis.profile.geometry import PageGeometryProfile
from services.rendering.analysis.profile.image_background import ImageBackgroundProfile
from services.rendering.analysis.profile.ocr_blocks import OcrBlockProfile
from services.rendering.analysis.profile.text_layer import TextLayerProfile
from services.rendering.analysis.profile.vector_layer import VectorLayerProfile


RenderPageKind = Literal[
    "editable_text",
    "scan_image",
    "pseudo_editable_scan",
    "vector_heavy",
    "mixed_complex",
]


@dataclass(frozen=True)
class RenderPageProfile:
    geometry: PageGeometryProfile
    text_layer: TextLayerProfile
    image_background: ImageBackgroundProfile
    vector_layer: VectorLayerProfile
    ocr_blocks: OcrBlockProfile
    kind: RenderPageKind

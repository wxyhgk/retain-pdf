from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from retainpdf_pipeline.render.analysis.profile.geometry import PageGeometryProfile
from retainpdf_pipeline.render.analysis.profile.image_background import ImageBackgroundProfile
from retainpdf_pipeline.render.analysis.profile.ocr_blocks import OcrBlockProfile
from retainpdf_pipeline.render.analysis.profile.text_layer import TextLayerProfile
from retainpdf_pipeline.render.analysis.profile.vector_layer import VectorLayerProfile


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

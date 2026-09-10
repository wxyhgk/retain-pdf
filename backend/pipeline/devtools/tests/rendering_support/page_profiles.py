from __future__ import annotations

from retainpdf_pipeline.render.analysis.profile.geometry import PageGeometryProfile
from retainpdf_pipeline.render.analysis.profile.image_background import ImageBackgroundProfile
from retainpdf_pipeline.render.analysis.profile.models import RenderPageKind
from retainpdf_pipeline.render.analysis.profile.models import RenderPageProfile
from retainpdf_pipeline.render.analysis.profile.ocr_blocks import OcrBlockProfile
from retainpdf_pipeline.render.analysis.profile.text_layer import TextLayerProfile
from retainpdf_pipeline.render.analysis.profile.vector_layer import VectorLayerProfile


def sample_render_page_profile(kind: RenderPageKind) -> RenderPageProfile:
    large_background = kind in {"scan_image", "pseudo_editable_scan", "mixed_complex"}
    return RenderPageProfile(
        geometry=PageGeometryProfile(
            page_index=0,
            width_pt=200.0,
            height_pt=300.0,
            rotation=0,
            cropbox=(0.0, 0.0, 200.0, 300.0),
        ),
        text_layer=TextLayerProfile(
            visible_traces=1 if kind == "editable_text" else 0,
            hidden_traces=1 if kind == "pseudo_editable_scan" else 0,
            has_visible_text=kind == "editable_text",
            has_hidden_text=kind == "pseudo_editable_scan",
            editable=kind == "editable_text",
        ),
        image_background=ImageBackgroundProfile(
            has_large_background=large_background,
            coverage_ratio=0.9 if large_background else 0.0,
            xref=1 if large_background else None,
            bbox=(0.0, 0.0, 200.0, 300.0) if large_background else None,
        ),
        vector_layer=VectorLayerProfile(
            drawing_count=1200 if kind == "vector_heavy" else 0,
            vector_heavy=kind == "vector_heavy",
            cover_only_preferred=kind == "vector_heavy",
        ),
        ocr_blocks=OcrBlockProfile(
            block_count=1,
            valid_bbox_count=1,
            total_bbox_area=100.0,
            page_area_ratio=0.01,
        ),
        kind=kind,
    )

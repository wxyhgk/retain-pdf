from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.analysis.profile.geometry import PageGeometryProfile
from services.rendering.analysis.profile.image_background import ImageBackgroundProfile
from services.rendering.analysis.profile.models import RenderPageKind
from services.rendering.analysis.profile.models import RenderPageProfile
from services.rendering.analysis.profile.ocr_blocks import OcrBlockProfile
from services.rendering.analysis.profile.text_layer import TextLayerProfile
from services.rendering.analysis.profile.vector_layer import VectorLayerProfile
from services.rendering.analysis.route.background_route import decide_page_background_route
from services.rendering.analysis.route.builder import build_render_page_route
from services.rendering.analysis.route.compose_route import decide_page_compose_route
from services.rendering.analysis.route.layout_route import decide_page_layout_route
from services.rendering.analysis.route.redaction_route import decide_page_redaction_route


def _profile(kind: RenderPageKind) -> RenderPageProfile:
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
            has_large_background=kind in {"scan_image", "pseudo_editable_scan", "mixed_complex"},
            coverage_ratio=0.9 if kind in {"scan_image", "pseudo_editable_scan", "mixed_complex"} else 0.0,
            xref=1 if kind in {"scan_image", "pseudo_editable_scan", "mixed_complex"} else None,
            bbox=(0.0, 0.0, 200.0, 300.0)
            if kind in {"scan_image", "pseudo_editable_scan", "mixed_complex"}
            else None,
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


def test_page_route_decisions_are_split_by_concern() -> None:
    editable = _profile("editable_text")
    assert decide_page_redaction_route(editable) == "text_layer_only"
    assert decide_page_background_route(editable) == "source_pdf_page"
    assert decide_page_compose_route(editable) == "typst_overlay"
    assert decide_page_layout_route(editable) == "ocr_bbox_overlay"


def test_build_render_page_route_for_scan_page() -> None:
    route = build_render_page_route(_profile("scan_image"))
    assert route.redaction == "visual_cover"
    assert route.background == "image_background"
    assert route.compose == "typst_background"
    assert route.layout == "ocr_bbox_overlay"
    assert "large background image" in route.reason


def test_build_render_page_route_for_pseudo_editable_scan() -> None:
    route = build_render_page_route(_profile("pseudo_editable_scan"))
    assert route.redaction == "visual_cover_and_remove_text"
    assert route.background == "hidden_text_stripped_source"
    assert route.compose == "typst_background"


def test_build_render_page_route_for_vector_heavy_page() -> None:
    route = build_render_page_route(_profile("vector_heavy"))
    assert route.redaction == "visual_cover"
    assert route.background == "cleaned_background"
    assert route.compose == "typst_background"

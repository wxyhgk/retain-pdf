from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.analysis.profile.text_layer import TextLayerProfile
from retainpdf_pipeline.render.analysis.route.background_route import decide_page_background_route
from retainpdf_pipeline.render.analysis.route.builder import build_render_page_route
from retainpdf_pipeline.render.analysis.route.compose_route import decide_page_compose_route
from retainpdf_pipeline.render.analysis.route.layout_route import decide_page_layout_route
from retainpdf_pipeline.render.analysis.route.redaction_route import decide_page_redaction_route
from devtools.tests.rendering_support.page_profiles import sample_render_page_profile as _profile


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


def test_page_route_exposes_pipeline_decisions() -> None:
    editable = build_render_page_route(_profile("editable_text"))
    pseudo_scan = build_render_page_route(_profile("pseudo_editable_scan"))

    assert editable.render_mode_hint == "overlay"
    assert editable.text_cleanup == "pikepdf_text_strip"
    assert editable.overlay_fallback == "none"

    assert pseudo_scan.render_mode_hint == "typst_visual"
    assert pseudo_scan.text_cleanup == "visual_cover_and_remove_text"
    assert pseudo_scan.overlay_fallback == "page_visual_cover"


def test_large_background_with_visible_text_is_pseudo_editable_scan() -> None:
    from retainpdf_pipeline.render.analysis.profile.kind import classify_profile_kind

    profile = _profile("mixed_complex")
    kind = classify_profile_kind(
        text_layer=TextLayerProfile(
            visible_traces=8,
            hidden_traces=0,
            has_visible_text=True,
            has_hidden_text=False,
            editable=True,
        ),
        image_background=profile.image_background,
        vector_layer=profile.vector_layer,
    )
    assert kind == "pseudo_editable_scan"


def test_build_render_page_route_for_vector_heavy_page() -> None:
    route = build_render_page_route(_profile("vector_heavy"))
    assert route.redaction == "visual_cover"
    assert route.background == "cleaned_background"
    assert route.compose == "typst_background"

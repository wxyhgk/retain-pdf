from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.visual_profile import build_page_visual_profile
from retainpdf_pipeline.render.visual_profile import merge_visual_profile_colors
from retainpdf_pipeline.render.visual_profile import write_document_visual_profile
from retainpdf_pipeline.render.visual_profile.manifest import document_visual_profile_from_manifest
from retainpdf_pipeline.render.visual_profile.manifest import document_visual_profile_to_manifest
from retainpdf_pipeline.render.visual_profile.contracts import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import VISUAL_PROFILE_ALGORITHM_VERSION
from retainpdf_pipeline.render.visual_profile.runtime import load_visual_profile_runtime


def test_visual_profile_samples_editable_span_color_and_background() -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=300, height=200)
        page.draw_rect(fitz.Rect(40, 40, 230, 80), color=None, fill=(0.86, 0.9, 0.96))
        page.insert_textbox(
            fitz.Rect(50, 48, 220, 76),
            "Colored heading",
            fontsize=15,
            color=(0.8, 0.0, 0.0),
        )
        items = [
                {
                    "item_id": "p001-b001",
                    "bbox": [44, 42, 226, 82],
                    "block_kind": "text",
                    "layout_role": "title",
                    "translated_text": "彩色标题",
                }
            ]

        profile = build_page_visual_profile(page, 0, items)

        item = profile.items["p001-b001"]
        assert item.method == "background_pixels+span_color"
        assert item.page_index == 0
        assert item.bbox_space == "page_pt"
        assert item.bbox_source == "render_cover_bbox"
        assert item.source_item_kind == "title"
        assert item.bbox[0] <= 44
        assert item.confidence > 0.8
        assert item.background_rgb[2] > item.background_rgb[0]
        assert item.text_rgb[0] > 0.65
        assert item.text_rgb[1] < 0.15
    finally:
        doc.close()


def test_visual_profile_works_on_image_only_page_pixels() -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=260, height=180)
        page.draw_rect(fitz.Rect(0, 0, 260, 180), color=None, fill=(0.92, 0.92, 0.86))
        page.draw_rect(fitz.Rect(50, 50, 210, 100), color=None, fill=(0.72, 0.78, 0.86))
        page.draw_rect(fitz.Rect(70, 66, 180, 76), color=None, fill=(0.0, 0.0, 0.0))
        items = [
            {
                "item_id": "p001-b002",
                "bbox": [50, 50, 210, 100],
                "block_kind": "text",
                "layout_role": "title",
                "translated_text": "图片页文本",
            }
        ]

        profile = build_page_visual_profile(page, 0, items)

        item = profile.items["p001-b002"]
        assert item.method == "background_pixels+foreground_pixels"
        assert item.background_rgb[2] > item.background_rgb[0]
        assert item.text_rgb[0] < 0.1
        assert item.text_rgb[1] < 0.1
        assert item.text_rgb[2] < 0.1
    finally:
        doc.close()


def test_visual_profile_manifest_round_trips() -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=200, height=120)
        page.insert_textbox(fitz.Rect(20, 20, 160, 42), "Text", fontsize=12, color=(0, 0, 0))
        page_profile = build_page_visual_profile(
            page,
            0,
            [{"item_id": "p001-b001", "bbox": [20, 20, 160, 42], "translated_text": "文本"}],
        )
        document = DocumentVisualProfile(algorithm=VISUAL_PROFILE_ALGORITHM_VERSION, pages={0: page_profile})

        manifest = document_visual_profile_to_manifest(document)
        restored = document_visual_profile_from_manifest(manifest)

        assert restored.algorithm == VISUAL_PROFILE_ALGORITHM_VERSION
        assert restored.pages[0].items["p001-b001"].item_id == "p001-b001"
        assert restored.pages[0].items["p001-b001"].bbox_source == "render_cover_bbox"
        assert restored.pages[0].items["p001-b001"].bbox_space == "page_pt"
        assert restored.pages[0].items["p001-b001"].background_rgb == tuple(
            manifest["pages"]["0"]["items"]["p001-b001"]["background_rgb"]
        )
    finally:
        doc.close()


def test_visual_profile_runtime_merges_profile_colors_over_precomputed(tmp_path: Path) -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=200, height=120)
        page.draw_rect(fitz.Rect(20, 20, 160, 50), color=None, fill=(0.7, 0.8, 0.9))
        page.insert_textbox(fitz.Rect(24, 24, 150, 44), "Text", fontsize=12, color=(0.9, 0, 0))
        page_profile = build_page_visual_profile(
            page,
            0,
            [
                {
                    "item_id": "p001-b001",
                    "bbox": [20, 20, 160, 50],
                    "block_kind": "text",
                    "_render_overlay_fill": "sampled",
                    "translated_text": "文本",
                }
            ],
        )
        path = tmp_path / "visual_profile.v1.json"
        write_document_visual_profile(path, DocumentVisualProfile(algorithm=VISUAL_PROFILE_ALGORITHM_VERSION, pages={0: page_profile}))

        colors, diagnostics = merge_visual_profile_colors(
            visual_profile_path=path,
            precomputed_colors_by_item_id={
                "p001-b001": {
                    "cover_fill": (1.0, 1.0, 1.0),
                    "text_color": (0.0, 0.0, 0.0),
                }
            },
        )

        assert diagnostics["loaded"] is True
        assert colors is not None
        assert colors["p001-b001"]["cover_fill"] != (1.0, 1.0, 1.0)
        assert colors["p001-b001"]["text_color"] == page_profile.items["p001-b001"].text_rgb
    finally:
        doc.close()


def test_visual_profile_runtime_supplies_background_visual_cover(tmp_path: Path) -> None:
    doc = fitz.open()
    try:
        page = doc.new_page(width=200, height=120)
        page.draw_rect(fitz.Rect(20, 20, 150, 55), color=None, fill=(0.72, 0.81, 0.9))
        page.insert_textbox(fitz.Rect(24, 26, 145, 48), "source", fontsize=11, color=(0, 0, 0))
        items = [{"item_id": "p001-b001", "bbox": [20, 20, 150, 55], "block_kind": "text", "translated_text": "文本"}]
        page_profile = build_page_visual_profile(page, 0, items)
        path = tmp_path / "visual_profile.v1.json"
        write_document_visual_profile(path, DocumentVisualProfile(algorithm=VISUAL_PROFILE_ALGORITHM_VERSION, pages={0: page_profile}))
        runtime = load_visual_profile_runtime(path)

        fill = runtime.background_fill_for_item(
            {
                "source_item_id": "p001-b001",
                "bbox": [20, 20, 150, 55],
            }
        )

        assert fill is not None
        assert all(
            abs(left - right) < 0.0001
            for left, right in zip(fill, page_profile.items["p001-b001"].background_rgb)
        )
    finally:
        doc.close()

import sys
import tempfile
from pathlib import Path
from unittest import mock
import re

import fitz
import pytest
from PIL import Image


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source.background.stage import build_clean_background_pdf
from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.layout.payload.body_pipeline import apply_body_payload_pipeline
from retainpdf_pipeline.render.layout.payload.collision import mark_adjacent_collision_risk
from retainpdf_pipeline.render.layout.payload.emit import payload_to_render_block
from retainpdf_pipeline.render.layout.payload.first_line_indent import detect_first_line_indent_pt
from retainpdf_pipeline.render.layout.payload.line_structure import maybe_preserve_structured_line_breaks
from retainpdf_pipeline.render.layout.model.models import RenderLayoutBlock
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.page_specs import build_render_page_specs
from retainpdf_pipeline.render.layout.payload.continuation_split import split_protected_text_for_boxes
from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.render.source.items import get_item_translated_text
from retainpdf_pipeline.render.source.dev_overlay.text_draw import _build_direct_draw_tokens
from retainpdf_pipeline.render.source.dev_overlay.text_draw import _fit_segment_layout
from retainpdf_pipeline.render.layout.payload.suspicious_ocr import detect_and_drop_suspicious_ocr_glued_blocks
from retainpdf_pipeline.render.output.typst.book_renderer import _compile_render_pages_pdf_resilient
from retainpdf_pipeline.render.output.typst.block_renderer import build_typst_block
from retainpdf_pipeline.render.output.typst.overlay_ops import overlay_translated_pages_on_doc
from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.output.typst.compiler import _resolved_font_paths
from retainpdf_pipeline.render.output.typst.compiler import _resolved_common_root
from retainpdf_pipeline.render.output.typst.compiler import TypstCompileError
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_book_background_pdf
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_overlay_pdf
from retainpdf_pipeline.render.output.typst.compiler import compile_typst_render_pages_pdf
from retainpdf_pipeline.render.output.typst.emitter import build_typst_source_from_page_specs
from retainpdf_pipeline.render.output.typst.source_builder import build_typst_overlay_source
from retainpdf_pipeline.render.policy import apply_render_page_policy_fields
from retainpdf_pipeline.render.policy import build_render_page_policy
from retainpdf_pipeline.render.policy import formula_neighbor_text_item_ids
from retainpdf_pipeline.render.policy import item_render_policy
from retainpdf_pipeline.render.policy import item_render_policy_reason
from retainpdf_pipeline.render.policy import item_requires_visual_cover_only
from retainpdf_pipeline.render.policy import item_uses_white_overlay_fill
from retainpdf_pipeline.render.policy import protect_formula_regions_in_redaction_items
from retainpdf_pipeline.render.output.typst.source_page_overlay import apply_source_page_overlay
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import apply_redaction_diagnostics
from retainpdf_pipeline.render.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from retainpdf_pipeline.render.source.background.redaction_items import redaction_items_from_layout_blocks
from retainpdf_pipeline.render.source.cleanup.item_rects import cover_rects_from_valid_items
from retainpdf_pipeline.render.output.typst.source_page_overlay import overlay_pages_from_single_pdf
from retainpdf_pipeline.render.output.typst.source_page_overlay import redaction_items_from_render_blocks
from retainpdf_pipeline.render.output.typst.sanitize import sanitize_items_for_typst_compile
from retainpdf_pipeline.render.output.typst.overlay_ops import _extract_failed_overlay_indices
from retainpdf_pipeline.render.output.typst.overlay_ops import _can_use_pikepdf_book_overlay
from retainpdf_pipeline.render.workflow.cover_fallback import cover_fallback_page_indices
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.modes import _compress_final_pdf_if_needed
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_pages import extract_pages_with_pikepdf
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from devtools.tests.rendering_support.page_specs import sample_page_spec as _page_spec


def test_background_book_source_draws_sampled_block_fill() -> None:
    from retainpdf_pipeline.render.output.typst.source_builder import build_typst_book_background_source

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        doc = fitz.open()
        doc.new_page(width=200, height=120)
        doc.save(source_pdf)
        doc.close()

        source = build_typst_book_background_source(
            source_pdf,
            [
                (
                    0,
                    200.0,
                    120.0,
                    [
                        {
                            "item_id": "p001-b001",
                            "page_idx": 0,
                            "block_type": "text",
                            "bbox": [10.0, 20.0, 120.0, 62.0],
                            "translated_text": "灰底文本块",
                            "protected_translated_text": "灰底文本块",
                            "formula_map": [],
                            "_render_cover_fill": (0.85, 0.85, 0.85),
                        }
                    ],
                )
            ],
            root,
        )

    assert "fill: rgb(216, 216, 216)" in source


def test_old_overlay_prebuilt_source_without_render_version_is_not_reused() -> None:
    from retainpdf_pipeline.render.output.typst.overlay_source_cache import prebuilt_source_matches_page_specs

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "book-overlay.typ.prebuilt"
        path.write_text(
            '#set page(width: 200pt, height: 120pt, margin: 0pt, fill: none)\n',
            encoding="utf-8",
        )

        assert not prebuilt_source_matches_page_specs(path, [(200.0, 120.0, [])])


def test_overlay_prebuilt_source_cover_fill_mode_does_not_reuse_plain_source() -> None:
    from retainpdf_pipeline.render.output.typst.overlay_source_cache import PREBUILT_SOURCE_RENDER_VERSION
    from retainpdf_pipeline.render.output.typst.overlay_source_cache import prebuilt_source_matches_page_specs

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "book-overlay.typ.prebuilt"
        path.write_text(
            f"// {PREBUILT_SOURCE_RENDER_VERSION}\n"
            '#set page(width: 200pt, height: 120pt, margin: 0pt, fill: none)\n',
            encoding="utf-8",
        )

        assert prebuilt_source_matches_page_specs(path, [(200.0, 120.0, [])])
        assert not prebuilt_source_matches_page_specs(
            path,
            [(200.0, 120.0, [])],
            include_cover_rect=True,
        )


def test_render_color_profile_preserves_tuple_cover_fill() -> None:
    from retainpdf_pipeline.render.source.prewarm_color_profile import round_color
    from retainpdf_pipeline.render.source.prewarm_manifest import color_tuple

    assert round_color((1.0, 0.9490196078431372, 0.8156862745098039)) == [1.0, 0.94902, 0.81569]
    assert color_tuple((1.0, 0.9490196078431372, 0.8156862745098039), default=(0.0, 0.0, 0.0)) == (
        1.0,
        0.9490196078431372,
        0.8156862745098039,
    )


def test_prewarm_color_adapt_uses_full_visual_profile_without_resampling() -> None:
    from retainpdf_pipeline.render.source import prewarm_color_profile
    from retainpdf_pipeline.render.visual_profile.contracts import DocumentVisualProfile
    from retainpdf_pipeline.render.visual_profile.contracts import ItemVisualProfile
    from retainpdf_pipeline.render.visual_profile.contracts import PageVisualProfile

    pages = {
        0: [
            {"item_id": "p001-b001", "bbox": [10, 20, 80, 40], "translated_text": "甲"},
            {"item_id": "p001-b002", "bbox": [10, 50, 80, 70], "translated_text": "乙"},
        ]
    }
    profile = DocumentVisualProfile(
        algorithm="test",
        pages={
            0: PageVisualProfile(
                page_index=0,
                background_rgb=(1.0, 1.0, 1.0),
                items={
                    "p001-b001": ItemVisualProfile(
                        item_id="p001-b001",
                        page_index=0,
                        bbox=(10, 20, 80, 40),
                        bbox_space="page_pt",
                        bbox_source="test",
                        source_item_kind="text",
                        background_rgb=(0.9, 0.9, 0.9),
                        text_rgb=(0.1, 0.1, 0.1),
                        confidence=1.0,
                        method="test",
                    ),
                    "p001-b002": ItemVisualProfile(
                        item_id="p001-b002",
                        page_index=0,
                        bbox=(10, 50, 80, 70),
                        bbox_space="page_pt",
                        bbox_source="test",
                        source_item_kind="text",
                        background_rgb=(0.8, 0.8, 0.8),
                        text_rgb=(0.2, 0.2, 0.2),
                        confidence=1.0,
                        method="test",
                    ),
                },
            )
        },
    )

    with mock.patch.object(prewarm_color_profile.fitz, "open") as open_mock:
        adapted = prewarm_color_profile.apply_page_color_adapt_for_prewarm(
            Path("/does/not/need/source.pdf"),
            pages,
            visual_profile=profile,
        )

    open_mock.assert_not_called()
    assert adapted[0][0]["_render_cover_fill"] == (0.9, 0.9, 0.9)
    assert adapted[0][1]["_render_text_color"] == (0.2, 0.2, 0.2)


def test_overlay_color_adapt_samples_local_gray_fill_without_page_background_image() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=200, height=160)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(20, 30, 150, 80))
        shape.finish(color=None, fill=(216 / 255.0, 216 / 255.0, 216 / 255.0))
        shape.commit()
        page.insert_text((28, 54), "source text", fontsize=10, color=(0, 0, 0))

        adapted = apply_adaptive_overlay_colors(
            page,
            [
                {
                    "item_id": "p001-b001",
                    "bbox": [26.0, 40.0, 130.0, 66.0],
                    "translated_text": "译文",
                    "_render_use_cover_fill": True,
                }
            ],
        )
    finally:
        doc.close()

    fill = adapted[0]["_render_cover_fill"]
    assert fill != (1, 1, 1)
    assert all(abs(component - 216 / 255.0) < 0.08 for component in fill)
    assert adapted[0]["_render_text_color"] == (0, 0, 0)


def test_overlay_color_adapt_batch_sampler_uses_rect_area_compatibility() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=240, height=240)
        shape = page.new_shape()
        for index in range(8):
            x0 = 12 + (index % 4) * 54
            y0 = 18 + (index // 4) * 64
            shape.draw_rect(fitz.Rect(x0, y0, x0 + 36, y0 + 24))
        shape.finish(color=None, fill=(230 / 255.0, 230 / 255.0, 230 / 255.0))
        shape.commit()

        items = [
            {
                "item_id": f"p001-b{index:03d}",
                "bbox": [
                    12 + (index % 4) * 54,
                    18 + (index // 4) * 64,
                    48 + (index % 4) * 54,
                    42 + (index // 4) * 64,
                ],
                "translated_text": "译文",
                "_render_use_cover_fill": True,
            }
            for index in range(8)
        ]

        adapted = apply_adaptive_overlay_colors(page, items)
    finally:
        doc.close()

    assert len(adapted) == 8
    assert adapted[0]["_render_cover_fill"][0] == pytest.approx(230 / 255.0, abs=0.04)


def test_overlay_color_adapt_prefers_inner_colored_panel_over_white_neighbors() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    panel = (248 / 255.0, 240 / 255.0, 208 / 255.0)
    doc = fitz.open()
    try:
        page = doc.new_page(width=220, height=180)
        shape = page.new_shape()
        shape.draw_rect(fitz.Rect(40, 40, 170, 110))
        shape.finish(color=None, fill=panel)
        shape.commit()
        for y in range(55, 96, 10):
            page.insert_text((48, y), "source text on colored panel", fontsize=8, color=(0, 0, 0))

        adapted = apply_adaptive_overlay_colors(
            page,
            [
                {
                    "item_id": "p001-b011",
                    "bbox": [45.0, 48.0, 165.0, 102.0],
                    "translated_text": "译文",
                    "_render_use_cover_fill": True,
                }
            ],
        )
    finally:
        doc.close()

    fill = adapted[0]["_render_cover_fill"]
    assert fill != (1, 1, 1)
    assert all(abs(component - expected) < 0.08 for component, expected in zip(fill, panel))


def test_overlay_color_adapt_uses_visual_title_text_color_only_for_titles() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=260, height=180)
        page.insert_text((24, 48), "Colored Title", fontsize=24, color=(0.82, 0.05, 0.02))
        page.insert_text((24, 95), "Colored body should not drive text color", fontsize=10, color=(0.0, 0.2, 0.85))

        adapted = apply_adaptive_overlay_colors(
            page,
            [
                {
                    "item_id": "p001-title",
                    "bbox": [20.0, 20.0, 220.0, 58.0],
                    "layout_role": "title",
                    "structure_role": "title",
                    "translated_text": "彩色标题",
                },
                {
                    "item_id": "p001-body",
                    "bbox": [20.0, 78.0, 230.0, 105.0],
                    "layout_role": "paragraph",
                    "structure_role": "body",
                    "translated_text": "正文",
                },
            ],
        )
    finally:
        doc.close()

    title_color = adapted[0]["_render_text_color"]
    assert title_color[0] > 0.55
    assert title_color[1] < 0.25
    assert title_color[2] < 0.25
    assert adapted[1]["_render_text_color"] == (0, 0, 0)


def test_overlay_color_adapt_skips_local_sampling_for_plain_body_blocks() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=260, height=180)
        items = [
            {
                "item_id": f"p001-body-{idx}",
                "bbox": [20.0, 20.0 + idx * 12.0, 220.0, 30.0 + idx * 12.0],
                "layout_role": "paragraph",
                "structure_role": "body",
                "translated_text": "正文",
            }
            for idx in range(8)
        ]

        with mock.patch(
            "retainpdf_pipeline.render.output.typst.color_adapt.sample_local_background_fill",
            return_value=(0.7, 0.7, 0.7),
        ) as sampler:
            adapted = apply_adaptive_overlay_colors(page, items)
    finally:
        doc.close()

    sampler.assert_not_called()
    assert all(item["_render_cover_fill"] == (1, 1, 1) for item in adapted)
    assert all(item["_render_text_color"] == (0, 0, 0) for item in adapted)


def test_overlay_color_adapt_samples_cover_fill_blocks_only_when_title_has_text_color() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=260, height=180)
        page.insert_text((24, 42), "Colored Title", fontsize=18, color=(0.8, 0.04, 0.02))
        items = [
            {
                "item_id": "p001-title",
                "bbox": [20.0, 20.0, 220.0, 50.0],
                "layout_role": "title",
                "structure_role": "title",
                "translated_text": "标题",
            },
            {
                "item_id": "p001-cover",
                "bbox": [20.0, 60.0, 220.0, 90.0],
                "layout_role": "paragraph",
                "structure_role": "body",
                "translated_text": "灰底正文",
                "_render_use_cover_fill": True,
            },
            {
                "item_id": "p001-body",
                "bbox": [20.0, 100.0, 220.0, 130.0],
                "layout_role": "paragraph",
                "structure_role": "body",
                "translated_text": "普通正文",
            },
        ]

        with mock.patch(
            "retainpdf_pipeline.render.output.typst.color_adapt.sample_local_background_fill",
            return_value=(0.7, 0.7, 0.7),
        ) as sampler:
            with mock.patch(
                "retainpdf_pipeline.render.output.typst.color_adapt.title_text_color_from_visual_components",
                return_value=None,
            ):
                adapted = apply_adaptive_overlay_colors(page, items)
    finally:
        doc.close()

    assert sampler.call_count == 1
    assert adapted[0]["_render_cover_fill"] == (1, 1, 1)
    assert adapted[1]["_render_cover_fill"] == (0.7, 0.7, 0.7)
    assert adapted[2]["_render_cover_fill"] == (1, 1, 1)


def test_overlay_color_adapt_reads_title_color_from_text_spans_before_visual_sampling() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=260, height=180)
        page.insert_text((24, 48), "Colored Title", fontsize=24, color=(0.8, 0.04, 0.02))

        with mock.patch(
            "retainpdf_pipeline.render.output.typst.color_adapt.title_text_color_from_visual_components",
            return_value=(0.0, 0.0, 1.0),
        ) as visual_sampler:
            adapted = apply_adaptive_overlay_colors(
                page,
                [
                    {
                        "item_id": "p001-title",
                        "bbox": [20.0, 20.0, 220.0, 58.0],
                        "layout_role": "title",
                        "structure_role": "title",
                        "translated_text": "彩色标题",
                    }
                ],
            )
    finally:
        doc.close()

    visual_sampler.assert_not_called()
    title_color = adapted[0]["_render_text_color"]
    assert title_color[0] > 0.55
    assert title_color[1] < 0.25
    assert title_color[2] < 0.25


def test_overlay_color_adapt_keeps_white_policy_fast_path() -> None:
    from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors

    doc = fitz.open()
    try:
        page = doc.new_page(width=260, height=180)
        with mock.patch(
            "retainpdf_pipeline.render.output.typst.color_adapt.sample_local_background_fill",
            return_value=(0.7, 0.7, 0.7),
        ) as sampler:
            adapted = apply_adaptive_overlay_colors(
                page,
                [
                    {
                        "item_id": "p001-white",
                        "bbox": [20.0, 40.0, 220.0, 70.0],
                        "layout_role": "paragraph",
                        "structure_role": "body",
                        "translated_text": "白底覆盖",
                        "_render_policy": {"overlay_fill": "white"},
                    }
                ],
            )
    finally:
        doc.close()

    sampler.assert_not_called()
    assert adapted[0]["_render_cover_fill"] == (1, 1, 1)
    assert adapted[0]["_render_text_color"] == (0, 0, 0)

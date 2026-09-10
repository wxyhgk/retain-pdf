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


def test_background_redaction_items_split_around_display_formula_guard() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "block_kind": "text",
            "source_text": "source above",
            "translated_text": "上文",
            "bbox": [40.0, 40.0, 260.0, 70.0],
        },
        {
            "item_id": "p001-b002",
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "bbox": [96.0, 76.0, 224.0, 104.0],
        },
        {
            "item_id": "p001-b003",
            "block_type": "text",
            "block_kind": "text",
            "source_text": "source below",
            "translated_text": "下文",
            "bbox": [42.0, 112.0, 258.0, 142.0],
        },
    ]
    redaction_items = [
        {
            "item_id": "item-p001-b001",
            "source_item_id": "p001-b001",
            "block_kind": "render_block",
            "block_type": "render_block",
            "translated_text": "译文",
            "bbox": [36.0, 34.0, 264.0, 148.0],
        }
    ]

    protected = protect_formula_regions_in_redaction_items(redaction_items, translated_items)

    rects = [fitz.Rect(item["bbox"]) for item in protected]
    formula = fitz.Rect(translated_items[1]["bbox"])
    assert len(protected) == 4
    assert all((rect & formula).is_empty for rect in rects)
    assert any(rect.y1 <= 70.0 for rect in rects)
    assert any(rect.y0 >= 112.0 for rect in rects)
    assert any(rect.x1 <= formula.x0 and rect.y0 < formula.y1 and rect.y1 > formula.y0 for rect in rects)
    assert any(rect.x0 >= formula.x1 and rect.y0 < formula.y1 and rect.y1 > formula.y0 for rect in rects)
    assert all(item.get("_formula_guard_fragment") for item in protected)
    cover_rects = cover_rects_from_valid_items([(rect, item, "译文") for rect, item in zip(rects, protected)])
    assert len(cover_rects) == 4
    assert all((rect & formula).is_empty for rect in cover_rects)


def test_render_policy_keeps_formula_page_text_deletable() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "block_kind": "text",
            "bbox": [40.0, 40.0, 260.0, 70.0],
            "translated_text": "上文",
        },
        {
            "item_id": "p001-b002",
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "bbox": [96.0, 76.0, 224.0, 104.0],
        },
    ]

    policy = build_render_page_policy(items)
    patched = apply_render_page_policy_fields(items)

    assert policy.page_has_formula_region is True
    assert policy.item_policy("p001-b001").cleanup_mode == "delete_text"
    assert item_render_policy(patched[0])["reason"] == "default_text_overlay_cover_fill"
    assert item_uses_white_overlay_fill(patched[0]) is True


def test_default_render_policy_adds_cover_fill_only_for_translated_text() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "block_kind": "text",
            "bbox": [40.0, 40.0, 260.0, 70.0],
            "translated_text": "译文",
        },
        {
            "item_id": "p001-b002",
            "block_type": "text",
            "block_kind": "text",
            "bbox": [40.0, 80.0, 260.0, 110.0],
            "source_text": "kept source",
            "translation_status": "keep_origin",
        },
    ]

    patched = apply_render_page_policy_fields(items)

    assert item_render_policy(patched[0])["cleanup_mode"] == "delete_text"
    assert item_uses_white_overlay_fill(patched[0]) is True
    assert item_render_policy(patched[1]) == {}
    assert item_uses_white_overlay_fill(patched[1]) is False


def test_precleaned_overlay_pages_still_get_cover_fill() -> None:
    pages = {
        0: [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "bbox": [40.0, 40.0, 260.0, 70.0],
                "protected_translated_text": "上文",
            },
            {
                "item_id": "p001-b002",
                "page_idx": 0,
                "block_type": "formula",
                "block_kind": "formula",
                "normalized_sub_type": "display_formula",
                "bbox": [96.0, 76.0, 224.0, 104.0],
            },
        ]
    }

    prepared = prepare_translated_pages_for_render(None, pages, skip_policy_page_indices=frozenset({0}))
    source = build_typst_overlay_source(300.0, 400.0, prepared[0])

    assert item_uses_white_overlay_fill(prepared[0][0]) is True
    assert "fill: rgb(255, 255, 255)" in source


def test_display_formula_neighbors_stay_deletable() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "block_kind": "text",
            "source_text": "source above",
            "translated_text": "上文",
            "bbox": [40.0, 40.0, 260.0, 70.0],
        },
        {
            "item_id": "p001-b002",
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "bbox": [96.0, 76.0, 224.0, 104.0],
        },
        {
            "item_id": "p001-b003",
            "block_type": "text",
            "block_kind": "text",
            "source_text": "source below",
            "translated_text": "下文",
            "bbox": [42.0, 112.0, 258.0, 142.0],
        },
    ]
    redaction_items = [
        {
            "source_item_id": "p001-b001",
            "block_kind": "render_block",
            "block_type": "render_block",
            "translated_text": "上文",
            "bbox": [36.0, 34.0, 264.0, 74.0],
        },
        {
            "source_item_id": "p001-b003",
            "block_kind": "render_block",
            "block_type": "render_block",
            "translated_text": "下文",
            "bbox": [36.0, 108.0, 264.0, 148.0],
        },
    ]

    protected = protect_formula_regions_in_redaction_items(redaction_items, translated_items)

    assert len(protected) == 6
    assert all(not item_requires_visual_cover_only(item) for item in protected)
    assert all(item_render_policy_reason(item) == "" for item in protected)


def test_redaction_shared_prefers_local_translated_text_over_group_text() -> None:
    item = {
        "translated_text": "当前框自己的文本",
        "translation_unit_translated_text": "整组很长的翻译文本，不应优先灌入单个 bbox",
        "group_translated_text": "另一份组级文本",
    }

    assert get_item_translated_text(item) == "当前框自己的文本"


def test_apply_source_page_overlay_visual_cover_and_remove_text_redacts_text_on_image_page() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        image_path = root / "bg.png"
        Image.new("RGB", (1200, 1600), (255, 255, 255)).save(image_path)

        doc = fitz.open()
        page = doc.new_page(width=300, height=400)
        page.insert_image(page.rect, filename=str(image_path))
        page.insert_textbox(
            fitz.Rect(30, 60, 270, 220),
            "Intermolecular Heck Coupling with Hindered Alkenes",
            fontsize=14,
        )
        translated_items = [
            {
                "item_id": "b1",
                "bbox": [25.0, 50.0, 275.0, 230.0],
                "source_text": "Intermolecular Heck Coupling with Hindered Alkenes",
                "translated_text": "羧酸钾导向的受阻烯烃分子间Heck偶联",
                "protected_translated_text": "羧酸钾导向的受阻烯烃分子间Heck偶联",
                "formula_map": [],
            }
        ]

        before = page.get_text("text")
        apply_source_page_overlay(page, translated_items, redaction_strategy="visual_cover_and_remove_text")
        after = page.get_text("text")

        assert "Intermolecular Heck Coupling" in before
        assert "Intermolecular Heck Coupling" not in after
        doc.close()


def test_build_clean_background_pdf_visual_cover_keeps_hidden_text_layer() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "cleaned.pdf"

        doc = fitz.open()
        page = doc.new_page(width=300, height=400)
        page.insert_textbox(
            fitz.Rect(30, 60, 270, 220),
            "Intermolecular Heck Coupling with Hindered Alkenes",
            fontsize=14,
        )
        doc.save(source_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "b1",
                    "bbox": [25.0, 50.0, 275.0, 230.0],
                    "source_text": "Intermolecular Heck Coupling with Hindered Alkenes",
                    "translated_text": "羧酸钾导向的受阻烯烃分子间Heck偶联",
                    "protected_translated_text": "羧酸钾导向的受阻烯烃分子间Heck偶联",
                    "formula_map": [],
                }
            ]
        }

        build_clean_background_pdf(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
            output_pdf_path=output_pdf,
            redaction_strategy="visual_cover",
        )

        cleaned = fitz.open(output_pdf)
        try:
            assert "Intermolecular Heck Coupling" in cleaned[0].get_text("text")
        finally:
            cleaned.close()

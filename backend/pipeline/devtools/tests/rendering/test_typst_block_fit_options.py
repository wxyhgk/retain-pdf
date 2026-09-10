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


def test_typst_overlay_fit_respects_python_min_font_and_leading() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [10.0, 20.0, 120.0, 42.0],
            "lines": [{"bbox": [10.0, 20.0, 120.0, 30.0], "spans": [{"type": "text", "content": "source"}]}],
            "source_text": "A dense source paragraph with enough words to be treated as body text.",
            "protected_source_text": "A dense source paragraph with enough words to be treated as body text.",
            "protected_translated_text": "这是一段非常长的中文译文，用来触发渲染拟合，但不能让 Typst 绕过 Python 给出的最小字号和最小行距继续压缩。",
        }
    ]

    source = build_typst_overlay_source(200.0, 300.0, translated_items)

    assert "min_size - 1.6pt" not in source
    assert "fallback_min_size - 1.2pt" not in source
    assert "min_leading - 0.12em" not in source
    assert "fallback_min_leading - 0.08em" not in source
    assert "pdftr_fit_leading" in source


def test_typst_overlay_emits_first_line_indent_for_markdown_blocks() -> None:
    source = build_typst_overlay_source(
        200.0,
        300.0,
        [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "bbox": [10.0, 20.0, 160.0, 82.0],
                "lines": [{"bbox": [10.0, 20.0, 160.0, 32.0], "spans": [{"type": "text", "content": "source"}]}],
                "source_text": "A source paragraph with first line indent.",
                "protected_source_text": "A source paragraph with first line indent.",
                "protected_translated_text": "这是一段需要渲染首行缩进的中文正文。",
                "_render_first_line_indent_pt": 12.0,
            }
        ],
    )

    assert "first_line_indent: 12.0pt" in source


def test_typst_overlay_justifies_body_markdown_blocks() -> None:
    source = build_typst_overlay_source(
        200.0,
        300.0,
        [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "bbox": [10.0, 20.0, 180.0, 90.0],
                "lines": [{"bbox": [10.0, 20.0, 180.0, 32.0], "spans": [{"type": "text", "content": "source"}]}],
                "source_text": "A body paragraph that should align on both sides.",
                "protected_source_text": "A body paragraph that should align on both sides.",
                "protected_translated_text": "这是一段需要左右两侧对齐的正文内容，用于确认 Typst 段落参数已经打开。",
            }
        ],
    )

    assert "justify: true" in source


def test_typst_overlay_does_not_justify_title_markdown_blocks() -> None:
    source = build_typst_overlay_source(
        200.0,
        300.0,
        [
            {
                "item_id": "p001-title",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "heading",
                "structure_role": "heading",
                "bbox": [10.0, 20.0, 180.0, 50.0],
                "lines": [{"bbox": [10.0, 20.0, 180.0, 32.0], "spans": [{"type": "text", "content": "Title"}]}],
                "source_text": "Related work",
                "protected_source_text": "Related work",
                "protected_translated_text": "相关工作",
            }
        ],
    )

    assert "justify: true" not in source


def test_typst_overlay_defaults_to_transparent_text_blocks() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [10.0, 20.0, 120.0, 62.0],
            "translated_text": "白底文本块",
            "protected_translated_text": "白底文本块",
            "formula_map": [],
        }
    ]

    source = build_typst_overlay_source(200.0, 300.0, translated_items)

    assert "rect(" not in source
    assert "block(width:" in source
    assert "fill: rgb(255, 255, 255)" not in source


def test_typst_overlay_can_use_block_cover_fill_as_fallback() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [10.0, 20.0, 120.0, 62.0],
            "translated_text": "白底文本块",
            "protected_translated_text": "白底文本块",
            "formula_map": [],
            "_render_policy": {"overlay_fill": "white"},
        }
    ]

    source = build_typst_overlay_source(200.0, 300.0, translated_items)

    assert "rect(" not in source
    assert "fill: rgb(255, 255, 255)" in source



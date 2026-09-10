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


def test_direct_math_layout_shrinks_font_to_fit_rect() -> None:
    font = fitz.Font(fontfile=str(fonts.DEFAULT_FONT_PATH))
    rect = fitz.Rect(0, 0, 90, 30)
    markdown_text = "观察到 $\\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷"

    tokens = _build_direct_draw_tokens(markdown_text, font)
    font_size, placements = _fit_segment_layout(rect, tokens, font)

    assert placements
    assert font_size < fonts.DEFAULT_FONT_SIZE
    assert font_size >= fonts.MIN_FONT_SIZE


def test_direct_math_layout_keeps_formula_token_atomic_on_wrap() -> None:
    font = fitz.Font(fontfile=str(fonts.DEFAULT_FONT_PATH))
    rect = fitz.Rect(0, 0, 80, 80)
    markdown_text = "前文 $\\mathrm{Ph(i-PrO)SiH_2}$ 后文"

    tokens = _build_direct_draw_tokens(markdown_text, font)
    _font_size, placements = _fit_segment_layout(rect, tokens, font)

    formula_placements = [placement for placement in placements if placement["token"]["kind"] == "formula"]
    assert len(formula_placements) == 1
    assert formula_placements[0]["token"]["text"] == r"\mathrm{Ph(i-PrO)SiH_2}"


def test_suspicious_ocr_skip_detector_does_not_drop_continuation_direct_typst_block() -> None:
    items = [
        {
            "item_id": "p003-b000",
            "block_type": "text",
            "bbox": [56, 66, 301, 144],
            "continuation_group": "cg-002-003",
            "translation_unit_kind": "group",
            "math_mode": "direct_typst",
            "render_protected_text": "阴离子交叉反应中，醇类并不仅仅是作为反应介质或质子源来周转催化剂。",
            "translation_unit_protected_source_text": "A" * 1200,
        },
        {
            "item_id": "p003-b001",
            "block_type": "text",
            "bbox": [56, 148, 301, 226],
            "render_protected_text": "下一段",
            "translation_unit_protected_source_text": "B" * 20,
        },
    ]

    summary = detect_and_drop_suspicious_ocr_glued_blocks(
        items,
        page_idx=2,
        page_font_size=11.4,
        page_line_pitch=14.0,
        page_line_height=14.0,
        density_baseline=1.0,
        page_text_width_med=245.0,
    )

    assert summary["count"] == 0
    assert items[0]["render_protected_text"]


def test_direct_typst_continuation_split_keeps_inline_math_atomic() -> None:
    text = "前文 观察到 $\\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷，后文。"
    chunks = split_protected_text_for_boxes(
        text,
        [],
        [26.0, 48.0],
        direct_math_mode=True,
    )

    assert len(chunks) == 2
    assert all(chunk.count("$") % 2 == 0 for chunk in chunks)
    assert not any("$\\mathrm{Ph(" in chunk and "$\\mathrm{Ph(i-PrO)SiH_2}$" not in chunk for chunk in chunks)
    assert sum("$\\mathrm{Ph(i-PrO)SiH_2}$" in chunk for chunk in chunks) == 1


def test_preserved_line_split_keeps_direct_typst_inline_math_atomic() -> None:
    from retainpdf_pipeline.render.layout.payload.line_structure import split_text_by_source_line_weights

    text = (
        r"a. $ \text{H}^{79}\text{Br} $ 或 $ \text{D}^{80}\text{Br} $　"
        r"b. $ \text{C}=\text{N} $ 或 $ \text{C}\equiv\text{N} $　"
        r"c. $ X^{1}\Sigma^+ $ CO（键长 1.128 Å）或 $ I^{1}\Sigma^- $ CO（键长 1.391 Å）"
    )

    chunks = split_text_by_source_line_weights(
        text,
        [
            r"a. $ \text{H}^{79}\text{Br} $ or $ \text{D}^{80}\text{Br} $ b. $ \text{C}=\text{N} $ or $ \text{C}\equiv\text{N} $",
            r"c. $ X^{1}\Sigma^+ $ CO (bond length 1.128 Å) or $ I^{1}\Sigma^- $ CO (bond length 1.391 Å)",
        ],
    )

    assert len(chunks) == 2
    assert all(chunk.count("$") % 2 == 0 for chunk in chunks)
    assert not chunks[1].lstrip().startswith("text{N}")
    assert any(r"\text{C}\equiv\text{N}" in chunk for chunk in chunks)
    assert not any("1.\n128" in chunk or chunk.strip().startswith("128 Å") for chunk in chunks)
    assert chunks[1].startswith("c.")


def test_preserved_line_typst_allows_dense_math_lines_to_shrink() -> None:
    from retainpdf_pipeline.render.layout.model.models import RenderBlock, RenderLineBox
    from retainpdf_pipeline.render.output.typst.block_renderer import build_typst_block

    block = RenderBlock(
        block_id="p035-b005",
        bbox=[33.996, 140.477, 244.973, 175.971],
        cover_bbox=[32.414, 140.127, 246.555, 176.321],
        inner_bbox=[33.996, 140.477, 244.973, 175.971],
        markdown_text="",
        plain_text="",
        render_kind="markdown",
        font_size_pt=15.98,
        leading_em=0.55,
        use_cover_fill=True,
        preserve_line_breaks=True,
        preserved_line_boxes=[
            RenderLineBox(
                text=(
                    r"a. $ \text{H}^{79}\text{Br} $ 或 $ \text{D}^{80}\text{Br} $　"
                    r"b. $ \text{C}=\text{N} $ 或 $ \text{C}\equiv\text{N} $"
                ),
                bbox=[33.996, 140.477, 244.973, 158.224],
            )
        ],
    )

    typst = build_typst_block("p035_b005", block)

    assert "min_size: 6.39pt" in typst
    assert r"$\\text{H}^{79}\\text{Br}$" in typst
    assert r"$ \text{H}^{79}\text{Br} $" not in typst


def test_preserved_line_marker_split_requires_increasing_source_markers() -> None:
    from retainpdf_pipeline.render.layout.payload.line_structure import _split_text_by_source_line_markers

    chunks = _split_text_by_source_line_markers(
        "c. 第三项 a. 第一项",
        [
            "c. third item",
            "a. first item",
        ],
    )

    assert chunks is None


def test_preserved_line_marker_split_rejects_mixed_marker_styles() -> None:
    from retainpdf_pipeline.render.layout.payload.line_structure import split_text_by_source_line_weights

    text = "1. 第一项 b. 第二项"

    chunks = split_text_by_source_line_weights(
        text,
        [
            "1. first item",
            "b. second item",
        ],
    )

    assert chunks != ["1. 第一项", "b. 第二项"]


def test_prepare_render_payloads_preserves_direct_typst_formula_at_group_boundary() -> None:
    translated_pages = {
        1: [
            {
                "item_id": "p002-b024",
                "page_idx": 1,
                "bbox": [320, 504, 565, 606],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "__cg__:cg-002-003",
                "translation_unit_kind": "group",
                "continuation_group": "cg-002-003",
                "protected_source_text": "A" * 300,
                "translation_unit_protected_source_text": "A" * 600,
                "translation_unit_protected_translated_text": (
                    "前文保持在较低丰度（图1）。观察到 $\\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷，"
                    "这使我们推测其可能是一种更优的还原剂。"
                ),
                "translation_unit_formula_map": [],
            }
        ],
        2: [
            {
                "item_id": "p003-b000",
                "page_idx": 2,
                "bbox": [56, 66, 301, 144],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "__cg__:cg-002-003",
                "translation_unit_kind": "group",
                "continuation_group": "cg-002-003",
                "protected_source_text": "B" * 300,
                "translation_unit_protected_source_text": "A" * 600,
                "translation_unit_protected_translated_text": (
                    "前文保持在较低丰度（图1）。观察到 $\\mathrm{Ph(i-PrO)SiH_2}$ (6) 的消耗速率快于其他硅烷，"
                    "这使我们推测其可能是一种更优的还原剂。"
                ),
                "translation_unit_formula_map": [],
            }
        ],
    }

    prepared = prepare_render_payloads_by_page(translated_pages)
    page2_item = prepared[1][0]
    page3_item = prepared[2][0]

    chunks = [page2_item["render_protected_text"], page3_item["render_protected_text"]]
    assert all(chunk.count("$") % 2 == 0 for chunk in chunks)
    assert not any("$\\mathrm{Ph(" in chunk and "$\\mathrm{Ph(i-PrO)SiH_2}$" not in chunk for chunk in chunks)
    assert sum("$\\mathrm{Ph(i-PrO)SiH_2}$" in chunk for chunk in chunks) == 1


def test_build_render_blocks_skips_display_formula_blocks() -> None:
    items = [
        {
            "item_id": "p005-b004",
            "page_idx": 4,
            "bbox": [44.938, 94.87, 352.34, 133.75],
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "source_text": "$$ Y_{i}=Y_{i}(1)\\cdot D_{i}+Y_{i}(0)\\cdot(1-D_{i}). $$",
            "protected_source_text": "$$ Y_{i}=Y_{i}(1)\\cdot D_{i}+Y_{i}(0)\\cdot(1-D_{i}). $$",
            "translated_text": "",
            "protected_translated_text": "",
            "should_translate": False,
            "classification_label": "skip_model_keep_origin",
            "skip_reason": "skip_model_keep_origin",
            "math_mode": "direct_typst",
            "formula_map": [],
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "$$ Y_{i}=Y_{i}(1)\\cdot D_{i}+Y_{i}(0)\\cdot(1-D_{i}). $$",
            "translation_unit_protected_translated_text": "",
            "translation_unit_formula_map": [],
        }
    ]

    blocks = build_render_blocks(items, page_width=362.8349914550781, page_height=272.1260070800781)

    assert blocks == []


def test_build_render_blocks_skips_keep_origin_display_math_text_blocks() -> None:
    items = [
        {
            "item_id": "p005-b004",
            "page_idx": 4,
            "bbox": [25.988, 94.87, 352.34, 133.75],
            "block_type": "text",
            "block_kind": "text",
            "normalized_sub_type": "body",
            "source_text": "$$ \\lim_{\\epsilon\\to0^+} f(x) $$ $$ \\lim_{\\epsilon\\to0^+} g(x) $$",
            "protected_source_text": "$$ \\lim_{\\epsilon\\to0^+} f(x) $$ $$ \\lim_{\\epsilon\\to0^+} g(x) $$",
            "translated_text": "",
            "protected_translated_text": "",
            "should_translate": False,
            "classification_label": "skip_model_keep_origin",
            "skip_reason": "skip_model_keep_origin",
            "math_mode": "direct_typst",
            "formula_map": [],
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "$$ \\lim_{\\epsilon\\to0^+} f(x) $$ $$ \\lim_{\\epsilon\\to0^+} g(x) $$",
            "translation_unit_protected_translated_text": "",
            "translation_unit_formula_map": [],
        }
    ]

    blocks = build_render_blocks(items, page_width=362.8349914550781, page_height=272.1260070800781)

    assert blocks == []


def test_build_render_blocks_skips_model_keep_origin_shell_commands_with_dollars() -> None:
    items = [
        {
            "item_id": "p006-b004",
            "page_idx": 5,
            "bbox": [125.9785, 254.1719, 278.8715, 276.2591],
            "block_type": "text",
            "block_kind": "text",
            "normalized_sub_type": "body",
            "source_text": "$ uv venv deeph --python=3.13 $ source deeph/bin/activate",
            "protected_source_text": "$ uv venv deeph --python=3.13 $ source deeph/bin/activate",
            "translated_text": "",
            "protected_translated_text": "",
            "should_translate": False,
            "classification_label": "skip_model_keep_origin",
            "skip_reason": "skip_model_keep_origin",
            "math_mode": "direct_typst",
            "formula_map": [],
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "$ uv venv deeph --python=3.13 $ source deeph/bin/activate",
            "translation_unit_protected_translated_text": "",
            "translation_unit_formula_map": [],
        }
    ]

    blocks = build_render_blocks(items, page_width=595.28, page_height=841.89)

    assert blocks == []

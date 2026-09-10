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


def test_continuation_group_member_prefers_member_translation_for_rendering() -> None:
    from retainpdf_pipeline.render.layout.payload.render_item import render_protected_translation_text

    item = {
        "translation_unit_kind": "single",
        "continuation_group": "cg-002-004",
        "protected_translated_text": "$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。",
        "translated_text": "$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。",
        "translation_unit_protected_translated_text": (
            "激发谱的每个模式$i$可通过其色散关系$\\omega^i(\\mathbf{Q})$、"
            "寿命$\\tau_{\\mathrm{SW}}^i$以及强度$I_0$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。"
            "假设磁激发具有洛伦兹线型，则散射函数可写为"
        ),
        "translation_unit_translated_text": (
            "激发谱的每个模式$i$可通过其色散关系$\\omega^i(\\mathbf{Q})$、"
            "寿命$\\tau_{\\mathrm{SW}}^i$以及强度$I_0$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。"
            "假设磁激发具有洛伦兹线型，则散射函数可写为"
        ),
    }

    assert render_protected_translation_text(item).startswith("$来表征")


def test_prepare_render_payloads_keeps_member_translations_for_continuation_group_members() -> None:
    translated_pages = {
        1: [
            {
                "item_id": "p002-b011",
                "page_idx": 1,
                "bbox": [300, 520, 560, 575],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "p003-b005",
                "translation_unit_kind": "single",
                "continuation_group": "cg-002-004",
                "protected_source_text": "Each mode $i$ of the excitation spectrum can be characterized by its dispersion relation.",
                "translation_unit_protected_source_text": (
                    "Each mode $i$ of the excitation spectrum can be characterized by its dispersion relation. "
                    "accessible by fitting the excitation spectrum."
                ),
                "translation_unit_protected_translated_text": (
                    "激发谱的每个模式$i$可通过其色散关系$\\omega^i(\\mathbf{Q})$、寿命$\\tau_{\\mathrm{SW}}^i$"
                    "以及强度$I_0$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。"
                    "假设磁激发具有洛伦兹线型，则散射函数可写为"
                ),
                "protected_translated_text": "局部旧文本",
                "translation_unit_formula_map": [],
            }
        ],
        2: [
            {
                "item_id": "p003-b005",
                "page_idx": 2,
                "bbox": [40, 80, 300, 135],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "p003-b005",
                "translation_unit_kind": "single",
                "continuation_group": "cg-002-004",
                "protected_source_text": "accessible by fitting the excitation spectrum.",
                "translation_unit_protected_source_text": (
                    "Each mode $i$ of the excitation spectrum can be characterized by its dispersion relation. "
                    "accessible by fitting the excitation spectrum."
                ),
                "translation_unit_protected_translated_text": (
                    "激发谱的每个模式$i$可通过其色散关系$\\omega^i(\\mathbf{Q})$、寿命$\\tau_{\\mathrm{SW}}^i$"
                    "以及强度$I_0$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。"
                    "假设磁激发具有洛伦兹线型，则散射函数可写为"
                ),
                "protected_translated_text": "$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。",
                "translation_unit_formula_map": [],
            }
        ],
    }

    prepared = prepare_render_payloads_by_page(translated_pages)
    first = prepared[1][0]["render_protected_text"]
    second = prepared[2][0]["render_protected_text"]

    assert first == "局部旧文本"
    assert second == "$来表征，所有这些量均可通过拟合不同温度及$Q_{0}$值下的激发谱获得。"


def test_prepare_render_payloads_resplits_repeated_full_cross_page_group_translation() -> None:
    aggregate = (
        "考虑到这些潜在困难，我们采用模型体系开展研究。"
        "对副产物的分析鉴定出多种化合物，并优化了催化剂。"
        "在整个项目过程中，我们发现含有路易斯碱性孤对电子时产率最高；"
        "而在不存在此类基团时，催化剂表现更优（见下文）。"
    )
    shared = {
        "block_type": "text",
        "math_mode": "direct_typst",
        "translation_unit_id": "__cg__:cg-cross-page",
        "translation_unit_kind": "group",
        "continuation_group": "cg-cross-page",
        "translation_unit_protected_source_text": "long source on page one whereas the final clause continues on page two",
        "translation_unit_protected_translated_text": aggregate,
        "translation_unit_formula_map": [],
        "protected_translated_text": aggregate,
        "translated_text": aggregate,
    }
    translated_pages = {
        0: [
            {
                **shared,
                "item_id": "p001-b010",
                "page_idx": 0,
                "bbox": [302.357, 437.891, 560.735, 725.819],
                "protected_source_text": "long source on page one " * 30,
            }
        ],
        1: [
            {
                **shared,
                "item_id": "p002-b003",
                "page_idx": 1,
                "bbox": [34.484, 579.855, 290.863, 602.35],
                "protected_source_text": "whereas the final clause continues on page two",
            }
        ],
    }

    prepared = prepare_render_payloads_by_page(translated_pages)
    first = prepared[0][0]["render_protected_text"]
    second = prepared[1][0]["render_protected_text"]

    assert first != aggregate
    assert second != aggregate
    assert first + second == aggregate
    assert second


def test_prepare_render_payloads_does_not_resplit_materialized_cross_page_member_translations() -> None:
    translated_pages = {
        11: [
            {
                "item_id": "p012-b009",
                "page_idx": 11,
                "bbox": [56.994, 740.875, 302.469, 764.371],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "__cg__:cg-012-016",
                "translation_unit_kind": "single",
                "continuation_group": "cg-012-016",
                "protected_source_text": "Having demonstrated the good performance of GFN2-xTB for small systems including",
                "translation_unit_protected_source_text": "Having demonstrated the good performance of GFN2-xTB for small systems including different elements and interaction types, we next turn our attention to larger systems. This behavior partially results from nonadditivity dispersion effects.",
                "translated_text": "我们已经证明了GFN2-xTB对于包含不同元素和相互作用类型的小体系的",
                "protected_translated_text": "我们已经证明了GFN2-xTB对于包含不同元素和相互作用类型的小体系的",
                "translation_unit_protected_translated_text": "我们已经证明了GFN2-xTB对于包含不同元素和相互作用类型的小体系的非共价相互作用具有良好的性能，接下来我们将关注更大的体系。这种行为部分源于非加和色散效应。",
                "translation_unit_formula_map": [],
            },
            {
                "item_id": "p012-b012",
                "page_idx": 11,
                "bbox": [319.967, 499.916, 567.442, 765.371],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "__cg__:cg-012-016",
                "translation_unit_kind": "single",
                "continuation_group": "cg-012-016",
                "protected_source_text": "different elements and interaction types, we next turn our attention to larger systems.",
                "translation_unit_protected_source_text": "Having demonstrated the good performance of GFN2-xTB for small systems including different elements and interaction types, we next turn our attention to larger systems. This behavior partially results from nonadditivity dispersion effects.",
                "translated_text": "非共价相互作用具有良好的性能，接下来我们将关注更大的体系。",
                "protected_translated_text": "非共价相互作用具有良好的性能，接下来我们将关注更大的体系。",
                "translation_unit_protected_translated_text": "我们已经证明了GFN2-xTB对于包含不同元素和相互作用类型的小体系的非共价相互作用具有良好的性能，接下来我们将关注更大的体系。这种行为部分源于非加和色散效应。",
                "translation_unit_formula_map": [],
            },
        ],
        12: [
            {
                "item_id": "p013-b004",
                "page_idx": 12,
                "bbox": [56.994, 290.451, 302.969, 378.436],
                "block_type": "text",
                "math_mode": "direct_typst",
                "translation_unit_id": "__cg__:cg-012-016",
                "translation_unit_kind": "single",
                "continuation_group": "cg-012-016",
                "protected_source_text": "This behavior partially results from nonadditivity dispersion effects.",
                "translation_unit_protected_source_text": "Having demonstrated the good performance of GFN2-xTB for small systems including different elements and interaction types, we next turn our attention to larger systems. This behavior partially results from nonadditivity dispersion effects.",
                "translated_text": "这种行为部分源于非加和色散效应。",
                "protected_translated_text": "这种行为部分源于非加和色散效应。",
                "translation_unit_protected_translated_text": "我们已经证明了GFN2-xTB对于包含不同元素和相互作用类型的小体系的非共价相互作用具有良好的性能，接下来我们将关注更大的体系。这种行为部分源于非加和色散效应。",
                "translation_unit_formula_map": [],
            }
        ],
    }

    prepared = prepare_render_payloads_by_page(translated_pages)

    assert prepared[11][0]["render_protected_text"] == "我们已经证明了GFN2-xTB对于包含不同元素和相互作用类型的小体系的"
    assert prepared[11][1]["render_protected_text"] == "非共价相互作用具有良好的性能，接下来我们将关注更大的体系。"
    assert prepared[12][0]["render_protected_text"] == "这种行为部分源于非加和色散效应。"


def test_continuation_member_does_not_inherit_short_body_font_from_context() -> None:
    from retainpdf_pipeline.render.layout.payload.body_font_inheritance_policy import inherit_short_body_fonts

    def payload(item_id: str, bbox: list[float], font_size: float, *, continuation: bool = False) -> dict:
        item = {
            "item_id": item_id,
            "block_kind": "text",
            "block_type": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "source_text": "source words for context",
        }
        if continuation:
            item["continuation_group"] = "cg-001-001"
        return {
            "item": item,
            "render_kind": "markdown",
            "is_body": True,
            "inner_bbox": bbox,
            "translated_text": "译文",
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.42,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "title_fit": None,
        }

    anchors = [
        payload("p001-b001", [40.0, 40.0, 180.0, 88.0], 10.4),
        payload("p001-b002", [40.0, 96.0, 180.0, 144.0], 10.2),
    ]
    continuation_member = payload("p002-b001", [40.0, 152.0, 120.0, 164.0], 8.2, continuation=True)
    normal_short = payload("p001-b003", [40.0, 172.0, 120.0, 184.0], 8.2)

    inherit_short_body_fonts(
        [*anchors, continuation_member, normal_short],
        [*anchors, continuation_member, normal_short],
        page_text_width_med=140.0,
    )

    assert continuation_member.get("_short_body_inherited_font_floor_pt") is None
    assert normal_short.get("_short_body_inherited_font_floor_pt") is not None


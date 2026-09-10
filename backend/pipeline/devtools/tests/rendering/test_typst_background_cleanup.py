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
from retainpdf_pipeline.render.output.typst.book_renderer import _background_cache_key
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
from retainpdf_pipeline.render.visual_profile.contracts import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import ItemVisualProfile
from retainpdf_pipeline.render.visual_profile.contracts import PageVisualProfile
from retainpdf_pipeline.render.visual_profile.runtime import VisualProfileRuntime
from devtools.tests.rendering_support.page_specs import sample_page_spec as _page_spec


def test_background_stage_creates_cleaned_pdf() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "cleaned.pdf"

        doc = fitz.open()
        page = doc.new_page(width=200, height=300)
        page.insert_text((20, 40), "source text")
        doc.save(source_pdf)
        doc.close()

        result = build_clean_background_pdf(
            source_pdf_path=source_pdf,
            translated_pages={
                0: [
                    {
                        "item_id": "b1",
                        "bbox": [10.0, 20.0, 80.0, 60.0],
                        "translated_text": "hello",
                        "protected_translated_text": "hello",
                        "formula_map": [],
                    }
                ]
            },
            output_pdf_path=output_pdf,
        )

        assert result == output_pdf
        assert output_pdf.exists()


def test_background_cache_key_includes_visual_profile_payload(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    doc.new_page(width=200, height=300)
    doc.save(source_pdf)
    doc.close()
    spec = RenderPageSpec(
        page_index=0,
        page_width_pt=200,
        page_height_pt=300,
        background_pdf_path=None,
        blocks=[
            RenderLayoutBlock(
                block_id="p001-b001",
                page_index=0,
                background_rect=[10, 20, 80, 60],
                content_rect=[10, 20, 80, 60],
                content_kind="text",
                content_text="hello",
                plain_text="hello",
                math_map=[],
                font_size_pt=10,
                leading_em=1.2,
            )
        ],
    )
    translated_pages = {0: [{"item_id": "p001-b001", "bbox": [10, 20, 80, 60], "translated_text": "hello"}]}

    def runtime(background_rgb: tuple[float, float, float]) -> VisualProfileRuntime:
        item = ItemVisualProfile(
            item_id="p001-b001",
            page_index=0,
            bbox=(10, 20, 80, 60),
            bbox_space="page",
            bbox_source="test",
            source_item_kind="text",
            background_rgb=background_rgb,
            text_rgb=(0.0, 0.0, 0.0),
            confidence=1.0,
            method="test",
        )
        return VisualProfileRuntime(
            path=None,
            profile=DocumentVisualProfile(
                algorithm="visual_profile_v6_document_title_pixels_only",
                pages={
                    0: PageVisualProfile(
                        page_index=0,
                        background_rgb=(1.0, 1.0, 1.0),
                        items={"p001-b001": item},
                    )
                },
            ),
            diagnostics={"loaded": True},
        )

    first = _background_cache_key(
        source_pdf_path=source_pdf,
        translated_pages=translated_pages,
        page_specs=[spec],
        redaction_strategy="pikepdf_text_strip",
        source_text_precleaned_page_indices=frozenset(),
        visual_profile_runtime=runtime((1.0, 1.0, 1.0)),
    )
    second = _background_cache_key(
        source_pdf_path=source_pdf,
        translated_pages=translated_pages,
        page_specs=[spec],
        redaction_strategy="pikepdf_text_strip",
        source_text_precleaned_page_indices=frozenset(),
        visual_profile_runtime=runtime((0.95, 0.96, 0.97)),
    )

    assert first != second


def test_background_stage_uses_cover_only_redaction_for_vector_text() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "cleaned.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        with mock.patch(
            "retainpdf_pipeline.render.source.background.stage.collect_vector_text_rects",
            return_value=[fitz.Rect(10, 20, 80, 60)],
        ), mock.patch(
            "retainpdf_pipeline.render.source.background.stage.redact_source_text_areas",
        ) as redact_mock, mock.patch(
            "retainpdf_pipeline.render.source.background.stage.save_optimized_pdf",
        ):
            build_clean_background_pdf(
                source_pdf_path=source_pdf,
                translated_pages={
                    0: [
                        {
                            "item_id": "b1",
                            "bbox": [10.0, 20.0, 80.0, 60.0],
                            "translated_text": "hello",
                            "protected_translated_text": "hello",
                            "formula_map": [],
                        }
                    ]
                },
                output_pdf_path=output_pdf,
            )

        redact_mock.assert_called_once()
        assert redact_mock.call_args.kwargs["cover_only"] is True


def test_background_stage_uses_visual_cover_for_formula_pages_by_default() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "cleaned.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        with mock.patch(
            "retainpdf_pipeline.render.source.background.stage.redact_source_text_areas",
        ) as redact_mock, mock.patch(
            "retainpdf_pipeline.render.source.background.stage.save_optimized_pdf",
        ):
            build_clean_background_pdf(
                source_pdf_path=source_pdf,
                translated_pages={
                    0: [
                        {
                            "item_id": "p001-b001",
                            "block_type": "text",
                            "block_kind": "text",
                            "bbox": [10.0, 20.0, 180.0, 60.0],
                            "translated_text": "hello",
                            "protected_translated_text": "hello",
                        },
                        {
                            "item_id": "p001-b002",
                            "block_type": "formula",
                            "block_kind": "formula",
                            "normalized_sub_type": "display_formula",
                            "bbox": [60.0, 70.0, 140.0, 95.0],
                        },
                    ]
                },
                output_pdf_path=output_pdf,
            )

        redact_mock.assert_called_once()
        assert redact_mock.call_args.kwargs["strategy"] == "visual_cover"


def test_background_stage_skips_old_cleanup_for_precleaned_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "cleaned.pdf"

        doc = fitz.open()
        page = doc.new_page(width=200, height=300)
        page.insert_text((20, 40), "already stripped by pikepdf")
        doc.save(source_pdf)
        doc.close()

        with mock.patch(
            "retainpdf_pipeline.render.source.background.stage.protect_formula_regions_in_redaction_items",
        ) as protect_mock, mock.patch(
            "retainpdf_pipeline.render.source.background.stage.redact_source_text_areas",
        ) as redact_mock:
            build_clean_background_pdf(
                source_pdf_path=source_pdf,
                translated_pages={
                    0: [
                        {
                            "item_id": "p001-b001",
                            "block_type": "text",
                            "block_kind": "text",
                            "bbox": [10.0, 20.0, 180.0, 60.0],
                            "translated_text": "hello",
                            "protected_translated_text": "hello",
                        },
                        {
                            "item_id": "p001-b002",
                            "block_type": "formula",
                            "block_kind": "formula",
                            "normalized_sub_type": "display_formula",
                            "bbox": [60.0, 70.0, 140.0, 95.0],
                        },
                    ]
                },
                output_pdf_path=output_pdf,
                source_text_precleaned_page_indices=frozenset({0}),
            )

        protect_mock.assert_not_called()
        redact_mock.assert_not_called()
        assert output_pdf.exists()


def test_apply_source_page_overlay_uses_cover_only_when_vector_text_detected() -> None:
    page = fitz.open().new_page(width=300, height=400)
    translated_items = [
        {
            "item_id": "b1",
            "bbox": [10.0, 20.0, 80.0, 60.0],
            "translated_text": "hello",
            "protected_translated_text": "hello",
            "formula_map": [],
        }
    ]

    with mock.patch(
        "retainpdf_pipeline.render.source.background.redaction_plan.collect_vector_text_rects",
        return_value=[fitz.Rect(10, 20, 80, 60)],
    ), mock.patch(
        "retainpdf_pipeline.render.source.background.source_overlay.redact_source_text_areas",
    ) as redact_mock, mock.patch(
        "retainpdf_pipeline.render.source.background.source_overlay.strip_page_links",
    ):
        apply_source_page_overlay(page, translated_items)

    redact_mock.assert_called_once()
    assert redact_mock.call_args.kwargs["cover_only"] is True


def test_redaction_items_from_render_blocks_preserve_source_item_metadata() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "source_text": "This editable source text should be matched in the PDF text layer.",
            "bbox": [20.0, 40.0, 180.0, 70.0],
            "translated_text": "这段可编辑源文本应在 PDF 文字层中匹配。",
            "protected_translated_text": "这段可编辑源文本应在 PDF 文字层中匹配。",
            "formula_map": [],
        }
    ]

    redaction_items = redaction_items_from_render_blocks(
        translated_items,
        page_width=300.0,
        page_height=400.0,
    )

    assert len(redaction_items) == 1
    item = redaction_items[0]
    assert item["item_id"] == "item-0"
    assert item["source_item_id"] == "p001-b001"
    assert item["source_block_kind"] == "text"
    assert item["block_kind"] == "render_block"
    assert item["block_type"] == "render_block"
    assert item["source_text"] == translated_items[0]["source_text"]
    assert len(item["bbox"]) == 4


def test_redaction_items_from_layout_blocks_use_background_rect() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "source_text": "source text",
            "translated_text": "译文",
            "protected_translated_text": "译文",
            "bbox": [20.0, 40.0, 180.0, 70.0],
        }
    ]
    block = RenderLayoutBlock(
        block_id="item-p001-b001",
        page_index=0,
        background_rect=[10.0, 30.0, 190.0, 80.0],
        content_rect=[20.0, 40.0, 180.0, 70.0],
        content_kind="markdown",
        content_text="译文",
        plain_text="译文",
        math_map=[],
        font_size_pt=10.0,
        leading_em=0.6,
    )

    redaction_items = redaction_items_from_layout_blocks(translated_items, [block])

    assert redaction_items[0]["bbox"] == [10.0, 30.0, 190.0, 80.0]
    assert redaction_items[0]["source_item_id"] == "p001-b001"


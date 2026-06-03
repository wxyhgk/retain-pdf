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


from services.rendering.source.background.stage import build_clean_background_pdf
from foundation.config import fonts
from services.rendering.layout.payload.blocks import build_render_blocks
from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.collision import mark_adjacent_collision_risk
from services.rendering.layout.payload.emit import payload_to_render_block
from services.rendering.layout.payload.first_line_indent import detect_first_line_indent_pt
from services.rendering.layout.payload.line_structure import maybe_preserve_structured_line_breaks
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.layout.page_specs import build_render_page_specs
from services.rendering.layout.payload.continuation_split import split_protected_text_for_boxes
from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page
from services.rendering.source.items import get_item_translated_text
from services.rendering.source.dev_overlay.text_draw import _build_direct_draw_tokens
from services.rendering.source.dev_overlay.text_draw import _fit_segment_layout
from services.rendering.layout.payload.suspicious_ocr import detect_and_drop_suspicious_ocr_glued_blocks
from services.rendering.output.typst.book_renderer import _compile_render_pages_pdf_resilient
from services.rendering.output.typst.block_renderer import build_typst_block
from services.rendering.output.typst.overlay_ops import overlay_translated_pages_on_doc
from services.rendering.output.typst.book_support import prepare_translated_pages_for_render
from services.rendering.output.typst.compiler import _resolved_font_paths
from services.rendering.output.typst.compiler import _resolved_common_root
from services.rendering.output.typst.compiler import TypstCompileError
from services.rendering.output.typst.compiler import compile_typst_book_background_pdf
from services.rendering.output.typst.compiler import compile_typst_overlay_pdf
from services.rendering.output.typst.compiler import compile_typst_render_pages_pdf
from services.rendering.output.typst.emitter import build_typst_source_from_page_specs
from services.rendering.output.typst.source_builder import build_typst_overlay_source
from services.rendering.policy import apply_render_page_policy_fields
from services.rendering.policy import build_render_page_policy
from services.rendering.policy import formula_neighbor_text_item_ids
from services.rendering.policy import item_render_policy
from services.rendering.policy import item_render_policy_reason
from services.rendering.policy import item_requires_visual_cover_only
from services.rendering.policy import item_uses_white_overlay_fill
from services.rendering.policy import protect_formula_regions_in_redaction_items
from services.rendering.output.typst.source_page_overlay import apply_source_page_overlay
from services.rendering.output.typst.overlay_diagnostics import apply_redaction_diagnostics
from services.rendering.output.typst.overlay_diagnostics import new_overlay_merge_diagnostics
from services.rendering.source.background.redaction_items import redaction_items_from_layout_blocks
from services.rendering.source.cleanup.item_rects import cover_rects_from_valid_items
from services.rendering.output.typst.source_page_overlay import overlay_pages_from_single_pdf
from services.rendering.output.typst.source_page_overlay import redaction_items_from_render_blocks
from services.rendering.output.typst.sanitize import sanitize_items_for_typst_compile
from services.rendering.output.typst.overlay_ops import _extract_failed_overlay_indices
from services.rendering.output.typst.overlay_ops import _can_use_pikepdf_book_overlay
from services.rendering.workflow.executor import _typst_cover_fallback_page_indices
from services.rendering.workflow.executor import _prepare_translated_pages_for_source_cleanup
from services.rendering.workflow.executor import _risk_cover_fallback_page_indices_from_diagnostics
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.workflow.modes import _compress_final_pdf_if_needed
from services.rendering.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from services.rendering.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from services.rendering.document.pikepdf_pages import extract_pages_with_pikepdf
from services.rendering.layout.inline_content.core.markdown import build_direct_typst_passthrough_text


def _page_spec(background_pdf_path: Path | None = None) -> RenderPageSpec:
    return RenderPageSpec(
        page_index=0,
        page_width_pt=200.0,
        page_height_pt=300.0,
        background_pdf_path=background_pdf_path,
        blocks=[
            RenderLayoutBlock(
                block_id="b1",
                page_index=0,
                background_rect=[10.0, 20.0, 80.0, 60.0],
                content_rect=[12.0, 22.0, 78.0, 58.0],
                content_kind="markdown",
                content_text="hello $x^2$",
                plain_text="hello x^2",
                math_map=[],
                font_size_pt=10.0,
                leading_em=0.6,
            )
        ],
    )

def test_overlay_diagnostics_count_legacy_pymupdf_redaction_pages() -> None:
    diagnostics = new_overlay_merge_diagnostics()
    page_diag = {"page_index": 0}

    apply_redaction_diagnostics(
        diagnostics,
        page_diag,
        {
            "elapsed_seconds": 0.1,
            "raw_removable_rects": 2,
            "merged_removable_rects": 1,
            "cover_rects": 0,
            "item_fast_cover_count": 0,
            "fast_page_cover_only": False,
            "route": "standard_redaction",
            "uses_pymupdf_redaction": True,
            "legacy_pdf_write_reason": "standard_redaction",
        },
    )

    assert page_diag["uses_pymupdf_redaction"] is True
    assert diagnostics["legacy_pymupdf_redaction_pages"] == 1
    assert diagnostics["legacy_pdf_write_reasons"] == {"standard_redaction": 1}


def test_pikepdf_text_strip_marks_unprecleaned_pages_for_typst_cover_fallback() -> None:
    translated_pages = {
        0: [{"item_id": "p001-b001"}],
        1: [{"item_id": "p002-b001"}],
        2: [{"item_id": "p003-b001"}],
    }

    page_indices = _typst_cover_fallback_page_indices(
        translated_pages=translated_pages,
        cleanup_strategy="pikepdf_text_strip",
        precleaned_page_indices=frozenset({0}),
        skipped_page_indices=frozenset({2}),
    )

    assert page_indices == frozenset({1, 2})


def test_render_risk_diagnostics_select_cover_fallback_pages() -> None:
    page_indices = _risk_cover_fallback_page_indices_from_diagnostics(
        {"render_risk_cover_fallback_page_indices": [0, "2", "bad", None]}
    )

    assert page_indices == frozenset({0, 2})


def test_source_cleanup_prepare_applies_explicit_cover_fallback_pages() -> None:
    translated_pages = {
        0: [{"item_id": "p001-b001", "block_kind": "text"}],
        1: [{"item_id": "p002-b001", "block_kind": "text"}],
    }

    prepared = _prepare_translated_pages_for_source_cleanup(
        translated_pages=translated_pages,
        cleanup_strategy="typst_fill",
        precleaned_page_indices=frozenset(),
        skipped_page_indices=frozenset(),
        fallback_page_indices=frozenset({1}),
    )

    assert item_render_policy(prepared[0][0]) == {}
    assert item_render_policy(prepared[1][0])["overlay_fill"] == "white"
    assert item_render_policy(prepared[1][0])["reason"] == "typst_cover_fallback"


def test_pikepdf_text_strip_allows_book_overlay_pikepdf_merge() -> None:
    assert _can_use_pikepdf_book_overlay(
        apply_source_overlay=False,
        use_typst_overlay_fill_only=False,
        source_cleanup_strategy="pikepdf_text_strip",
        source_text_precleaned_page_indices=frozenset({0}),
        ordered_page_indices=[0, 1, 2],
        translated_pages={0: [{}], 1: [{}], 2: [{}]},
    )


def test_pikepdf_text_strip_compile_fallback_does_not_reenter_source_overlay() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "out.pdf"
        overlay_pdf = root / "overlay.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        overlay_doc = fitz.open()
        overlay_doc.new_page(width=200, height=300)
        overlay_doc.save(overlay_pdf)
        overlay_doc.close()

        source_doc = fitz.open(source_pdf)
        try:
            with mock.patch(
                "services.rendering.output.typst.overlay_ops.compile_book_overlay_pdf",
                side_effect=RuntimeError("book compile failed"),
            ), mock.patch(
                "services.rendering.output.typst.page_compile.compile_page_overlay_pdf",
                return_value=overlay_pdf,
            ), mock.patch(
                "services.rendering.output.typst.overlay_book.apply_source_page_overlay",
            ) as source_overlay_mock:
                diagnostics = overlay_translated_pages_on_doc(
                    source_doc,
                    {
                        0: [
                            {
                                "item_id": "p001-b001",
                                "bbox": [10.0, 20.0, 180.0, 60.0],
                                "translated_text": "hello",
                                "protected_translated_text": "hello",
                            }
                        ]
                    },
                    stem="book-overlay",
                    temp_root=root,
                    source_text_precleaned_page_indices=frozenset({0}),
                    source_base_pdf_path=source_pdf,
                    pikepdf_output_pdf_path=output_pdf,
                    source_cleanup_strategy="pikepdf_text_strip",
                )
        finally:
            source_doc.close()

        source_overlay_mock.assert_not_called()
        assert diagnostics["mode"] == "page_overlay_fallback_pikepdf"
        assert output_pdf.exists()


def test_typst_render_source_does_not_emit_white_cover_rects() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        background_pdf = root / "background.pdf"
        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(background_pdf)
        doc.close()

        source = build_typst_source_from_page_specs(
            background_pdf_path=background_pdf,
            page_specs=[_page_spec(background_pdf)],
            work_dir=root,
        )

        assert 'fill: white' not in source
        assert 'image("background.pdf"' in source
        assert 'cmarker.render' in source
        assert 'math.frac(style: "horizontal")' not in source


def test_typst_book_overlay_keeps_default_fraction_layout() -> None:
    source = build_typst_overlay_source(
        200.0,
        300.0,
        [
            {
                "item_id": "p001-b001",
                "page_idx": 0,
                "block_type": "text",
                "bbox": [10.0, 20.0, 180.0, 70.0],
                "source_text": r"Equation \frac{a}{b}.",
                "protected_source_text": r"Equation \frac{a}{b}.",
                "protected_translated_text": r"公式 $\\frac{a}{b}$。",
            }
        ],
    )

    assert 'math.frac(style: "horizontal")' not in source
    assert r"\\frac{a}{b}" in source



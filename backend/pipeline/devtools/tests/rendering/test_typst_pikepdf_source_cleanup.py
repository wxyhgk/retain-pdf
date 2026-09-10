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
from retainpdf_pipeline.render.workflow.cover_fallback import TypstCoverFallbackPlan
from retainpdf_pipeline.render.workflow.cover_fallback import cover_fallback_page_indices
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.modes import _compress_final_pdf_if_needed
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_overlay import PikepdfOverlayResult
from retainpdf_pipeline.render.document.pikepdf_pages import extract_pages_with_pikepdf
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from retainpdf_pipeline.render.output.typst.overlay_chunk_compile import OverlayChunkCompileResult
from devtools.tests.rendering_support.page_specs import sample_page_spec as _page_spec

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

    page_indices = cover_fallback_page_indices(
        translated_pages=translated_pages,
        cleanup_strategy="pikepdf_text_strip",
        precleaned_page_indices=frozenset({0}),
        skipped_page_indices=frozenset({2}),
    )

    assert page_indices == frozenset({1, 2})


def test_typst_cover_fallback_plan_marks_only_target_items() -> None:
    plan = TypstCoverFallbackPlan(page_indices=frozenset(), item_ids=frozenset({"p001-b002"}))
    translated_pages = {
        0: [
            {"item_id": "p001-b001", "block_kind": "text", "protected_translated_text": "正常删除"},
            {"item_id": "p001-b002", "block_kind": "text", "protected_translated_text": "需要兜底"},
        ]
    }

    patched_pages = plan.apply_to_translated_pages(translated_pages)
    untouched, fallback = patched_pages[0]

    assert "_render_policy" not in untouched
    assert fallback["_render_policy"]["overlay_fill"] == "white"
    assert fallback["_render_policy"]["reason"] == "typst_item_cover_fallback"
    assert plan.diagnostics() == {
        "typst_cover_fallback_pages": {"count": 0, "head": [], "tail": []},
        "typst_cover_fallback_items": {"count": 1, "head": ["p001-b002"], "tail": []},
    }


def test_typst_cover_fallback_plan_diagnostics_summarizes_large_sets() -> None:
    plan = TypstCoverFallbackPlan(
        page_indices=frozenset(range(25)),
        item_ids=frozenset(f"p001-b{idx:03d}" for idx in range(25)),
    )

    diagnostics = plan.diagnostics()

    assert diagnostics["typst_cover_fallback_pages"]["count"] == 25
    assert diagnostics["typst_cover_fallback_pages"]["head"] == list(range(20))
    assert diagnostics["typst_cover_fallback_pages"]["tail"] == list(range(5, 25))
    assert diagnostics["typst_cover_fallback_items"]["count"] == 25


def test_typst_cover_fallback_plan_marks_only_target_page_spec_blocks() -> None:
    plan = TypstCoverFallbackPlan(page_indices=frozenset(), item_ids=frozenset({"p001-b002"}))
    spec = RenderPageSpec(
        page_index=0,
        page_width_pt=200.0,
        page_height_pt=200.0,
        background_pdf_path=None,
        blocks=[
            RenderLayoutBlock(
                block_id="item-p001-b001",
                page_index=0,
                background_rect=[10, 10, 90, 40],
                content_rect=[10, 10, 90, 40],
                content_kind="markdown",
                content_text="正常删除",
                plain_text="正常删除",
                math_map=[],
                font_size_pt=10.0,
                leading_em=1.0,
            ),
            RenderLayoutBlock(
                block_id="item-p001-b002",
                page_index=0,
                background_rect=[10, 50, 90, 80],
                content_rect=[10, 50, 90, 80],
                content_kind="markdown",
                content_text="需要兜底",
                plain_text="需要兜底",
                math_map=[],
                font_size_pt=10.0,
                leading_em=1.0,
            ),
        ],
    )

    patched_specs = plan.apply_to_page_specs([spec])
    assert patched_specs is not None
    untouched, fallback = patched_specs[0].blocks

    assert untouched.use_cover_fill is False
    assert fallback.use_cover_fill is True
    assert fallback.skip_reason == "typst_item_cover_fallback"


def test_pikepdf_text_strip_book_overlay_pikepdf_merge_requires_all_pages_precleaned() -> None:
    assert not _can_use_pikepdf_book_overlay(
        apply_source_overlay=False,
        use_typst_overlay_fill_only=False,
        source_cleanup_strategy="pikepdf_text_strip",
        source_text_precleaned_page_indices=frozenset({0}),
        ordered_page_indices=[0, 1, 2],
        translated_pages={0: [{}], 1: [{}], 2: [{}]},
    )
    assert _can_use_pikepdf_book_overlay(
        apply_source_overlay=False,
        use_typst_overlay_fill_only=False,
        source_cleanup_strategy="pikepdf_text_strip",
        source_text_precleaned_page_indices=frozenset({0, 1, 2}),
        ordered_page_indices=[0, 1, 2],
        translated_pages={0: [{}], 1: [{}], 2: [{}]},
    )


def test_large_pikepdf_overlay_uses_chunked_typst_compile_when_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RETAIN_TYPST_OVERLAY_CHUNKED", "1")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "out.pdf"

        doc = fitz.open()
        for _index in range(256):
            doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        source_doc = fitz.open(source_pdf)
        try:
            chunk_compile_mock = mock.Mock(
                return_value=OverlayChunkCompileResult(
                    chunk_pdf_paths=[root / "chunk-1.pdf", root / "chunk-2.pdf"],
                    chunk_source_page_indices=[list(range(128)), list(range(128, 256))],
                    elapsed_seconds=1.25,
                    chunk_page_count=128,
                    chunk_count=2,
                    workers=2,
                )
            )
            with mock.patch(
                "retainpdf_pipeline.render.output.typst.overlay_ops.compile_book_overlay_pdf",
                side_effect=AssertionError("large pikepdf overlay should use chunked compile"),
            ), mock.patch(
                "retainpdf_pipeline.render.output.typst.overlay_ops.compile_book_overlay_pdf_chunks",
                chunk_compile_mock,
            ), mock.patch(
                "retainpdf_pipeline.render.output.typst.overlay_ops.overlay_pdf_chunks_with_pikepdf",
                return_value=PikepdfOverlayResult(
                    output_pdf_path=output_pdf,
                    pages_merged=256,
                    elapsed_seconds=0.5,
                ),
            ):
                diagnostics = overlay_translated_pages_on_doc(
                    source_doc,
                    {
                        page_idx: [
                            {
                                "item_id": f"p{page_idx + 1:03d}-b001",
                                "bbox": [10.0, 20.0, 180.0, 60.0],
                                "translated_text": "hello",
                                "protected_translated_text": "hello",
                            }
                        ]
                        for page_idx in range(256)
                    },
                    stem="book-overlay",
                    temp_root=root,
                    source_text_precleaned_page_indices=frozenset(range(256)),
                    source_base_pdf_path=source_pdf,
                    pikepdf_output_pdf_path=output_pdf,
                    source_cleanup_strategy="pikepdf_text_strip",
                )
        finally:
            source_doc.close()

        assert diagnostics["mode"] == "book_overlay_chunked_pikepdf"
        assert diagnostics["typst_chunked_compile"] is True
        assert diagnostics["typst_chunk_count"] == 2
        assert diagnostics["typst_chunk_page_count"] == 128
        assert diagnostics["pikepdf_overlay_pages"] == 256
        assert chunk_compile_mock.call_args.kwargs["include_cover_rect"] is True


def test_overlay_includes_cover_rect_without_promoting_unprecleaned_pages_to_fallback() -> None:
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
                "retainpdf_pipeline.render.output.typst.overlay_ops.compile_book_overlay_pdf",
                return_value=overlay_pdf,
            ) as compile_mock, mock.patch(
                "retainpdf_pipeline.render.output.typst.overlay_ops.overlay_pdf_pages_with_pikepdf",
                return_value=PikepdfOverlayResult(
                    output_pdf_path=output_pdf,
                    pages_merged=1,
                    elapsed_seconds=0.1,
                ),
            ):
                diagnostics = overlay_translated_pages_on_doc(
                    source_doc,
                    {
                        0: [
                            {
                                "item_id": "p001-b001",
                                "block_kind": "text",
                                "bbox": [10.0, 20.0, 180.0, 60.0],
                                "translated_text": "hello",
                                "protected_translated_text": "hello",
                            }
                        ]
                    },
                    stem="book-overlay",
                    temp_root=root,
                    source_text_precleaned_page_indices=frozenset(),
                    source_base_pdf_path=source_pdf,
                    pikepdf_output_pdf_path=output_pdf,
                    source_cleanup_strategy="pikepdf_text_strip",
                    visual_cover_page_indices=frozenset(),
                )
        finally:
            source_doc.close()

        assert compile_mock.call_args.kwargs["include_cover_rect"] is True
        assert diagnostics["typst_cover_fallback_pages"] == []


def test_overlay_uses_explicit_visual_cover_pages_for_cover_fallback() -> None:
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
                "retainpdf_pipeline.render.output.typst.overlay_ops.compile_book_overlay_pdf",
                return_value=overlay_pdf,
            ) as compile_mock, mock.patch(
                "retainpdf_pipeline.render.output.typst.overlay_ops.overlay_pdf_pages_with_pikepdf",
                return_value=PikepdfOverlayResult(
                    output_pdf_path=output_pdf,
                    pages_merged=1,
                    elapsed_seconds=0.1,
                ),
            ):
                diagnostics = overlay_translated_pages_on_doc(
                    source_doc,
                    {
                        0: [
                            {
                                "item_id": "p001-b001",
                                "block_kind": "text",
                                "bbox": [10.0, 20.0, 180.0, 60.0],
                                "translated_text": "hello",
                                "protected_translated_text": "hello",
                            }
                        ]
                    },
                    stem="book-overlay",
                    temp_root=root,
                    source_text_precleaned_page_indices=frozenset(),
                    source_base_pdf_path=source_pdf,
                    pikepdf_output_pdf_path=output_pdf,
                    source_cleanup_strategy="pikepdf_text_strip",
                    visual_cover_page_indices=frozenset({0}),
                )
        finally:
            source_doc.close()

        assert compile_mock.call_args.kwargs["include_cover_rect"] is True
        assert diagnostics["typst_cover_fallback_pages"] == [0]


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
                "retainpdf_pipeline.render.output.typst.overlay_ops.compile_book_overlay_pdf",
                side_effect=RuntimeError("book compile failed"),
            ), mock.patch(
                "retainpdf_pipeline.render.output.typst.page_compile.compile_page_overlay_pdf",
                return_value=overlay_pdf,
            ), mock.patch(
                "retainpdf_pipeline.render.output.typst.overlay_book.apply_source_page_overlay",
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

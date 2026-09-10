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
from retainpdf_pipeline.render.document.pikepdf_overlay import PikepdfOverlayChunk
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_chunks_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from retainpdf_pipeline.render.document.pikepdf_pages import extract_pages_with_pikepdf
from retainpdf_pipeline.render.layout.inline_content.core.markdown import build_direct_typst_passthrough_text
from devtools.tests.rendering_support.page_specs import sample_page_spec as _page_spec

def test_pikepdf_overlay_merges_overlay_page_without_pymupdf_write() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        overlay_pdf = root / "overlay.pdf"
        output_pdf = root / "merged.pdf"

        doc = fitz.open()
        page = doc.new_page(width=200, height=120)
        page.insert_text((20, 40), "source text", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        doc = fitz.open()
        page = doc.new_page(width=200, height=120)
        page.insert_text((20, 80), "overlay text", fontsize=12)
        doc.save(overlay_pdf)
        doc.close()

        result = overlay_pdf_pages_with_pikepdf(
            source_pdf_path=source_pdf,
            overlay_pdf_path=overlay_pdf,
            output_pdf_path=output_pdf,
        )

        assert result.pages_merged == 1
        merged = fitz.open(output_pdf)
        try:
            text = merged[0].get_text()
        finally:
            merged.close()
        assert "source text" in text
        assert "overlay text" in text


def test_pikepdf_overlay_merges_single_page_pdfs_by_source_page() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        page_two_overlay = root / "page-two-overlay.pdf"
        output_pdf = root / "merged.pdf"

        doc = fitz.open()
        for index in range(3):
            page = doc.new_page(width=200, height=120)
            page.insert_text((20, 40), f"source page {index + 1}", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        doc = fitz.open()
        page = doc.new_page(width=200, height=120)
        page.insert_text((20, 80), "page two overlay", fontsize=12)
        doc.save(page_two_overlay)
        doc.close()

        result = overlay_page_pdfs_with_pikepdf(
            source_pdf_path=source_pdf,
            overlay_paths_by_page_index={1: page_two_overlay},
            output_pdf_path=output_pdf,
        )

        assert result.pages_merged == 1
        merged = fitz.open(output_pdf)
        try:
            assert "page two overlay" not in merged[0].get_text()
            assert "page two overlay" in merged[1].get_text()
            assert "page two overlay" not in merged[2].get_text()
        finally:
            merged.close()


def test_pikepdf_overlay_merges_chunk_pdfs_by_source_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        chunk_one_pdf = root / "chunk-one.pdf"
        chunk_two_pdf = root / "chunk-two.pdf"
        output_pdf = root / "merged.pdf"

        doc = fitz.open()
        for index in range(4):
            page = doc.new_page(width=200, height=120)
            page.insert_text((20, 40), f"source page {index + 1}", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        doc = fitz.open()
        page = doc.new_page(width=200, height=120)
        page.insert_text((20, 80), "chunk one page one", fontsize=12)
        page = doc.new_page(width=200, height=120)
        page.insert_text((20, 80), "chunk one page two", fontsize=12)
        doc.save(chunk_one_pdf)
        doc.close()

        doc = fitz.open()
        page = doc.new_page(width=200, height=120)
        page.insert_text((20, 80), "chunk two page one", fontsize=12)
        doc.save(chunk_two_pdf)
        doc.close()

        result = overlay_pdf_chunks_with_pikepdf(
            source_pdf_path=source_pdf,
            overlay_chunks=[
                PikepdfOverlayChunk(chunk_one_pdf, [0, 1]),
                PikepdfOverlayChunk(chunk_two_pdf, [3]),
            ],
            output_pdf_path=output_pdf,
        )

        assert result.pages_merged == 3
        merged = fitz.open(output_pdf)
        try:
            assert "chunk one page one" in merged[0].get_text()
            assert "chunk one page two" in merged[1].get_text()
            assert "chunk two page one" not in merged[2].get_text()
            assert "chunk two page one" in merged[3].get_text()
        finally:
            merged.close()


def test_single_pdf_overlay_can_write_final_pdf_with_pikepdf() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        overlay_pdf = root / "overlay.pdf"
        output_pdf = root / "merged.pdf"

        doc = fitz.open()
        for index in range(2):
            page = doc.new_page(width=200, height=120)
            page.insert_text((20, 40), f"source page {index + 1}", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        doc = fitz.open()
        for index in range(2):
            page = doc.new_page(width=200, height=120)
            page.insert_text((20, 80), f"overlay page {index + 1}", fontsize=12)
        doc.save(overlay_pdf)
        doc.close()

        source_doc = fitz.open(source_pdf)
        try:
            diagnostics = overlay_pages_from_single_pdf(
                source_doc,
                [0, 1],
                {
                    0: [{"item_id": "p001-b001", "bbox": [10.0, 10.0, 50.0, 30.0]}],
                    1: [{"item_id": "p002-b001", "bbox": [10.0, 10.0, 50.0, 30.0]}],
                },
                overlay_pdf,
                apply_source_overlay=False,
                skip_visual_cover=True,
                source_base_pdf_path=source_pdf,
                pikepdf_output_pdf_path=output_pdf,
            )
        finally:
            source_doc.close()

        assert diagnostics["mode"] == "single_pdf_overlay_pikepdf"
        assert diagnostics["pikepdf_overlay_pages"] == 2
        merged = fitz.open(output_pdf)
        try:
            assert "source page 1" in merged[0].get_text()
            assert "overlay page 1" in merged[0].get_text()
            assert "source page 2" in merged[1].get_text()
            assert "overlay page 2" in merged[1].get_text()
        finally:
            merged.close()


def test_pikepdf_extract_pages_copies_selected_page() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "selected.pdf"
        doc = fitz.open()
        for index in range(3):
            page = doc.new_page(width=200, height=120)
            page.insert_text((20, 40), f"page {index + 1}", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        extract_pages_with_pikepdf(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            start_page=1,
            end_page=1,
        )

        selected = fitz.open(output_pdf)
        try:
            assert selected.page_count == 1
            text = selected[0].get_text()
        finally:
            selected.close()
        assert "page 2" in text
        assert "page 1" not in text

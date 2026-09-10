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


def test_first_line_indent_detector_uses_block_ink_projection() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "source.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((44, 42), "Indented first line", fontsize=10)
        page.insert_text((24, 58), "second line of paragraph", fontsize=10)
        page.insert_text((24, 74), "third line of paragraph", fontsize=10)
        doc.save(pdf_path)
        doc.close()

        source_doc = fitz.open(pdf_path)
        try:
            indent = detect_first_line_indent_pt(
                source_doc,
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "block_kind": "text",
                    "layout_role": "paragraph",
                    "semantic_role": "body",
                    "structure_role": "body",
                    "bbox": [18.0, 30.0, 210.0, 88.0],
                    "source_text": "Indented first line second line of paragraph third line of paragraph",
                    "protected_source_text": "Indented first line second line of paragraph third line of paragraph",
                    "lines": [],
                },
                page_idx=0,
                font_size_pt=10.0,
                page_text_width_med=160.0,
            )
        finally:
            source_doc.close()

    assert indent >= 10.0


def test_typst_compiler_defaults_include_backend_fonts_dir() -> None:
    resolved = _resolved_font_paths()
    assert fonts.BACKEND_FONTS_DIR in resolved


def test_resolved_common_root_uses_shared_ancestor() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "job-1"
        typ_path = root / "rendered" / "typst" / "background-book" / "page.typ"
        pdf_path = root / "rendered" / "typst" / "background-book" / "page.pdf"
        source_pdf = root / "source" / "input.pdf"

        common_root = _resolved_common_root([typ_path, pdf_path, source_pdf])

        assert common_root == root


def test_typst_compile_error_carries_structured_context() -> None:
    completed = mock.Mock(returncode=1, stdout="", stderr="syntax error")
    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        with mock.patch("retainpdf_pipeline.render.output.typst.compiler.subprocess.run", return_value=completed):
            with pytest.raises(TypstCompileError) as exc_info:
                compile_typst_overlay_pdf(
                    200.0,
                    300.0,
                    [{"item_id": "b1", "bbox": [0, 0, 40, 20], "translated_text": "x", "protected_translated_text": "x"}],
                    stem="probe",
                    work_dir=work_dir,
                )
    error = exc_info.value
    payload = error.to_dict()
    assert payload["phase"] == "overlay_page"
    assert payload["stem"] == "probe"
    assert payload["return_code"] == 1
    assert payload["stderr"] == "syntax error"
    assert payload["typ_path"].endswith("probe.typ")


def test_typst_compile_error_wraps_runtime_start_failure() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        with mock.patch(
            "retainpdf_pipeline.render.output.typst.compiler.subprocess.run",
            side_effect=FileNotFoundError("typst missing"),
        ):
            with pytest.raises(TypstCompileError) as exc_info:
                compile_typst_overlay_pdf(
                    200.0,
                    300.0,
                    [{"item_id": "b1", "bbox": [0, 0, 40, 20], "translated_text": "x", "protected_translated_text": "x"}],
                    stem="probe",
                    work_dir=work_dir,
                )

    payload = exc_info.value.to_dict()
    assert payload["return_code"] == -1
    assert "Typst runtime failed to start: FileNotFoundError" in payload["stderr"]
    assert payload["extra"]["runtime_error_type"] == "FileNotFoundError"
    assert payload["extra"]["typst_bin"]


def test_book_overlay_compile_falls_back_when_prebuilt_source_is_missing() -> None:
    completed = mock.Mock(returncode=0, stdout="", stderr="")
    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp) / "book-overlays"
        missing_prebuilt = Path(tmp) / "book-overlay-sources" / "book-overlay.typ.prebuilt"

        with mock.patch("retainpdf_pipeline.render.output.typst.compiler.subprocess.run", return_value=completed) as run_mock:
            from retainpdf_pipeline.render.output.typst.compiler import compile_typst_book_overlay_pdf

            output = compile_typst_book_overlay_pdf(
                [(200.0, 300.0, [])],
                stem="book-overlay",
                work_dir=work_dir,
                prebuilt_source_path=missing_prebuilt,
            )

        assert output == work_dir / "book-overlay.pdf"
        assert (work_dir / "book-overlay.typ").exists()
        assert run_mock.called


def test_render_pages_compile_uses_dynamic_project_root() -> None:
    completed = mock.Mock(returncode=0, stdout="", stderr="")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "job-1"
        work_dir = root / "rendered" / "typst" / "background-book"
        work_dir.mkdir(parents=True, exist_ok=True)
        background_pdf = work_dir / "book-background-cleaned.pdf"
        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(background_pdf)
        doc.close()

        with mock.patch("retainpdf_pipeline.render.output.typst.compiler.subprocess.run", return_value=completed) as run_mock:
            compile_typst_render_pages_pdf(
                background_pdf_path=background_pdf,
                page_specs=[_page_spec(background_pdf)],
                stem="book-background-overlay-sanitized",
                work_dir=work_dir,
            )

        command = run_mock.call_args.args[0]
        root_index = command.index("--root")
        assert Path(command[root_index + 1]) == work_dir


def test_background_book_compile_uses_job_root_as_project_root() -> None:
    completed = mock.Mock(returncode=0, stdout="", stderr="")
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "job-1"
        work_dir = root / "rendered" / "typst" / "background-book"
        work_dir.mkdir(parents=True, exist_ok=True)
        source_pdf = root / "source" / "input.pdf"
        source_pdf.parent.mkdir(parents=True, exist_ok=True)
        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        page_specs = [
            (
                0,
                200.0,
                300.0,
                [{"item_id": "b1", "bbox": [0, 0, 40, 20], "translated_text": "x", "protected_translated_text": "x"}],
            )
        ]

        with mock.patch("retainpdf_pipeline.render.output.typst.compiler.subprocess.run", return_value=completed) as run_mock:
            compile_typst_book_background_pdf(
                source_pdf_path=source_pdf,
                page_specs=page_specs,
                stem="book-background-overlay-sanitized",
                work_dir=work_dir,
            )

        command = run_mock.call_args.args[0]
        root_index = command.index("--root")
        assert Path(command[root_index + 1]) == root


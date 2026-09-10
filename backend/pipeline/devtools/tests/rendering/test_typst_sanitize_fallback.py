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


def test_sanitize_items_collects_compile_diagnostics() -> None:
    item = {"item_id": "b1", "bbox": [0, 0, 40, 20], "translated_text": "x", "protected_translated_text": "x"}

    def _fake_compile(*args, **kwargs):
        stem = kwargs.get("stem", "")
        if stem.endswith("-plain"):
            return Path("/tmp/plain.pdf")
        raise TypstCompileError(
            phase="overlay_page",
            stem=stem,
            typ_path=Path(f"/tmp/{stem}.typ"),
            pdf_path=Path(f"/tmp/{stem}.pdf"),
            command=["typst", "compile"],
            return_code=1,
            stdout="",
            stderr="bad formula",
            work_dir=Path("/tmp"),
        )

    diagnostics: dict = {}
    with mock.patch("retainpdf_pipeline.render.output.typst.sanitize.compile_typst_overlay_pdf", side_effect=_fake_compile), mock.patch(
        "retainpdf_pipeline.render.output.typst.sanitize_steps.compile_typst_overlay_pdf",
        side_effect=_fake_compile,
    ):
        sanitized = sanitize_items_for_typst_compile(
            200.0,
            300.0,
            [item],
            stem="page-000",
            diagnostics=diagnostics,
        )

    assert sanitized[0]["_force_plain_line"] is True
    assert diagnostics["final_mode"] == "selective_plain_text"
    assert diagnostics["bad_item_indices"] == [0]
    assert diagnostics["initial_compile_error"]["phase"] == "overlay_page"
    assert diagnostics["probe_failures"][0]["item_id"] == "b1"


def test_sanitize_items_uses_llm_repair_before_plain_fallback() -> None:
    item = {"item_id": "b1", "bbox": [0, 0, 40, 20], "translated_text": "x", "protected_translated_text": "x"}

    def _fake_compile(*args, **kwargs):
        stem = kwargs.get("stem", "")
        if stem.endswith("-selective-llm"):
            return Path("/tmp/llm.pdf")
        raise TypstCompileError(
            phase="overlay_page",
            stem=stem,
            typ_path=Path(f"/tmp/{stem}.typ"),
            pdf_path=Path(f"/tmp/{stem}.pdf"),
            command=["typst", "compile"],
            return_code=1,
            stdout="",
            stderr="bad formula",
            work_dir=Path("/tmp"),
        )

    with mock.patch("retainpdf_pipeline.render.output.typst.sanitize.compile_typst_overlay_pdf", side_effect=_fake_compile), mock.patch(
        "retainpdf_pipeline.render.output.typst.sanitize_steps.compile_typst_overlay_pdf",
        side_effect=_fake_compile,
    ), mock.patch(
        "retainpdf_pipeline.render.output.typst.sanitize_steps.repair_items_with_llm_for_typst",
        return_value=[{**item, "protected_translated_text": "llm repaired"}],
    ) as repair_mock:
        diagnostics: dict = {}
        sanitized = sanitize_items_for_typst_compile(
            200.0,
            300.0,
            [item],
            stem="page-000",
            diagnostics=diagnostics,
            request_chat_content_fn=lambda *_args, **_kwargs: "",
        )

    repair_mock.assert_called_once()
    assert sanitized[0]["protected_translated_text"] == "llm repaired"
    assert diagnostics["final_mode"] == "selective_llm_repair"
    assert "selective_plain_text_error" not in diagnostics


def test_sanitize_items_can_disable_llm_repair(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RENDER_TYPST_LLM_REPAIR", "0")
    item = {"item_id": "b1", "bbox": [0, 0, 40, 20], "translated_text": "x", "protected_translated_text": "x"}

    def _fake_compile(*args, **kwargs):
        stem = kwargs.get("stem", "")
        if stem.endswith("-plain"):
            return Path("/tmp/plain.pdf")
        raise TypstCompileError(
            phase="overlay_page",
            stem=stem,
            typ_path=Path(f"/tmp/{stem}.typ"),
            pdf_path=Path(f"/tmp/{stem}.pdf"),
            command=["typst", "compile"],
            return_code=1,
            stdout="",
            stderr="bad formula",
            work_dir=Path("/tmp"),
        )

    with mock.patch("retainpdf_pipeline.render.output.typst.sanitize.compile_typst_overlay_pdf", side_effect=_fake_compile), mock.patch(
        "retainpdf_pipeline.render.output.typst.sanitize_steps.compile_typst_overlay_pdf",
        side_effect=_fake_compile,
    ), mock.patch("retainpdf_pipeline.render.output.typst.sanitize_steps.repair_items_with_llm_for_typst") as repair_mock:
        diagnostics: dict = {}
        sanitize_items_for_typst_compile(
            200.0,
            300.0,
            [item],
            stem="page-000",
            diagnostics=diagnostics,
            request_chat_content_fn=lambda *_args, **_kwargs: "",
        )

    repair_mock.assert_not_called()
    assert diagnostics["final_mode"] == "selective_plain_text"


def test_sanitize_items_uses_math_token_fallback_for_math_blocks(monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RENDER_TYPST_LLM_REPAIR", "0")
    item = {
        "item_id": "b1",
        "bbox": [0, 0, 120, 40],
        "protected_translated_text": r"矩阵元 $ \broken{A} $ 导致编译失败。",
    }

    def _fake_compile(*args, **kwargs):
        stem = kwargs.get("stem", "")
        items = args[2]
        if stem.endswith("-math-token-plain"):
            assert items[0].get("_typst_math_token_plain_text") is True
            assert items[0].get("_force_plain_line") is not True
            assert "$" not in items[0]["protected_translated_text"]
            return Path("/tmp/math-token-plain.pdf")
        raise TypstCompileError(
            phase="overlay_page",
            stem=stem,
            typ_path=Path(f"/tmp/{stem}.typ"),
            pdf_path=Path(f"/tmp/{stem}.pdf"),
            command=["typst", "compile"],
            return_code=1,
            stdout="",
            stderr="bad formula",
            work_dir=Path("/tmp"),
        )

    with mock.patch("retainpdf_pipeline.render.output.typst.sanitize.compile_typst_overlay_pdf", side_effect=_fake_compile), mock.patch(
        "retainpdf_pipeline.render.output.typst.sanitize_steps.compile_typst_overlay_pdf",
        side_effect=_fake_compile,
    ):
        diagnostics: dict = {}
        sanitized = sanitize_items_for_typst_compile(
            200.0,
            300.0,
            [item],
            stem="page-000",
            diagnostics=diagnostics,
        )

    assert sanitized[0].get("_force_plain_line") is not True
    assert sanitized[0].get("_typst_math_token_plain_text") is True
    assert diagnostics["final_mode"] == "selective_math_token_plain_text"
    assert diagnostics["selective_llm_repair_skipped"] == "disabled_by_env"


def test_extract_failed_overlay_indices_from_typst_error() -> None:
    page_specs = [
        (page_idx, 200.0, 300.0, [{"item_id": f"p{page_idx + 1:03d}-b001"}], f"book-overlay-{page_idx:03d}")
        for page_idx in range(20)
    ]
    exc = TypstCompileError(
        phase="overlay_book",
        stem="book-overlay",
        typ_path=Path("/tmp/book-overlay.typ"),
        pdf_path=Path("/tmp/book-overlay.pdf"),
        command=["typst", "compile"],
        return_code=1,
        stdout="",
        stderr=(
            "error: plugin errored\n"
            "help: error occurred in this call\n"
            "610 │ #let p14_item_0_0_body = block(...)[cmarker.render(p14_item_0_0_md, math: mitex)]\n"
            "typst selective fallback: book-overlay-014 block_indices=[0]"
        ),
    )

    assert _extract_failed_overlay_indices(exc, page_specs) == {14}


def test_sanitize_book_overlay_can_limit_to_candidate_pages() -> None:
    from retainpdf_pipeline.render.output.typst.sanitize import sanitize_page_specs_for_typst_book_overlay

    page_specs = [
        (0, 200.0, 300.0, [{"item_id": "p001-b001", "protected_translated_text": "page 1"}], "book-overlay-000"),
        (1, 200.0, 300.0, [{"item_id": "p002-b001", "protected_translated_text": "page 2"}], "book-overlay-001"),
        (2, 200.0, 300.0, [{"item_id": "p003-b001", "protected_translated_text": "page 3"}], "book-overlay-002"),
    ]

    def _fake_sanitize(_width, _height, items, *, stem, **_kwargs):
        return [{**item, "protected_translated_text": f"sanitized {stem}"} for item in items]

    with mock.patch(
        "retainpdf_pipeline.render.output.typst.sanitize.sanitize_items_for_typst_compile",
        side_effect=_fake_sanitize,
    ) as sanitize_mock:
        sanitized_specs = sanitize_page_specs_for_typst_book_overlay(page_specs, overlay_indices={1})

    assert sanitize_mock.call_count == 1
    assert sanitize_mock.call_args.kwargs["stem"] == "book-overlay-001"
    assert sanitized_specs[0][3][0]["protected_translated_text"] == "page 1"
    assert sanitized_specs[1][3][0]["protected_translated_text"] == "sanitized book-overlay-001"
    assert sanitized_specs[2][3][0]["protected_translated_text"] == "page 3"

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
from services.rendering.layout.payload.first_line_indent import detect_first_line_indent_pt
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
from services.rendering.workflow.context import RenderExecutionContext
from services.rendering.workflow.modes import _compress_final_pdf_if_needed
from services.rendering.source.preparation.bbox_text_strip import build_bbox_text_stripped_pdf_copy
from services.rendering.source.preparation.bbox_text_strip import strip_bbox_text_rects_from_pdf_copy
from services.rendering.source.preparation.redact_restore_formula import build_redact_restore_formula_pdf_copy
from services.rendering.document.pikepdf_overlay import overlay_pdf_pages_with_pikepdf
from services.rendering.document.pikepdf_overlay import overlay_page_pdfs_with_pikepdf
from services.rendering.document.pikepdf_pages import extract_pages_with_pikepdf


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


def test_pikepdf_text_strip_allows_book_overlay_pikepdf_merge() -> None:
    assert _can_use_pikepdf_book_overlay(
        apply_source_overlay=False,
        use_typst_overlay_fill_only=False,
        source_cleanup_strategy="pikepdf_text_strip",
        source_text_precleaned_page_indices=frozenset({0}),
        ordered_page_indices=[0, 1, 2],
        translated_pages={0: [{}], 1: [{}], 2: [{}]},
    )


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
        with mock.patch("services.rendering.output.typst.compiler.subprocess.run", return_value=completed):
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


def test_book_overlay_compile_falls_back_when_prebuilt_source_is_missing() -> None:
    completed = mock.Mock(returncode=0, stdout="", stderr="")
    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp) / "book-overlays"
        missing_prebuilt = Path(tmp) / "book-overlay-sources" / "book-overlay.typ.prebuilt"

        with mock.patch("services.rendering.output.typst.compiler.subprocess.run", return_value=completed) as run_mock:
            from services.rendering.output.typst.compiler import compile_typst_book_overlay_pdf

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

        with mock.patch("services.rendering.output.typst.compiler.subprocess.run", return_value=completed) as run_mock:
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

        with mock.patch("services.rendering.output.typst.compiler.subprocess.run", return_value=completed) as run_mock:
            compile_typst_book_background_pdf(
                source_pdf_path=source_pdf,
                page_specs=page_specs,
                stem="book-background-overlay-sanitized",
                work_dir=work_dir,
            )

        command = run_mock.call_args.args[0]
        root_index = command.index("--root")
        assert Path(command[root_index + 1]) == root


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
    with mock.patch("services.rendering.output.typst.sanitize.compile_typst_overlay_pdf", side_effect=_fake_compile), mock.patch(
        "services.rendering.output.typst.sanitize_steps.compile_typst_overlay_pdf",
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
    from services.rendering.output.typst.sanitize import sanitize_page_specs_for_typst_book_overlay

    page_specs = [
        (0, 200.0, 300.0, [{"item_id": "p001-b001", "protected_translated_text": "page 1"}], "book-overlay-000"),
        (1, 200.0, 300.0, [{"item_id": "p002-b001", "protected_translated_text": "page 2"}], "book-overlay-001"),
        (2, 200.0, 300.0, [{"item_id": "p003-b001", "protected_translated_text": "page 3"}], "book-overlay-002"),
    ]

    def _fake_sanitize(_width, _height, items, *, stem, **_kwargs):
        return [{**item, "protected_translated_text": f"sanitized {stem}"} for item in items]

    with mock.patch(
        "services.rendering.output.typst.sanitize.sanitize_items_for_typst_compile",
        side_effect=_fake_sanitize,
    ) as sanitize_mock:
        sanitized_specs = sanitize_page_specs_for_typst_book_overlay(page_specs, overlay_indices={1})

    assert sanitize_mock.call_count == 1
    assert sanitize_mock.call_args.kwargs["stem"] == "book-overlay-001"
    assert sanitized_specs[0][3][0]["protected_translated_text"] == "page 1"
    assert sanitized_specs[1][3][0]["protected_translated_text"] == "sanitized book-overlay-001"
    assert sanitized_specs[2][3][0]["protected_translated_text"] == "page 3"


def test_typst_render_source_keeps_title_fit_inside_rect_budget() -> None:
    spec = RenderPageSpec(
        page_index=0,
        page_width_pt=200.0,
        page_height_pt=300.0,
        background_pdf_path=None,
        blocks=[
            RenderLayoutBlock(
                block_id="title-1",
                page_index=0,
                background_rect=[10.0, 20.0, 160.0, 60.0],
                content_rect=[12.0, 22.0, 158.0, 58.0],
                content_kind="markdown",
                content_text="引言",
                plain_text="引言",
                math_map=[],
                font_size_pt=12.0,
                leading_em=0.42,
                font_weight="bold",
                fit_to_box=True,
                fit_single_line=True,
                fit_min_font_size_pt=12.0,
                fit_max_font_size_pt=24.0,
                fit_min_leading_em=0.42,
                fit_max_height_pt=36.0,
            )
        ],
    )

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        background_pdf = root / "background.pdf"
        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(background_pdf)
        doc.close()

        source = build_typst_source_from_page_specs(
            background_pdf_path=background_pdf,
            page_specs=[spec],
            work_dir=root,
        )

    assert 'weight: "bold"' in source
    assert "clip: false" in source
    assert "fit_width: 146.0pt" in source
    assert re.search(r"fit_height: 36(\.0+)?pt", source)


def test_typst_render_source_does_not_shrink_multiline_markdown_fit_height() -> None:
    spec = RenderPageSpec(
        page_index=0,
        page_width_pt=200.0,
        page_height_pt=300.0,
        background_pdf_path=None,
        blocks=[
            RenderLayoutBlock(
                block_id="body-1",
                page_index=0,
                background_rect=[10.0, 20.0, 160.0, 70.0],
                content_rect=[10.0, 20.0, 160.0, 70.0],
                content_kind="markdown",
                content_text=r"正文 $\\frac{\\partial E}{\\partial R}$ 继续说明。",
                plain_text="正文继续说明。",
                math_map=[],
                font_size_pt=10.0,
                leading_em=0.6,
                fit_to_box=True,
                fit_single_line=False,
                fit_min_font_size_pt=9.2,
                fit_min_leading_em=0.52,
                fit_max_height_pt=24.0,
                use_cover_fill=True,
            )
        ],
    )

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        background_pdf = root / "background.pdf"
        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(background_pdf)
        doc.close()

        source = build_typst_source_from_page_specs(
            background_pdf_path=background_pdf,
            page_specs=[spec],
            work_dir=root,
        )

    assert "height: 50.0pt" in source
    assert "fit_height: 24.0pt" in source
    assert "fill: rgb(255, 255, 255)" in source


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
            "services.rendering.source.background.stage.collect_vector_text_rects",
            return_value=[fitz.Rect(10, 20, 80, 60)],
        ), mock.patch(
            "services.rendering.source.background.stage.redact_source_text_areas",
        ) as redact_mock, mock.patch(
            "services.rendering.source.background.stage.save_optimized_pdf",
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
            "services.rendering.source.background.stage.redact_source_text_areas",
        ) as redact_mock, mock.patch(
            "services.rendering.source.background.stage.save_optimized_pdf",
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
        "services.rendering.source.background.redaction_plan.collect_vector_text_rects",
        return_value=[fitz.Rect(10, 20, 80, 60)],
    ), mock.patch(
        "services.rendering.source.background.source_overlay.redact_source_text_areas",
    ) as redact_mock, mock.patch(
        "services.rendering.source.background.source_overlay.strip_page_links",
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

    assert len(protected) == 2
    rects = [fitz.Rect(item["bbox"]) for item in protected]
    formula = fitz.Rect(translated_items[1]["bbox"])
    assert all((rect & formula).is_empty for rect in rects)
    assert rects[0].y1 <= 70.0
    assert rects[1].y0 >= 112.0
    assert all(item.get("_formula_guard_fragment") for item in protected)
    cover_rects = cover_rects_from_valid_items([(rect, item, "译文") for rect, item in zip(rects, protected)])
    assert len(cover_rects) == 2
    assert all((rect & formula).is_empty for rect in cover_rects)


def test_render_policy_marks_formula_pages_for_visual_cover_and_white_fill() -> None:
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
    assert policy.item_policy("p001-b001").cleanup_mode == "visual_cover"
    assert policy.item_policy("p001-b001").overlay_fill == "white"
    assert item_render_policy(patched[0])["cleanup_mode"] == "visual_cover"
    assert item_uses_white_overlay_fill(patched[0]) is True


def test_display_formula_neighbors_use_visual_cover_policy() -> None:
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

    assert formula_neighbor_text_item_ids(translated_items) == {"p001-b001", "p001-b003"}
    assert len(protected) == 2
    assert all(item_requires_visual_cover_only(item) for item in protected)
    assert all(item_render_policy_reason(item) == "display_formula_neighbor" for item in protected)


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


def test_build_render_page_specs_uses_layout_block_protocol() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 80.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "Raw CBFZ text with formula",
                    "protected_source_text": "Raw <f1-17a/> text",
                    "protected_translated_text": "译文 <f1-17a/> 内容",
                    "formula_map": [
                        {
                            "placeholder": "<f1-17a/>",
                            "formula_text": r"(\mathrm{CaO}_2)",
                            "kind": "formula",
                        }
                    ],
                }
            ]
        }

        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        assert len(page_specs) == 1
        spec = page_specs[0]
        assert isinstance(spec, RenderPageSpec)
        assert spec.page_index == 0
        assert len(spec.blocks) == 1

        block = spec.blocks[0]
        assert isinstance(block, RenderLayoutBlock)
        assert block.block_id == "item-p001-b001"
        assert block.content_kind == "markdown"
        assert "$(" in block.content_text
        assert block.content_rect == [10.0, 20.0, 180.0, 80.0]
        assert block.background_rect[0] < 10.0
        assert block.background_rect[1] < 20.0
        assert block.background_rect[2] > 180.0
        assert block.background_rect[3] > 80.0
        assert 8.4 <= block.font_size_pt <= 11.6
        assert 0.28 <= block.leading_em <= 0.74


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


def test_typst_overlay_text_blocks_use_fit_without_clipping() -> None:
    translated_items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [10.0, 20.0, 120.0, 42.0],
            "translated_text": "这是一段很长的文字，用来确认渲染时不会越出 OCR 框覆盖下方内容。",
            "protected_translated_text": "这是一段很长的文字，用来确认渲染时不会越出 OCR 框覆盖下方内容。",
            "formula_map": [],
        }
    ]

    source = build_typst_overlay_source(200.0, 300.0, translated_items, include_cover_rect=True)

    assert "clip: true" not in source
    assert "pdftr_fit_markdown" in source
    assert "emergency_min_size = calc.max(4.2pt" in source
    assert "emergency_min_leading = calc.max(0.20em" in source
    assert "pdftr_fit_leading" in source


def test_dense_body_pressure_tightening_does_not_increase_leading() -> None:
    normal_payload = {
        "inner_bbox": [10.0, 60.0, 210.0, 150.0],
        "translated_text": "这是普通正文块，密度较低。",
        "formula_map": [],
        "font_size_pt": 10.0,
        "leading_em": 0.62,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with enough words for smoothing"},
    }
    payload = {
        "inner_bbox": [10.0, 10.0, 110.0, 52.0],
        "translated_text": "这是一个很密集的正文块，译文长度明显偏长，需要收紧而不是增加行距。" * 4,
        "formula_map": [],
        "font_size_pt": 10.0,
        "leading_em": 0.62,
        "dense_small_box": True,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "dense body text with enough words for smoothing"},
    }
    baseline_leading = payload["leading_em"]

    apply_body_payload_pipeline([normal_payload, payload], page_text_width_med=100.0)

    assert payload["leading_em"] <= baseline_leading
    assert payload["prefer_typst_fit"] is True


def test_normal_body_leading_recovers_when_vertical_slack_exists() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 250.0, 145.0],
        "translated_text": "这是一个普通正文段落，内容不算拥挤，应该保持比较舒适的行距。",
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with enough words for smoothing"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=180.0)

    assert payload["leading_em"] >= 0.56


def test_underfilled_body_density_recovery_has_floor_and_safe_target() -> None:
    from services.rendering.layout.payload.body_common import payload_density

    def make_payload(height: float) -> dict:
        return {
            "inner_bbox": [10.0, 0.0, 260.0, height],
            "translated_text": "普通正文段落用于测试密度下限恢复。" * 2,
            "formula_map": [],
            "font_size_pt": 10.2,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "normal body words enough",
                "lines": [{"bbox": [10.0, index * 10.0, 260.0, index * 10.0 + 8.0]} for index in range(4)],
            },
        }

    already_ok = make_payload(50.0)
    recoverable = make_payload(55.0)
    too_tall = make_payload(140.0)

    before_ok = (already_ok["font_size_pt"], already_ok["leading_em"], payload_density(already_ok))
    before_recoverable_density = payload_density(recoverable)
    before_tall_density = payload_density(too_tall)

    apply_body_payload_pipeline([already_ok, recoverable, too_tall], page_text_width_med=220.0)

    assert before_ok[2] >= 0.60
    assert (already_ok["font_size_pt"], already_ok["leading_em"]) == before_ok[:2]
    assert before_recoverable_density < 0.60
    assert payload_density(recoverable) >= 0.60
    assert payload_density(recoverable) < 1.0
    assert before_tall_density < 0.60
    assert before_tall_density < payload_density(too_tall) < 1.0


def test_normal_body_leading_uses_more_slack_when_available() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 300.0, 220.0],
        "translated_text": "这是一个普通正文段落，页面给了很多垂直空间，所以行距应该更接近舒展的正文排版。",
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {
            "source_text": "normal body text with loose source leading",
            "lines": [
                {"bbox": [10.0, 10.0, 290.0, 22.0]},
                {"bbox": [10.0, 28.0, 290.0, 40.0]},
                {"bbox": [10.0, 46.0, 290.0, 58.0]},
            ],
            "bbox": [10.0, 10.0, 300.0, 70.0],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=180.0)

    assert 0.58 <= payload["leading_em"] <= 0.74


def test_normal_body_leading_stays_bounded_when_height_is_tight() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 145.0, 54.0],
        "translated_text": "这是一个较紧的普通正文段落，行距可以恢复但不能撑出框。" * 2,
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with constrained height"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=120.0)

    assert payload["leading_em"] < 0.62


def test_normal_body_leading_spends_available_line_space() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 230.0, 86.0],
        "translated_text": "这是一个两三行的普通正文段落，应该根据框高把行距拉开一些。",
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "normal body text with enough geometry"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=160.0)

    assert 0.58 <= payload["leading_em"] <= 0.70


def test_long_normal_body_leading_can_use_high_dynamic_cap() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 250.0, 245.0],
        "translated_text": "这是一个普通的大段正文，应该在不溢出的前提下使用更多垂直空间，而不是长期停留在保守行距。" * 8,
        "formula_map": [],
        "font_size_pt": 9.7,
        "leading_em": 0.52,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {"source_text": "long normal body text with generous paragraph box"},
    }

    apply_body_payload_pipeline([payload], page_text_width_med=180.0)

    assert 0.54 <= payload["leading_em"] <= 0.76


def test_source_line_rich_body_grows_font_before_expanding_chinese_leading() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 485.0, 223.0],
        "translated_text": "这是一个中文译文只需要六行左右的段落，但是英文原文有很多行，因此中文行距需要明显放大来匹配原始框高。" * 3,
        "formula_map": [],
        "font_size_pt": 10.3,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {
            "source_text": "source line rich paragraph",
            "bbox": [10.0, 10.0, 485.0, 223.0],
            "lines": [
                {"bbox": [10.0, 10.0 + index * 11.8, 485.0, 20.0 + index * 11.8]}
                for index in range(18)
            ],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=420.0)

    assert payload["font_size_pt"] > 10.7
    assert payload["leading_em"] <= 1.38


def test_extreme_source_line_underfill_can_expand_body_leading_after_font_growth() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 285.0, 232.0],
        "translated_text": "这是一个中文译文明显少于英文原文行数的段落，需要用更大的行距填充原始宽松版面。" * 2,
        "formula_map": [],
        "font_size_pt": 10.4,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "item": {
            "source_text": "extremely loose source line rich paragraph",
            "bbox": [10.0, 10.0, 285.0, 232.0],
            "lines": [
                {"bbox": [10.0, 10.0 + index * 13.0, 285.0, 20.0 + index * 13.0]}
                for index in range(17)
            ],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=240.0)

    assert payload["font_size_pt"] > 10.8
    assert payload["leading_em"] >= 0.9


def test_source_line_rich_body_font_growth_survives_adjacent_smoothing() -> None:
    def make_payload(y0: float, y1: float) -> dict:
        return {
            "inner_bbox": [10.0, y0, 485.0, y1],
            "translated_text": "这是一个中文译文只需要六行左右的段落，但是英文原文有很多行，因此中文行距需要明显放大来匹配原始框高。" * 3,
            "formula_map": [],
            "font_size_pt": 10.3,
            "leading_em": 0.56,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "source line rich paragraph with enough words for adjacent smoothing",
                "bbox": [10.0, y0, 485.0, y1],
                "lines": [
                    {"bbox": [10.0, y0 + index * 11.8, 485.0, y0 + 10.0 + index * 11.8]}
                    for index in range(18)
                ],
            },
        }

    first = make_payload(10.0, 223.0)
    second = make_payload(240.0, 453.0)

    apply_body_payload_pipeline([first, second], page_text_width_med=420.0)

    assert first["font_size_pt"] > 10.7
    assert second["font_size_pt"] > 10.7
    assert first["leading_em"] <= 1.38
    assert second["leading_em"] <= 1.38


def test_font_growth_pairs_with_body_leading_growth() -> None:
    payload = {
        "inner_bbox": [10.0, 10.0, 300.0, 235.0],
        "translated_text": "这是一个字号已经明显增长的正文段落，行距也需要同步增长，否则视觉上会显得字大而行距过挤。" * 3,
        "formula_map": [],
        "font_size_pt": 11.3,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "_body_font_growth_decision": {
            "seed_font_pt": 10.0,
            "target_font_pt": 11.3,
            "grew_pt": 1.3,
            "slack_ratio": 0.8,
            "reason": "underfilled_body",
        },
        "item": {
            "source_text": "body text with visible font growth and enough vertical slack",
            "bbox": [10.0, 10.0, 300.0, 235.0],
            "lines": [
                {"bbox": [10.0, 10.0 + index * 13.0, 300.0, 20.0 + index * 13.0]}
                for index in range(12)
            ],
        },
    }

    apply_body_payload_pipeline([payload], page_text_width_med=250.0)

    assert payload["font_size_pt"] >= 11.2
    assert payload["leading_em"] >= 0.58
    assert payload["leading_em"] > 0.56


def test_body_font_unify_then_leading_refit_preserves_page_font_consistency() -> None:
    def make_payload(y0: float, y1: float, font_size: float, source_lines: int) -> dict:
        return {
            "inner_bbox": [10.0, y0, 260.0, y1],
            "translated_text": "这是一个用于测试页面级字体统一和行距二次拟合的正文段落。" * 2,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for smoothing and refit",
                "bbox": [10.0, y0, 260.0, y1],
                "lines": [
                    {"bbox": [10.0, y0 + index * 12.0, 260.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    compact = make_payload(10.0, 100.0, 10.0, 5)
    loose = make_payload(120.0, 300.0, 10.6, 12)

    apply_body_payload_pipeline([compact, loose], page_text_width_med=220.0)

    assert compact["font_size_pt"] == loose["font_size_pt"]
    assert loose["leading_em"] > compact["leading_em"] + 0.2
    assert loose["leading_em"] <= 1.02


def test_page_long_body_anchors_do_not_raise_single_line_body_font() -> None:
    def make_payload(y0: float, y1: float, font_size: float, text: str, source_lines: int) -> dict:
        return {
            "inner_bbox": [10.0, y0, 280.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for page anchor policy",
                "bbox": [10.0, y0, 280.0, y1],
                "lines": [
                    {"bbox": [10.0, y0 + index * 12.0, 280.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    long_a = make_payload(10.0, 112.0, 10.8, "这是一个较长正文段落，用于稳定页面字体基准。" * 5, 8)
    long_b = make_payload(130.0, 232.0, 10.9, "这是另一个较长正文段落，用于稳定页面字体基准。" * 5, 8)
    short = make_payload(248.0, 262.0, 9.4, "短正文也应该继承页面字体。", 1)

    apply_body_payload_pipeline([long_a, long_b, short], page_text_width_med=240.0)

    assert short["font_size_pt"] == 9.4
    assert short.get("page_body_font_size_pt", 0.0) <= 9.7


def test_body_font_unify_shrinks_large_body_fonts_to_low_page_anchor() -> None:
    def make_payload(y0: float, y1: float, font_size: float, text: str, source_lines: int) -> dict:
        return {
            "inner_bbox": [45.0, y0, 385.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.56,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for page font unification",
                "bbox": [45.0, y0, 385.0, y1],
                "lines": [
                    {"bbox": [45.0, y0 + index * 12.0, 385.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    long_a = make_payload(60.0, 116.0, 11.27, "这是稳定页面字号的长正文段落。" * 4, 5)
    long_b = make_payload(150.0, 212.0, 11.19, "这是另一个稳定页面字号的长正文段落。" * 5, 6)
    compact = make_payload(490.0, 525.0, 9.67, "这是较短但仍属于正文的段落，不能在同页显著小一圈。" * 3, 3)

    apply_body_payload_pipeline([long_a, long_b, compact], page_text_width_med=340.0)

    assert compact["font_size_pt"] <= 9.86
    assert max(payload["font_size_pt"] for payload in [long_a, long_b, compact]) / compact["font_size_pt"] < 1.08
    assert long_a["font_size_pt"] <= 10.5


def test_body_font_unify_locks_page_candidates_to_single_target() -> None:
    def make_payload(y0: float, y1: float, font_size: float, text: str, source_lines: int) -> dict:
        return {
            "inner_bbox": [45.0, y0, 385.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.56,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "body text with enough words for page font unification",
                "bbox": [45.0, y0, 385.0, y1],
                "lines": [
                    {"bbox": [45.0, y0 + index * 12.0, 385.0, y0 + 10.0 + index * 12.0]}
                    for index in range(source_lines)
                ],
            },
        }

    top = make_payload(60.0, 86.0, 11.17, "这是顶部正文段落，用于模拟视觉字号偏大的短段。" * 2, 2)
    middle = make_payload(110.0, 160.0, 11.19, "这是中部正文段落，用于模拟视觉字号偏大的多行段。" * 3, 4)
    low = make_payload(190.0, 226.0, 9.57, "这是同栏正文段落，应该作为低字号统一目标。" * 2, 3)

    apply_body_payload_pipeline([top, middle, low], page_text_width_med=340.0)

    fonts = {payload["font_size_pt"] for payload in (top, middle, low)}
    assert len(fonts) == 1
    assert fonts == {9.57}


def test_collision_keeps_unified_body_font_and_only_compresses_leading() -> None:
    current = {
        "inner_bbox": [45.0, 490.0, 384.0, 525.0],
        "translated_text": "这里乘积函数是一个新的高斯函数，中心位于某处，并包含多个较长说明。" * 3,
        "formula_map": [],
        "font_size_pt": 11.17,
        "page_body_font_size_pt": 11.17,
        "leading_em": 0.72,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "adjacent_collision_risk": False,
        "item": {
            "source_text": "body text with nearby next block",
            "bbox": [45.0, 490.0, 384.0, 525.0],
            "lines": [{"bbox": [45.0, 490.0, 384.0, 502.0]}],
        },
    }
    nxt = {
        "inner_bbox": [45.0, 526.0, 384.0, 610.0],
        "translated_text": "下一段正文。",
        "formula_map": [],
        "font_size_pt": 11.17,
        "page_body_font_size_pt": 11.17,
        "leading_em": 0.72,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
        "render_kind": "markdown",
        "prefer_typst_fit": False,
        "adjacent_collision_risk": False,
        "item": {"source_text": "next body", "bbox": [45.0, 526.0, 384.0, 610.0], "lines": []},
    }

    mark_adjacent_collision_risk([current, nxt])

    assert current["font_size_pt"] == 11.17
    assert current["leading_em"] == 0.56
    assert current["prefer_typst_fit"] is False
    assert current["adjacent_collision_risk"] is False
    assert current["_body_collision_leading_only"] is True


def test_body_font_unify_includes_short_dense_body_without_typst_fit() -> None:
    def make_payload(
        y0: float,
        y1: float,
        font_size: float,
        text: str,
        *,
        dense: bool = False,
        heavy: bool = False,
        prefer_fit: bool = False,
    ) -> dict:
        return {
            "inner_bbox": [45.0, y0, 385.0, y1],
            "translated_text": text,
            "formula_map": [],
            "font_size_pt": font_size,
            "leading_em": 0.56,
            "dense_small_box": dense,
            "heavy_dense_small_box": heavy,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": prefer_fit,
            "item": {
                "source_text": "body text",
                "bbox": [45.0, y0, 385.0, y1],
                "lines": [{"bbox": [45.0, y0, 385.0, y0 + 10.0]}],
            },
        }

    anchor_a = make_payload(60.0, 112.0, 11.17, "这是稳定页面字号的长正文段落。" * 4)
    anchor_b = make_payload(132.0, 190.0, 11.17, "这是另一个稳定页面字号的长正文段落。" * 4)
    short_dense = make_payload(
        210.0,
        223.0,
        10.2,
        "这里，变量 r 是从高斯球原点起测量的。",
        dense=True,
        heavy=True,
        prefer_fit=True,
    )

    apply_body_payload_pipeline([anchor_a, anchor_b, short_dense], page_text_width_med=340.0)

    assert short_dense["font_size_pt"] == anchor_a["font_size_pt"] == anchor_b["font_size_pt"]
    assert short_dense["prefer_typst_fit"] is False
    assert short_dense["_body_font_unified"] is True


def test_caption_and_footnote_fonts_use_low_role_anchor() -> None:
    from services.rendering.layout.payload.annotation_font_policy import unify_annotation_fonts

    caption_a = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 9.7,
    }
    caption_b = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 8.9,
    }
    footnote_a = {
        "item": {"layout_role": "footnote", "semantic_role": "footnote"},
        "render_kind": "markdown",
        "font_size_pt": 8.7,
    }
    footnote_b = {
        "item": {"layout_role": "footnote", "semantic_role": "footnote"},
        "render_kind": "markdown",
        "font_size_pt": 7.8,
    }

    unify_annotation_fonts([caption_a, caption_b, footnote_a, footnote_b])

    assert caption_a["font_size_pt"] == 8.96
    assert caption_b["font_size_pt"] == 8.96
    assert footnote_a["font_size_pt"] == 7.84
    assert footnote_b["font_size_pt"] == 7.8
    assert footnote_a["font_size_pt"] < caption_a["font_size_pt"]


def test_role_font_unify_ignores_extreme_small_font_outlier() -> None:
    from services.rendering.layout.payload.annotation_font_policy import unify_annotation_fonts

    tiny = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 5.2,
    }
    normal_a = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 9.1,
    }
    normal_b = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "render_kind": "markdown",
        "font_size_pt": 9.4,
    }

    unify_annotation_fonts([tiny, normal_a, normal_b])

    assert normal_a["font_size_pt"] >= 9.1
    assert normal_b["font_size_pt"] >= 9.1


def test_caption_and_footnote_density_recovery_uses_same_floor_rule() -> None:
    from services.rendering.layout.payload.annotation_font_policy import recover_underfilled_annotation_density
    from services.rendering.layout.payload.body_common import payload_density

    def make_payload(role: str, height: float) -> dict:
        return {
            "item": {"layout_role": role, "semantic_role": role},
            "inner_bbox": [10.0, 0.0, 220.0, height],
            "translated_text": "注释文字用于测试密度恢复。" * 2,
            "formula_map": [],
            "render_kind": "markdown",
            "font_size_pt": 8.4 if role == "caption" else 7.4,
            "leading_em": 0.46,
        }

    caption_ok = make_payload("caption", 20.0)
    caption_low = make_payload("caption", 48.0)
    footnote_low = make_payload("footnote", 46.0)

    before_caption_ok = (caption_ok["font_size_pt"], caption_ok["leading_em"], payload_density(caption_ok))
    before_caption_low = payload_density(caption_low)
    before_footnote_low = payload_density(footnote_low)

    recover_underfilled_annotation_density([caption_ok, caption_low, footnote_low])

    assert before_caption_ok[2] >= 0.60
    assert (caption_ok["font_size_pt"], caption_ok["leading_em"]) == before_caption_ok[:2]
    assert before_caption_low < 0.60
    assert before_caption_low < payload_density(caption_low) < 1.0
    assert before_footnote_low < 0.60
    assert before_footnote_low < payload_density(footnote_low) < 1.0
    assert footnote_low["font_size_pt"] - 7.4 <= caption_low["font_size_pt"] - 8.4


def test_caption_and_footnote_recovery_do_not_exceed_body_font_reference() -> None:
    from services.rendering.layout.payload.annotation_font_policy import recover_underfilled_annotation_density

    body = {
        "item": {"layout_role": "paragraph", "semantic_role": "body"},
        "inner_bbox": [10.0, 0.0, 220.0, 30.0],
        "translated_text": "正文。",
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 9.0,
        "leading_em": 0.56,
        "dense_small_box": False,
        "heavy_dense_small_box": False,
        "is_body": True,
    }
    caption = {
        "item": {"layout_role": "caption", "semantic_role": "caption"},
        "inner_bbox": [10.0, 40.0, 220.0, 100.0],
        "translated_text": "图题文字用于测试字号不能超过正文。" * 2,
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 8.8,
        "leading_em": 0.46,
    }
    footnote = {
        "item": {"layout_role": "footnote", "semantic_role": "footnote"},
        "inner_bbox": [10.0, 110.0, 220.0, 170.0],
        "translated_text": "脚注文字用于测试字号低于正文。" * 2,
        "formula_map": [],
        "render_kind": "markdown",
        "font_size_pt": 8.2,
        "leading_em": 0.44,
    }

    recover_underfilled_annotation_density([body, caption, footnote])

    assert caption["font_size_pt"] <= round(body["font_size_pt"] * 0.95, 2)
    assert footnote["font_size_pt"] <= round(body["font_size_pt"] * 0.82, 2)


def test_page_leading_baseline_only_weakly_dampens_normal_body_leading_jumps() -> None:
    def make_payload(height: float, source_lines: int) -> dict:
        return {
            "inner_bbox": [10.0, 0.0, 260.0, height],
            "translated_text": "普通正文段落用于测试页面行距基准。" * 2,
            "formula_map": [],
            "font_size_pt": 10.2,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "normal body words enough",
                "lines": [
                    {"bbox": [10.0, index * 10.0, 260.0, index * 10.0 + 8.0]}
                    for index in range(source_lines)
                ],
            },
        }

    compact = make_payload(90.0, 4)
    loose = make_payload(180.0, 7)

    apply_body_payload_pipeline([compact, loose], page_text_width_med=220.0)

    assert loose["leading_em"] >= compact["leading_em"]
    assert loose["leading_em"] - compact["leading_em"] <= 0.32


def test_loose_source_pitch_can_override_page_leading_baseline() -> None:
    def make_payload(height: float, source_lines: int, pitch: float) -> dict:
        return {
            "inner_bbox": [10.0, 0.0, 260.0, height],
            "translated_text": "普通正文段落用于测试很宽松英文原文对应的动态行距。" * 2,
            "formula_map": [],
            "font_size_pt": 10.2,
            "leading_em": 0.54,
            "dense_small_box": False,
            "heavy_dense_small_box": False,
            "is_body": True,
            "render_kind": "markdown",
            "prefer_typst_fit": False,
            "item": {
                "source_text": "normal body words enough",
                "lines": [
                    {"bbox": [10.0, index * pitch, 260.0, index * pitch + 8.0]}
                    for index in range(source_lines)
                ],
            },
        }

    compact = make_payload(90.0, 4, 10.0)
    loose = make_payload(210.0, 11, 18.0)

    apply_body_payload_pipeline([compact, loose], page_text_width_med=220.0)

    assert loose["leading_em"] >= compact["leading_em"] + 0.20
    assert loose["leading_em"] <= 1.02


def test_build_render_page_specs_restores_leaked_formula_tokens_before_render() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p003-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 90.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "However ...",
                    "protected_source_text": "However <f1-9a9/> orbitals",
                    "translation_unit_protected_translated_text": "然而，研究表明这些传统方法不适用于表征具有局域电子态的半导体<f1-9a9/>或<f2-797/>轨道）。",
                    "translation_unit_protected_map": [
                        {
                            "token_tag": "<f1-9a9/>",
                            "token_type": "formula",
                            "original_text": r"^ { \cdot } d",
                            "restore_text": r"^ { \cdot } d",
                            "source_offset": 0,
                            "checksum": "9a9",
                        },
                        {
                            "token_tag": "<f2-797/>",
                            "token_type": "formula",
                            "original_text": "f",
                            "restore_text": "f",
                            "source_offset": 0,
                            "checksum": "797",
                        },
                    ],
                    "translation_unit_formula_map": [
                        {"placeholder": "<f1-9a9/>", "formula_text": r"^ { \cdot } d"},
                        {"placeholder": "<f2-797/>", "formula_text": "f"},
                    ],
                }
            ]
        }

        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        block = page_specs[0].blocks[0]
        assert "<f1-9a9/>" not in block.content_text
        assert "<f2-797/>" not in block.content_text
        assert "$" in block.content_text


def test_build_render_page_specs_marks_adjacent_collision_risk_for_stacked_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 60.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "short text",
                    "protected_source_text": "short text",
                    "protected_translated_text": "这是一段明显会在翻译后变长很多很多很多的中文正文，用来模拟上方文本块在渲染时向下扩张。",
                },
                {
                    "item_id": "p001-b002",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 61.5, 180.0, 95.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "below text",
                    "protected_source_text": "below text",
                    "protected_translated_text": "下方块",
                },
            ]
        }

        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        upper, lower = page_specs[0].blocks
        assert upper.block_id == "item-p001-b001"
        assert lower.block_id == "item-p001-b002"
        assert upper.fit_to_box is True
        expected_limit = lower.content_rect[1] - upper.content_rect[1] - 0.9
        assert upper.fit_max_height_pt <= expected_limit + 0.2


def test_build_render_page_specs_uses_cover_bbox_gap_for_tight_stacked_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"

        doc = fitz.open()
        doc.new_page(width=240, height=320)
        doc.save(source_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [20.0, 40.0, 210.0, 110.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "upper",
                    "protected_source_text": "upper",
                    "protected_translated_text": (
                        "这是一段会在渲染时变得明显更长的中文正文，用来模拟上方块在原始 OCR 框已经"
                        "贴到下方块时，仍然需要继续压缩高度避免覆盖下一块。"
                    ),
                },
                {
                    "item_id": "p001-b002",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [20.0, 109.7, 210.0, 152.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "lower",
                    "protected_source_text": "lower",
                    "protected_translated_text": "下方块",
                },
            ]
        }

        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        upper, lower = page_specs[0].blocks
        upper_height = upper.content_rect[3] - upper.content_rect[1]
    assert upper.fit_to_box is True
    assert upper.skip_reason == "adjacent_collision_risk"
    assert upper.fit_max_height_pt < upper_height
    assert upper.fit_max_height_pt >= upper_height - 8.0
    assert lower.content_rect[1] == 109.7


def test_build_render_blocks_uses_vertical_fit_for_tight_stacked_overlay_blocks() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [20.0, 40.0, 210.0, 110.0],
            "lines": [{"text": "raw"}],
            "source_text": "upper",
            "protected_source_text": "upper",
            "protected_translated_text": (
                "这是一段会在渲染时变得明显更长的中文正文，用来模拟上方块在原始 OCR 框已经"
                "贴到下方块时，仍然需要继续压缩高度避免覆盖下一块。"
            ),
        },
        {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "bbox": [20.0, 109.7, 210.0, 152.0],
            "lines": [{"text": "raw"}],
            "source_text": "lower",
            "protected_source_text": "lower",
            "protected_translated_text": "下方块",
        },
    ]

    blocks = build_render_blocks(items, page_width=240.0, page_height=320.0)

    upper, lower = blocks
    expected_limit = lower.inner_bbox[1] - upper.inner_bbox[1] - 0.9
    assert upper.fit_to_box is True
    assert upper.fit_max_height_pt <= expected_limit
    assert upper.fit_min_font_size_pt <= upper.font_size_pt
    assert upper.fit_min_leading_em <= upper.leading_em


def test_build_render_blocks_binary_fits_long_translated_title_to_box() -> None:
    items = [
        {
            "item_id": "p001-title",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "title",
            "structure_role": "title",
            "bbox": [20.0, 22.0, 180.0, 50.0],
            "lines": [{"text": "A Long Title"}],
            "source_text": "A Long Title",
            "protected_source_text": "A Long Title",
            "protected_translated_text": "这是一个非常长的中文标题需要在很窄的标题框里面自动缩小并且完整显示",
        }
    ]

    blocks = build_render_blocks(items, page_width=200.0, page_height=300.0)

    title = blocks[0]
    assert title.font_weight == "bold"
    assert title.fit_to_box is True
    assert title.fit_single_line is False
    assert title.font_size_pt < 12.0
    assert title.leading_em >= 0.34
    assert title.fit_min_font_size_pt < title.font_size_pt
    assert title.fit_target_width_pt == 160.0
    assert title.fit_target_height_pt == 28.0


def test_build_render_blocks_insets_tight_body_vertical_gap() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [20.0, 40.0, 220.0, 92.0],
            "lines": [{"text": "raw"}],
            "source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_translated_text": "这是一段正文内容，用于确认 OCR 框上下贴得很近时可以获得一点有效高度余量。",
        },
        {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [20.0, 92.8, 220.0, 145.0],
            "lines": [{"text": "raw"}],
            "source_text": "This second body paragraph is in the same column and follows very closely.",
            "protected_source_text": "This second body paragraph is in the same column and follows very closely.",
            "protected_translated_text": "这是同一栏的下一段正文，用来给上一段提供安全边界。",
        },
    ]

    blocks = build_render_blocks(items, page_width=260.0, page_height=320.0)

    upper, lower = blocks
    assert upper.inner_bbox[1] > 40.0
    assert upper.inner_bbox[3] < 92.0
    assert (92.0 - 40.0) - (upper.inner_bbox[3] - upper.inner_bbox[1]) <= (92.0 - 40.0) * 0.03
    assert upper.cover_bbox[0] < 20.0
    assert upper.cover_bbox[1] < 40.0
    assert upper.cover_bbox[2] > 220.0
    assert upper.cover_bbox[3] > 92.0


def test_build_render_blocks_expands_short_body_region_up_and_right_only() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [30.0, 40.0, 230.0, 92.0],
            "lines": [{"text": "raw"}],
            "source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_translated_text": "这是第一段正文，用于建立同一区域的宽正文参照。",
        },
        {
            "item_id": "p001-b002",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [31.0, 106.0, 231.0, 158.0],
            "lines": [{"text": "raw"}],
            "source_text": "This second body paragraph has enough source text to be treated as body text.",
            "protected_source_text": "This second body paragraph has enough source text to be treated as body text.",
            "protected_translated_text": "这是第二段正文，用于确认同列正文区域的宽度和位置。",
        },
        {
            "item_id": "p001-b003",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [34.0, 172.0, 144.0, 192.0],
            "lines": [{"text": "raw"}],
            "source_text": "Short but body-like text that belongs to the same paragraph region.",
            "protected_source_text": "Short but body-like text that belongs to the same paragraph region.",
            "protected_translated_text": "这是较短的第三段正文，翻译后需要更多宽度避免异常换行。",
        },
    ]

    blocks = build_render_blocks(items, page_width=260.0, page_height=320.0)

    short = blocks[2]
    assert short.inner_bbox[1] < 172.0
    assert short.inner_bbox[3] <= 192.0
    assert short.inner_bbox[2] > 144.0
    assert short.inner_bbox[2] <= 177.0


def test_build_render_blocks_expands_title_width_toward_body_column() -> None:
    items = [
        {
            "item_id": "p001-title",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "heading",
            "structure_role": "heading",
            "bbox": [24.0, 24.0, 150.0, 48.0],
            "lines": [{"text": "Related work"}],
            "source_text": "Related work",
            "protected_source_text": "Related work",
            "protected_translated_text": "相关工作和方法",
        },
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [22.0, 60.0, 224.0, 128.0],
            "lines": [{"text": "raw"}],
            "source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_translated_text": "这是标题下方的正文段落，用于给标题提供同栏宽度参考。",
        },
    ]

    blocks = build_render_blocks(items, page_width=260.0, page_height=320.0)

    title = blocks[0]
    assert title.inner_bbox[2] > 150.0
    assert title.fit_target_width_pt == title.inner_bbox[2] - title.inner_bbox[0]
    assert title.cover_bbox == [23.0, 23.0, 151.0, 49.0]


def test_build_render_blocks_expands_body_cover_bbox_slightly() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [20.0, 40.0, 220.0, 140.0],
            "lines": [{"text": "raw"}],
            "source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_source_text": "This body paragraph has enough source text to be treated as body text.",
            "protected_translated_text": "这是一段正文内容，用于确认背景遮盖区域会轻微扩张以防止原文边缘漏出。",
        },
    ]

    blocks = build_render_blocks(items, page_width=260.0, page_height=320.0)

    cover = blocks[0].cover_bbox
    assert cover[0] < 20.0
    assert cover[1] < 40.0
    assert cover[2] > 220.0
    assert cover[3] > 140.0
    assert cover[0] >= 17.0
    assert cover[3] <= 143.0


def test_build_render_blocks_uses_conservative_cover_y_near_inline_formula() -> None:
    items = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "bbox": [20.0, 40.0, 220.0, 140.0],
            "lines": [{"text": "raw"}],
            "source_text": r"This paragraph contains $\frac{a}{b}$ inline math.",
            "protected_source_text": r"This paragraph contains $\frac{a}{b}$ inline math.",
            "protected_translated_text": r"这段正文包含 $\\frac{a}{b}$ 行内公式。",
        },
    ]

    blocks = build_render_blocks(items, page_width=260.0, page_height=320.0)

    cover = blocks[0].cover_bbox
    assert 39.5 < cover[1] < 40.0
    assert 140.0 < cover[3] < 140.5
    assert cover[0] < 20.0
    assert cover[2] > 220.0


def test_typst_overlay_source_uses_title_single_line_fit_when_title_fits_one_line() -> None:
    source = build_typst_overlay_source(
        200.0,
        300.0,
        [
            {
                "item_id": "p001-title",
                "page_idx": 0,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "title",
                "structure_role": "title",
                "bbox": [20.0, 22.0, 180.0, 58.0],
                "lines": [{"text": "Intro"}],
                "source_text": "Intro",
                "protected_source_text": "Intro",
                "protected_translated_text": "引言",
            }
        ],
    )

    assert "pdftr_fit_single_line_markdown" in source
    assert 'weight: "bold"' in source
    assert "fit_width: 160.0pt" in source
    assert "fit_height: 36.0pt" in source


def test_background_render_resilient_compile_sanitizes_on_failure() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        background_pdf = root / "background.pdf"

        doc = fitz.open()
        doc.new_page(width=200, height=300)
        doc.save(source_pdf)
        doc.save(background_pdf)
        doc.close()

        translated_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 80.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "raw text",
                    "protected_source_text": "raw text",
                    "protected_translated_text": "translated text",
                }
            ]
        }
        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf,
            translated_pages=translated_pages,
        )

        sanitized_pages = {
            0: [
                {
                    "item_id": "p001-b001",
                    "page_idx": 0,
                    "block_type": "text",
                    "bbox": [10.0, 20.0, 180.0, 80.0],
                    "lines": [{"text": "raw"}],
                    "source_text": "raw text",
                    "protected_source_text": "raw text",
                    "protected_translated_text": "sanitized text",
                }
            ]
        }

        with mock.patch(
            "services.rendering.output.typst.book_renderer.compile_typst_render_pages_pdf",
            side_effect=[RuntimeError("mitex failed"), root / "sanitized.pdf"],
        ) as compile_mock, mock.patch(
            "services.rendering.output.typst.book_renderer.collect_background_page_specs",
            return_value=[(0, 200.0, 300.0, translated_pages[0])],
        ), mock.patch(
            "services.rendering.output.typst.book_renderer.sanitize_page_specs_for_typst_book_background",
            return_value=[(0, 200.0, 300.0, sanitized_pages[0])],
        ):
            result = _compile_render_pages_pdf_resilient(
                source_pdf_path=source_pdf,
                background_pdf_path=background_pdf,
                translated_pages=translated_pages,
                page_specs=page_specs,
                work_dir=root,
            )

        assert result == root / "sanitized.pdf"
        assert compile_mock.call_count == 2
        assert compile_mock.call_args_list[1].kwargs["stem"] == "book-background-overlay-sanitized"


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


def test_continuation_group_member_prefers_unit_translation_for_rendering() -> None:
    from services.rendering.layout.payload.render_item import render_protected_translation_text

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

    assert render_protected_translation_text(item).startswith("激发谱的每个模式")


def test_prepare_render_payloads_splits_single_kind_continuation_group_members() -> None:
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

    assert first
    assert second
    assert first != second
    assert first + second != first
    assert "激发谱的每个模式" in first
    assert not second.startswith("$来表征")


def test_final_pdf_compression_skips_when_source_already_compressed() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        context = RenderExecutionContext(
            output_pdf_path=Path(tmp) / "out.pdf",
            start_page=0,
            end_page=0,
            source_image_compressed=True,
        )

        with mock.patch("services.rendering.workflow.modes.compress_pdf_images_only") as compress_mock:
            compressed = _compress_final_pdf_if_needed(context, mode="overlay")

    assert compressed is False
    compress_mock.assert_not_called()


def test_final_pdf_compression_runs_when_source_not_compressed() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        context = RenderExecutionContext(
            output_pdf_path=Path(tmp) / "out.pdf",
            start_page=0,
            end_page=0,
            source_image_compressed=False,
        )

        with mock.patch("services.rendering.workflow.modes.compress_pdf_images_only", return_value=True) as compress_mock:
            compressed = _compress_final_pdf_if_needed(context, mode="overlay")

    assert compressed is True
    compress_mock.assert_called_once_with(context.output_pdf_path, dpi=context.pdf_compress_dpi)


def test_bbox_text_strip_removes_text_inside_bbox_without_redaction_bloat() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "inside text", fontsize=12)
        page.insert_text((20, 140), "outside text", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 140.0, 55.0],
                        "protected_translated_text": "译文",
                    }
                ]
            },
        )

        assert result.changed is True
        assert result.text_show_ops_removed >= 1

        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "inside text" not in text
        assert "outside text" in text


def test_bbox_text_strip_accepts_untranslated_template_source_text() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=200, height=200)
        page.insert_text((20, 40), "inside source", fontsize=12)
        page.insert_text((20, 140), "outside source", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [10.0, 20.0, 140.0, 55.0],
                        "protected_source_text": "inside source",
                        "protected_translated_text": "",
                    }
                ]
            },
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "inside source" not in text
        assert "outside source" in text


def test_bbox_text_strip_skips_formula_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "body text", fontsize=12)
        page.insert_text((80, 90), "I/I0 = A1 + A2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "bbox": [20.0, 30.0, 130.0, 65.0],
                        "protected_translated_text": "正文",
                    },
                    {
                        "block_kind": "formula",
                        "bbox": [70.0, 70.0, 190.0, 105.0],
                        "protected_translated_text": "",
                    },
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False
        assert result.skipped_complex_page_indices == frozenset({0})


def test_redact_restore_formula_uses_pikepdf_text_strip_for_all_rendered_blocks() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "redact-restore.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "body text", fontsize=12)
        page.insert_text((80, 90), "I/I0 = A1 + A2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_redact_restore_formula_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "block_type": "text",
                        "bbox": [20.0, 30.0, 150.0, 65.0],
                        "protected_translated_text": "正文",
                    },
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [70.0, 70.0, 200.0, 105.0],
                        "protected_translated_text": "",
                    },
                ]
            },
        )

        assert result.changed is True
        assert result.redaction_rects == 1
        assert result.formula_rects_restored == 0
        restored = fitz.open(output_pdf)
        try:
            text = restored[0].get_text()
        finally:
            restored.close()
        assert "body text" not in text
        assert "I/I0 = A1 + A2" in text


def test_strip_bbox_text_rects_from_pdf_copy_removes_text_without_translated_pages() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=240, height=180)
        page.insert_text((30, 50), "remove me", fontsize=12)
        page.insert_text((30, 100), "keep me", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects={0: [fitz.Rect(20.0, 115.0, 120.0, 150.0)]},
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "remove me" not in text
        assert "keep me" in text

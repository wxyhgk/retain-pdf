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


from services.rendering.background.stage import build_clean_background_pdf
from foundation.config import fonts
from services.rendering.core.models import RenderLayoutBlock
from services.rendering.core.models import RenderPageSpec
from services.rendering.layout.render_model import build_render_page_specs
from services.rendering.layout.payload.continuation_split import split_protected_text_for_boxes
from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page
from services.rendering.redaction.shared import get_item_translated_text
from services.rendering.redaction.text_draw import _build_direct_draw_tokens
from services.rendering.redaction.text_draw import _fit_segment_layout
from services.rendering.layout.payload.suspicious_ocr import detect_and_drop_suspicious_ocr_glued_blocks
from services.rendering.typst.book_ops import _compile_render_pages_pdf_resilient
from services.rendering.typst.compiler import _resolved_font_paths
from services.rendering.typst.compiler import _resolved_common_root
from services.rendering.typst.compiler import TypstCompileError
from services.rendering.typst.compiler import compile_typst_book_background_pdf
from services.rendering.typst.compiler import compile_typst_overlay_pdf
from services.rendering.typst.compiler import compile_typst_render_pages_pdf
from services.rendering.typst.emitter import build_typst_source_from_page_specs
from services.rendering.typst.page_ops import apply_source_page_overlay
from services.rendering.typst.sanitize import sanitize_items_for_typst_compile


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
        with mock.patch("services.rendering.typst.compiler.subprocess.run", return_value=completed):
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

        with mock.patch("services.rendering.typst.compiler.subprocess.run", return_value=completed) as run_mock:
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

        with mock.patch("services.rendering.typst.compiler.subprocess.run", return_value=completed) as run_mock:
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
    with mock.patch("services.rendering.typst.sanitize.compile_typst_overlay_pdf", side_effect=_fake_compile), mock.patch(
        "services.rendering.typst.sanitize_steps.compile_typst_overlay_pdf",
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
            "services.rendering.background.stage.collect_vector_text_rects",
            return_value=[fitz.Rect(10, 20, 80, 60)],
        ), mock.patch(
            "services.rendering.background.stage.redact_translated_text_areas",
        ) as redact_mock, mock.patch(
            "services.rendering.background.stage.save_optimized_pdf",
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
        "services.rendering.typst.page_ops.collect_vector_text_rects",
        return_value=[fitz.Rect(10, 20, 80, 60)],
    ), mock.patch(
        "services.rendering.typst.page_ops.redact_translated_text_areas",
    ) as redact_mock, mock.patch(
        "services.rendering.typst.page_ops.strip_page_links",
    ):
        apply_source_page_overlay(page, translated_items)

    redact_mock.assert_called_once()
    assert redact_mock.call_args.kwargs["cover_only"] is True


def test_redaction_shared_prefers_local_translated_text_over_group_text() -> None:
    item = {
        "translated_text": "当前框自己的文本",
        "translation_unit_translated_text": "整组很长的翻译文本，不应优先灌入单个 bbox",
        "group_translated_text": "另一份组级文本",
    }

    assert get_item_translated_text(item) == "当前框自己的文本"


def test_apply_source_page_overlay_redacts_text_on_image_page() -> None:
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
        apply_source_page_overlay(page, translated_items)
        after = page.get_text("text")

        assert "Intermolecular Heck Coupling" in before
        assert "Intermolecular Heck Coupling" not in after
        doc.close()


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
        assert block.background_rect == [10.0, 20.0, 180.0, 80.0]
        assert 8.4 <= block.font_size_pt <= 11.6
        assert 0.28 <= block.leading_em <= 0.74


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
        assert upper.fit_max_height_pt <= upper_height - 10.0
        assert lower.content_rect[1] >= 120.0


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
            "services.rendering.typst.book_ops.compile_typst_render_pages_pdf",
            side_effect=[RuntimeError("mitex failed"), root / "sanitized.pdf"],
        ) as compile_mock, mock.patch(
            "services.rendering.typst.book_ops.collect_background_page_specs",
            return_value=[(0, 200.0, 300.0, translated_pages[0])],
        ), mock.patch(
            "services.rendering.typst.book_ops.sanitize_page_specs_for_typst_book_background",
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

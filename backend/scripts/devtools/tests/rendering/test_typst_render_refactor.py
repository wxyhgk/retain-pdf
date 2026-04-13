import sys
import tempfile
from pathlib import Path
from unittest import mock
import re

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.background.stage import build_clean_background_pdf
from foundation.config import fonts
from services.rendering.core.models import RenderLayoutBlock
from services.rendering.core.models import RenderPageSpec
from services.rendering.layout.render_model import build_render_page_specs
from services.rendering.typst.book_ops import _compile_render_pages_pdf_resilient
from services.rendering.typst.compiler import _resolved_font_paths
from services.rendering.typst.emitter import build_typst_source_from_page_specs


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

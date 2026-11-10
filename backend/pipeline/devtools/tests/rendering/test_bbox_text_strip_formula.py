"""bbox 文字剥离遇到公式时的保护：公式守卫、公式页跳过、redact-restore 包装、公式区像素。

从 test_bbox_text_strip_document.py 整块拆出，用例本身未改。
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import fitz

from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import RectIndex
from retainpdf_pipeline.render.source_cleanup.pdf.hit_test import is_protected_text_op
from retainpdf_pipeline.render.source_cleanup import build_bbox_text_stripped_pdf_copy
from devtools.tests.pdf_fixtures import write_pdf


def test_bbox_text_strip_formula_guard_edge_touch_does_not_protect_whole_text_op() -> None:
    protected_index = RectIndex.build([fitz.Rect(68.5, 667.0, 249.0, 681.0)])

    assert not is_protected_text_op(
        user_point=(72.02, 684.22),
        text_rect=(72.02, 680.73, 136.76, 694.68),
        protected_index=protected_index,
    )


def test_bbox_text_strip_formula_guard_protects_substantial_text_overlap() -> None:
    protected_index = RectIndex.build([fitz.Rect(68.5, 667.0, 249.0, 681.0)])

    assert is_protected_text_op(
        user_point=(72.02, 676.0),
        text_rect=(72.02, 672.0, 136.76, 686.0),
        protected_index=protected_index,
    )


def test_bbox_text_strip_preserves_textual_formula_without_overlay_and_keeps_math_formula() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=260, height=180)
        page.insert_text((30, 50), "f = lateral friction for design speed", fontsize=12)
        page.insert_text((30, 90), "E = mc2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [20.0, 30.0, 230.0, 65.0],
                        "source_text": r"$$ \mathrm{f=lateral friction for design speed} $$",
                    },
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [20.0, 70.0, 130.0, 105.0],
                        "source_text": r"$$ E=mc^2 $$",
                    },
                ]
            },
        )

        assert result.changed is False
        assert output_pdf.exists() is False


def test_bbox_text_strip_removes_textual_formula_when_overlay_exists() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        write_pdf(source_pdf, width=260, height=180, text="f = lateral friction for design speed", at=(30, 50), fontsize=12)

        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "bbox": [20.0, 30.0, 230.0, 65.0],
                        "source_text": r"$$ \mathrm{f=lateral friction for design speed} $$",
                        "protected_translated_text": "f = 设计速度对应的侧向摩擦系数",
                    },
                ]
            },
        )

        assert result.changed is True
        stripped = fitz.open(output_pdf)
        try:
            text = stripped[0].get_text()
        finally:
            stripped.close()
        assert "lateral friction" not in text


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
            skip_formula_pages=True,
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


def test_bbox_text_strip_preserves_formula_zone_pixels() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        source_pdf = root / "source.pdf"
        output_pdf = root / "stripped.pdf"
        doc = fitz.open()
        page = doc.new_page(width=300, height=300)
        page.insert_text((30, 50), "remove me", fontsize=12)
        page.insert_text((30, 150), "E = mc2", fontsize=12)
        doc.save(source_pdf)
        doc.close()

        formula_bbox = [20.0, 130.0, 180.0, 170.0]
        result = build_bbox_text_stripped_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            translated_pages={
                0: [
                    {
                        "block_kind": "text",
                        "block_type": "text",
                        "bbox": [20.0, 30.0, 180.0, 70.0],
                        "protected_translated_text": "译文",
                    },
                    {
                        "block_kind": "formula",
                        "block_type": "formula",
                        "normalized_sub_type": "display_formula",
                        "bbox": formula_bbox,
                    },
                ]
            },
        )

        assert result.changed is True
        source_doc = fitz.open(source_pdf)
        stripped_doc = fitz.open(output_pdf)
        try:
            assert "remove me" not in stripped_doc[0].get_text()
            assert "mc2" in stripped_doc[0].get_text()
            zone = fitz.Rect(formula_bbox)
            before = source_doc[0].get_pixmap(clip=zone, matrix=fitz.Matrix(2, 2))
            after = stripped_doc[0].get_pixmap(clip=zone, matrix=fitz.Matrix(2, 2))
            assert (before.width, before.height) == (after.width, after.height)
            assert bytes(before.samples) == bytes(after.samples)
        finally:
            source_doc.close()
            stripped_doc.close()

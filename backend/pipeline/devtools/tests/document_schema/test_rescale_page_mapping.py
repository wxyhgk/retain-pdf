"""缩放到 PDF 时按位置配页：对不上的情况要报出来，不能静默留在原始坐标里。"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema.pdf_geometry import rescale_document_geometry_to_pdf


def _pdf(tmp_path: Path, pages: int) -> Path:
    path = tmp_path / "source.pdf"
    with fitz.open() as pdf:
        for _ in range(pages):
            pdf.new_page(width=600, height=800)
        pdf.save(path)
    return path


def _page(width: float, height: float, *, with_block: bool = True) -> dict:
    blocks = [{"bbox": [10, 10, 110, 30], "lines": [], "segments": []}] if with_block else []
    return {"width": width, "height": height, "unit": "pt", "blocks": blocks}


def test_more_ocr_pages_than_the_pdf_is_an_error(tmp_path):
    document = {"pages": [_page(1200, 1600), _page(1200, 1600), _page(1200, 1600)]}
    with pytest.raises(RuntimeError, match="3 pages but the source PDF has 2"):
        rescale_document_geometry_to_pdf(document, _pdf(tmp_path, 2))


def test_fewer_ocr_pages_are_scaled_by_position_and_recorded(tmp_path):
    document = {"pages": [_page(1200, 1600)]}
    rescale_document_geometry_to_pdf(document, _pdf(tmp_path, 3))
    assert document["pages"][0]["blocks"][0]["bbox"] == [5.0, 5.0, 55.0, 15.0]
    assert document["derived"]["page_count_mismatch"] == {"ocr_pages": 1, "pdf_pages": 3}


def test_a_page_without_size_but_with_blocks_is_an_error(tmp_path):
    document = {"pages": [_page(0, 0)]}
    with pytest.raises(RuntimeError, match="page 1 has no usable size"):
        rescale_document_geometry_to_pdf(document, _pdf(tmp_path, 1))


def test_an_empty_page_without_size_takes_the_pdf_size(tmp_path):
    document = {"pages": [_page(0, 0, with_block=False)]}
    rescale_document_geometry_to_pdf(document, _pdf(tmp_path, 1))
    assert (document["pages"][0]["width"], document["pages"][0]["height"]) == (600.0, 800.0)

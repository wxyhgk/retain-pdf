import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.render.tools.side_by_side_pdf import build_side_by_side_pdf


def _write_pdf(path: Path, page_sizes: list[tuple[int, int]], label: str) -> None:
    doc = fitz.open()
    for index, (width, height) in enumerate(page_sizes):
        page = doc.new_page(width=width, height=height)
        page.insert_text((24, 36), f"{label} {index + 1}")
    doc.save(path)
    doc.close()


def test_build_side_by_side_pdf_places_source_and_translation_pages(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    translated_pdf = tmp_path / "translated.pdf"
    output_pdf = tmp_path / "side-by-side.pdf"
    _write_pdf(source_pdf, [(200, 300), (200, 300)], "source")
    _write_pdf(translated_pdf, [(250, 320)], "translated")

    build_side_by_side_pdf(source_pdf, translated_pdf, output_pdf)

    with fitz.open(output_pdf) as doc:
        assert doc.page_count == 2
        assert round(doc[0].rect.width) == 450
        assert round(doc[0].rect.height) == 320
        assert round(doc[1].rect.width) == 400
        assert round(doc[1].rect.height) == 300
        assert "source 1" in doc[0].get_text()
        assert "translated 1" in doc[0].get_text()
        assert "source 2" in doc[1].get_text()

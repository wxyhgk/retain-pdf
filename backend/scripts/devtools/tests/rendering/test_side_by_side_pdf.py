import sys
from pathlib import Path

import fitz
from PIL import Image
from PIL import ImageChops


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.rendering.tools.side_by_side_pdf import build_side_by_side_pdf


def _write_pdf(path: Path, page_sizes: list[tuple[int, int]], label: str) -> None:
    doc = fitz.open()
    for index, (width, height) in enumerate(page_sizes):
        page = doc.new_page(width=width, height=height)
        page.insert_text((24, 36), f"{label} {index + 1}")
    doc.save(path)
    doc.close()


def _write_marker_pdf(
    path: Path,
    *,
    width: int,
    height: int,
    rotation: int,
    colors: list[tuple[float, float, float]],
) -> None:
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    page.draw_rect(fitz.Rect(20, 20, 60, 60), color=colors[0], fill=colors[0])
    page.draw_rect(fitz.Rect(140, 20, 180, 60), color=colors[1], fill=colors[1])
    page.draw_rect(fitz.Rect(20, 240, 60, 280), color=colors[2], fill=colors[2])
    page.draw_rect(fitz.Rect(140, 240, 180, 280), color=colors[3], fill=colors[3])
    page.draw_rect(fitz.Rect(80, 120, 120, 160), color=(0, 0, 0), fill=(0, 0, 0))
    page.set_rotation(rotation)
    doc.save(path)
    doc.close()


def _render_page_image(path: Path, *, page_index: int = 0) -> Image.Image:
    with fitz.open(path) as doc:
        pix = doc[page_index].get_pixmap(alpha=False)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


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


def test_build_side_by_side_pdf_preserves_rotated_page_appearance(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source-rotated.pdf"
    translated_pdf = tmp_path / "translated-rotated.pdf"
    output_pdf = tmp_path / "side-by-side-rotated.pdf"
    _write_marker_pdf(
        source_pdf,
        width=200,
        height=300,
        rotation=90,
        colors=[(1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 0)],
    )
    _write_marker_pdf(
        translated_pdf,
        width=200,
        height=300,
        rotation=270,
        colors=[(1, 0, 1), (0, 1, 1), (0.5, 0.2, 0), (0, 0, 0.5)],
    )

    build_side_by_side_pdf(source_pdf, translated_pdf, output_pdf)

    source_image = _render_page_image(source_pdf)
    translated_image = _render_page_image(translated_pdf)
    output_image = _render_page_image(output_pdf)

    expected_height = max(source_image.height, translated_image.height)
    assert output_image.size == (source_image.width + translated_image.width, expected_height)
    left_half = output_image.crop((0, 0, source_image.width, source_image.height))
    right_half = output_image.crop(
        (
            source_image.width,
            0,
            source_image.width + translated_image.width,
            expected_height,
        )
    )

    assert ImageChops.difference(source_image, left_half).getbbox() is None
    assert ImageChops.difference(translated_image, right_half).getbbox() is None

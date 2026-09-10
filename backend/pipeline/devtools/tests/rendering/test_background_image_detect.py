from __future__ import annotations

import sys
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source.background.detect import page_has_large_background_image
from retainpdf_pipeline.render.source.background.detect import page_has_tiled_background_images
from retainpdf_pipeline.render.source.background.detect import pick_primary_background_image


def test_tiled_background_images_are_detected(tmp_path) -> None:
    image_path = tmp_path / "band.png"
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 20, 20), False)
    pix.clear_with(230)
    pix.save(image_path)

    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    for top in range(0, 300, 25):
        page.insert_image(fitz.Rect(0, top, 200, min(top + 25, 300)), filename=image_path)

    assert page_has_tiled_background_images(page)
    assert page_has_large_background_image(page)


def test_sparse_images_are_not_treated_as_tiled_background(tmp_path) -> None:
    image_path = tmp_path / "figure.png"
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 20, 20), False)
    pix.clear_with(230)
    pix.save(image_path)

    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(fitz.Rect(20, 20, 120, 100), filename=image_path)
    page.insert_image(fitz.Rect(80, 160, 180, 240), filename=image_path)

    assert not page_has_tiled_background_images(page)
    assert not page_has_large_background_image(page)


def test_primary_background_image_falls_back_to_image_rects_when_info_xref_is_zero() -> None:
    class FakePage:
        rect = fitz.Rect(0, 0, 200, 300)

        def get_image_info(self, *, hashes: bool = False, xrefs: bool = False) -> list[dict]:
            assert hashes is False
            assert xrefs is True
            return [{"xref": 0, "bbox": (0, 0, 200, 300)}]

        def get_images(self, full: bool = False) -> list[tuple]:
            assert full is True
            return [(42, 0, 200, 300, 8, "DeviceRGB", "", "Im0", "DCTDecode", 0)]

        def get_image_rects(self, xref: int) -> list[fitz.Rect]:
            assert xref == 42
            return [fitz.Rect(0, 0, 200, 300)]

    page = FakePage()

    assert page_has_large_background_image(page) is True
    assert pick_primary_background_image(page) == (42, fitz.Rect(0, 0, 200, 300))

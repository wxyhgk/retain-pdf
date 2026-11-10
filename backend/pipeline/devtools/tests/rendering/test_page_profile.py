from __future__ import annotations

from pathlib import Path

import fitz
from PIL import Image


from retainpdf_pipeline.render.analysis.profile.builder import build_render_page_profile


def test_build_render_page_profile_collects_base_dimensions(tmp_path: Path) -> None:
    image_path = tmp_path / "scan.png"
    Image.new("RGB", (800, 1200), (255, 255, 255)).save(image_path)

    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(page.rect, filename=str(image_path))
    try:
        profile = build_render_page_profile(
            page,
            ocr_items=[{"bbox": [10.0, 20.0, 100.0, 80.0]}],
        )

        assert profile.geometry.width_pt == 200
        assert profile.geometry.height_pt == 300
        assert profile.image_background.has_large_background is True
        assert profile.vector_layer.drawing_count >= 0
        assert profile.ocr_blocks.block_count == 1
        assert profile.ocr_blocks.valid_bbox_count == 1
        assert profile.kind == "scan_image"
    finally:
        doc.close()

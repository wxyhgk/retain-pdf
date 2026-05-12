from __future__ import annotations

import sys
from pathlib import Path

import fitz
from PIL import Image


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.analysis.classifier import classify_render_page


def test_classify_render_page_detects_editable_text() -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_text((20, 40), "Editable text")
    try:
        classification = classify_render_page(page)
        assert classification.kind == "editable_text"
        assert classification.large_background_image is False
        assert classification.route is not None
        assert classification.route.redaction == "text_layer_only"
    finally:
        doc.close()


def test_classify_render_page_detects_scan_image(tmp_path: Path) -> None:
    image_path = tmp_path / "scan.png"
    Image.new("RGB", (800, 1200), (255, 255, 255)).save(image_path)

    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    page.insert_image(page.rect, filename=str(image_path))
    try:
        classification = classify_render_page(page)
        assert classification.kind == "scan_image"
        assert classification.large_background_image is True
        assert classification.background_coverage_ratio >= 0.75
        assert classification.route is not None
        assert classification.route.background == "image_background"
    finally:
        doc.close()

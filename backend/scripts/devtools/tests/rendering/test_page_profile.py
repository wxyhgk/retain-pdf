from __future__ import annotations

import sys
from pathlib import Path

import fitz
from PIL import Image


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.analysis.profile.builder import build_render_page_profile
from services.rendering.analysis.profile.registry import EMPTY_PAGE_PROFILE_REGISTRY


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


def test_page_profile_registry_allows_additive_collectors() -> None:
    doc = fitz.open()
    page = doc.new_page(width=200, height=300)
    try:
        registry = EMPTY_PAGE_PROFILE_REGISTRY.register(
            "probe",
            lambda current_page, context: {
                "page": current_page.number,
                "value": context["value"],
            },
        )

        collected = registry.collect(page, {"value": 42})

        assert collected == {"probe": {"page": 0, "value": 42}}
        assert EMPTY_PAGE_PROFILE_REGISTRY.collect(page) == {}
    finally:
        doc.close()

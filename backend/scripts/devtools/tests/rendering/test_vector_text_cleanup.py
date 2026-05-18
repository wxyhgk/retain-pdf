from __future__ import annotations

import sys
from unittest.mock import patch
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.rendering.source.cleanup.vector_text_cleanup import collect_vector_text_rects
from services.rendering.source.cleanup.vector_text_cleanup import cleanup_vector_text_drawings
from services.rendering.source.preparation.bbox_text_strip_candidates import build_bbox_text_strip_candidates
from services.rendering.source.preparation.bbox_text_strip_geometry import formula_guard_rects
from services.rendering.source.preparation.bbox_text_strip_geometry import ocr_bbox_to_pdf_rect
from services.rendering.source.preparation.bbox_text_strip_test_support import build_page_formula_rects_for_items
from services.rendering.source.preparation.bbox_text_strip_test_support import build_page_strip_rects_for_items
from services.rendering.source.preparation.bbox_text_strip_test_support import build_page_strip_source_rects_for_items


def test_collect_vector_text_rects_detects_black_filled_glyph_drawings() -> None:
    page = fitz.open().new_page(width=300, height=400)
    target_rect = fitz.Rect(250, 40, 560, 60)
    drawings = [
        {
            "type": "f",
            "fill": (0.0, 0.0, 0.0),
            "rect": fitz.Rect(252, 46, 430, 55),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 20,
        },
        {
            "type": "f",
            "fill": (0.8, 0.8, 0.8),
            "rect": fitz.Rect(252, 46, 430, 55),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 20,
        },
        {
            "type": "f",
            "fill": (0.0, 0.0, 0.0),
            "rect": fitz.Rect(20, 200, 200, 240),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 20,
        },
    ]
    page.get_drawings = lambda: drawings  # type: ignore[method-assign]

    rects = collect_vector_text_rects(page, [target_rect])

    assert rects == [fitz.Rect(252, 46, 430, 55)]


def test_collect_vector_text_rects_detects_large_black_text_clusters_by_intersection() -> None:
    page = fitz.open().new_page(width=300, height=400)
    target_rect = fitz.Rect(50, 300, 250, 360)
    drawings = [
        {
            "type": "f",
            "fill": (0.0, 0.0, 0.0),
            "rect": fitz.Rect(20, 280, 280, 380),
            "items": [("l", fitz.Point(0, 0), fitz.Point(1, 1))] * 1000,
        }
    ]
    page.get_drawings = lambda: drawings  # type: ignore[method-assign]

    rects = collect_vector_text_rects(page, [target_rect])

    assert rects == [fitz.Rect(50, 300, 250, 360)]


def test_cleanup_vector_text_drawings_uses_background_covers_instead_of_redaction() -> None:
    page = fitz.open().new_page(width=300, height=400)
    target_rect = fitz.Rect(250, 40, 560, 60)
    vector_rect = fitz.Rect(252, 46, 430, 55)

    with patch(
        "services.rendering.source.cleanup.vector_text_cleanup.collect_vector_text_rects",
        return_value=[vector_rect],
    ), patch(
        "services.rendering.source.cleanup.vector_text_cleanup.prepare_background_covers",
        return_value=["cover"],
    ) as prepare_mock, patch(
        "services.rendering.source.cleanup.vector_text_cleanup.apply_prepared_background_covers",
    ) as apply_mock:
        count = cleanup_vector_text_drawings(page, [target_rect])

    assert count == 1
    prepare_mock.assert_called_once_with(page, [vector_rect])
    apply_mock.assert_called_once_with(page, ["cover"])


def test_bbox_text_strip_rects_shrink_away_from_adjacent_display_formula() -> None:
    page_height = 818.362
    items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "bbox": [319.967, 244.459, 566.442, 417.43],
            "protected_translated_text": "正文译文",
        },
        {
            "item_id": "p001-b002",
            "block_type": "formula",
            "bbox": [333.466, 419.929, 472.452, 445.425],
            "source_text": "$$ E^{(1)} $$",
        },
    ]

    rects = build_page_strip_rects_for_items(page_height=page_height, translated_items=items)

    assert rects == []


def test_bbox_text_strip_rects_split_around_overlapping_display_formula() -> None:
    page_height = 655.228
    items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "bbox": [44.5, 455.8, 385.7, 507.3],
            "protected_translated_text": "正文译文",
        },
        {
            "item_id": "p001-b002",
            "block_type": "formula",
            "bbox": [177.9, 458.8, 250.8, 484.8],
            "source_text": "$$ \\frac{a}{b} $$",
        },
    ]

    rects = build_page_strip_rects_for_items(page_height=page_height, translated_items=items)

    assert rects == []


def test_bbox_text_strip_formula_guard_expands_to_body_column() -> None:
    page_height = 655.228
    items = [
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "bbox": [44.5, 410.0, 385.7, 510.0],
            "protected_translated_text": "正文译文",
        },
        {
            "item_id": "p001-b002",
            "block_type": "formula",
            "bbox": [177.9, 458.8, 250.8, 484.8],
            "source_text": "$$ \\frac{a}{b} $$",
        },
    ]

    strip_rects = build_page_strip_rects_for_items(page_height=page_height, translated_items=items)
    source_rects = build_page_strip_source_rects_for_items(page_height=page_height, translated_items=items)
    formula_rects = build_page_formula_rects_for_items(page_height=page_height, translated_items=items)
    protected = formula_guard_rects(formula_rects, strip_rects=source_rects)

    assert strip_rects == []
    assert source_rects == []
    assert formula_rects
    assert protected


def test_bbox_text_strip_candidates_skip_formula_pages(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    page.insert_text((40, 50), "source above")
    page.insert_text((80, 90), "E = mc2")
    page.insert_text((40, 130), "source below")
    doc.save(source_pdf)
    doc.close()

    candidates = build_bbox_text_strip_candidates(
        source_pdf_path=source_pdf,
        translated_pages={
            0: [
                {
                    "item_id": "p001-b001",
                    "block_type": "text",
                    "block_kind": "text",
                    "bbox": [35.0, 35.0, 220.0, 65.0],
                    "protected_translated_text": "上文",
                },
                {
                    "item_id": "p001-b002",
                    "block_type": "formula",
                    "block_kind": "formula",
                    "normalized_sub_type": "display_formula",
                    "bbox": [75.0, 75.0, 160.0, 105.0],
                },
                {
                    "item_id": "p001-b003",
                    "block_type": "text",
                    "block_kind": "text",
                    "bbox": [35.0, 115.0, 220.0, 145.0],
                    "protected_translated_text": "下文",
                },
            ]
        },
    )

    assert candidates.page_rects == {}
    assert 0 in candidates.skipped_complex_page_indices


def test_bbox_text_strip_candidates_keep_formula_guard_but_strip_far_text_on_formula_page(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    page.insert_text((40, 50), "source above")
    page.insert_text((80, 90), "E = mc2")
    page.insert_text((40, 130), "source below")
    page.insert_text((205, 240), "figure caption")
    doc.save(source_pdf)
    doc.close()

    candidates = build_bbox_text_strip_candidates(
        source_pdf_path=source_pdf,
        translated_pages={
            0: [
                {
                    "item_id": "p001-b001",
                    "block_type": "text",
                    "block_kind": "text",
                    "bbox": [35.0, 35.0, 220.0, 65.0],
                    "protected_translated_text": "上文",
                },
                {
                    "item_id": "p001-b002",
                    "block_type": "formula",
                    "block_kind": "formula",
                    "normalized_sub_type": "display_formula",
                    "bbox": [75.0, 75.0, 160.0, 105.0],
                },
                {
                    "item_id": "p001-b003",
                    "block_type": "text",
                    "block_kind": "text",
                    "bbox": [35.0, 115.0, 220.0, 145.0],
                    "protected_translated_text": "下文",
                },
                {
                    "item_id": "p001-b004",
                    "block_type": "text",
                    "block_kind": "text",
                    "bbox": [200.0, 225.0, 285.0, 255.0],
                    "protected_translated_text": "图注",
                },
            ]
        },
        skip_formula_pages=False,
    )

    assert 0 in candidates.page_rects
    assert candidates.page_protected_rects and 0 in candidates.page_protected_rects
    assert 0 not in candidates.skipped_complex_page_indices


def test_bbox_text_strip_converts_visible_bbox_to_pdf_cropbox_coordinates(tmp_path: Path) -> None:
    source_pdf = tmp_path / "cropped.pdf"
    doc = fitz.open()
    page = doc.new_page(width=612, height=783.5)
    page.set_cropbox(fitz.Rect(26.64, 1.51, 612.0, 783.43))
    doc.save(source_pdf)
    doc.close()

    doc = fitz.open(source_pdf)
    try:
        page = doc[0]
        rect = ocr_bbox_to_pdf_rect(page, [32.492, 114.488, 385.908, 233.476])
    finally:
        doc.close()

    assert rect is not None
    assert round(rect.x0, 3) == 59.132
    assert round(rect.x1, 3) == 412.548
    assert round(rect.y0, 3) == 548.514
    assert round(rect.y1, 3) == 667.502

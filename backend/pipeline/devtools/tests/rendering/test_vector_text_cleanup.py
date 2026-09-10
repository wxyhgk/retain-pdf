from __future__ import annotations

import sys
from unittest.mock import patch
from pathlib import Path

import fitz


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.source.cleanup.vector_text_cleanup import collect_vector_text_rects
from retainpdf_pipeline.render.source.cleanup.vector_text_cleanup import cleanup_vector_text_drawings
from retainpdf_pipeline.render.source_cleanup import plan_source_cleanup
from retainpdf_pipeline.render.source_cleanup.planning import geometry
from retainpdf_pipeline.render.source_cleanup.planning import test_support
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import bboxlog_path_blocks_text_strip
from retainpdf_pipeline.render.source_cleanup.planning.drawing_classifier import drawing_blocks_text_strip
from retainpdf_pipeline.render.source_cleanup.planning.planner import plan_source_cleanup_page


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
        "retainpdf_pipeline.render.source.cleanup.vector_text_cleanup.collect_vector_text_rects",
        return_value=[vector_rect],
    ), patch(
        "retainpdf_pipeline.render.source.cleanup.vector_text_cleanup.prepare_background_covers",
        return_value=["cover"],
    ) as prepare_mock, patch(
        "retainpdf_pipeline.render.source.cleanup.vector_text_cleanup.apply_prepared_background_covers",
    ) as apply_mock:
        count = cleanup_vector_text_drawings(page, [target_rect])

    assert count == 1
    prepare_mock.assert_called_once_with(page, [vector_rect])
    apply_mock.assert_called_once_with(page, ["cover"])


def test_text_like_fill_path_blocks_text_strip() -> None:
    drawing = {
        "type": "f",
        "fill": (0.0, 0.0, 0.0),
        "rect": fitz.Rect(368.1, 531.67, 373.78, 540.54),
    }

    assert drawing_blocks_text_strip(drawing) is True
    assert bboxlog_path_blocks_text_strip("fill-path", fitz.Rect(368.1, 531.67, 373.78, 540.54)) is True


def test_large_fill_path_does_not_block_text_strip() -> None:
    large_background = {
        "type": "f",
        "fill": (1.0, 1.0, 1.0),
        "rect": fitz.Rect(0, 0, 300, 400),
    }

    assert drawing_blocks_text_strip(large_background) is False
    assert bboxlog_path_blocks_text_strip("fill-path", fitz.Rect(0, 0, 300, 400)) is False


def test_source_cleanup_body_vector_probe_strips_without_cover_fallback() -> None:
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    item = {
        "item_id": "p002-b009",
        "block_kind": "text",
        "block_type": "text",
        "bbox": [312.0, 530.0, 557.0, 568.0],
        "protected_translated_text": "译文 $ x_i $",
    }
    bboxlog_entries = [
        ("fill-text", (312.0, 232.0, 557.0, 271.0)),
        ("fill-text", (314.0, 234.0, 555.0, 269.0)),
        ("fill-path", (368.0, 532.0, 374.0, 541.0)),
    ]
    page.get_bboxlog = lambda: bboxlog_entries  # type: ignore[method-assign]
    page.get_cdrawings = lambda: []  # type: ignore[method-assign]
    page.get_xobjects = lambda: []  # type: ignore[method-assign]

    plan = plan_source_cleanup_page(doc, page, translated_items=[item], skip_form_xobject_pages=False)

    assert "p002-b009" not in plan.uncovered_unsafe_vector_item_ids
    assert plan.strip_rects


def test_source_cleanup_footnote_vector_probe_uses_item_cover_fallback() -> None:
    doc = fitz.open()
    page = doc.new_page(width=600, height=800)
    item = {
        "item_id": "p008-b005",
        "block_kind": "text",
        "block_type": "text",
        "layout_role": "footnote",
        "semantic_role": "metadata",
        "normalized_sub_type": "table_footnote",
        "bbox": [48.0, 281.0, 439.0, 291.0],
        "source_text": "$ ^{a} $The nuclear repulsive interaction term is omitted.",
        "protected_translated_text": "$^{a}$核排斥相互作用项被省略。",
    }
    bboxlog_entries = [
        ("fill-text", (48.0, 509.0, 439.0, 520.0)),
        ("fill-path", (335.0, 510.0, 342.0, 518.0)),
    ]
    page.get_bboxlog = lambda: bboxlog_entries  # type: ignore[method-assign]
    page.get_cdrawings = lambda: []  # type: ignore[method-assign]
    page.get_xobjects = lambda: []  # type: ignore[method-assign]

    plan = plan_source_cleanup_page(doc, page, translated_items=[item], skip_form_xobject_pages=False)

    assert "p008-b005" in plan.uncovered_unsafe_vector_item_ids
    assert plan.strip_rects


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

    rects = test_support.build_page_strip_rects_for_items(page_height=page_height, translated_items=items)
    formula_rects = test_support.build_page_formula_rects_for_items(page_height=page_height, translated_items=items)

    assert rects
    assert all((rect & formula).is_empty for rect in rects for formula in formula_rects)


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

    rects = test_support.build_page_strip_rects_for_items(page_height=page_height, translated_items=items)
    formula_rects = test_support.build_page_formula_rects_for_items(page_height=page_height, translated_items=items)

    formula = formula_rects[0]
    assert all((rect & formula).is_empty for rect in rects)
    assert any(rect.y1 <= formula.y0 for rect in rects)
    assert any(rect.y0 >= formula.y1 for rect in rects)
    assert any(rect.x1 <= formula.x0 and rect.y0 < formula.y1 and rect.y1 > formula.y0 for rect in rects)
    assert any(rect.x0 >= formula.x1 and rect.y0 < formula.y1 and rect.y1 > formula.y0 for rect in rects)


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

    strip_rects = test_support.build_page_strip_rects_for_items(page_height=page_height, translated_items=items)
    source_rects = test_support.build_page_strip_source_rects_for_items(page_height=page_height, translated_items=items)
    formula_rects = test_support.build_page_formula_rects_for_items(page_height=page_height, translated_items=items)
    protected = geometry.formula_guard_rects(formula_rects, strip_rects=source_rects)

    assert strip_rects
    assert source_rects
    assert formula_rects
    assert protected


def test_bbox_text_strip_keeps_text_between_display_formulas_deletable() -> None:
    page_height = 728.16
    items = [
        {
            "item_id": "p009-b003",
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "bbox": [68.963, 136.936, 336.817, 170.92],
        },
        {
            "item_id": "p009-b005",
            "block_type": "text",
            "block_kind": "text",
            "bbox": [43.476, 180.916, 392.787, 216.899],
            "protected_translated_text": "正文译文",
        },
        {
            "item_id": "p009-b006",
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "bbox": [123.933, 220.897, 309.832, 249.883],
        },
    ]

    rects = test_support.build_page_strip_rects_for_items(page_height=page_height, translated_items=items)
    source_rects = test_support.build_page_strip_source_rects_for_items(page_height=page_height, translated_items=items)
    formula_rects = test_support.build_page_formula_rects_for_items(page_height=page_height, translated_items=items)
    protected = geometry.formula_guard_rects(formula_rects, strip_rects=source_rects)

    assert len(rects) == 1
    assert rects[0].y0 <= page_height - 216.899
    assert rects[0].y1 >= page_height - 180.916
    assert all((rects[0] & guard).is_empty for guard in protected)


def test_bbox_text_strip_keeps_formula_neighbor_text_deletable() -> None:
    page_height = 728.16
    items = [
        {
            "item_id": "p005-b004",
            "block_type": "text",
            "block_kind": "text",
            "bbox": [33.482, 265.376, 398.284, 301.359],
            "protected_translated_text": "公式上方正文",
        },
        {
            "item_id": "p005-b005",
            "block_type": "formula",
            "block_kind": "formula",
            "normalized_sub_type": "display_formula",
            "bbox": [125.932, 305.857, 306.834, 334.844],
        },
        {
            "item_id": "p005-b007",
            "block_type": "text",
            "block_kind": "text",
            "bbox": [33.482, 343.34, 398.784, 559.739],
            "protected_translated_text": "公式下方正文",
        },
    ]

    rects = test_support.build_page_strip_rects_for_items(page_height=page_height, translated_items=items)
    formula_rects = test_support.build_page_formula_rects_for_items(page_height=page_height, translated_items=items)
    p005_b004 = fitz.Rect(33.482, page_height - 301.359, 398.284, page_height - 265.376)
    p005_b007 = fitz.Rect(33.482, page_height - 559.739, 398.784, page_height - 343.34)

    assert any(not (rect & p005_b004).is_empty for rect in rects)
    assert any(not (rect & p005_b007).is_empty for rect in rects)
    assert all((rect & formula).is_empty for rect in rects for formula in formula_rects)


def test_bbox_text_strip_candidates_skip_formula_pages(tmp_path: Path) -> None:
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    page = doc.new_page(width=300, height=400)
    page.insert_text((40, 50), "source above")
    page.insert_text((80, 90), "E = mc2")
    page.insert_text((40, 130), "source below")
    doc.save(source_pdf)
    doc.close()

    candidates = plan_source_cleanup(
        source_pdf_path=source_pdf,
        skip_formula_pages=True,
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

    candidates = plan_source_cleanup(
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
        rect = geometry.ocr_bbox_to_pdf_rect(page, [32.492, 114.488, 385.908, 233.476])
    finally:
        doc.close()

    assert rect is not None
    assert round(rect.x0, 3) == 59.132
    assert round(rect.x1, 3) == 412.548
    assert round(rect.y0, 3) == 548.514
    assert round(rect.y1, 3) == 667.502

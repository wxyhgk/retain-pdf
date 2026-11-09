"""标题按原文字号排、只缩不放（layout/title_source_size.py，2026-11-09）。

以前标题在框里找塞得下的最大字号：框是原文两行撑出来的，译成一行中文时字被放大将近一倍。"""

from pathlib import Path

import fitz

from retainpdf_pipeline.render.layout.title_binary_fit import solve_title_fit
from retainpdf_pipeline.render.layout.title_fit_limits import resolve_title_fill_max_font_size_pt
from retainpdf_pipeline.render.layout.title_source_size import annotate_title_source_font_sizes
from retainpdf_pipeline.render.layout.title_source_size import fitted_source_font_size_pt
from retainpdf_pipeline.render.layout.title_source_size import text_layer_font_size_pt
from retainpdf_pipeline.render.layout.title_source_size import title_source_font_size_pt
from retainpdf_pipeline.render.output.rpr_fit.renderer import _translation_items


def _heading(bbox, source_text="Modeling a Complete Photonic Computing Network", translated="完整光子计算网络的建模", **extra) -> dict:
    return {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_idx": 1,
        "block_type": "text",
        "layout_role": "heading",
        "structure_role": "heading",
        "bbox": list(bbox),
        "source_text": source_text,
        "translated_text": translated,
        "protected_translated_text": translated,
        "policy_translate": True,
        **extra,
    }


def _body(bbox) -> dict:
    return {**_heading(bbox), "item_id": "p001-b002", "block_idx": 2, "layout_role": "paragraph", "structure_role": "body"}


# 原文 10.9pt、两行的小节标题框（LightningFNO 第 5 页「3.4 Modeling a Complete Photonic Computing Network」）
TWO_LINE_BOX = [52.2, 200.0, 300.0, 226.0]


def test_title_keeps_source_size_when_translation_takes_fewer_lines() -> None:
    old = _heading(TWO_LINE_BOX)
    old_fit = solve_title_fit(
        {**old, "source_text": ""},  # 没有原文：按框放大的老规则
        old["translated_text"],
        [],
        base_font_size_pt=10.0,
        base_leading_em=0.34,
        max_font_size_pt=24.0,
    )
    assert old_fit is not None and old_fit.font_size_pt > 16, old_fit

    item = _heading(TWO_LINE_BOX, source_font_size_pt=10.9)
    fit = solve_title_fit(
        item,
        item["translated_text"],
        [],
        base_font_size_pt=10.0,
        base_leading_em=0.34,
        max_font_size_pt=resolve_title_fill_max_font_size_pt(item, 10.0),
    )
    assert fit is not None
    assert fit.font_size_pt == 10.9
    assert fit.fit_max_font_size_pt == 10.9


def test_title_whose_source_size_does_not_fit_still_shrinks() -> None:
    item = _heading([52.2, 200.0, 120.0, 214.0], translated="完整光子计算网络的建模与反向设计", source_font_size_pt=30.0)
    fit = solve_title_fit(item, item["translated_text"], [], base_font_size_pt=10.0, base_leading_em=0.34, max_font_size_pt=24.0)
    assert fit is not None and fit.font_size_pt < 30.0


def test_text_layer_size_is_the_character_weighted_median_inside_the_box() -> None:
    item = _heading([0, 0, 200, 20], source_text="CONCLUSION")
    spans = [
        ([2, 1, 120, 18], 12.2, "CONCLUSION "),
        ([150, 1, 155, 18], 6.0, ". "),  # 框里一个小号的点不影响
        ([2, 40, 120, 58], 30.0, "Somewhere else"),  # 中心不在框里
    ]
    assert text_layer_font_size_pt(spans, item) == 12.2


def test_text_layer_is_ignored_when_its_characters_do_not_match_the_source() -> None:
    item = _heading([0, 0, 200, 20], source_text="ACKNOWLEDGMENTS AND OTHER THANKS FOR EVERYONE")
    assert text_layer_font_size_pt([([2, 1, 20, 18], 32.0, "■")], item) is None


def test_fallback_recovers_the_size_that_fills_the_box_with_the_source_text() -> None:
    one_line = _heading([0, 0, 400, 14], source_text="Results")
    two_lines = _heading([0, 0, 400, 30], source_text="Results")
    # 一个词一行：字高就是框高
    assert abs(fitted_source_font_size_pt(one_line) - 14.0) < 0.05
    assert abs(fitted_source_font_size_pt(two_lines) - 30.0) < 0.05
    # 同一个框，原文长到要排两行：反推出的字小一半多（两行加一个行距塞进同样的高度）
    long_text = _heading([0, 0, 200, 30], source_text="Modeling a Complete Photonic Computing Network")
    assert fitted_source_font_size_pt(long_text) < 14.0


def test_title_source_size_prefers_the_measured_value_and_skips_non_titles() -> None:
    assert title_source_font_size_pt(_heading(TWO_LINE_BOX, source_font_size_pt=10.9)) == 10.9
    assert title_source_font_size_pt(_heading(TWO_LINE_BOX)) is not None  # 没量过：现场按框反推
    assert title_source_font_size_pt(_body(TWO_LINE_BOX)) is None


def test_annotate_reads_the_text_layer_and_falls_back_without_a_pdf(tmp_path: Path) -> None:
    pdf_path = tmp_path / "source.pdf"
    document = fitz.open()
    page = document.new_page(width=400, height=300)
    page.insert_text((20, 60), "Results", fontsize=18)
    document.save(pdf_path)
    document.close()

    title = _heading([18, 40, 200, 66], source_text="Results", translated="结果")
    body = _body([18, 100, 380, 160])
    pages = {0: [title, body]}
    assert annotate_title_source_font_sizes(pages, pdf_path) == {"pdf": 1, "fit": 0, "none": 0}
    assert title["source_font_size_pt"] == 18.0 and title["source_font_size_from"] == "pdf"
    assert "source_font_size_pt" not in body

    other = _heading([18, 40, 200, 66], source_text="Results", translated="结果")
    assert annotate_title_source_font_sizes({0: [other]}, tmp_path / "missing.pdf") == {"pdf": 0, "fit": 1, "none": 0}
    assert other["source_font_size_from"] == "fit"


def test_rpr_fit_items_carry_the_source_size_for_titles_only() -> None:
    title = _heading(TWO_LINE_BOX, source_font_size_pt=10.9)
    body = _body([18, 100, 380, 160])
    items = {entry["item_id"]: entry for entry in _translation_items({0: [title, body]})}
    assert items["p001-b001"]["source_font_size_pt"] == 10.9
    assert "source_font_size_pt" not in items["p001-b002"]

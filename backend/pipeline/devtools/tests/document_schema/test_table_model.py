"""表格模型（表格翻译 T1）：结构来自 OCR 的 HTML，格子原文来自文字层；对着评测集的标准答案钉住水平。"""
from __future__ import annotations

import sys
from pathlib import Path

import fitz

from retainpdf_pipeline.ocr.tables import build_table_model, content_kind
from retainpdf_pipeline.ocr.tables.html_grid import drop_caption_rows, parse_html_grid
from retainpdf_pipeline.ocr.tables.symbol_fonts import fix_symbol_char
from retainpdf_pipeline.ocr.tables.text_layer import table_text_lines

DEVTOOLS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DEVTOOLS))

import table_model_eval  # noqa: E402


def test_html_grid_places_spanning_cells() -> None:
    grid = parse_html_grid(
        "<table><tr><td rowspan='2'>Entry</td><td colspan='2'>Yield<sup>a</sup> (%)</td></tr>"
        "<tr><td>A</td><td>B</td></tr><tr><td>1</td><td>92</td><td>80</td></tr></table>"
    )
    assert (grid.n_rows, grid.n_cols) == (3, 3)
    assert [(cell.row, cell.col, cell.rowspan, cell.colspan) for cell in grid.cells][:4] == [
        (0, 0, 2, 1), (0, 1, 1, 2), (1, 1, 1, 1), (1, 2, 1, 1),
    ]
    assert grid.cells[1].ocr_text == "Yield<sup>a</sup> (%)"


def test_caption_and_footnote_rows_that_ocr_put_inside_the_table_are_dropped() -> None:
    grid = parse_html_grid(
        "<table><tr><td colspan='2'>Table 3 Optimisation of the conditions</td></tr>"
        "<tr><td>Entry</td><td>Yield</td></tr><tr><td>1</td><td>92</td></tr>"
        "<tr><td colspan='2'>a Isolated yield.</td></tr></table>"
    )
    removed = drop_caption_rows(grid)
    assert len(removed) == 2
    assert grid.n_rows == 2
    assert [cell.ocr_text for cell in grid.cells] == ["Entry", "Yield", "1", "92"]
    assert grid.cells[0].row == 0


def test_symbol_fonts_are_mapped_to_the_glyphs_on_the_page() -> None:
    # Advent 字体（Elsevier / RSC）：文字层里的 \x04、1、D 在页面上是 ×、°、Δ
    assert fix_symbol_char("ABCDEF+AdvP4C4E74", "\x04") == "×"
    assert fix_symbol_char("AdvEls-ent5", "1") == "°"
    assert fix_symbol_char("AdvPi1", "D") == "Δ"
    assert fix_symbol_char("Times-Roman", "D") == "D", "不在对照表里的字体不动"


def _page_with(tmp_path: Path, draw) -> fitz.Page:  # noqa: ANN001
    document = fitz.open()
    page = document.new_page(width=400, height=300)
    draw(page)
    path = tmp_path / "table.pdf"
    document.save(path)
    return fitz.open(path)[0]


def test_text_layer_marks_raised_small_text_as_superscript_and_keeps_rows_apart(tmp_path: Path) -> None:
    def draw(page: fitz.Page) -> None:
        page.insert_text((50, 100), "Yield", fontsize=10)
        page.insert_text((50 + fitz.get_text_length("Yield", fontsize=10) + 0.3, 96), "a", fontsize=6)
        page.insert_text((150, 100), "Entry", fontsize=10)
        page.insert_text((50, 112), "92", fontsize=10)  # 行距很紧的下一行
        page.insert_text((150, 112), "1", fontsize=10)

    lines = table_text_lines(_page_with(tmp_path, draw), [40, 80, 300, 130])
    assert [line.text for line in lines] == ["Yield<sup>a</sup> Entry", "92 1"]


def test_vertical_text_inside_the_table_box_is_ignored(tmp_path: Path) -> None:
    def draw(page: fitz.Page) -> None:
        page.insert_text((50, 100), "Entry", fontsize=10)
        page.insert_text((50, 112), "1", fontsize=10)
        page.insert_text((200, 140), "WATERMARK", fontsize=12, rotate=90)

    lines = table_text_lines(_page_with(tmp_path, draw), [40, 60, 300, 200])
    assert [line.text for line in lines] == ["Entry", "1"]


def test_content_kind_separates_numbers_formulas_codes_and_text() -> None:
    assert content_kind("92") == "numeric"
    assert content_kind("−20") == "numeric"
    assert content_kind("2.95 × 10<sup>5</sup>") == "numeric"
    assert content_kind("CH<sub>2</sub>Cl<sub>2</sub>") == "chemical"
    assert content_kind("SB-3") == "code"
    assert content_kind("toluene") == "text"
    assert content_kind("") == "empty"


def test_quality_on_the_eval_set_does_not_regress() -> None:
    """2026-11-12 的水平：格子原文完全一致 GLM-OCR 97.3%、PaddleOCR 94.7%；结构真错的表都要能标出来一部分。"""
    glm = table_model_eval.evaluate("glm_ocr")["summary"]
    assert glm["tables"] == 55
    paddle = table_model_eval.evaluate("paddle")["summary"]
    assert glm["same_shape"] >= 50 and paddle["same_shape"] >= 50
    assert glm["cells_text_exact_rate"] >= 0.965, glm
    assert paddle["cells_text_exact_rate"] >= 0.94, paddle
    assert glm["cells_role_ok_rate"] >= 0.95 and paddle["cells_role_ok_rate"] >= 0.94
    flagged, wrong = (int(part) for part in paddle["wrong_shape_flagged"].split("/"))
    assert flagged == wrong, "PaddleOCR 结构错的表都要标出来"
    flagged_right, right = (int(part) for part in glm["right_shape_flagged"].split("/"))
    assert flagged_right <= right * 0.12, "结构对的表不能误标太多（会多花看图的钱）"


def _three_column_table(page: fitz.Page, rows: list[list[str]], top: float = 100, step: float = 12) -> None:
    for index, row in enumerate(rows):
        for x, text in zip((50, 160, 270), row):
            if text:
                page.insert_text((x, top + index * step), text, fontsize=9)


def test_cells_wrapped_over_several_lines_are_not_swallowed_rows(tmp_path: Path) -> None:
    """说明文字表：一行表格里每格都折成几行，每行文字都横跨各列，但下一行是小写接着写，不是 OCR 漏行（2026-11-22）。"""
    lines = [
        ["Method", "Principle", "Limitations"],
        ["Wet sol-gel", "Particles are soaked in a", "Layer is often uneven;"],
        ["", "precursor solution and", "residual solvent may"],
        ["", "dried at low heat.", "react with the surface."],
        ["Dry route", "Fine powder is pressed", "Coverage is incomplete"],
        ["", "onto the particles.", "in most cases."],
    ]
    html = (
        "<table><tr><td>Method</td><td>Principle</td><td>Limitations</td></tr>"
        "<tr><td>Wet sol-gel</td><td>Particles are soaked in a precursor solution and dried at low heat.</td>"
        "<td>Layer is often uneven; residual solvent may react with the surface.</td></tr>"
        "<tr><td>Dry route</td><td>Fine powder is pressed onto the particles.</td>"
        "<td>Coverage is incomplete in most cases.</td></tr></table>"
    )
    page = _page_with(tmp_path, lambda page: _three_column_table(page, lines))
    model = build_table_model({"block_id": "t", "page_index": 0, "bbox": [40, 85, 390, 180], "text": html}, page)
    assert model["n_rows"] == 3 and model["issues"] == []


def test_data_rows_merged_by_ocr_are_still_flagged(tmp_path: Path) -> None:
    """OCR 把两行数据并成一行：下一行是新数据（大写、数字开头），照旧标出来。"""
    lines = [["Batch", "Capacity", "Density"], ["B-01", "268.4", "1.92"], ["B-02", "265.9", "1.95"], ["B-03", "270.2", "1.89"]]
    html = (
        "<table><tr><td>Batch</td><td>Capacity</td><td>Density</td></tr>"
        "<tr><td>B-01 B-02</td><td>268.4 265.9</td><td>1.92 1.95</td></tr>"
        "<tr><td>B-03</td><td>270.2</td><td>1.89</td></tr></table>"
    )
    page = _page_with(tmp_path, lambda page: _three_column_table(page, lines, step=16))
    model = build_table_model({"block_id": "t", "page_index": 0, "bbox": [40, 85, 390, 160], "text": html}, page)
    assert "row_swallows_rows" in model["issues"]

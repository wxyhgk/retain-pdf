"""表格译文放回译文 PDF（表格翻译 T5，render/output/tables/overlay.py：rpr 引擎按原表的框重排整表）。"""

import json

import fitz
import pytest

from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineUnavailable
from retainpdf_pipeline.render.output.rpr.engine_cli import resolve_engine_runtime
from retainpdf_pipeline.render.output.tables import overlay

# 一张 3 行 2 列的三线表：表头粗体，第一列文字、第二列数字（右对齐）
ROWS = [("Sample", "Capacity"), ("Pristine", "268.4"), ("Coated", "65.9")]
ROW_BASELINES = (100.0, 116.0, 132.0)
SIZE = 10.0
RULES = ((86.0, 0.9), (104.0, 0.5), (137.0, 0.9))


def _engine_available() -> bool:
    try:
        resolve_engine_runtime("rpr-table.js")
    except RprEngineUnavailable:
        return False
    return True


def _write_pdf(path):
    with fitz.open() as doc:
        page = doc.new_page(width=400, height=300)
        for (label, value), baseline in zip(ROWS, ROW_BASELINES):
            bold = baseline == ROW_BASELINES[0]
            page.insert_text((60, baseline), label, fontname="hebo" if bold else "helv", fontsize=SIZE)
            width = fitz.get_text_length(value, fontname="hebo" if bold else "helv", fontsize=SIZE)
            page.insert_text((300 - width, baseline), value, fontname="hebo" if bold else "helv", fontsize=SIZE)
        for y, width in RULES:
            page.draw_line((55, y), (305, y), width=width)
        doc.save(path)
    cells = []
    with fitz.open(path) as doc:
        page = doc[0]
        for r, row in enumerate(ROWS):
            for c, text in enumerate(row):
                rect = page.search_for(text)[0]
                cells.append({
                    "id": f"r{r}c{c}", "row": r, "col": c, "rowspan": 1, "colspan": 1, "text": text,
                    "bbox": [rect.x0, rect.y0, rect.x1, rect.y1], "font_size": SIZE,
                    # 表格模型的 role 不太准：这里故意把第一列都标成 header，表头行要按原表的表头下线定
                    "role": "header" if r == 0 or c == 0 else "data",
                })
    return cells


def _write_tables(dir_path, cells, translations, *, status="translated", source_kind="text_layer"):
    result_cells = {cell["id"]: {"source": cell["text"], "translation": translations.get(cell["id"])} for cell in cells}
    payload = {
        "schema": "tables.v1",
        "tables": [{
            "block_id": "p001-b0001",
            "page_index": 0,
            "model": {
                "model_version": "table.v1", "block_id": "p001-b0001", "page_index": 0,
                "bbox": [55, 87, 305, 136], "source_kind": source_kind, "n_rows": 3, "n_cols": 2, "cells": cells,
            },
            "result": {"block_id": "p001-b0001", "status": status, "cells": result_cells},
        }],
    }
    (dir_path / overlay.TABLES_FILE_NAME).write_text(json.dumps(payload), encoding="utf-8")


TRANSLATIONS = {"r0c0": "样品", "r0c1": "容量", "r1c0": "原始", "r2c0": "包覆"}


def _table(tmp_path, translations=TRANSLATIONS):
    pdf = tmp_path / "out.pdf"
    cells = _write_pdf(pdf)
    _write_tables(tmp_path, cells, translations)
    return pdf, overlay.load_translated_tables(tmp_path)[0]


def test_no_tables_file_is_skipped(tmp_path):
    pdf = tmp_path / "out.pdf"
    _write_pdf(pdf)
    result = overlay.apply_table_translations(output_pdf_path=pdf, source_pdf_path=pdf, translations_dir=tmp_path, page_indices=[0])
    assert result == {"skipped": "no_translated_tables"}


def test_only_translated_text_layer_tables_are_loaded(tmp_path):
    cells = _write_pdf(tmp_path / "out.pdf")
    _write_tables(tmp_path, cells, TRANSLATIONS, status="skipped")
    assert overlay.load_translated_tables(tmp_path) == []
    _write_tables(tmp_path, cells, TRANSLATIONS, source_kind="vector")
    assert overlay.load_translated_tables(tmp_path) == []
    _write_tables(tmp_path, cells, TRANSLATIONS)
    assert len(overlay.load_translated_tables(tmp_path)) == 1


def test_cell_markup_turns_scripts_into_formulas():
    assert overlay.cell_markup("容量 (mAh g<sup>−1</sup>)") == "容量 (mAh g$^{-1}$)"
    assert overlay.cell_markup("LiFePO<sub>4</sub>") == "LiFePO$_{4}$"
    assert overlay.cell_markup("<b>粗</b>体<sup></sup>") == "粗体"
    # 上下标里不是简单的字（可能是一句话）：只去标签，不当公式
    assert overlay.cell_markup("见<sup>注释：很长</sup>") == "见注释：很长"


def test_measure_reads_the_original_table(tmp_path):
    pdf, table = _table(tmp_path)
    with fitz.open(pdf) as doc:
        style, stats = overlay.measure_table(doc[0], table)
    assert stats["cells_matched"] == stats["cells"] == 6
    assert style.header_rows == 1  # 按原表的表头下线定，不是按（不准的）role
    assert style.header_bold
    assert style.aligns == ["left", "right"]
    assert style.rules == {"kind": "booktabs", "top": 0.9, "mid": 0.5, "bottom": 0.9}
    assert style.font_size == SIZE
    # 原表行距 16pt，字号 10pt：上下内边距各 3pt
    assert style.padding == pytest.approx(3.0, abs=0.3)


def test_text_mismatch_keeps_the_table(tmp_path):
    pdf = tmp_path / "out.pdf"
    cells = _write_pdf(pdf)
    for cell in cells:  # 页码对错 / 文字层不是这张表：位置上的字和原文对不上
        cell["text"] += "X"
    _write_tables(tmp_path, cells, TRANSLATIONS)
    with fitz.open(pdf) as doc:
        style, stats = overlay.measure_table(doc[0], overlay.load_translated_tables(tmp_path)[0])
    assert style is None and stats["skipped"] == "text_mismatch"


def test_engine_table_uses_translations_and_keeps_the_rest(tmp_path):
    pdf, table = _table(tmp_path)
    with fitz.open(pdf) as doc:
        style, _ = overlay.measure_table(doc[0], table)
    spec = overlay.engine_table(table, style)
    cells = {(cell["row"], cell["col"]): cell for cell in spec["cells"]}
    assert cells[(0, 0)]["text"] == "样品" and cells[(0, 0)]["bold"]
    assert cells[(1, 0)]["text"] == "原始" and not cells[(1, 0)]["bold"]
    assert cells[(1, 1)]["text"] == "268.4" and cells[(1, 1)]["align"] == "right"  # 数字没翻，照抄
    assert spec["headerRows"] == 1 and spec["rules"]["kind"] == "booktabs"
    assert spec["minFontSize"] == pytest.approx(SIZE * overlay.TABLE_MIN_SCALE)


def test_output_page_indices():
    assert overlay.output_page_indices(5, 5, [1, 3]) == {1: 1, 3: 3}
    assert overlay.output_page_indices(5, 2, [3, 1]) == {1: 0, 3: 1}


def test_tables_are_kept_when_the_engine_is_unavailable(tmp_path, monkeypatch):
    import retainpdf_pipeline.render.output.rpr.engine_cli as engine_cli

    def unavailable(*_args, **_kwargs):
        raise RprEngineUnavailable("engine_not_installed", "test")

    monkeypatch.setattr(engine_cli, "resolve_engine_runtime", unavailable)
    pdf, _ = _table(tmp_path)
    before = pdf.read_bytes()
    result = overlay.apply_table_translations(output_pdf_path=pdf, source_pdf_path=pdf, translations_dir=tmp_path, page_indices=[0])
    assert result["tables_written"] == 0 and result["details"][0]["skipped"] == "engine_unavailable"
    assert pdf.read_bytes() == before


@pytest.mark.skipif(not _engine_available(), reason="rpr 引擎（node + 依赖 + rpr-table.js）不在本机")
def test_apply_redraws_the_table(tmp_path):
    pdf, _ = _table(tmp_path)
    source = tmp_path / "source.pdf"
    source.write_bytes(pdf.read_bytes())
    result = overlay.apply_table_translations(output_pdf_path=pdf, source_pdf_path=source, translations_dir=tmp_path, page_indices=[0])
    assert result["tables_written"] == 1, result
    with fitz.open(pdf) as doc:
        page = doc[0]
        text = page.get_text()
        drawn = page.get_drawings()
    for word in ("Sample", "Capacity", "Pristine", "Coated"):
        assert word not in text
    for word in ("样品", "容量", "原始", "包覆", "268.4", "65.9"):
        assert word in text
    # 原表的三条线擦掉了，引擎画的三条线（细长的实心矩形）在原表的框里
    rules = [fitz.Rect(d["rect"]) for d in drawn]
    assert len(rules) == 3 and all(55 - 1 <= r.x0 and r.x1 <= 305 + 1 for r in rules)


@pytest.mark.skipif(not _engine_available(), reason="rpr 引擎（node + 依赖 + rpr-table.js）不在本机")
def test_a_table_that_does_not_fit_is_kept(tmp_path):
    long = dict(TRANSLATIONS, r1c0="非常长的样品名称" * 40)
    pdf, _ = _table(tmp_path, long)
    source = tmp_path / "source.pdf"
    source.write_bytes(pdf.read_bytes())
    before = pdf.read_bytes()
    result = overlay.apply_table_translations(output_pdf_path=pdf, source_pdf_path=source, translations_dir=tmp_path, page_indices=[0])
    assert result["tables_written"] == 0 and result["details"][0]["skipped"] == "does_not_fit"
    assert pdf.read_bytes() == before

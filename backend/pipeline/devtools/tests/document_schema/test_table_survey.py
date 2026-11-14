"""表格摸底脚本（表格翻译 T0）：三类表格的判断、HTML 网格、只出计数。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz

DEVTOOLS = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(DEVTOOLS))

import table_survey  # noqa: E402

FIXTURE = (
    Path(__file__).resolve().parent
    / "fixtures"
    / "synthetic"
    / "paddle_vl_english_paper"
    / "expected.document.v1.json"
)
TABLE_BOX = [72, 72, 300, 200]


def _pdf_page(tmp_path: Path, kind: str) -> fitz.Page:
    doc = fitz.open()
    page = doc.new_page()
    if kind == "text":
        page.insert_text((80, 100), "Sample  Voc  Jsc  FF", fontsize=10)
        page.insert_text((80, 120), "Control  1.12  24.1  80.2", fontsize=10)
    elif kind == "image":
        pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 20, 20), False)
        pix.clear_with(200)
        page.insert_image(fitz.Rect(80, 80, 280, 180), pixmap=pix)
    elif kind == "paths":
        shape = page.new_shape()
        for index in range(600):
            x = 80 + (index % 60) * 3
            y = 90 + (index // 60) * 8
            shape.draw_line((x, y), (x + 2, y + 2))
        shape.finish()
        shape.commit()
    path = tmp_path / f"{kind}.pdf"
    doc.save(path)
    return fitz.open(path)[0]


def test_source_kind_tells_text_layer_image_and_outlined_text_apart(tmp_path: Path) -> None:
    assert table_survey.table_source_kind(_pdf_page(tmp_path, "text"), TABLE_BOX) == table_survey.SOURCE_TEXT_LAYER
    assert table_survey.table_source_kind(_pdf_page(tmp_path, "image"), TABLE_BOX) == table_survey.SOURCE_IMAGE
    # 字被转成曲线：没有文字层、没有图片，但页面上有大量矢量路径（2026-11-12 摸底里约 15% 的表）
    assert table_survey.table_source_kind(_pdf_page(tmp_path, "paths"), TABLE_BOX) == table_survey.SOURCE_VECTOR_PATHS
    assert table_survey.table_source_kind(_pdf_page(tmp_path, "empty"), TABLE_BOX) == table_survey.SOURCE_UNKNOWN


def test_grid_counts_cells_and_spanning_cells() -> None:
    grid = table_survey.parse_table_grid(
        "<table><tr><th colspan='2'>Device</th><th>FF (%)</th></tr>"
        "<tr><td>Control</td><td>1.12</td><td>80.2<sup>a</sup></td></tr></table>"
    )
    assert grid.cells == ["Device", "FF (%)", "Control", "1.12", "80.2a"]
    assert grid.spanning_cells == 1
    assert [table_survey.classify_cell_text(cell) for cell in grid.cells] == [
        "texty", "texty", "texty", "numeric_like", "numeric_like",
    ]


def test_survey_reads_the_ocr_table_html_and_outputs_only_counts() -> None:
    document = json.loads(FIXTURE.read_text(encoding="utf-8"))
    counts = table_survey.survey_document(document, source_pdf=None)
    assert counts["tables"] >= 1
    assert counts["tables_without_html"] == 0, "表格的 HTML 在 segments / lines 里"
    assert counts["cells"] > 0
    assert counts["source_unknown"] == counts["tables"], "没有原文 PDF 时归 unknown"
    # 只有计数，没有文字内容
    assert all(isinstance(value, int) for value in counts.values())


def test_same_document_from_two_jobs_is_counted_once(tmp_path: Path) -> None:
    document = FIXTURE.read_text(encoding="utf-8")
    for job in ("job-a", "job-b"):
        target = tmp_path / job / "ocr" / "normalized"
        target.mkdir(parents=True)
        (target / "document.v1.json").write_text(document, encoding="utf-8")
    result = table_survey.survey_jobs(tmp_path)
    assert result["total"]["documents"] == 1
    assert result["total"]["documents_duplicate_skipped"] == 1
    assert len(result["per_document"]) == 1


def test_table_html_is_not_cut_at_the_first_formula() -> None:
    """表里有公式时 OCR 把 HTML 拆成多段，只取第一段会把表截断（2026-11-12 发现，大半的表被截断过）。"""
    segments = [
        {"type": "text", "text": "<table><tr><td>E"},
        {"type": "inline_formula", "text": "^{3}"},
        {"type": "text", "text": "LLCT</td><td>1.2</td></tr></table>"},
    ]
    from_segments = table_survey.table_html({"segments": segments})
    assert from_segments.endswith("</table>")
    assert "$ ^{3} $" in from_segments
    whole = "<table><tr><td>E$ ^{3} $LLCT</td><td>1.2</td></tr></table>"
    assert table_survey.table_html({"text": whole, "segments": segments}) == whole
    assert table_survey.parse_table_grid(from_segments).cells == ["E$ ^{3} $LLCT", "1.2"]

from __future__ import annotations

import fitz
import pytest

from retainpdf_pipeline.ocr.document_schema import build_validation_report
from retainpdf_pipeline.ocr.document_schema.table_cells import enrich_table_cells
from retainpdf_pipeline.render.output.table_cells import render_translated_table_cells
from retainpdf_translation.services.context.windows import annotate_translation_context_windows
from retainpdf_translation.core.orchestration.zones import annotate_payload_layout_zones
from retainpdf_translation.core.ocr.json_extractor import extract_text_items
from retainpdf_translation.core.payload.template_records import build_translation_record
from retainpdf_translation.services.continuation.rules import eligible
from retainpdf_translation.workflow.pages import load_page_payloads


def make_table_pdf(path):
    with fitz.open() as pdf:
        page = pdf.new_page(width=500, height=340)
        page.draw_rect((30, 60, 470, 290), color=None, fill=(0.95, 0.9, 0.8))
        for x in (30, 270, 370, 470):
            page.draw_line((x, 60), (x, 290))
        for y in (60, 106, 152, 198, 244, 290):
            page.draw_line((30, y), (470, y))
        labels = ["Criteria", "Deadline", "Report content", "Lab review (questions)/Test", "Total"]
        for row, label in enumerate(labels):
            page.insert_text((38, 87 + row * 46), label, fontsize=12)
            page.insert_text((290, 87 + row * 46), "Min points" if row == 0 else "0", fontsize=12)
            page.insert_text((390, 87 + row * 46), "Max points" if row == 0 else str(row), fontsize=12)
        page.insert_text((30, 35), "Outside the table", fontsize=14)
        page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(38, 113, 100, 139),
                          "uri": "https://example.com/deadline"})
        pdf.save(path)


def table_document():
    return {
        "schema": "normalized_document_v1", "schema_version": "1.1",
        "document_id": "table-regression", "page_count": 1, "source": {"provider": "paddle"},
        "markers": {}, "derived": {},
        "pages": [{"page_index": 0, "width": 500, "height": 340, "unit": "pt", "blocks": [{
            "block_id": "p001-b0000", "page_index": 0, "order": 0, "reading_order": 0,
            "type": "table", "text": "", "bbox": [30, 60, 470, 290],
            "geometry": {"bbox": [30, 60, 470, 290]}, "content": {"kind": "table", "text": ""},
            "layout_role": "unknown", "semantic_role": "unknown", "structure_role": "table",
            "policy": {"translate": False, "translate_reason": "non_text"},
            "provenance": {"provider": "paddle", "raw_label": "table", "raw_sub_type": "",
                           "raw_bbox": [30, 60, 470, 290], "raw_path": "test"},
            "continuation_hint": {"source": "", "group_id": "", "role": "", "scope": "",
                                  "reading_order": -1, "confidence": 0.0},
            "metadata": {}, "source": {"provider": "paddle"},
        }]}],
    }


def translated_cells(document):
    translations = {
        "Criteria": "评分标准", "Min points": "最低分", "Max points": "最高分",
        "Deadline": "截止时间", "Report content": "报告内容",
        "Lab review (questions)/Test": "实验答辩（问答）/测试", "Total": "总分",
    }
    items = [build_translation_record(item, math_mode="direct_typst") for item in extract_text_items(document, 0)]
    for item in items:
        item["translated_text"] = translations[item["source_text"]]
    return items


def test_table_translation_toggle_prunes_previous_cells_and_can_reenable(tmp_path):
    source = tmp_path / "source.pdf"
    make_table_pdf(source)
    document = table_document()
    with fitz.open(source) as pdf:
        enrich_table_cells(document, pdf)
    output = tmp_path / "translations"
    _, enabled = load_page_payloads(data=document, output_dir=output, page_indices=range(1), translate_tables=True)
    assert len(enabled[0]) == 7
    assert all(item["metadata"]["table_cell"] for item in enabled[0])
    assert "Translate descriptive method/model names" in enabled[0][0]["translation_style_hint"]
    paths, disabled = load_page_payloads(data=document, output_dir=output, page_indices=range(1))
    assert disabled[0] == []
    assert paths[0].read_text(encoding="utf-8").strip() == "[]"
    _, enabled_again = load_page_payloads(data=document, output_dir=output, page_indices=range(1), translate_tables=True)
    assert len(enabled_again[0]) == 7


def test_table_translation_keeps_cells_grid_numbers_and_background(tmp_path):
    path = tmp_path / "table.pdf"
    make_table_pdf(path)
    document = table_document()
    with fitz.open(path) as pdf:
        enrich_table_cells(document, pdf)
        enrich_table_cells(document, pdf)  # Re-normalization must not duplicate cells.
        original_drawings = pdf[0].get_drawings()
    build_validation_report(document)
    items = translated_cells(document)
    assert len(items) == 7
    assert all(item["should_translate"] and not eligible(item) for item in items)
    annotate_translation_context_windows({0: items})
    assert all("Criteria" in item["translation_context_before"] for item in items)
    body = {**items[0], "metadata": {}, "bbox": [30, 10, 470, 45]}
    annotate_payload_layout_zones([body, *items])
    assert body["layout_zone_size"] == 1
    result = render_translated_table_cells(path, {0: items}, mode="overlay")
    assert result == {"translated": 7, "kept_source": []}
    with fitz.open(path) as pdf:
        page = pdf[0]
        assert page.get_drawings() == original_drawings
        assert "Outside the table" in page.get_text()
        links = page.get_links()
        assert len(links) == 1 and links[0]["uri"] == "https://example.com/deadline"
        assert "截止时间" in page.get_text(clip=links[0]["from"])
        for item in items:
            box = fitz.Rect(item["metadata"]["table_cell"]["bbox"])
            text = page.get_text(clip=box).replace("\n", "").replace(" ", "")
            assert item["translated_text"].replace(" ", "") in text
            assert item["source_text"] not in page.get_text(clip=box)
        for row in range(1, 5):
            assert page.get_text(clip=fitz.Rect(270, 60 + row * 46, 370, 106 + row * 46)).strip() == "0"
            assert page.get_text(clip=fitz.Rect(370, 60 + row * 46, 470, 106 + row * 46)).strip() == str(row)


@pytest.mark.parametrize("mode,extract,shift", [("dual", False, 500), ("overlay", True, 0)])
def test_table_translation_maps_selected_and_dual_pages(tmp_path, mode, extract, shift):
    path = tmp_path / "table.pdf"
    make_table_pdf(path)
    document = table_document()
    with fitz.open(path) as source:
        enrich_table_cells(document, source)
        if mode == "dual":
            dual_path = tmp_path / "dual.pdf"
            with fitz.open() as dual:
                page = dual.new_page(width=1000, height=340)
                page.show_pdf_page(fitz.Rect(0, 0, 500, 340), source, 0)
                page.show_pdf_page(fitz.Rect(500, 0, 1000, 340), source, 0)
                dual.save(dual_path)
            path = dual_path
    result = render_translated_table_cells(path, {3: translated_cells(document)}, mode=mode,
                                           start_page=3, extract_selected_pages=extract)
    assert result["translated"] == 7
    with fitz.open(path) as pdf:
        assert "评分标准" in pdf[0].get_text(clip=fitz.Rect(30 + shift, 60, 270 + shift, 106))
        if mode == "dual":
            assert "Criteria" in pdf[0].get_text(clip=fitz.Rect(30, 60, 270, 106))


def test_untranslated_or_overflowing_cells_keep_source(tmp_path):
    path = tmp_path / "table.pdf"
    make_table_pdf(path)
    document = table_document()
    with fitz.open(path) as pdf:
        enrich_table_cells(document, pdf)
    items = translated_cells(document)
    items[0]["translated_text"] = ""
    items[1]["translated_text"] = "无法放入单元格的很长译文" * 500
    items[2]["translated_text"] = "最高分 123"
    items[3]["translated_text"] = r"时间 $\frac{1}{2}$"
    result = render_translated_table_cells(path, {0: items[:4]}, mode="overlay")
    assert result["translated"] == 0
    assert {item["reason"] for item in result["kept_source"]} == {
        "untranslated", "cell_overflow", "numeric_content_changed", "complex_cell_math",
    }
    with fitz.open(path) as pdf:
        assert "Criteria" in pdf[0].get_text()
        assert "Min points" in pdf[0].get_text()


def test_borderless_html_cells_keep_merged_headers_and_numeric_phrases(tmp_path):
    path = tmp_path / "borderless.pdf"
    with fitz.open() as pdf:
        page = pdf.new_page(width=500, height=340)
        for x, y, text in [(38, 85, "Experiment"), (285, 75, "Score"),
                           (280, 110, "Before"), (380, 110, "After"),
                           (38, 170, "Trusted the bad model"), (280, 170, "10 out of 27"),
                           (380, 170, "3 out of 27"), (38, 225, "Snow as a potential feature"),
                           (280, 225, "12 out of 27"), (380, 225, "25 out of 27")]:
            page.insert_text((x, y), text, fontsize=10)
        pdf.save(path)
    document = table_document()
    document["pages"][0]["blocks"][0]["content"]["table_html"] = (
        '<table><tr><th rowspan="2">Experiment</th><th colspan="2">Score</th></tr>'
        '<tr><th>Before</th><th>After</th></tr>'
        '<tr><td>Trusted the bad model</td><td>10 out of 27</td><td>3 out of 27</td></tr>'
        '<tr><td>Snow as a potential feature</td><td>12 out of 27</td><td>25 out of 27</td></tr></table>'
    )
    with fitz.open(path) as pdf:
        enrich_table_cells(document, pdf)
    items = [build_translation_record(item, math_mode="direct_typst") for item in extract_text_items(document, 0)]
    by_text = {item["source_text"]: item for item in items}
    assert len(items) == 10
    assert "10 out of 27" in by_text and "Snow as a potential feature" in by_text
    box = lambda name: fitz.Rect(by_text[name]["metadata"]["table_cell"]["bbox"])
    assert box("Experiment").y1 == box("Before").y1
    assert box("Score").x1 == box("After").x1
    numeric_item = by_text["10 out of 27"]
    numeric_item["translated_text"] = "27 人中有 10 人"
    result = render_translated_table_cells(path, {0: [numeric_item]}, mode="overlay")
    assert result["translated"] == 1


def test_inline_symbol_renders_without_literal_math_delimiters(tmp_path):
    path = tmp_path / "inline-symbol.pdf"
    make_table_pdf(path)
    document = table_document()
    with fitz.open(path) as pdf:
        enrich_table_cells(document, pdf)
    item = translated_cells(document)[0]
    item["translated_text"] = "评分标准 $x$"
    assert render_translated_table_cells(path, {0: [item]}, mode="overlay")["translated"] == 1
    with fitz.open(path) as pdf:
        text = pdf[0].get_text(clip=fitz.Rect(item["bbox"]))
        assert "评分标准" in text and "x" in text and "$" not in text

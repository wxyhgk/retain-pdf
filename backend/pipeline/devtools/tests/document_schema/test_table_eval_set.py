"""表格翻译评测集的记录：格式对、指向的样例 PDF 和页码真的存在、没有本机路径。"""
from __future__ import annotations

import json
from pathlib import Path

import fitz

REPO = Path(__file__).resolve().parents[5]
TABLES = REPO / "tests" / "fixtures" / "tables"
PDFS = REPO / "tests" / "fixtures" / "pdfs"


def _records(provider: str) -> list[dict]:
    return json.loads((TABLES / "ocr" / f"{provider}.tables.json").read_text(encoding="utf-8"))


def test_each_provider_has_records_for_the_same_pages() -> None:
    pages = {}
    for provider in ("glm_ocr", "paddle"):
        records = _records(provider)
        assert records, provider
        pages[provider] = {(record["fixture"], record["source_page"]) for record in records}
    assert pages["glm_ocr"] == pages["paddle"], "两家对同一批页做的 OCR"


def test_records_point_at_real_fixture_pages_and_carry_table_html() -> None:
    page_counts = {}
    for provider in ("glm_ocr", "paddle"):
        for record in _records(provider):
            assert record["record_version"] == "table_eval_record.v1"
            assert record["provider"] == provider
            fixture = PDFS / record["fixture"]
            assert fixture.is_file(), record["fixture"]
            if fixture.name not in page_counts:
                with fitz.open(fixture) as document:
                    page_counts[fixture.name] = len(document)
            assert 1 <= record["source_page"] <= page_counts[fixture.name]
            assert "<t" in record["html"], record["table_id"]
            x0, y0, x1, y1 = record["bbox_pt"]
            width, height = record["page_size_pt"]
            assert 0 <= x0 < x1 <= width + 1 and 0 <= y0 < y1 <= height + 1, record["table_id"]


def test_no_local_paths_in_the_eval_set() -> None:
    for path in TABLES.rglob("*.json"):
        text = path.read_text(encoding="utf-8")
        for marker in ("/Users/", "/private/", "/home/", "C:\\\\"):
            assert marker not in text, f"{path.name} 里有本机路径"


LABEL_KEYS = {
    "label_version", "label_id", "fixture", "source_page", "bbox_pt", "source_kind",
    "caption", "footnotes", "rows", "tags", "notes",
}


def _labels() -> list[dict]:
    return [json.loads(path.read_text(encoding="utf-8")) for path in sorted((TABLES / "labels").glob("*.json"))]


def test_every_ocr_table_has_a_label_and_labels_are_well_formed() -> None:
    labels = _labels()
    assert len(labels) == 55
    pages = {(record["fixture"], record["source_page"]) for record in _records("glm_ocr")}
    assert {(label["fixture"], label["source_page"]) for label in labels} == pages
    for label in labels:
        assert set(label) == LABEL_KEYS, label["label_id"]
        assert label["label_version"] == "table_label.v1"
        assert label["source_kind"] in {"text_layer", "vector_paths", "image"}
        occupied: dict[int, set[int]] = {}
        for row_index, row in enumerate(label["rows"]):
            column = 0
            for cell in row:
                while column in occupied.setdefault(row_index, set()):
                    column += 1
                for dr in range(cell["rowspan"]):
                    for dc in range(cell["colspan"]):
                        occupied.setdefault(row_index + dr, set()).add(column + dc)
                column += cell["colspan"]
                assert cell["role"] in {"header", "stub", "data", "empty"}
                assert cell["action"] in {"translate", "keep"}
                if cell["action"] == "translate":
                    assert cell["reference"], f"{label['label_id']}: {cell['text']} 要翻却没有参考译文"
                else:
                    assert cell["reference"] is None, f"{label['label_id']}: {cell['text']}"
        widths = {len(occupied[index]) for index in range(len(label["rows"]))}
        assert len(widths) == 1, f"{label['label_id']}: 每行占的列数不一致 {widths}"


def test_same_source_text_has_one_reference_within_a_document() -> None:
    seen: dict[tuple[str, str], str] = {}
    for label in _labels():
        for row in label["rows"]:
            for cell in row:
                if cell["action"] != "translate":
                    continue
                key = (label["fixture"], cell["text"].strip())
                assert seen.setdefault(key, cell["reference"].strip()) == cell["reference"].strip(), key

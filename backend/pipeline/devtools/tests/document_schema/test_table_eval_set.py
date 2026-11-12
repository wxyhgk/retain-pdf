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

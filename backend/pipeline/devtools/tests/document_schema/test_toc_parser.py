from pathlib import Path
import sys


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.ocr.document_schema.toc import build_toc_entries
from retainpdf_pipeline.ocr.document_schema.toc import order_toc_lines_by_geometry
from retainpdf_pipeline.ocr.document_schema.toc import parse_toc_line


def test_parse_toc_line_accepts_numbered_title_page_without_dot_leader() -> None:
    parsed = parse_toc_line("3 Thermochemistry output from Gaussian 8")

    assert parsed == {
        "number": "3",
        "title": "Thermochemistry output from Gaussian",
        "page_label": "8",
        "level": 1,
    }


def test_build_toc_entries_keeps_mixed_leader_and_plain_page_lines() -> None:
    line_texts = [
        "1 Introduction 2",
        "2 Sources of components for thermodynamic quantities 2",
        "2.1 Contributions from translation ..... 3",
        "3.2 Output from compound model chemistries 11",
        "5 Summary 17",
    ]
    lines = [
        {"bbox": [10.0, 20.0 + index * 10.0, 200.0, 30.0 + index * 10.0]}
        for index in range(len(line_texts))
    ]

    entries = build_toc_entries(lines=lines, line_texts=line_texts)

    assert [entry["number"] for entry in entries] == ["1", "2", "2.1", "3.2", "5"]
    assert [entry["page_label"] for entry in entries] == ["2", "2", "3", "11", "17"]
    assert entries[0]["line_index"] == 0
    assert entries[-1]["bbox"] == [10.0, 60.0, 200.0, 70.0]


def test_parse_toc_line_rejects_ordinary_sentence_without_section_number() -> None:
    assert parse_toc_line("The final energy is evaluated in 2 steps") is None


def test_build_toc_entries_orders_two_column_toc_by_geometry() -> None:
    line_texts = [
        "1 Left first 1",
        "4 Right first 4",
        "2 Left second 2",
        "5 Right second 5",
        "3 Left third 3",
        "6 Right third 6",
    ]
    lines = [
        {"bbox": [50.0, 100.0, 240.0, 112.0]},
        {"bbox": [300.0, 100.0, 520.0, 112.0]},
        {"bbox": [50.0, 120.0, 240.0, 132.0]},
        {"bbox": [300.0, 120.0, 520.0, 132.0]},
        {"bbox": [50.0, 140.0, 240.0, 152.0]},
        {"bbox": [300.0, 140.0, 520.0, 152.0]},
    ]

    ordered = order_toc_lines_by_geometry(lines=lines, line_texts=line_texts)
    entries = build_toc_entries(lines=lines, line_texts=line_texts)

    assert [index for index, _text, _line in ordered] == [0, 2, 4, 1, 3, 5]
    assert [entry["number"] for entry in entries] == ["1", "2", "3", "4", "5", "6"]
    assert [entry["order_index"] for entry in entries] == [0, 1, 2, 3, 4, 5]

"""分类草案、复杂样例 PDF 的标准答案、查看器生成。"""

from __future__ import annotations

import json
from pathlib import Path

import fitz

from devtools.ocr_viewer.complex_sample import build
from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES
from devtools.ocr_viewer.taxonomy import check_taxonomy
from devtools.ocr_viewer.viewer import PLACEHOLDER
from devtools.ocr_viewer.viewer import build_viewer
from devtools.ocr_viewer.viewer import check_truth

# 样例里故意没有的类别：目录条目要单独造目录页，未知留给真实 OCR。
NOT_IN_SAMPLE = {"toc_entry", "unknown"}


def _sample(tmp_path: Path) -> tuple[Path, dict]:
    pdf_path, truth_path = build().save(tmp_path)
    return pdf_path, json.loads(truth_path.read_text(encoding="utf-8"))


def test_taxonomy_is_consistent() -> None:
    assert check_taxonomy() == []


def test_sample_uses_every_class_and_passes_truth_check(tmp_path: Path) -> None:
    _, truth = _sample(tmp_path)
    assert check_truth(truth) == []
    used = {element["class"] for element in truth["elements"]}
    assert used == set(BLOCK_CLASSES) - NOT_IN_SAMPLE
    assert len({element["id"] for element in truth["elements"]}) == len(truth["elements"])


def test_sample_has_column_and_page_continuations(tmp_path: Path) -> None:
    _, truth = _sample(tmp_path)
    by_id = {element["id"]: element for element in truth["elements"]}
    continued = [(by_id[e["relations"]["continues"]], e) for e in truth["elements"] if "continues" in e.get("relations", {})]
    assert any(head["page"] != tail["page"] for head, tail in continued), "no cross-page continuation"
    assert any(head["page"] == tail["page"] and head["bbox"][0] != tail["bbox"][0] for head, tail in continued), "no cross-column continuation"


def test_truth_boxes_sit_on_the_rendered_text(tmp_path: Path) -> None:
    pdf_path, truth = _sample(tmp_path)
    with fitz.open(pdf_path) as pdf:
        assert pdf.page_count == len(truth["pages"])
        for element in truth["elements"]:
            page = pdf[element["page"]]
            words = page.get_text("words")
            for line in element["lines"]:
                rect = fitz.Rect(line["bbox"])
                assert rect.is_valid and not rect.is_empty, (element["id"], line)
                assert fitz.Rect(element["bbox"]).contains(rect) or fitz.Rect(element["bbox"]).intersects(rect), element["id"]
                assert any(fitz.Rect(w[:4]).intersects(rect) for w in words), (element["id"], line["text"])


def test_sample_is_deterministic(tmp_path: Path) -> None:
    _, first = _sample(tmp_path / "a")
    _, second = _sample(tmp_path / "b")
    assert first == second


def test_viewer_embeds_taxonomy_truth_and_pages(tmp_path: Path) -> None:
    pdf_path, truth_path = build().save(tmp_path)
    html = build_viewer(pdf_path, truth_path, tmp_path / "viewer.html", dpi=40).read_text(encoding="utf-8")
    assert PLACEHOLDER not in html
    blob = html.split('<script id="data" type="application/json">', 1)[1].split("</script>", 1)[0]
    data = json.loads(blob)
    assert data["truth"]["document_id"] == "complex_paper"
    assert len(data["images"]) == 2 and all(src.startswith("data:image/png;base64,") for src in data["images"])
    assert set(data["taxonomy"]["block_classes"]) == set(BLOCK_CLASSES)

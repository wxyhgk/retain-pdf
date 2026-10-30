"""教科书样例（sample_textbook）：能排出来、能交给翻译 agent 的页整理，页边注、例题跨页、习题列表、术语加粗这些埋点都在。"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fitz
import pytest

from devtools.agent_lab import sample_textbook
from devtools.agent_lab.pages import build_pages
from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES


def _build(tmp_path: Path):
    doc = sample_textbook.build()
    pdf_path, truth_path = doc.save(tmp_path)
    return doc, pdf_path, json.loads(truth_path.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    """样例排一次要几秒：同一个文件里的测试共用一份（都只读）。"""
    return _build(tmp_path_factory.mktemp("textbook"))


def _by_id(truth: dict) -> dict[str, dict]:
    return {e["id"]: e for e in truth["elements"]}


def test_builds_and_feeds_the_page_builder(built) -> None:
    doc, pdf_path, truth = built
    assert truth["document_id"] == "sample_textbook"
    assert len(truth["pages"]) >= 5
    assert len(fitz.open(pdf_path)) == len(truth["pages"])
    assert doc.page_labels == {i: str(71 + i) for i in range(len(truth["pages"]))}
    pages = build_pages(truth, page_labels=doc.page_labels)
    assert len(pages) == len(truth["pages"])
    blocks = [b for p in pages for b in p.blocks]
    assert {b.id for b in blocks} == {e["id"] for e in truth["elements"]}
    assert all(p.to_translate() for p in pages)


def test_classes_ids_and_page_boxes_are_sane(built) -> None:
    _, _, truth = built
    ids = [e["id"] for e in truth["elements"]]
    assert len(ids) == len(set(ids))
    assert all(e["class"] in BLOCK_CLASSES for e in truth["elements"])
    size = {p["index"]: (p["width"], p["height"]) for p in truth["pages"]}
    for e in truth["elements"]:
        width, height = size[e["page"]]
        x0, y0, x1, y1 = e["bbox"]
        assert 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height, e["id"]
    # 同一页上的块不许互相压住（缩进半个点，免得贴边算重叠）
    for page in size:
        boxes = [(e["id"], e["bbox"]) for e in truth["elements"] if e["page"] == page]
        for i, (a_id, a) in enumerate(boxes):
            for b_id, b in boxes[i + 1 :]:
                overlap = min(a[2], b[2]) - max(a[0], b[0]) > 0.5 and min(a[3], b[3]) - max(a[1], b[1]) > 0.5
                assert not overlap, (page, a_id, b_id)
    # 行首不许是标点：公式、粗体后面紧跟的逗号不该被换到下一行开头
    for e in truth["elements"]:
        for line in e["lines"]:
            assert not re.match(r"[,.;:)%]", line["text"]), (e["id"], line["text"][:20])


def test_has_continuation_groups_including_an_example_and_an_exercise(built) -> None:
    _, _, truth = built
    by_id = _by_id(truth)
    continued = {e["id"]: e["relations"]["continues"] for e in truth["elements"] if "continues" in (e.get("relations") or {})}
    assert continued
    heads = {by_id[head]["text"][:7] for head in continued.values()}
    assert "Example" in heads  # 例题跨页
    assert any(by_id[head]["class"] == "list_item" for head in continued.values())  # 习题自己被切成两半
    for tail, head in continued.items():
        assert by_id[tail]["page"] > by_id[head]["page"]


def test_exercises_are_list_items_numbered_3_1_to_3_12_across_pages(built) -> None:
    _, _, truth = built
    items = [e for e in truth["elements"] if e["class"] == "list_item" and e["id"].startswith("ex-3.")]
    assert [e["text"].split()[0] for e in items if "continues" not in (e.get("relations") or {})] == [f"3.{i}" for i in range(1, 13)]
    assert len({e["page"] for e in items}) >= 2  # 习题列表跨页


def test_definitions_theorems_and_examples_are_paragraphs_with_numbers_in_the_text(built) -> None:
    _, _, truth = built
    paragraphs = [e["text"] for e in truth["elements"] if e["class"] == "paragraph"]
    for label in ("Definition 3.1", "Definition 3.2", "Example 3.3", "Example 3.4", "Theorem 3.5", "Definition 3.6", "Theorem 3.7", "Example 3.8"):
        assert any(text.startswith(label) for text in paragraphs), label
    # 正文里回头引用
    assert any("Example 3.4" in e["text"] for e in truth["elements"] if e["class"] in ("margin_note", "paragraph") and not e["text"].startswith("Example 3.4"))
    assert any("Exercise 3.3" in text for text in (e["text"] for e in truth["elements"]))


def test_margin_notes_hang_on_paragraphs_and_mirror_on_odd_even_pages(built) -> None:
    _, _, truth = built
    by_id = _by_id(truth)
    width = truth["pages"][0]["width"]
    notes = [e for e in truth["elements"] if e["class"] == "margin_note"]
    assert len(notes) >= 5
    sides = set()
    for note in notes:
        anchor = by_id[note["relations"]["note_of"]]
        assert anchor["class"] == "paragraph" and anchor["page"] == note["page"]
        assert note["bbox"][1] >= anchor["bbox"][1] - 0.5  # 不比它挂的段落高
        x0, _, x1, _ = note["bbox"]
        if note["page"] % 2 == 0:  # 右页（奇数页码）：边注在版心右边
            assert x0 > anchor["bbox"][2], note["id"]
            sides.add("right")
        else:
            assert x1 < anchor["bbox"][0], note["id"]
            sides.add("left")
        assert (x0 + x1) / 2 > width / 2 if note["page"] % 2 == 0 else (x0 + x1) / 2 < width / 2
    assert sides == {"left", "right"}
    # 边注里也有行内公式
    assert any(inline["class"] == "inline_formula" for note in notes for inline in note.get("inlines", []))


def test_display_formulas_have_numbers_and_inline_formulas_carry_latex(built) -> None:
    _, _, truth = built
    by_id = _by_id(truth)
    formulas = [e for e in truth["elements"] if e["class"] == "display_formula"]
    assert len(formulas) >= 5
    numbers = [e for e in truth["elements"] if e["class"] == "formula_number"]
    assert [e["text"] for e in numbers][:3] == ["(3.1)", "(3.2)", "(3.3)"]
    for number in numbers:
        assert by_id[number["relations"]["number_of"]]["class"] == "display_formula"
    inlines = [i for e in truth["elements"] for i in e.get("inlines", []) if i["class"] == "inline_formula"]
    assert len(inlines) >= 30 and all(i.get("latex") for i in inlines)
    assert any("\\mu" in i["latex"] for i in inlines) and any("\\bar{x}" in i["latex"] for i in inlines)
    # 翻译 agent 的输入里公式写成 $latex$
    pages = build_pages(truth, page_labels={p["index"]: str(71 + p["index"]) for p in truth["pages"]})
    texts = [b.source for p in pages for b in p.blocks]
    assert any("$\\mu$" in text for text in texts)


def test_figure_with_shared_caption_table_with_caption_and_note_and_code(built) -> None:
    _, _, truth = built
    by_id = _by_id(truth)
    caption = by_id["fig-31-cap"]
    assert caption["class"] == "figure_caption" and len(caption["relations"]["caption_of"]) == 3
    assert all(by_id[i]["class"] == "figure" for i in caption["relations"]["caption_of"])
    assert by_id["fig-32-cap"]["relations"]["caption_of"] == ["fig-32"]
    assert by_id["tab-31-cap"]["class"] == "table_caption" and by_id["tab-31"]["class"] == "table"
    assert by_id["tab-31-note"]["class"] == "float_note" and by_id["tab-31-note"]["relations"]["note_of"] == "tab-31"
    assert by_id["code-31-cap"]["class"] == "code_caption" and by_id["code-31"]["class"] == "code_block"


def test_footnotes_sit_on_the_same_page_as_their_marks(built) -> None:
    _, _, truth = built
    by_id = _by_id(truth)
    marks = [(e, i) for e in truth["elements"] for i in e.get("inlines", []) if i["class"] == "footnote_mark"]
    notes = [e for e in truth["elements"] if e["class"] == "footnote"]
    assert len(marks) == len(notes) >= 4
    for element, mark in marks:
        note = by_id[mark["target"]]
        assert note["page"] == element["page"], mark["target"]
        assert note["relations"]["note_of"] == element["id"]
    assert any(i["class"] == "citation" for e in truth["elements"] for i in e.get("inlines", []))


def test_headers_differ_on_odd_and_even_pages_and_the_opener_has_none(built) -> None:
    _, _, truth = built
    headers = {e["page"]: e["text"] for e in truth["elements"] if e["class"] == "running_header"}
    assert 0 not in headers  # 章首页没有页眉
    verso = {text for page, text in headers.items() if page % 2 == 1}
    recto = {text for page, text in headers.items() if page % 2 == 0}
    assert verso == {sample_textbook.BOOK_TITLE}
    assert recto and not recto & verso and len(recto) >= 2  # 右页是节名，随节变
    labels = [e["text"] for e in sorted((e for e in truth["elements"] if e["class"] == "page_number"), key=lambda e: e["page"])]
    assert labels == [str(71 + i) for i in range(len(truth["pages"]))]
    # 页码在外侧：右页靠右、左页靠左
    for e in truth["elements"]:
        if e["class"] == "page_number":
            assert (e["bbox"][2] > 300) == (e["page"] % 2 == 0)


def test_chapter_structure_has_levels_objectives_and_summary(built) -> None:
    _, _, truth = built
    headings = {e["text"]: e["attributes"]["level"] for e in truth["elements"] if e["class"] == "section_heading"}
    assert headings["3 Sampling Distributions and the Central Limit Theorem"] == 1
    assert headings["Learning objectives"] == 2 and headings["Chapter summary"] == 2 and headings["Exercises"] == 2
    assert 3 in headings.values()
    objectives = [e for e in truth["elements"] if e["id"].startswith("obj-")]
    summary = [e for e in truth["elements"] if e["id"].startswith("sum-")]
    assert len(objectives) == 5 and len(summary) == 5
    assert all(e["class"] == "list_item" for e in objectives + summary)


def test_terms_are_bold_where_they_are_defined_and_not_before(built) -> None:
    doc, pdf_path, truth = built
    by_id = _by_id(truth)
    terms = doc.bold_terms
    assert {"population", "sample", "sampling variability", "parameter", "statistic", "sampling distribution", "standard error", "Central Limit Theorem"} <= set(terms)
    pdf = fitz.open(pdf_path)
    bold_by_page = {}
    for index, page in enumerate(pdf):
        spans = [s["text"] for b in page.get_text("dict")["blocks"] for line in b.get("lines", []) for s in line["spans"] if "Bold" in s["font"]]
        bold_by_page[index] = " ".join(" ".join(spans).split())
    body = False
    first_seen: dict[str, str] = {}
    for element in truth["elements"]:
        if element["id"] == "h-31":
            body = True
        if not body or element["class"] not in ("paragraph", "list_item"):
            continue
        for term in terms:
            if term not in first_seen and re.search(rf"\b{re.escape(term)}\b", element["text"], re.IGNORECASE):
                first_seen[term] = element["id"]
    # 学习目标里已经用过这些词，但加粗要等到第 3.1 节起的第一次出现
    assert any(re.search(r"\bparameter\b", e["text"]) for e in truth["elements"] if e["id"].startswith("obj-"))
    for term, element_id in terms.items():
        assert first_seen[term] == element_id, (term, first_seen[term], element_id)
        assert term in by_id[element_id]["text"]
        assert term in bold_by_page[by_id[element_id]["page"]], term

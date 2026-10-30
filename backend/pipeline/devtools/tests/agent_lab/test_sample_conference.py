"""会议论文样例（A4 双栏、约 7 页）：能造出来、答案自洽、这类文档特有的东西都在。离线，不调模型。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from devtools.agent_lab import sample_conference
from devtools.agent_lab.pages import build_pages
from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    doc = sample_conference.build()
    out = tmp_path_factory.mktemp("conference")
    pdf_path, truth_path = doc.save(out)
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    return doc, pdf_path, truth


def _by_id(truth: dict) -> dict[str, dict]:
    return {e["id"]: e for e in truth["elements"]}


def _column(element: dict, page_width: float) -> str:
    x0, _, x1, _ = element["bbox"]
    if x1 - x0 > page_width * 0.6:
        return "full"
    return "left" if (x0 + x1) / 2 < page_width / 2 else "right"


def test_builds_pages_for_the_translation_agent(built) -> None:
    doc, pdf_path, truth = built
    assert pdf_path.is_file()
    assert truth["document_id"] == "sample_conference"
    pages = build_pages(truth, page_labels=doc.page_labels)
    assert len(pages) >= 7
    assert [p.page_label for p in pages] == [str(211 + i) for i in range(len(pages))]
    assert set(doc.page_labels) == set(range(len(pages)))
    assert all(p.blocks for p in pages)
    assert len(truth["pages"]) == len(pages) and truth["pages"][0]["width"] == 595.0


def test_classes_and_ids_are_valid(built) -> None:
    _, _, truth = built
    elements = truth["elements"]
    assert {e["class"] for e in elements} <= set(BLOCK_CLASSES)
    ids = [e["id"] for e in elements]
    assert len(ids) == len(set(ids))
    for element in elements:
        for target in _targets(element):
            assert target in set(ids), (element["id"], target)
    # 框都在页内
    sizes = {p["index"]: (p["width"], p["height"]) for p in truth["pages"]}
    for element in elements:
        x0, y0, x1, y1 = element["bbox"]
        width, height = sizes[element["page"]]
        assert 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height, element["id"]


def _targets(element: dict) -> list[str]:
    out: list[str] = []
    for key, value in (element.get("relations") or {}).items():
        out.extend(value if isinstance(value, list) else [value])
    return out


def test_no_text_blocks_overlap(built) -> None:
    _, _, truth = built
    boxes = [(e["id"], e["page"], e["bbox"]) for e in truth["elements"]]
    for i, (id_a, page_a, a) in enumerate(boxes):
        for id_b, page_b, b in boxes[i + 1 :]:
            if page_a != page_b:
                continue
            w = min(a[2], b[2]) - max(a[0], b[0])
            h = min(a[3], b[3]) - max(a[1], b[1])
            assert not (w > 1.0 and h > 1.0), f"{id_a} overlaps {id_b} on page {page_a + 1}"


def test_front_matter_is_full_width_with_three_authors_side_by_side(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    assert elements["title"]["class"] == "doc_title" and elements["title"]["page"] == 0
    authors = [e for e in truth["elements"] if e["class"] == "author"]
    assert len(authors) == 3 and len({round(a["bbox"][1]) for a in authors}) == 1
    assert len([e for e in truth["elements"] if e["class"] == "affiliation"]) == 3
    for cls in ("publication_info", "abstract", "keywords", "acknowledgement"):
        assert any(e["class"] == cls for e in truth["elements"]), cls
    assert elements["abstract"]["bbox"][2] - elements["abstract"]["bbox"][0] > 400
    # 每页都有页眉、页脚、页码
    pages = len(truth["pages"])
    for cls in ("running_header", "running_footer", "page_number"):
        assert {e["page"] for e in truth["elements"] if e["class"] == cls} == set(range(pages)), cls


def test_multilevel_headings_including_3_1_1_and_appendix(built) -> None:
    _, _, truth = built
    headings = [e for e in truth["elements"] if e["class"] == "section_heading"]
    levels = {e["text"].split()[0]: e["attributes"]["level"] for e in headings}
    assert levels["3.1.1"] == 3 and levels["3.1"] == 2 and levels["3"] == 1
    assert {"A", "A.1", "A.2", "A.3"} <= set(levels)
    assert levels["A"] == 1 and levels["A.1"] == 2


def test_display_formulas_are_numbered_and_cited_in_the_text(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    numbers = [e for e in truth["elements"] if e["class"] == "formula_number"]
    assert {e["text"] for e in numbers} >= {"(1)", "(2)", "(3)", "(4)", "(5)", "(A.1)", "(A.2)"}
    for number in numbers:
        assert elements[number["relations"]["number_of"]]["class"] == "display_formula"
    paragraphs = " ".join(e["text"] for e in truth["elements"] if e["class"] == "paragraph")
    assert "Eq. (3)" in paragraphs and "Eq. (A.1)" in paragraphs
    # 行内公式、引用标记、脚注标记都有
    kinds = {i["class"] for e in truth["elements"] for i in e.get("inlines", [])}
    assert kinds == {"inline_formula", "citation", "footnote_mark"}
    assert any(i.get("latex") == "r_i" for e in truth["elements"] for i in e.get("inlines", []))


def test_algorithm_blocks_have_captions_and_are_not_translated(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    algos = [e for e in truth["elements"] if e["class"] == "algorithm"]
    assert len(algos) >= 2
    for algo in algos:
        caption = elements[algo["id"] + "-cap"]
        assert caption["class"] == "code_caption" and caption["relations"]["caption_of"] == [algo["id"]]
        assert len(algo["lines"]) >= 7 and BLOCK_CLASSES["algorithm"]["translate"] is False


def test_wide_table_spans_both_columns_and_figures_share_captions(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    width = truth["pages"][0]["width"]
    wide = elements["tab2"]
    assert wide["class"] == "table" and wide["bbox"][2] - wide["bbox"][0] > width * 0.75
    assert elements["tab2-cap"]["relations"]["caption_of"] == ["tab2"]
    assert elements["tab2-note"]["class"] == "float_note" and elements["tab2-note"]["relations"]["note_of"] == "tab2"
    # 两张子图、三张子图各共用一个图注
    assert elements["fig2-cap"]["relations"]["caption_of"] == ["fig2a", "fig2b"]
    assert elements["fig3-cap"]["relations"]["caption_of"] == ["fig3a", "fig3b", "fig3c"]
    assert elements["fig2a"]["page"] == elements["fig2b"]["page"] == elements["fig2-cap"]["page"]
    assert elements["fig1"]["attributes"]["figure_type"] == "diagram"
    tables = [e for e in truth["elements"] if e["class"] == "table"]
    assert len(tables) >= 5


def test_figures_and_tables_float_to_a_page_after_the_paragraph_that_cites_them(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    paragraphs = [e for e in truth["elements"] if e["class"] == "paragraph"]
    floats = {"Figure 1": "fig1", "Figure 2": "fig2a", "Figure 3": "fig3a", "Table 2": "tab2"}
    for label, float_id in floats.items():
        first = min(p["page"] for p in paragraphs if label in p["text"])
        assert first < elements[float_id]["page"], f"{label} should sit on a later page than its first mention"


def test_paragraphs_continue_across_columns_and_across_pages(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    width = truth["pages"][0]["width"]
    across_column = across_page = 0
    for element in truth["elements"]:
        previous = (element.get("relations") or {}).get("continues")
        if not previous:
            continue
        head = elements[previous]
        assert head["class"] == element["class"]
        if head["page"] != element["page"]:
            across_page += 1
        elif _column(head, width) != _column(element, width):
            across_column += 1
    assert across_column >= 2 and across_page >= 2
    paragraph_groups = [e for e in truth["elements"] if e["class"] == "paragraph" and "continues" in (e.get("relations") or {})]
    assert paragraph_groups
    pages = build_pages(truth, page_labels={i: str(211 + i) for i in range(len(truth["pages"]))})
    grouped = {b.group["id"] for p in pages for b in p.blocks if b.group}
    assert len(grouped) >= 3


def test_footnotes_sit_on_the_page_of_their_mark(built) -> None:
    _, _, truth = built
    elements = _by_id(truth)
    footnotes = [e for e in truth["elements"] if e["class"] == "footnote"]
    assert len(footnotes) == 3
    for note in footnotes:
        holder = elements[note["relations"]["note_of"]]
        assert holder["class"] == "paragraph" and holder["page"] == note["page"], note["id"]
        marks = [i for i in holder["inlines"] if i["class"] == "footnote_mark" and i.get("target") == note["id"]]
        assert len(marks) == 1


def test_references_run_over_two_columns_and_a_page_break(built) -> None:
    _, _, truth = built
    refs = [e for e in truth["elements"] if e["class"] == "reference_entry"]
    entries = [e for e in refs if "continues" not in (e.get("relations") or {})]
    assert len(entries) == 20 and all(e["text"].startswith(f"[{i}]") for i, e in enumerate(entries, start=1))
    assert len({e["page"] for e in refs}) >= 2
    split = [e for e in refs if "continues" in (e.get("relations") or {})]
    assert split, "at least one reference entry is cut by a column or page break"
    # 附录接在参考文献之后（同一栏里，不另起一页）
    order = [e["id"] for e in truth["elements"]]
    assert order.index("h-appendix") > order.index("ref20")
    appendix, last_ref = _by_id(truth)["h-appendix"], _by_id(truth)["ref20"]
    assert appendix["page"] == last_ref["page"]

"""人造样例 sample_essay（人文学科期刊文章）：离线能排出来、标准答案自洽、这类文档特有的东西都在。"""

from __future__ import annotations

import json
from collections import Counter
from collections import defaultdict
from pathlib import Path

import fitz

from devtools.agent_lab.pages import build_pages
from devtools.agent_lab.sample_essay import build
from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES


def _build(tmp_path: Path):
    doc = build()
    pdf_path, truth_path = doc.save(tmp_path)
    truth = json.loads(truth_path.read_text(encoding="utf-8"))
    return doc, pdf_path, truth


def test_builds_pages_with_printed_labels_and_valid_classes(tmp_path: Path) -> None:
    doc, pdf_path, truth = _build(tmp_path)
    assert truth["document_id"] == "sample_essay"
    assert len(truth["pages"]) >= 5
    assert fitz.open(pdf_path).page_count == len(truth["pages"])
    # 期刊的连续页码，不是从 1 开始
    assert doc.page_labels == {i: str(211 + i) for i in range(len(truth["pages"]))}
    classes = {e["class"] for e in truth["elements"]}
    assert classes <= set(BLOCK_CLASSES)
    ids = [e["id"] for e in truth["elements"]]
    assert len(ids) == len(set(ids))
    # 每页都有块，没有空白页
    assert {e["page"] for e in truth["elements"]} == set(range(len(truth["pages"])))
    pages = build_pages(truth, page_labels=doc.page_labels)
    assert [p.page_label for p in pages] == [str(211 + i) for i in range(len(truth["pages"]))]


def test_essay_specific_pieces_are_present(tmp_path: Path) -> None:
    doc, _, truth = _build(tmp_path)
    elements = {e["id"]: e for e in truth["elements"]}
    by_class = Counter(e["class"] for e in truth["elements"])
    for cls in ("doc_title", "author", "affiliation", "publication_info", "abstract", "keywords", "running_header",
                "running_footer", "page_number", "figure", "figure_caption", "footnote", "reference_entry"):
        assert by_class[cls] >= 1, cls
    assert by_class["reference_entry"] >= 10

    # 题记和它的出处
    epigraph = [e for e in truth["elements"] if (e.get("attributes") or {}).get("role") == "epigraph"]
    assert len(epigraph) == 1 and epigraph[0]["page"] == 0
    assert any((e.get("attributes") or {}).get("role") == "epigraph_source" for e in truth["elements"])

    # 罗马数字小节标题
    numbers = [e["attributes"]["number"] for e in truth["elements"] if e["class"] == "section_heading" and "number" in e["attributes"]]
    assert numbers == ["I", "II", "III", "IV", "V"]
    assert any(e["class"] == "section_heading" and e["text"].startswith("III. ") for e in truth["elements"])

    # 外文整块引文：lang 和 language 属性都标出语言
    quotes = [e for e in truth["elements"] if (e.get("attributes") or {}).get("role") == "block_quote"]
    assert {q["lang"] for q in quotes} == {"fr", "de"}
    assert all(q["attributes"]["language"] == q["lang"] for q in quotes)
    assert any("pleinement vécus" in q["text"] for q in quotes)
    assert any("Frist" in q["text"] for q in quotes)

    # 图是一张历史版画，有图注
    figure = elements["fig1"]
    assert figure["attributes"]["figure_type"] == "photo"
    assert elements["fig1-cap"]["relations"]["caption_of"] == ["fig1"]

    # 页码和页眉页脚每页都有（第 1 页没有页眉）
    assert sorted(e["page"] for e in truth["elements"] if e["class"] == "page_number") == list(range(len(truth["pages"])))
    assert {e["page"] for e in truth["elements"] if e["class"] == "running_header"} == set(range(1, len(truth["pages"])))


def test_footnotes_are_many_stay_on_their_page_and_some_continue(tmp_path: Path) -> None:
    doc, _, truth = _build(tmp_path)
    elements = {e["id"]: e for e in truth["elements"]}
    notes = [e for e in truth["elements"] if e["class"] == "footnote"]
    assert len(notes) >= 20

    # 每页 2-4 个脚注（接续到这一页的后半段也算一个）
    per_page: dict[int, int] = defaultdict(int)
    for note in notes:
        per_page[note["page"]] += 1
    assert set(per_page) == set(range(len(truth["pages"])))
    assert all(2 <= count <= 4 for count in per_page.values()), dict(per_page)

    # 正文里每个脚注标记都指向一个脚注块，反过来每个脚注都指回装着标记的那一块，而且在同一页
    marks = {
        part["target"]: e
        for e in truth["elements"]
        for part in e.get("inlines") or []
        if part["class"] == "footnote_mark"
    }
    heads = {n["id"]: n for n in notes if "continues" not in (n.get("relations") or {})}
    assert set(marks) == set(heads)
    for note_id, holder in marks.items():
        note = heads[note_id]
        assert note["relations"]["note_of"] == holder["id"]
        assert note["page"] == holder["page"]
        assert holder["class"] in ("paragraph", "abstract")

    # 有脚注写不下、接到下一页：后半段在下一页，continues 指向前半段
    continued = [n for n in notes if "continues" in (n.get("relations") or {})]
    assert continued
    for part in continued:
        first = elements[part["relations"]["continues"]]
        assert first["class"] == "footnote" and part["page"] == first["page"] + 1
        assert len(first["lines"]) >= 2 and len(part["lines"]) >= 2


def test_long_paragraphs_continue_across_pages_and_reach_the_agent_as_groups(tmp_path: Path) -> None:
    doc, _, truth = _build(tmp_path)
    elements = {e["id"]: e for e in truth["elements"]}
    paragraph_parts = [e for e in truth["elements"] if e["class"] == "paragraph" and "continues" in (e.get("relations") or {})]
    assert len(paragraph_parts) >= 2
    # 至少有一处是一个句子被页边切开：前半段最后一行不以句号结尾
    assert any(not elements[p["relations"]["continues"]]["text"].rstrip().endswith((".", ":", "?")) for p in paragraph_parts)

    pages = build_pages(truth, page_labels=doc.page_labels)
    blocks = {b.id: b for p in pages for b in p.blocks}
    part = paragraph_parts[0]
    head = blocks[part["relations"]["continues"]]
    assert blocks[part["id"]].group["of"] == 2 and head.group["index"] == 1
    # 接续的后半段和前半段放进同一页的请求
    request = next(p for p in pages if head.id in [b.id for b in p.blocks])
    assert part["id"] in [b.id for b in request.blocks]


def test_foreign_quotes_and_references_are_marked_for_the_agent(tmp_path: Path) -> None:
    doc, _, truth = _build(tmp_path)
    pages = build_pages(truth, page_labels=doc.page_labels)
    blocks = {b.id: b for p in pages for b in p.blocks}
    quotes = [b for b in blocks.values() if b.attributes.get("role") == "block_quote"]
    assert {q.lang for q in quotes} == {"fr", "de"}
    for quote in quotes:
        agent_input = quote.to_input()
        assert agent_input.source_lang == quote.lang
        assert agent_input.attributes["language"] == quote.lang
    # 书目不翻；脚注、正文要翻；脚注标记在原文里是 {{fn:n}}
    assert not blocks["ref01"].translate
    assert blocks["fn1"].translate
    assert "{{fn:1}}" in blocks["s1-p1"].source
    # 斜体的书名留在文字里，不变成别的东西
    assert "Adam Bede" in blocks["s1-p2-cont1"].source


def test_nothing_overlaps_or_leaves_the_page(tmp_path: Path) -> None:
    doc, _, truth = _build(tmp_path)
    size = {p["index"]: (p["width"], p["height"]) for p in truth["pages"]}
    by_page: dict[int, list[dict]] = defaultdict(list)
    for e in truth["elements"]:
        width, height = size[e["page"]]
        x0, y0, x1, y1 = e["bbox"]
        assert 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height, e["id"]
        by_page[e["page"]].append(e)
    for page, items in by_page.items():
        for i, a in enumerate(items):
            for b in items[i + 1 :]:
                overlap_w = min(a["bbox"][2], b["bbox"][2]) - max(a["bbox"][0], b["bbox"][0])
                overlap_h = min(a["bbox"][3], b["bbox"][3]) - max(a["bbox"][1], b["bbox"][1])
                assert not (overlap_w > 0.5 and overlap_h > 0.5), (page, a["id"], b["id"])
    # 画上去的字和标准答案对得上：每个块的第一行文字能在 PDF 那一页的对应位置读出来
    pdf = fitz.open(tmp_path / "sample_essay.pdf")
    for e in truth["elements"]:
        if e["class"] in ("paragraph", "footnote", "section_heading") and e["lines"]:
            line = e["lines"][0]
            words = [w for w in line["text"].split() if w.isalpha()][:2]
            clip = fitz.Rect(*line["bbox"]) + (-2, -2, 2, 2)
            found = pdf[e["page"]].get_text("text", clip=clip)
            assert all(word in found for word in words), (e["id"], words, found[:80])

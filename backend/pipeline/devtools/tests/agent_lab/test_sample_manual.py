"""人造样例 manual（软件技术手册）：能造出来、标准答案自洽、手册特有的东西都在，并且能整理成翻译 agent 的输入。离线，不发请求。"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from devtools.agent_lab import sample_manual
from devtools.agent_lab.pages import build_pages
from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES


def _built(tmp_path: Path):
    doc = sample_manual.build()
    pdf_path, truth_path = doc.save(tmp_path)
    return doc, pdf_path, json.loads(truth_path.read_text(encoding="utf-8"))


def test_manual_builds_and_feeds_the_page_builder(tmp_path: Path) -> None:
    doc, pdf_path, truth = _built(tmp_path)
    assert truth["document_id"] == "sample_manual" and pdf_path.exists()
    assert len(truth["pages"]) >= 5 and len(truth["pages"]) <= 8
    assert set(doc.page_labels) == set(range(len(truth["pages"])))
    assert doc.page_labels[0] == "cover" and doc.page_labels[1] == "i" and doc.page_labels[2] == "1"
    pages = build_pages(truth, page_labels=doc.page_labels)
    assert [p.page_label for p in pages] == [doc.page_labels[i] for i in range(len(pages))]
    assert all(e["class"] in BLOCK_CLASSES for e in truth["elements"])
    ids = [e["id"] for e in truth["elements"]]
    assert len(ids) == len(set(ids))
    known = set(ids)
    for element in truth["elements"]:
        for target in (element.get("relations") or {}).values():
            for one in target if isinstance(target, list) else [target]:
                assert one in known, f"{element['id']} points to missing {one}"
    assert any(b.group for p in pages for b in p.blocks), "at least one paragraph continues on the next page"


def test_manual_toc_page_labels_match_where_the_headings_are(tmp_path: Path) -> None:
    doc, _, truth = _built(tmp_path)
    by_id = {e["id"]: e for e in truth["elements"]}
    entries = [e for e in truth["elements"] if e["class"] == "toc_entry"]
    assert len(entries) >= 20 and {e["attributes"]["level"] for e in entries} == {1, 2, 3}
    for entry in entries:
        heading = by_id[entry["relations"]["toc_target"]]
        assert heading["class"] == "section_heading"
        assert entry["attributes"]["page_label"] == doc.page_labels[heading["page"]]
        assert entry["page"] == 1
    # 每个正文标题都有目录条目
    headings = {e["id"] for e in truth["elements"] if e["class"] == "section_heading" and e["page"] != 1}
    assert headings == {e["relations"]["toc_target"] for e in entries}


def test_manual_has_code_tables_notes_figures_and_inline_code(tmp_path: Path) -> None:
    _, _, truth = _built(tmp_path)
    elements = truth["elements"]
    by_id = {e["id"]: e for e in elements}
    classes = Counter(e["class"] for e in elements)
    for cls in ("running_header", "running_footer", "page_number", "doc_title", "code_block", "code_caption", "float_note", "footnote", "figure", "figure_caption", "table", "table_caption", "list_item", "toc_entry", "section_heading"):
        assert classes[cls] > 0, cls
    # 标题到三级
    assert {e["attributes"]["level"] for e in elements if e["class"] == "section_heading"} >= {1, 2, 3}
    # 代码题注指向代码块；警告贴在代码块 / 表格下面，记 float_note
    captions = [e for e in elements if e["class"] == "code_caption"]
    assert captions and all(by_id[t]["class"] == "code_block" for c in captions for t in c["relations"]["caption_of"])
    targets = {by_id[e["relations"]["note_of"]]["class"] for e in elements if e["class"] == "float_note"}
    assert targets == {"code_block", "table"}
    # 参数表跨页，拆成两段，第二段的题注写 continued
    tables = [e for e in elements if e["class"] == "table" and e["id"].startswith("tab-params")]
    assert len(tables) == 2 and tables[0]["page"] != tables[1]["page"]
    assert any(e["class"] == "table_caption" and "(continued)" in e["text"] for e in elements)
    assert all(len(t["lines"]) >= 3 for t in tables) and all(" | " in t["lines"][0]["text"] for t in tables)
    # 步骤列表：1. 里嵌 a.，编号留在文字里
    items = [e["text"] for e in elements if e["class"] == "list_item"]
    assert any(t.startswith("1. ") for t in items) and any(t.startswith("a. ") for t in items)
    assert sum(1 for t in items if t.startswith("• ")) >= 8
    # 行内代码：记成 inline_code，不带 latex，文字在行里能对上
    codes = [(e, i) for e in elements for i in e.get("inlines", []) if i["class"] == "inline_code"]
    assert len(codes) >= 30 and all("latex" not in i for _, i in codes)
    assert {"paragraph", "list_item"} <= {e["class"] for e, _ in codes}
    for element, inline in codes:
        if element["class"] != "table":
            assert element["lines"][inline["line"]]["text"][inline["start"] : inline["end"]] == inline["text"]
    # 终端输出和配置文件整块是代码块，不翻
    assert all(not BLOCK_CLASSES[e["class"]]["translate"] for e in elements if e["class"] == "code_block")

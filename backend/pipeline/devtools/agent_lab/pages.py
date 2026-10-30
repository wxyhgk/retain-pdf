"""把一份文档（现在是 OCR 分类查看器的标准答案 `truth.json`）整理成翻译 agent 包（retainpdf-translation-agent）的输入格式。

每块给：类别、大概位置（第几页、哪一栏、上中下，不给精确坐标）、原文（行内公式写成 `$…$`、脚注标记写成 `{{fn:1}}`）、
要不要翻、接续组、图注之类的关系。跨页的接续段落整组放进前半段所在的那一页一起翻。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import PageInput

from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES

# 分类表里"翻不翻"还没定的类别，测试时先这样定（结果里标明是测试默认值）。
UNDECIDED_TRANSLATE = {"doc_title": True}

FN_TOKEN = "{{fn:%s}}"
# 目录条目末尾的引导点和页码（". . . . 2"）不交给 agent：页码另存在属性里，排版时再补
TOC_LEADER_RE = re.compile(r"(?:\s*\.){3,}\s*\S+\s*$")


@dataclass
class Block:
    id: str
    cls: str
    page: int
    bbox: list[float]
    source: str
    lang: str
    translate: bool
    translate_reason: str
    where: str
    relations: dict = field(default_factory=dict)
    attributes: dict = field(default_factory=dict)
    group: dict | None = None
    level: int | None = None

    def to_input(self) -> BlockInput:
        return BlockInput(
            id=self.id,
            cls=self.cls,
            cls_label=BLOCK_CLASSES[self.cls]["label"],
            where=self.where,
            text=self.source,
            translate=self.translate,
            source_lang=self.lang,
            group=self.group,
            relations=self.relations,
            attributes={k: v for k, v in self.attributes.items() if k != "latex"},
        )


@dataclass
class PageRequest:
    page: int
    page_label: str
    blocks: list[Block]  # 这一页的全部块（含不翻的、含拉进来的下一页接续）
    section_path: list[str]
    # 这一页属于哪一章：一级标题的块 id（这一页上有一级标题就算新的一章）；术语的作用域按它算
    chapter: str = ""

    def to_translate(self) -> list[Block]:
        return [b for b in self.blocks if b.translate]

    def to_input(self, document: dict) -> PageInput:
        return PageInput(
            page_label=self.page_label,
            blocks=[b.to_input() for b in self.blocks],
            section_path=self.section_path,
            document=document,
            chapter=self.chapter,
        )


def agent_text(element: dict) -> str:
    """块的原文：行内公式换成 `$latex$`，脚注标记换成 `{{fn:n}}`，行内代码用反引号包起来，其余照原样。"""
    sep = "" if element.get("lang") == "zh" else " "
    lines = [line["text"] for line in element.get("lines") or []]
    if not lines:
        return element.get("text", "")
    inlines = sorted(element.get("inlines") or [], key=lambda p: (p["line"], p["start"]), reverse=True)
    lines = list(lines)
    for part in inlines:
        if part["class"] == "inline_formula" and part.get("latex"):
            token = f"${part['latex']}$"
        elif part["class"] == "footnote_mark":
            token = FN_TOKEN % part["text"]
        elif part["class"] == "inline_code":
            token = "`" + lines[part["line"]][part["start"] : part["end"]] + "`"
        else:
            continue
        text = lines[part["line"]]
        lines[part["line"]] = text[: part["start"]] + token + text[part["end"] :]
    text = sep.join(lines)
    if element.get("class") == "toc_entry":
        text = TOC_LEADER_RE.sub("", text)
    return text


def describe_where(element: dict, page_width: float, page_height: float, page_label: str) -> str:
    x0, y0, x1, y1 = element["bbox"]
    width = x1 - x0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if x1 < page_width * 0.1 or x0 > page_width * 0.9:
        column = "页边"
    elif width > page_width * 0.55:
        column = "通栏"
    else:
        column = "左栏" if cx < page_width / 2 else "右栏"
    vertical = "上部" if cy < page_height / 3 else "中部" if cy < page_height * 2 / 3 else "下部"
    return f"第 {page_label} 页，{column}{vertical}"


def _translate_default(cls: str) -> tuple[bool, str]:
    value = BLOCK_CLASSES[cls]["translate"]
    if value is None:
        return UNDECIDED_TRANSLATE.get(cls, True), "undecided_test_default"
    return bool(value), "class_default"


def _reading_key(element: dict, page_width: float) -> tuple:
    x0, y0, x1, _ = element["bbox"]
    band = 0 if (x1 - x0) > page_width * 0.55 or (x0 + x1) / 2 < page_width / 2 else 1
    return (element["page"], band, y0, x0)


def build_pages(truth: dict, *, page_labels: dict[int, str] | None = None) -> list[PageRequest]:
    pages = {p["index"]: p for p in truth["pages"]}
    labels = page_labels or {}
    elements = sorted(truth["elements"], key=lambda e: _reading_key(e, pages[e["page"]]["width"]))
    by_id = {e["id"]: e for e in elements}

    # 接续组：沿 continues 往前找到组头，组内按顺序编号
    def head_of(element: dict) -> dict:
        seen = set()
        while "continues" in (element.get("relations") or {}) and element["id"] not in seen:
            seen.add(element["id"])
            element = by_id[element["relations"]["continues"]]
        return element

    groups: dict[str, list[dict]] = {}
    for element in elements:
        rel = element.get("relations") or {}
        if "continues" in rel or any((o.get("relations") or {}).get("continues") == element["id"] for o in elements):
            groups.setdefault(head_of(element)["id"], []).append(element)

    blocks: dict[str, Block] = {}
    for element in elements:
        page = pages[element["page"]]
        label = labels.get(element["page"], str(element["page"] + 1))
        translate, reason = _translate_default(element["class"])
        if translate and element.get("lang") == "zh":
            # 原文已经是中文：只当上下文，不交给 agent 改写
            translate, reason = False, "source_is_target_language"
        block = Block(
            id=element["id"],
            cls=element["class"],
            page=element["page"],
            bbox=element["bbox"],
            source=agent_text(element),
            lang=element.get("lang", "en"),
            translate=translate,
            translate_reason=reason,
            where=describe_where(element, page["width"], page["height"], label),
            relations={k: v for k, v in (element.get("relations") or {}).items() if k != "continues"},
            attributes=dict(element.get("attributes") or {}),
            level=(element.get("attributes") or {}).get("level"),
        )
        blocks[element["id"]] = block
    for head_id, members in groups.items():
        for index, member in enumerate(members, start=1):
            blocks[member["id"]].group = {"id": f"cg-{head_id}", "index": index, "of": len(members)}

    # 按页分组；跨页接续的后半段放进组头那一页
    home: dict[str, int] = {}
    for block in blocks.values():
        if block.group:
            head = groups[block.group["id"][3:]][0]
            home[block.id] = head["page"]
        else:
            home[block.id] = block.page
    requests: list[PageRequest] = []
    section: list[str] = []
    chapter = ""
    toc_pages = {e["page"] for e in elements if e["class"] == "toc_entry"}
    for index in sorted(pages):
        page_blocks = [blocks[e["id"]] for e in elements if home[e["id"]] == index]
        # 目录页上的"目录"标题不算正文的章节
        headings = [e for e in elements if e["page"] == index and e["class"] == "section_heading" and index not in toc_pages]
        chapter = next((e["id"] for e in headings if ((e.get("attributes") or {}).get("level") or 1) == 1), chapter)
        requests.append(
            PageRequest(
                page=index,
                page_label=labels.get(index, str(index + 1)),
                blocks=page_blocks,
                section_path=list(section),
                chapter=chapter,
            )
        )
        for e in headings:
            level = (e.get("attributes") or {}).get("level") or 1
            section = section[: level - 1] + [e["text"]]
    return requests


def document_title(truth: dict) -> str:
    for element in truth["elements"]:
        if element["class"] == "doc_title":
            return element["text"]
    return truth.get("document_id", "")

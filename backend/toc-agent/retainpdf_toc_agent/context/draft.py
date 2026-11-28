"""一页目录的规则草稿：每段字（片段）是什么、归哪一条。认上下文的输入和输出都是它。

草稿由流水线给（``retainpdf_pipeline/ocr/document_schema/toc_pages.py`` 的 ``page_draft``，按文字层拆条目的同一套规则），
是普通的 dict，这里读成数据类。模型只能改片段的角色和条目的归属（``tools.py``），**不能改字、不能改位置**：
片段的字、框、字号、基线原样带回去，流水线照它重建条目块、渲染照它擦字写字。

片段的角色：

| 角色 | 是什么 | 翻不翻 |
|---|---|---|
| ``title`` | 标题的字 | 翻，原位替换 |
| ``number`` | 章号「1」「2.3」「A-3」 | 留原图 |
| ``label`` | 标签列「Chapter 1」「Annexure I」「Part II」 | 留原图 |
| ``leader`` | 点线 | 留原图 |
| ``page`` | 页码 | 留原图 |
| ``author`` | 论文集的作者行 | 留原图 |
| ``header`` | 页眉页脚「xvi Contents」 | 留原图，不归哪一条 |
| ``other`` | 别的（落单的字、栏目装饰） | 留原图，不归哪一条 |
"""
from __future__ import annotations

import copy
import re
from dataclasses import dataclass
from dataclasses import field
from typing import Any

ROLES = ("title", "number", "label", "leader", "page", "author", "header", "other")
# 这些角色的字必须归到某一条里；header / other 不归哪一条
ENTRY_ROLES = frozenset({"title", "number", "label", "leader", "page", "author"})
FREE_ROLES = frozenset({"header", "other"})

TEXT_LAYER_VISIBLE = "visible"
TEXT_LAYER_INVISIBLE = "invisible"  # 扫描件上的 OCR 文字层：字是图，文字层看不见

# 页码：「12」「12a」「S2」「A-3」「1-7」「5-35」「57.1」，或罗马数字（和流水线拆条目的规则一样宽）
_ARABIC_PAGE = r"(?:[A-Z]{1,2}-?)?\d{1,4}[a-z]?(?:[.\-–:]\d{1,4}){0,2}(?:[\-–]\d{1,4}(?::\d{1,4})?)?"
_ROMAN_PAGE = r"(?:[ivxlcdm]{1,7}|[IVXLCDM]{1,7})"
PAGE_RE = re.compile(rf"^(?:{_ARABIC_PAGE}|{_ROMAN_PAGE})$")
ARABIC_PAGE_RE = re.compile(rf"^{_ARABIC_PAGE}$")
# 章号：「1」「1.2」「4-2」「A-3」「A.」「IV.」「§3」
NUMBER_RE = re.compile(r"^§?\s*(?:\d{1,3}(?:[.\-–]\d{1,3})*\.?|[A-Z](?:[.\-–]\d{1,3})*\.?|[IVXLCivxlc]{1,6}\.?)$")


@dataclass
class Fragment:
    id: str
    line: int  # 视觉行号，从 1 数（截图上叠的行号）
    text: str
    role: str
    bbox: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    size: float = 0.0
    bold: bool = False
    italic: bool = False
    font: str = ""
    raw: dict[str, Any] = field(default_factory=dict, repr=False)  # 草稿里的原样（基线等），写回时带上

    @classmethod
    def from_dict(cls, data: dict) -> "Fragment":
        bbox = tuple(float(value) for value in (data.get("bbox") or (0, 0, 0, 0)))[:4]
        return cls(id=str(data.get("id") or ""), line=int(data.get("line") or 0), text=str(data.get("text") or ""),
                   role=str(data.get("role") or ""), bbox=bbox if len(bbox) == 4 else (0.0, 0.0, 0.0, 0.0),
                   size=float(data.get("size") or 0.0), bold=bool(data.get("bold")), italic=bool(data.get("italic")),
                   font=str(data.get("font") or ""), raw=dict(data))

    def to_dict(self) -> dict:
        return {**self.raw, "id": self.id, "line": self.line, "text": self.text, "role": self.role}


@dataclass
class DraftEntry:
    id: str
    fragments: list[str]
    level: int = 1
    keep: str = ""  # 不翻的原因（代码名、人名、作者……）；空 = 翻
    continues_prev_page: bool = False  # 接上一页最后那条没完的标题


@dataclass
class PageDraft:
    page_index: int
    fragments: list[Fragment]
    entries: list[DraftEntry]
    accepted: bool = True  # 规则认了这一块（已经拆成条目）；False = 规则不认，只是候选
    reason: str = ""  # 规则不认的原因
    region: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0)
    page_size: tuple[float, float] = (0.0, 0.0)
    text_layer: str = TEXT_LAYER_VISIBLE
    parent_block_id: str = ""
    not_toc: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> "PageDraft":
        fragments = [Fragment.from_dict(item) for item in data.get("fragments") or [] if isinstance(item, dict)]
        entries = []
        for index, item in enumerate(data.get("entries") or []):
            if not isinstance(item, dict):
                continue
            entries.append(DraftEntry(id=str(item.get("id") or f"e{index + 1}"),
                                      fragments=[str(value) for value in item.get("fragments") or []],
                                      level=int(item.get("level") or 1), keep=str(item.get("keep") or ""),
                                      continues_prev_page=bool(item.get("continues_prev_page"))))
        region = tuple(float(value) for value in (data.get("region") or (0, 0, 0, 0)))[:4]
        size = tuple(float(value) for value in (data.get("page_size") or (0, 0)))[:2]
        return cls(page_index=int(data.get("page_index") or 0), fragments=fragments, entries=entries,
                   accepted=bool(data.get("accepted", True)), reason=str(data.get("reason") or ""),
                   region=region if len(region) == 4 else (0.0, 0.0, 0.0, 0.0),
                   page_size=size if len(size) == 2 else (0.0, 0.0),
                   text_layer=str(data.get("text_layer") or TEXT_LAYER_VISIBLE),
                   parent_block_id=str(data.get("parent_block_id") or ""), not_toc=bool(data.get("not_toc")))

    def to_dict(self) -> dict:
        return {
            "page_index": self.page_index,
            "parent_block_id": self.parent_block_id,
            "region": list(self.region),
            "page_size": list(self.page_size),
            "accepted": self.accepted,
            "reason": self.reason,
            "text_layer": self.text_layer,
            "not_toc": self.not_toc,
            "fragments": [fragment.to_dict() for fragment in self.fragments],
            "entries": [{"id": entry.id, "fragments": list(entry.fragments), "level": entry.level,
                         **({"keep": entry.keep} if entry.keep else {}),
                         **({"continues_prev_page": True} if entry.continues_prev_page else {})}
                        for entry in self.entries],
        }

    def copy(self) -> "PageDraft":
        return copy.deepcopy(self)

    # 查找
    def by_id(self) -> dict[str, Fragment]:
        return {fragment.id: fragment for fragment in self.fragments}

    def order(self) -> dict[str, int]:
        return {fragment.id: index for index, fragment in enumerate(self.fragments)}

    def entry_of(self) -> dict[str, str]:
        """片段 → 它所在的条目（在两条里的取第一条，检查会报出来）。"""
        found: dict[str, str] = {}
        for entry in self.entries:
            for fragment_id in entry.fragments:
                found.setdefault(fragment_id, entry.id)
        return found

    def entry(self, entry_id: str) -> DraftEntry | None:
        return next((entry for entry in self.entries if entry.id == entry_id), None)

    def role_text(self, entry: DraftEntry, role: str) -> str:
        by_id = self.by_id()
        return " ".join(by_id[f].text for f in entry.fragments if f in by_id and by_id[f].role == role).strip()

    def tidy(self) -> None:
        """条目里的片段按页面顺序排；空条目去掉；条目按第一个片段的位置排。"""
        order = self.order()
        for entry in self.entries:
            entry.fragments = sorted(dict.fromkeys(f for f in entry.fragments if f in order), key=order.get)
        self.entries = [entry for entry in self.entries if entry.fragments]
        self.entries.sort(key=lambda entry: order[entry.fragments[0]])

    def next_entry_id(self) -> str:
        numbers = [int(entry.id[1:]) for entry in self.entries if entry.id[1:].isdigit()]
        return f"e{max(numbers, default=0) + 1}"


def page_key(label: str) -> tuple[str, tuple[int, ...]] | None:
    """页码的比较键：（字母前缀，数字们）；罗马数字不比。"""
    label = str(label or "").strip()
    if not label or not ARABIC_PAGE_RE.match(label) or not re.search(r"\d", label):
        return None
    prefix = re.match(r"^[A-Z]*", label).group(0)
    return prefix, tuple(int(item) for item in re.findall(r"\d+", label))


def _descents(draft: PageDraft, entries: list[DraftEntry]) -> int:
    last: dict[str, tuple[int, ...]] = {}
    descents = 0
    for entry in entries:
        key = page_key(draft.role_text(entry, "page"))
        if key is None:
            continue
        prefix, numbers = key
        if prefix in last and numbers < last[prefix]:
            descents += 1
        last[prefix] = numbers
    return descents


def page_descents(draft: PageDraft) -> int:
    """按条目顺序，页码往回走了几次（同一个字母前缀里比）。双栏的页（条目从目录区域左半和右半起的各有两条以上）
    再按「先左栏、后右栏」数一遍，取少的那个：视觉行把两栏的条目交错排着。"""
    in_order = _descents(draft, draft.entries)
    x0, _y0, x1, _y1 = draft.region
    middle = (x0 + x1) / 2
    by_id = draft.by_id()
    starts = {entry.id: by_id[entry.fragments[0]].bbox[0] for entry in draft.entries if entry.fragments and entry.fragments[0] in by_id}
    right = [entry for entry in draft.entries if starts.get(entry.id, x0) >= middle]
    left = [entry for entry in draft.entries if starts.get(entry.id, x0) < middle]
    if len(left) >= 2 and len(right) >= 2:
        return min(in_order, _descents(draft, left + right))
    return in_order


__all__ = [
    "ENTRY_ROLES",
    "FREE_ROLES",
    "NUMBER_RE",
    "PAGE_RE",
    "ROLES",
    "TEXT_LAYER_INVISIBLE",
    "TEXT_LAYER_VISIBLE",
    "DraftEntry",
    "Fragment",
    "PageDraft",
    "page_descents",
    "page_key",
]

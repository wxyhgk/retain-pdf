"""目录页拆块：有文字层时，把 OCR 给的一整块目录拆成一条条只框住标题的小块（2026-11-25）。

OCR 把一页目录给成一整块、每行的框是估的，翻译后排成左对齐的流水行（页码不再右对齐、小节不缩进、章与章没有间隔），
跨页的两块目录还会被串成一个接续组。拆成只框标题的小块以后：

- 原书的章号、页码列、页眉不在任何块里，留在原图上不动（排版引擎只换块里的字）；
- 每条标题按原位置、原缩进放译文，框一直延伸到页码列前面，给译文留宽度；
- 每条是独立的短块（``structure_role = toc_entry``，不算正文），不参与跨页接续。

文字层读不出条目（扫描件、页码对不上、条目太少）时什么都不改，照旧是一整块。方案见 docs/ops/planning/toc-agent/。
"""
from __future__ import annotations

import copy
import re
import unicodedata
from dataclasses import dataclass, field

TOC_ROLES = frozenset({"toc", "table_of_contents"})
ENTRY_STRUCTURE_ROLE = "toc_entry"
# 一行里的片段按 y 中心聚成视觉行
LINE_Y_TOLERANCE = 3.0
# 页码：一行最右边、落在块宽右侧这一截的数字或罗马数字
PAGE_TOKEN_RE = re.compile(r"^(?:\d{1,4}[a-z]?|[ivxlcdm]{1,8})$", re.IGNORECASE)
PAGE_COLUMN_FRACTION = 0.6
# 章号：一行最左边、和后面的标题隔开的短编号
NUMBER_TOKEN_RE = re.compile(r"^(?:\d{1,3}(?:\.\d{1,3})*\.?|[A-Z]\.?|[IVXL]{1,6}\.?)$")
NUMBER_GAP = 4.0
# 章号和标题写在同一个片段里（「10 Using Your …」）
JOINED_NUMBER_RE = re.compile(r"^(\d{1,3}(?:\.\d{1,3})*\.?)\s+(\S.*)$")
# 页眉：在页面上面这一截、去掉页码以后只剩这些字
HEADER_BAND = 0.1
HEADER_WORDS = frozenset({"contents", "table of contents", "brief contents", "目录", "目次", "目 录"})
TITLE_RIGHT_GAP = 6.0
MIN_ENTRIES = 3


@dataclass
class _Span:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    size: float


@dataclass
class _Line:
    spans: list[_Span]

    @property
    def y(self) -> float:
        return sum((span.y0 + span.y1) / 2 for span in self.spans) / len(self.spans)


@dataclass
class TocEntry:
    title: str
    number: str
    page_label: str
    level: int
    bbox: list[float]  # 标题文字的框（还没延伸到页码列）
    font_size: float
    line_count: int
    number_x0: float | None = None  # 章号的左边（有章号时）
    line_boxes: list[list[float]] = field(default_factory=list)  # 标题每一行的框（多行标题）


@dataclass
class TocPageSplit:
    entries: list[TocEntry] = field(default_factory=list)
    header_lines: list[str] = field(default_factory=list)
    page_column_x0: float | None = None


def _clean(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text or "").split())


def _spans_in(pdf_page, bbox: list[float]) -> list[_Span]:
    x0, y0, x1, y1 = bbox
    spans = []
    for block in pdf_page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "")
                if not text.strip():
                    continue
                sx0, sy0, sx1, sy1 = span["bbox"]
                cx, cy = (sx0 + sx1) / 2, (sy0 + sy1) / 2
                if x0 - 2 <= cx <= x1 + 2 and y0 - 2 <= cy <= y1 + 2:
                    spans.append(_Span(text, sx0, sy0, sx1, sy1, float(span.get("size") or 0)))
    return spans


def _visual_lines(spans: list[_Span]) -> list[_Line]:
    lines: list[_Line] = []
    for span in sorted(spans, key=lambda item: ((item.y0 + item.y1) / 2, item.x0)):
        center = (span.y0 + span.y1) / 2
        if lines and abs(lines[-1].y - center) <= LINE_Y_TOLERANCE:
            lines[-1].spans.append(span)
        else:
            lines.append(_Line([span]))
    for line in lines:
        line.spans.sort(key=lambda item: item.x0)
    return lines


def _merge_words(spans: list[_Span]) -> list[_Span]:
    """紧挨着的片段（连字 ﬁ 被拆成单独片段之类）拼成一段，隔开的保留成几段。"""
    merged: list[_Span] = []
    for span in spans:
        if merged and span.x0 - merged[-1].x1 <= 2.0:
            last = merged[-1]
            merged[-1] = _Span(last.text + span.text, last.x0, min(last.y0, span.y0), span.x1, max(last.y1, span.y1),
                               max(last.size, span.size))
        else:
            merged.append(span)
    return merged


def _is_header(line: _Line, page_height: float) -> bool:
    if page_height <= 0 or line.y > page_height * HEADER_BAND:
        return False
    words = [_clean(span.text) for span in _merge_words(line.spans)]
    rest = [word for word in words if not PAGE_TOKEN_RE.match(word)]
    return bool(rest) and " ".join(rest).lower() in HEADER_WORDS


def split_toc_page(pdf_page, block_bbox: list[float]) -> TocPageSplit | None:
    """从文字层读出这一块目录的条目。读不出（没文字层、条目太少、页码倒退）回 None。"""
    spans = _spans_in(pdf_page, block_bbox)
    if not spans:
        return None
    block_x0, block_x1 = float(block_bbox[0]), float(block_bbox[2])
    page_column_from = block_x0 + (block_x1 - block_x0) * PAGE_COLUMN_FRACTION
    result = TocPageSplit()
    pending: list[tuple[str, _Span | None, list[_Span]]] = []  # 还没碰到页码的多行标题：（章号，章号片段，标题片段）
    page_column_x0s: list[float] = []

    def flush(page_label: str) -> None:
        if not pending:
            return
        number = next((item[0] for item in pending if item[0]), "")
        title_spans = [span for _number, _span, spans_ in pending for span in spans_]
        if not title_spans:
            pending.clear()
            return
        title = _clean(" ".join(" ".join(span.text for span in spans_) for _n, _s, spans_ in pending))
        bbox = [min(s.x0 for s in title_spans), min(s.y0 for s in title_spans),
                max(s.x1 for s in title_spans), max(s.y1 for s in title_spans)]
        sizes = sorted(span.size for span in title_spans)
        number_x0 = next((item[1].x0 for item in pending if item[1] is not None), None)
        line_boxes = [[min(s.x0 for s in spans_), min(s.y0 for s in spans_), max(s.x1 for s in spans_), max(s.y1 for s in spans_)]
                      for _n, _s, spans_ in pending if spans_]
        result.entries.append(TocEntry(title=title, number=number, page_label=page_label, level=0, bbox=bbox,
                                       font_size=sizes[len(sizes) // 2], line_count=len(pending), number_x0=number_x0,
                                       line_boxes=line_boxes))
        pending.clear()

    for line in _visual_lines(spans):
        if _is_header(line, float(pdf_page.rect.height)):
            result.header_lines.append(_clean(" ".join(span.text for span in line.spans)))
            continue
        words = _merge_words(line.spans)
        page_label = ""
        if len(words) >= 2 and PAGE_TOKEN_RE.match(_clean(words[-1].text)) and words[-1].x0 >= page_column_from:
            page_label = _clean(words[-1].text)
            page_column_x0s.append(words[-1].x0)
            words = words[:-1]
        number, number_span = "", None
        if len(words) >= 2 and NUMBER_TOKEN_RE.match(_clean(words[0].text)) and words[1].x0 - words[0].x1 >= NUMBER_GAP:
            number, number_span = _clean(words[0].text), words[0]
            words = words[1:]
        elif words and (joined := JOINED_NUMBER_RE.match(words[0].text.strip())):
            # 章号和标题在同一个片段里：按字数估出标题从哪里开始（原图上的章号留着不动）
            first = words[0]
            raw = first.text.strip()
            title_start = first.x0 + (first.x1 - first.x0) * (raw.index(joined.group(2)) / max(1, len(raw)))
            number = joined.group(1)
            number_span = _Span(number, first.x0, first.y0, title_start, first.y1, first.size)
            words = [_Span(joined.group(2), title_start, first.y0, first.x1, first.y1, first.size)] + words[1:]
        if number and pending:
            flush("")  # 新的一章开始，上面没等到页码的标题单独成一条
        pending.append((number, number_span, words))
        if page_label:
            flush(page_label)
    flush("")

    entries = result.entries
    if len(entries) < MIN_ENTRIES:
        return None
    numeric = [int(entry.page_label) for entry in entries if entry.page_label.isdigit()]
    if any(later < earlier for earlier, later in zip(numeric, numeric[1:])):
        return None
    result.page_column_x0 = min(page_column_x0s) if page_column_x0s else None
    _assign_levels(entries)
    return result


def _assign_levels(entries: list[TocEntry]) -> None:
    """按起点定级别：章号不带点的是第 1 级、带点的按点数往下；没有章号的看标题从哪里写起——
    从章号那一列写起的（结论、附录、索引这类后置部分）和章同级，从章标题那一列写起的低一级，再往右缩进的再低一级。
    这一页没有带章号的条目时，以最左的起点为第 1 级。"""
    numbered = [entry for entry in entries if entry.number and entry.number_x0 is not None]
    number_column = min((entry.number_x0 for entry in numbered), default=None)
    chapter_title_column = min((entry.bbox[0] for entry in numbered), default=None)
    left = min(entry.bbox[0] for entry in entries)
    for entry in entries:
        if entry.number:
            entry.level = entry.number.rstrip(".").count(".") + 1 if entry.number[0].isdigit() else 1
            continue
        x0 = entry.bbox[0]
        if number_column is not None and x0 <= number_column + 4:
            entry.level = 1
        elif chapter_title_column is not None:
            entry.level = 2 + (1 if x0 - chapter_title_column > 8 else 0)
        else:
            entry.level = 1 + (1 if x0 - left > 8 else 0)


def _entry_block(parent: dict, entry: TocEntry, block_id: str, right_edge: float) -> dict:
    """一条目录：框从标题（有章号时从章号）起，延伸到页码列前面。章号放进这一条的文字里一起重画——
    擦原文按内容流里的整段文字删，章号和标题常在同一段里，只框标题也会把章号擦掉。"""
    block = copy.deepcopy({key: value for key, value in parent.items() if key not in ("lines", "segments", "content", "text")})
    x0, y0, x1, y1 = entry.bbox
    text = entry.title
    if entry.number and entry.number_x0 is not None:
        x0 = min(x0, entry.number_x0)
        text = f"{entry.number} {entry.title}"
    box = [x0, y0, max(x1, right_edge), y1]
    line_boxes = [[x0, top, box[2], bottom] for _l, top, _r, bottom in entry.line_boxes] or [list(box)]
    block.update(
        block_id=block_id,
        bbox=box,
        text=text,
        sub_type="table_of_contents",
        layout_role="toc",
        semantic_role="unknown",
        structure_role=ENTRY_STRUCTURE_ROLE,
        block_class="body",
        geometry={"bbox": list(box)},
        # 框来自 PDF 文字层的真实位置；多行标题一行一个框（排版时译文一行放得下就放在最后一行，和页码对齐）
        lines=[{"bbox": list(line), "bbox_precision": "provider_layout",
                "spans": [{"type": "text", "raw_type": "toc_entry", "text": text if index == 0 else "", "bbox": list(line),
                           "score": None, "bbox_precision": "line"}]} for index, line in enumerate(line_boxes)],
        segments=[{"type": "text", "raw_type": "toc_entry", "text": text, "bbox": list(box), "score": None,
                   "bbox_precision": "line"}],
        content={"kind": "text", "text": text, "line_texts": [text]},
    )
    block["tags"] = ["table_of_contents", "toc", "toc_entry"]
    metadata = dict(block.get("metadata") or {})
    metadata.update(
        toc_entry_number=entry.number,
        toc_entry_page_label=entry.page_label,
        toc_entry_level=entry.level,
        toc_entry_source_font_size=round(entry.font_size, 2),
        toc_entry_line_count=entry.line_count,
        toc_split_parent_block_id=str(parent.get("block_id") or ""),
        structure_role=ENTRY_STRUCTURE_ROLE,
        layout_role="toc",
        semantic_role="unknown",
    )
    block["metadata"] = metadata
    return block


def split_toc_blocks_with_text_layer(document: dict, pdf) -> int:
    """把每页的目录块按文字层拆成条目小块，回拆了几块。坐标要已经是 PDF 的点。"""
    split = 0
    for page_index, page in enumerate(document.get("pages") or []):
        if page_index >= len(pdf):
            break
        blocks = page.get("blocks") or []
        if not any(_is_toc_block(block) for block in blocks):
            continue
        rebuilt: list[dict] = []
        page_split = 0
        for block in blocks:
            if not _is_toc_block(block):
                rebuilt.append(block)
                continue
            result = split_toc_page(pdf[page_index], block.get("bbox") or [0, 0, 0, 0])
            if result is None:
                rebuilt.append(block)
                continue
            right_edge = (result.page_column_x0 - TITLE_RIGHT_GAP) if result.page_column_x0 else float(block["bbox"][2])
            for entry in result.entries:
                rebuilt.append(_entry_block(block, entry, str(block.get("block_id") or ""), right_edge))
            page_split += 1
        if not page_split:
            continue
        page["blocks"] = rebuilt
        _renumber_page_blocks(document, page_index, rebuilt)
        split += page_split
    return split


def _renumber_page_blocks(document: dict, page_index: int, blocks: list[dict]) -> None:
    """块号的数字要等于块在本页的位置（各家适配器都这么编号；翻译条目号、渲染引擎配译文都按位置算）。
    拆出条目后整页重编，文档里别处写着的旧块号一起改成新的；拆掉的目录块的号只留在条目的
    `toc_split_parent_block_id` 里。"""
    renamed: dict[str, str] = {}
    for index, block in enumerate(blocks):
        new_id = f"p{page_index + 1:03d}-b{index:04d}"
        old_id = str(block.get("block_id") or "")
        if block.get("structure_role") != ENTRY_STRUCTURE_ROLE and old_id and old_id != new_id:
            renamed[old_id] = new_id
        block["block_id"] = new_id
        block["order"] = index
        block["reading_order"] = index
    if renamed:
        _replace_ids(document, renamed)


def _replace_ids(value, renamed: dict[str, str]):
    if isinstance(value, dict):
        for key, item in value.items():
            if isinstance(item, str) and item in renamed and key != "block_id":
                value[key] = renamed[item]
            else:
                _replace_ids(item, renamed)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            if isinstance(item, str) and item in renamed:
                value[index] = renamed[item]
            else:
                _replace_ids(item, renamed)


def _is_toc_block(block: dict) -> bool:
    if str(block.get("structure_role") or "").lower() == ENTRY_STRUCTURE_ROLE:
        return False
    return (
        str(block.get("structure_role") or "").lower() in TOC_ROLES
        or str(block.get("sub_type") or "").lower() in TOC_ROLES
        or str(block.get("layout_role") or "").lower() in TOC_ROLES
    )


__all__ = ["ENTRY_STRUCTURE_ROLE", "TocEntry", "TocPageSplit", "split_toc_blocks_with_text_layer", "split_toc_page"]

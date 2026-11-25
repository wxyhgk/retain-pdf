"""目录页拆块：有文字层时，把 OCR 给的一整块目录拆成一条条只框住标题的小块（2026-11-25）。

OCR 把一页目录给成一整块、每行的框是估的，翻译后排成左对齐的流水行（页码不再右对齐、小节不缩进、章与章没有间隔），
跨页的两块目录还会被串成一个接续组。拆成只框标题的小块以后：

- 原书的页眉不在任何块里，留在原图上不动（排版引擎只换块里的字）；章号放进条目的文字里跟着重画；
- 每条标题按原位置、原缩进放译文，框一直延伸到页码列前面，给译文留宽度；
- 每条是独立的短块（``structure_role = toc_entry``，不算正文），不参与跨页接续；
- 读出页码的条目后面跟一个页码小块（``structure_role = toc_page_label``，框就是页码在原图上的位置），
  定译就是页码本身（``metadata.fixed_translation``，不发模型请求），排版时擦掉原来的页码、在原处重画。
  不少书一行的标题、点线、页码是同一条绘字指令，擦标题会把页码一起擦掉（2026-11-25，
  docs/ops/planning/toc-agent/20261125-目录页码补画.md）；点线引导不补，擦掉就没了。

一行怎么读（2026-11-25 按本机 13 本书修过一轮，见 docs/ops/planning/toc-agent/20261125-拆条目规则修正.md）：

- 页码：行尾的数字、罗马数字，以及「1-7」「5-35」「57.1」「S2」「A-3」这类；可以是单独的片段，也可以和标题、
  点线引导（``. . .``、``....``、``…``、``·``）写在同一个片段里（按字的位置切开）。
  靠得住的页码：在右边一列（块宽右侧 40%），或者前面有点线引导。
  靠不太住的（紧跟在标题后面、只隔空格的阿拉伯数字）：这一块里这种页码占多数才认（页码不排成一列的目录），
  认了以后页码倒着走，就不认这种再读一遍。
- 点线引导是标题和页码之间的空当，从标题里去掉；有点线没页码的行也算一条结束。
- 章号：行首的「1」「1.2」「4-2」「A-3」「A.」「IV.」；和标题粘在一段里的也拆开（按字的位置）。
- 新的一条从哪里开始：有章号的行、Appendix/Annexure/Chapter/Part（附录、Приложение 等）开头的行、
  比正在攒的没章号的那条起点往左缩出去的行；其余没碰到页码的行当成标题折行，接着攒。

文字层读不出条目（扫描件、页码倒退、条目太少、大半条目没有页码）时什么都不改，照旧是一整块。方案见 docs/ops/planning/toc-agent/。
"""
from __future__ import annotations

import copy
import re
import unicodedata
from dataclasses import dataclass, field

TOC_ROLES = frozenset({"toc", "table_of_contents"})
ENTRY_STRUCTURE_ROLE = "toc_entry"
# 页码小块：框是页码在原图上的位置，定译就是页码本身，排版时擦掉原来的、在原处重画
PAGE_LABEL_STRUCTURE_ROLE = "toc_page_label"
PAGE_LABEL_FIXED_TRANSLATION_SOURCE = "toc_page_label"
SPLIT_STRUCTURE_ROLES = frozenset({ENTRY_STRUCTURE_ROLE, PAGE_LABEL_STRUCTURE_ROLE})
# 一行里的片段按 y 中心聚成视觉行
LINE_Y_TOLERANCE = 3.0
# 上下标：字号不到这一块中位数的这么多、最多 3 个字
SCRIPT_SIZE_RATIO = 0.8
# 页码：「12」「12a」「S2」「A-3」「1-7」「5-35」「57.1」「16-16.1」，或罗马数字
_ARABIC_PAGE = r"(?:[A-Z]{1,2}-?)?\d{1,4}[a-z]?(?:[.\-–]\d{1,4}){0,2}"
_ROMAN_PAGE = (r"(?:(?=[ivxlcdm])m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})"
               r"|(?=[IVXLCDM])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3}))")
PAGE_TOKEN_RE = re.compile(rf"^(?:{_ARABIC_PAGE}|{_ROMAN_PAGE})$")
ARABIC_PAGE_RE = re.compile(rf"^{_ARABIC_PAGE}$")
PLAIN_PAGE_RE = re.compile(r"^\d{1,4}$")
PAGE_COLUMN_FRACTION = 0.6
# 点线引导：两个以上的点（中间可以有空格）
_LEADER_CHARS = r"[.·•…‥⋯∙_]"
LEADER_ONLY_RE = re.compile(rf"^(?:\s*{_LEADER_CHARS}){{2,}}\s*$")
# 片段末尾的「标题 + 点线或空格 + 页码」
TRAILING_PAGE_RE = re.compile(
    rf"^(?P<head>.*?)(?P<sep>(?:\s*{_LEADER_CHARS}){{2,}}\s*|\s+)(?P<page>{_ARABIC_PAGE}|{_ROMAN_PAGE})\s*$"
)
# 标题末尾的点线（夹着零星的短横也算：扫描书文字层的点线里常混着「-」）
TRAILING_LEADER_RE = re.compile(r"(?:\s*[.·•…‥⋯∙_\-–—]){2,}\s*$")
# 章号：一行最左边、和后面的标题隔开的短编号（「1」「1.2」「4-2」「A-3」「A.」「IV.」）
NUMBER_TOKEN_RE = re.compile(r"^(?:\d{1,3}(?:[.\-–]\d{1,3})*\.?|[A-Z](?:[.\-–]\d{1,3})*\.?|[IVXL]{1,6}\.?)$")
NUMBER_GAP = 4.0  # 字母、罗马数字的章号和标题至少隔这么远（数字章号是单独的片段就算）
# 章号和标题写在同一个片段里（「10 Using Your …」「4-2 Separation …」「A-3 Tables」）
JOINED_NUMBER_RE = re.compile(r"^(\s*)(\d{1,3}(?:[.\-–]\d{1,3})*\.?|[A-Z][.\-–]\d{1,3}(?:[.\-–]\d{1,3})*\.?)\s+(\S.*)$")
# 这些词开头的行另起一条（附录、章、部分），词留在标题里
LABEL_START_RE = re.compile(
    r"^(?:appendix|appendices|annex|annexure|attachment|supplement|chapter|part|приложение|глава|раздел|часть"
    r"|附录|附錄|付録)\b",
    re.IGNORECASE,
)
# 比正在攒的那条起点往左缩出去这么多，就是新的一条
OUTDENT = 8.0
# 页码排成一列：这么多的页码左边或右边对齐（±3pt）
PAGE_COLUMN_SHARE = 0.6
# 页眉：在页面上面这一截、去掉页码以后只剩这些字
HEADER_BAND = 0.1
HEADER_WORDS = frozenset({"contents", "table of contents", "brief contents", "目录", "目次", "目 录", "содержание"})
TITLE_RIGHT_GAP = 6.0
# 页码小块压着别的块超过自己面积的这么多就不要（照旧留原图）
LABEL_OVERLAP_SHARE = 0.2
MIN_ENTRIES = 3
# 每这么多个页码容一处倒退（认错的页码）
PAGE_DESCENTS_PER = 15
# 文字层把重音写成「¨」加字母（「¨o」）：合回一个字
_SPACING_ACCENTS = {"¨": ("̈", "aeiouyAEIOUY"), "´": ("́", "aeiouycnszAEIOUYCNSZ"),
                    "ˆ": ("̂", "aeiouAEIOU"), "˜": ("̃", "anoANO"),
                    "ˇ": ("̌", "cszrnegCSZRNEG"), "˚": ("̊", "auAU")}
_ACCENT_RE = re.compile("([" + "".join(_SPACING_ACCENTS) + r"])\s?([A-Za-z])")


@dataclass
class _Span:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    size: float
    chars: tuple = ()  # 每个字的（字，左，右）；和 text 一一对应


@dataclass
class _Line:
    spans: list[_Span]

    @property
    def y(self) -> float:
        return sum((span.y0 + span.y1) / 2 for span in self.spans) / len(self.spans)


@dataclass
class _ParsedLine:
    words: list[_Span]  # 标题片段（章号、页码、点线已去掉）
    number: str = ""
    number_span: _Span | None = None
    page_label: str = ""
    page_span: _Span | None = None
    page_strength: str = ""  # strong：右边一列或有点线；weak：紧跟标题、只隔空格
    words_with_page: list[_Span] = field(default_factory=list)  # 不认 weak 页码时用回这一份
    has_leader: bool = False
    starts_label: bool = False
    header: str = ""

    @property
    def page_x0(self) -> float | None:
        return self.page_span.x0 if self.page_span is not None else None

    @property
    def x0(self) -> float | None:
        if self.number_span is not None:
            return self.number_span.x0
        return self.words[0].x0 if self.words else None


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
    page_box: list[float] | None = None  # 页码的框（读出页码时）
    page_font_size: float | None = None  # 页码的字号（读出页码时）


@dataclass
class TocPageSplit:
    entries: list[TocEntry] = field(default_factory=list)
    header_lines: list[str] = field(default_factory=list)
    page_column_x0: float | None = None


def _join_accents(text: str) -> str:
    def repl(match: re.Match) -> str:
        mark, letters = _SPACING_ACCENTS[match.group(1)]
        return match.group(2) + mark if match.group(2) in letters else match.group(0)

    return unicodedata.normalize("NFC", _ACCENT_RE.sub(repl, text))


def _clean(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", _join_accents(text or "")).split())


def _spans_in(pdf_page, bbox: list[float]) -> list[_Span]:
    x0, y0, x1, y1 = bbox
    spans = []
    for block in pdf_page.get_text("rawdict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                chars = tuple((char.get("c", ""), float(char["bbox"][0]), float(char["bbox"][2]))
                              for char in span.get("chars", []))
                text = "".join(char[0] for char in chars) if chars else span.get("text", "")
                if not text.strip():
                    continue
                sx0, sy0, sx1, sy1 = span["bbox"]
                cx, cy = (sx0 + sx1) / 2, (sy0 + sy1) / 2
                if x0 - 2 <= cx <= x1 + 2 and y0 - 2 <= cy <= y1 + 2:
                    spans.append(_Span(text, sx0, sy0, sx1, sy1, float(span.get("size") or 0), chars))
    return spans


def _is_script(span: _Span, median_size: float) -> bool:
    """上下标（H₂⁺ 的「2」「+」）：字小一圈、只有一两个字。"""
    return median_size > 0 and span.size < median_size * SCRIPT_SIZE_RATIO and len(span.text.strip()) <= 3


def _visual_lines(spans: list[_Span]) -> list[_Line]:
    sizes = sorted(span.size for span in spans)
    median_size = sizes[len(sizes) // 2] if sizes else 0.0
    scripts = [span for span in spans if _is_script(span, median_size)]
    lines: list[_Line] = []
    for span in sorted((span for span in spans if not _is_script(span, median_size)),
                       key=lambda item: ((item.y0 + item.y1) / 2, item.x0)):
        center = (span.y0 + span.y1) / 2
        if lines and abs(lines[-1].y - center) <= LINE_Y_TOLERANCE:
            lines[-1].spans.append(span)
        else:
            lines.append(_Line([span]))
    # 上下标挂到最近的那一行上（以前自成一行，被当成一条目录）；离哪行都远的照旧自成一行
    for span in scripts:
        center = (span.y0 + span.y1) / 2
        nearest = min(lines, key=lambda line: abs(line.y - center), default=None)
        if nearest is not None and abs(nearest.y - center) <= median_size:
            nearest.spans.append(span)
        else:
            lines.append(_Line([span]))
    lines.sort(key=lambda line: line.y)
    for line in lines:
        line.spans.sort(key=lambda item: item.x0)
    return lines


def _merge_words(spans: list[_Span]) -> list[_Span]:
    """紧挨着的片段（连字 ﬁ 被拆成单独片段之类）拼成一段，隔开的保留成几段。"""
    merged: list[_Span] = []
    for span in spans:
        if merged and span.x0 - merged[-1].x1 <= 2.0:
            last = merged[-1]
            chars = last.chars + span.chars if len(last.chars) == len(last.text) and len(span.chars) == len(span.text) else ()
            merged[-1] = _Span(last.text + span.text, last.x0, min(last.y0, span.y0), span.x1, max(last.y1, span.y1),
                               max(last.size, span.size), chars)
        else:
            merged.append(span)
    return merged


def _slice(span: _Span, start: int, end: int) -> _Span | None:
    """片段里 [start, end) 这几个字，框按字的位置算（没有逐字位置时按字数估）。"""
    text = span.text[start:end]
    if not text.strip():
        return None
    if len(span.chars) == len(span.text):
        chars = span.chars[start:end]
        visible = [char for char in chars if char[0].strip()] or list(chars)
        x0, x1 = min(char[1] for char in visible), max(char[2] for char in visible)
    else:
        chars = ()
        width, count = span.x1 - span.x0, max(1, len(span.text))
        x0, x1 = span.x0 + width * start / count, span.x0 + width * end / count
    return _Span(text, x0, span.y0, x1, span.y1, span.size, tuple(chars))


def _is_header(line: _Line, page_height: float) -> bool:
    if page_height <= 0 or line.y > page_height * HEADER_BAND:
        return False
    words = [_clean(span.text) for span in _merge_words(line.spans)]
    rest = [word for word in words if not PAGE_TOKEN_RE.match(word)]
    return bool(rest) and " ".join(rest).lower() in HEADER_WORDS


def _strip_trailing_leaders(words: list[_Span]) -> tuple[list[_Span], bool]:
    """去掉标题后面的点线：整段都是点线的片段扔掉，片段末尾的点线切掉。"""
    words = list(words)
    found = False
    while words and LEADER_ONLY_RE.match(words[-1].text):
        words.pop()
        found = True
    if words:
        match = TRAILING_LEADER_RE.search(words[-1].text)
        if match and LEADER_ONLY_RE.match(re.sub(r"[\-–—]", "", match.group(0)) or ""):
            head = _slice(words[-1], 0, match.start())
            words[-1:] = [head] if head is not None else []
            found = True
    return words, found


def _take_page(words: list[_Span], page_column_from: float) -> tuple[list[_Span], str, _Span | None, str]:
    """从一行末尾取页码：回（剩下的标题片段，页码，页码片段，strong / weak / 空）。
    strong：页码在右边一列，或前面有点线；weak：紧跟在标题后面、只隔空格的阿拉伯数字。"""
    if not words:
        return words, "", None, ""
    last = words[-1]
    whole = _clean(last.text)
    if PAGE_TOKEN_RE.match(whole):
        if len(words) == 1:
            # 只有一个数的行：折行标题的页码单独落到下一行（只认右边一列的）
            return ([], whole, last, "strong") if last.x0 >= page_column_from else (words, "", None, "")
        rest, leader = _strip_trailing_leaders(words[:-1])
        if last.x0 >= page_column_from or leader:
            return rest, whole, last, "strong"
        if ARABIC_PAGE_RE.match(whole):
            return rest, whole, last, "weak"
        return words, "", None, ""
    match = TRAILING_PAGE_RE.match(last.text)
    if not match:
        return words, "", None, ""
    leader = bool(LEADER_ONLY_RE.match(match.group("sep")))
    page = match.group("page")
    head_text = match.group("head")
    if not leader and (not PLAIN_PAGE_RE.match(page) or not head_text.strip()):
        return words, "", None, ""
    page_span = _slice(last, match.start("page"), match.end("page"))
    if page_span is None:
        return words, "", None, ""
    head = _slice(last, 0, len(head_text)) if head_text.strip() else None
    rest, more_leader = _strip_trailing_leaders(words[:-1] + ([head] if head is not None else []))
    if leader or more_leader or page_span.x0 >= page_column_from:
        return rest, page, page_span, "strong"
    return rest, page, page_span, "weak"


def _take_number(words: list[_Span]) -> tuple[list[_Span], str, _Span | None]:
    if len(words) >= 2:
        first = _clean(words[0].text)
        gap = words[1].x0 - words[0].x1
        # 数字章号是单独的片段就算（片段之间本来就隔着 2pt 以上）；字母、罗马数字要隔得开，免得把「A」当章号
        if NUMBER_TOKEN_RE.match(first) and (gap >= NUMBER_GAP or first[0].isdigit()):
            return words[1:], first, words[0]
    if words and (joined := JOINED_NUMBER_RE.match(words[0].text)):
        # 章号和标题在同一个片段里：按字的位置切开（原图上的章号留着不动）
        first = words[0]
        number_span = _slice(first, joined.start(2), joined.end(2))
        title_span = _slice(first, joined.start(3), len(first.text))
        if number_span is not None and title_span is not None:
            return [title_span] + words[1:], _clean(joined.group(2)), number_span
    return words, "", None


def _parse_line(line: _Line, page_column_from: float, page_height: float) -> _ParsedLine:
    if _is_header(line, page_height):
        return _ParsedLine(words=[], header=_clean(" ".join(span.text for span in line.spans)))
    words = _merge_words(line.spans)
    rest, page_label, page_span, strength = _take_page(words, page_column_from)
    rest, leader = _strip_trailing_leaders(rest)
    rest, number, number_span = _take_number(rest)
    with_page = rest
    if strength == "weak":
        # 不认这个页码时，数字留在标题里
        with_page, _number, _span = _take_number(_strip_trailing_leaders(words)[0])
    first_text = _clean(rest[0].text) if rest else ""
    starts_label = bool(first_text) and not first_text[0].islower() and bool(LABEL_START_RE.match(first_text))
    return _ParsedLine(words=rest, number=number, number_span=number_span, page_label=page_label,
                       page_span=page_span,
                       page_strength=strength, words_with_page=with_page, has_leader=leader, starts_label=starts_label)


def _use_weak_pages(parsed: list[_ParsedLine]) -> bool:
    """紧跟标题的数字算不算页码：这一块的页码排成一列（大多左边或右边对齐）时不算，排不成一列时算。"""
    labeled = [line for line in parsed if line.page_strength and line.page_span is not None]
    if not any(line.page_strength == "weak" for line in labeled):
        return False

    def aligned(values: list[float]) -> int:
        return max(sum(1 for other in values if abs(other - value) <= 3) for value in values)

    best = max(aligned([line.page_span.x0 for line in labeled]), aligned([line.page_span.x1 for line in labeled]))
    return best < len(labeled) * PAGE_COLUMN_SHARE


def _page_key(label: str) -> tuple[str, tuple[int, ...]] | None:
    """页码的比较键：（字母前缀，数字们）；罗马数字不比。"""
    if not ARABIC_PAGE_RE.match(label):
        return None
    prefix = re.match(r"^[A-Z]*", label).group(0)
    return prefix, tuple(int(item) for item in re.findall(r"\d+", label))


def _monotonic(entries: list[TocEntry]) -> bool:
    """页码不往回走（同一个字母前缀里比）。条目多的页容一处倒退：扫描书的文字层偶尔认错一个页码（149 认成 159），
    每 15 个页码容一处；索引页、正文被认成目录的，页码来回跳，远不止这些。"""
    last: dict[str, tuple[int, ...]] = {}
    labeled = descents = 0
    for entry in entries:
        key = _page_key(entry.page_label)
        if key is None:
            continue
        labeled += 1
        prefix, numbers = key
        if prefix in last and numbers < last[prefix]:
            descents += 1
        last[prefix] = numbers
    return descents <= labeled // PAGE_DESCENTS_PER


def _group(parsed: list[_ParsedLine], *, use_weak: bool) -> TocPageSplit:
    result = TocPageSplit()
    pending: list[tuple[str, _Span | None, list[_Span]]] = []  # 还没碰到页码的多行标题：（章号，章号片段，标题片段）
    pending_x0: list[float] = []
    page_column_x0s: list[float] = []

    def flush(page_label: str, page_span: _Span | None = None) -> None:
        if not pending:
            return
        number = next((item[0] for item in pending if item[0]), "")
        title_spans = [span for _number, _span, spans_ in pending for span in spans_]
        if not title_spans:
            pending.clear()
            pending_x0.clear()
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
                                       line_boxes=line_boxes,
                                       page_box=[page_span.x0, page_span.y0, page_span.x1, page_span.y1] if page_span else None,
                                       page_font_size=page_span.size if page_span else None))
        pending.clear()
        pending_x0.clear()

    for line in parsed:
        if line.header:
            result.header_lines.append(line.header)
            continue
        words, page_label = line.words, line.page_label
        if page_label and line.page_strength == "weak" and not use_weak:
            words, page_label = line.words_with_page, ""
        if not words and line.number_span is None:
            if page_label and pending:
                # 只有页码（或点线加页码）的一行：上面折行的标题到头了
                if line.page_x0 is not None:
                    page_column_x0s.append(line.page_x0)
                flush(page_label, line.page_span)
            continue
        x0 = line.x0 if line.x0 is not None else (words[0].x0 if words else 0.0)
        # 往左缩出去的行：没章号的条目（论文集里标题上面一行作者）到这里结束；带章号的条目折行常从章号列
        # 甚至更左写起，照旧当折行
        outdented = bool(pending_x0) and not any(item[0] for item in pending) and pending_x0[0] - x0 > OUTDENT
        if pending and (line.number or line.starts_label or outdented):
            flush("")  # 新的一条开始，上面没等到页码的标题单独成一条
        pending.append((line.number, line.number_span, words))
        pending_x0.append(x0)
        if page_label:
            if line.page_x0 is not None:
                page_column_x0s.append(line.page_x0)
            flush(page_label, line.page_span)
        elif line.has_leader:
            flush("")  # 有点线没页码：这一条也到头了
    flush("")
    result.page_column_x0 = min(page_column_x0s) if page_column_x0s else None
    return result


def _acceptable(result: TocPageSplit) -> bool:
    entries = result.entries
    if len(entries) < MIN_ENTRIES:
        return False
    # 三分之二以上的条目没有页码的不是目录（项目符号列表、正文段落被认成目录块）；
    # 论文集的目录每篇下面一行作者、不带页码，占一半上下，照样认
    labeled = sum(1 for entry in entries if entry.page_label)
    if labeled < 2 or labeled * 3 < len(entries):
        return False
    return _monotonic(entries)


def split_toc_page(pdf_page, block_bbox: list[float]) -> TocPageSplit | None:
    """从文字层读出这一块目录的条目。读不出（没文字层、条目太少、页码倒退）回 None。"""
    spans = _spans_in(pdf_page, block_bbox)
    if not spans:
        return None
    block_x0, block_x1 = float(block_bbox[0]), float(block_bbox[2])
    page_column_from = block_x0 + (block_x1 - block_x0) * PAGE_COLUMN_FRACTION
    page_height = float(pdf_page.rect.height)
    parsed = [_parse_line(line, page_column_from, page_height) for line in _visual_lines(spans)]
    use_weak = _use_weak_pages(parsed)
    result = _group(parsed, use_weak=use_weak)
    if use_weak and not _acceptable(result):
        result = _group(parsed, use_weak=False)
    if not _acceptable(result):
        return None
    _assign_levels(result.entries)
    return result


def _number_level(number: str) -> int:
    """「1」「A」「IV」一级，「1.2」「4-2」「A-3」二级，往下按分隔符数。"""
    return len(re.findall(r"[.\-–]", number.rstrip("."))) + 1


def _assign_levels(entries: list[TocEntry]) -> None:
    """按起点定级别：有章号的按章号里的分隔符数（「1」一级、「1.2」「4-2」二级）。没有章号的看从哪一列写起：
    - 在最左的章号列上或更左：一级（结论、附录、索引这类后置部分常和章号同列）；
    - 和更深一级的章号同一列：就是那一级；
    - 和某一级的标题同一列：一级章的标题列上的是它的小节（低一级）；二级以下的标题列上的是同级
      （「习题」「小结」这类没编号的，和带编号的小节并排）；下一级有带编号的条目时也算低一级；
    - 都对不上：往右缩进的低一级、再缩进的再低一级。
    这一页没有带章号的条目时，按起点从左到右一列一级。"""
    numbered = [entry for entry in entries if entry.number and entry.number_x0 is not None]
    if not numbered:
        columns: list[float] = []
        for x0 in sorted(entry.bbox[0] for entry in entries):
            if not columns or x0 - columns[-1] > 8:
                columns.append(x0)
        for entry in entries:
            entry.level = 1 + max(index for index, column in enumerate(columns) if entry.bbox[0] >= column - 0.01)
        return
    for entry in numbered:
        entry.level = _number_level(entry.number)
    levels = sorted({entry.level for entry in numbered})
    number_columns = {level: min(e.number_x0 for e in numbered if e.level == level) for level in levels}
    title_columns = {level: min(e.bbox[0] for e in numbered if e.level == level) for level in levels}
    number_column = min(number_columns.values())
    chapter_title_column = min(e.bbox[0] for e in numbered)
    for entry in entries:
        if entry.number:
            continue
        x0 = entry.bbox[0]
        same_number = [level for level, column in number_columns.items() if abs(x0 - column) <= 4]
        same_title = [level for level, column in title_columns.items() if abs(x0 - column) <= 4]
        if x0 <= number_column + 4:
            entry.level = 1
        elif same_number:
            entry.level = min(same_number)
        elif same_title:
            level = max(same_title)
            entry.level = level + 1 if level == 1 or (level + 1) in number_columns else level
        else:
            entry.level = 2 + (1 if x0 - chapter_title_column > 8 else 0)


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
        # 页码在原图上的框（页码不在条目里；擦原文时它和标题在同一个绘字指令里会被一起擦掉；后面跟着的页码小块就用这个框在原处重画）
        toc_entry_page_bbox=[round(value, 2) for value in entry.page_box] if entry.page_box else None,
        toc_split_parent_block_id=str(parent.get("block_id") or ""),
        structure_role=ENTRY_STRUCTURE_ROLE,
        layout_role="toc",
        semantic_role="unknown",
    )
    block["metadata"] = metadata
    return block


def _page_label_block(parent: dict, entry: TocEntry, block_id: str) -> dict | None:
    """条目的页码小块：框是页码在原图上的位置，文字和定译都是页码本身（不发模型请求）。
    policy 照抄原目录块（服务商不翻目录时整页照旧不动，页码也不重画）。"""
    if not entry.page_label or not entry.page_box:
        return None
    block = copy.deepcopy({key: value for key, value in parent.items() if key not in ("lines", "segments", "content", "text")})
    box = [round(float(value), 2) for value in entry.page_box]
    label = entry.page_label
    block.update(
        block_id=block_id,
        bbox=box,
        text=label,
        sub_type="table_of_contents",
        layout_role="toc",
        semantic_role="unknown",
        structure_role=PAGE_LABEL_STRUCTURE_ROLE,
        block_class="body",
        geometry={"bbox": list(box)},
        lines=[{"bbox": list(box), "bbox_precision": "provider_layout",
                "spans": [{"type": "text", "raw_type": PAGE_LABEL_STRUCTURE_ROLE, "text": label, "bbox": list(box),
                           "score": None, "bbox_precision": "line"}]}],
        segments=[{"type": "text", "raw_type": PAGE_LABEL_STRUCTURE_ROLE, "text": label, "bbox": list(box), "score": None,
                   "bbox_precision": "line"}],
        content={"kind": "text", "text": label, "line_texts": [label]},
    )
    block["tags"] = ["table_of_contents", "toc", PAGE_LABEL_STRUCTURE_ROLE]
    metadata = dict(block.get("metadata") or {})
    for key in [key for key in metadata if key.startswith("toc_entry_")]:
        metadata.pop(key)
    metadata.update(
        toc_page_label=label,
        toc_page_label_source_font_size=round(entry.page_font_size or entry.font_size, 2),
        toc_split_parent_block_id=str(parent.get("block_id") or ""),
        # 定译就是页码本身：两个翻译引擎都不发请求（translation 包 workflow/fixed_translations.py）
        fixed_translation=label,
        fixed_translation_source=PAGE_LABEL_FIXED_TRANSLATION_SOURCE,
        structure_role=PAGE_LABEL_STRUCTURE_ROLE,
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
                label_block = _page_label_block(block, entry, str(block.get("block_id") or ""))
                if label_block is not None:
                    rebuilt.append(label_block)
            page_split += 1
        if not page_split:
            continue
        rebuilt = _drop_crowded_page_labels(rebuilt)
        page["blocks"] = rebuilt
        _renumber_page_blocks(document, page_index, rebuilt)
        split += page_split
    return split


def _overlap_area(a: list[float], b: list[float]) -> float:
    width = min(a[2], b[2]) - max(a[0], b[0])
    height = min(a[3], b[3]) - max(a[1], b[1])
    return width * height if width > 0 and height > 0 else 0.0


def _drop_crowded_page_labels(blocks: list[dict]) -> list[dict]:
    """页码小块压着别的块（两成以上）就不要：标题折行、页码紧跟在最后一行字后面时，页码落在条目框里，
    排版引擎为了不压字会把条目译文缩得很小。这种页码照旧留在原图上（2026-11-25 本机 13 本书里 42 处）。"""
    kept: list[dict] = []
    for block in blocks:
        if block.get("structure_role") == PAGE_LABEL_STRUCTURE_ROLE:
            box = [float(value) for value in block["bbox"]]
            area = max((box[2] - box[0]) * (box[3] - box[1]), 1e-6)
            if any(other is not block and _overlap_area(box, [float(v) for v in other.get("bbox") or [0, 0, 0, 0]])
                   > LABEL_OVERLAP_SHARE * area for other in blocks):
                continue
        kept.append(block)
    return kept


def _renumber_page_blocks(document: dict, page_index: int, blocks: list[dict]) -> None:
    """块号的数字要等于块在本页的位置（各家适配器都这么编号；翻译条目号、渲染引擎配译文都按位置算）。
    拆出条目后整页重编，文档里别处写着的旧块号一起改成新的；拆掉的目录块的号只留在条目的
    `toc_split_parent_block_id` 里。页码小块记下它跟着的条目（`toc_page_label_entry_block_id`）。"""
    renamed: dict[str, str] = {}
    last_entry_id = ""
    label_entries: list[tuple[dict, str]] = []
    for index, block in enumerate(blocks):
        new_id = f"p{page_index + 1:03d}-b{index:04d}"
        old_id = str(block.get("block_id") or "")
        role = block.get("structure_role")
        if role not in SPLIT_STRUCTURE_ROLES and old_id and old_id != new_id:
            renamed[old_id] = new_id
        block["block_id"] = new_id
        block["order"] = index
        block["reading_order"] = index
        if role == ENTRY_STRUCTURE_ROLE:
            last_entry_id = new_id
        elif role == PAGE_LABEL_STRUCTURE_ROLE:
            label_entries.append((block, last_entry_id))
    if renamed:
        _replace_ids(document, renamed)
    # 换完旧号再写：新号可能和别的块的旧号同名，先写会被换掉
    for block, entry_id in label_entries:
        block["metadata"]["toc_page_label_entry_block_id"] = entry_id


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
    if str(block.get("structure_role") or "").lower() in SPLIT_STRUCTURE_ROLES:
        return False
    return (
        str(block.get("structure_role") or "").lower() in TOC_ROLES
        or str(block.get("sub_type") or "").lower() in TOC_ROLES
        or str(block.get("layout_role") or "").lower() in TOC_ROLES
    )


__all__ = ["ENTRY_STRUCTURE_ROLE", "PAGE_LABEL_FIXED_TRANSLATION_SOURCE", "PAGE_LABEL_STRUCTURE_ROLE", "TocEntry", "TocPageSplit", "split_toc_blocks_with_text_layer", "split_toc_page"]

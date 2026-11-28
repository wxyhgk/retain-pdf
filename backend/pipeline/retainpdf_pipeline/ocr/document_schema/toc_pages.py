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

原位替换（2026-11-28 用户定，docs/ops/planning/toc-agent/20261128-用户定：目录页原位替换.md）要知道哪些字是标题：每条另记
``toc_entry_title_lines``（只框标题的字的每一行：框、基线、字号、文字）、章号的框、标签列（「Chapter 1」「Annexure I」，
不翻、留原图）。条目的文字和框照旧（默认的重排不变）。标题自带的句号（「Summary. . . .」）不当点线。

文字层读不出条目（扫描件、页码倒退、条目太少、大半条目没有页码）时什么都不改，照旧是一整块。方案见 docs/ops/planning/toc-agent/。

认上下文（R2，2026-11-28，docs/ops/planning/toc-agent/20261128-R2：认上下文的agent.md）：``page_draft`` 给出同一套规则的草稿
（每段字的角色 number / label / title / leader / page / header / other、归哪一条；规则不认的块也给候选），目录 agent 核对拿不准的页；
``apply_toc_context`` 按它改过的草稿重建条目块（字段和这里拆出来的一样，另加 ``toc_entry_keep_original`` 等）。拆出的条目另记
原目录块的框 ``toc_split_parent_bbox``，重读时用。
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
# 标签列：「Chapter 1」「Annexure I」「Part II」「Appendix A」（标签词 + 编号）。原位替换时留在原图上不翻（2026-11-28 用户定），
# 只记下来，条目文字照旧带着它
LABEL_PREFIX_RE = re.compile(
    r"^\s*((?i:appendix|annex|annexure|attachment|supplement|chapter|part|приложение|глава|раздел|часть)"
    r"\s*(?:\d{1,3}(?:[.\-–]\d{1,3})*|[IVXLC]{1,6}|[ivx]{1,4}|[A-Z])[.:]?)(?=\s|$)"  # 编号区分大小写：「Part a story」不算
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
    baseline: float = 0.0  # 基线的 y（文字层的 origin）；没有时用框的底边
    font: str = ""  # 字体名（认上下文时给模型看粗斜体、数字体种类，2026-11-28）
    flags: int = 0  # 文字层的字体标志（2 斜体、16 粗体）


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
    number_box: list[float] | None = None  # 章号的框（有章号时）
    label: str = ""  # 标签列（「Chapter 1」），没有时空
    label_box: list[float] | None = None
    title_only: str = ""  # 去掉章号、标签的标题
    title_lines: list[dict] = field(default_factory=list)  # 标题每一行只框标题的字：{bbox, baseline, size, text}
    # 认上下文（R2，2026-11-28）用：这一条的每段字和角色（视觉行号，角色，片段）；角色 number / label / title / page
    fragments: list[tuple[int, str, "_Span"]] = field(default_factory=list)


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
                    origin = span.get("origin") or (sx0, sy1)
                    spans.append(_Span(text, sx0, sy0, sx1, sy1, float(span.get("size") or 0), chars, float(origin[1]),
                                       str(span.get("font") or ""), int(span.get("flags") or 0)))
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
                               max(last.size, span.size), chars, last.baseline, last.font, last.flags)
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
    return _Span(text, x0, span.y0, x1, span.y1, span.size, tuple(chars), span.baseline, span.font, span.flags)


def _is_header(line: _Line, page_height: float) -> bool:
    if page_height <= 0 or line.y > page_height * HEADER_BAND:
        return False
    words = [_clean(span.text) for span in _merge_words(line.spans)]
    rest = [word for word in words if not PAGE_TOKEN_RE.match(word)]
    return bool(rest) and " ".join(rest).lower() in HEADER_WORDS


def _leaders_from(text: str, start: int) -> int:
    """点线从哪个字开始：标题自带的句号（紧贴着字母、后面隔着空格才是一个个点：「Summary. . . .」）留在标题里。
    点挨着点的（「Summary.....」）分不出来，照旧全算点线。"""
    if (0 < start < len(text) - 1 and text[start] == "." and (text[start - 1].isalnum() or text[start - 1] in ")]\"'’”")
            and text[start + 1].isspace()):
        return start + 1
    return start


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
            head = _slice(words[-1], 0, _leaders_from(words[-1].text, match.start()))
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
    head_text = last.text[:_leaders_from(last.text, match.start("sep"))] if leader else match.group("head")
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


def _box(span: _Span) -> list[float]:
    return [round(span.x0, 2), round(span.y0, 2), round(span.x1, 2), round(span.y1, 2)]


def _split_label(words: list[_Span]) -> tuple[str, _Span | None, list[_Span]]:
    """标题第一行开头的标签（「Chapter 1」）切出来：回（标签，标签片段，剩下的标题片段）。标签后面没有标题字的不切
    （整条就是「Appendix A」时它就是标题）。标签和编号可以在一个片段里、也可以是两个片段。"""
    if not words:
        return "", None, words
    for count in (1, 2):
        if len(words) < count:
            break
        joined = " ".join(span.text for span in words[:count])
        match = LABEL_PREFIX_RE.match(joined)
        if not match:
            continue
        end = match.end(1)
        if count == 2:
            if end < len(joined.rstrip()):
                continue  # 编号片段里还带着标题字：两段拼起来切不准，不切
            first, second = words[0], words[1]
            label_span = _Span(joined.strip(), first.x0, min(first.y0, second.y0), second.x1, max(first.y1, second.y1),
                               first.size, (), first.baseline, first.font, first.flags)
            rest = words[2:]
        else:
            label_span = _slice(words[0], 0, end)
            tail = _slice(words[0], end, len(words[0].text))
            rest = ([tail] if tail is not None else []) + words[1:]
        if label_span is not None and any(span.text.strip() for span in rest):
            return _clean(match.group(1)), label_span, rest
    return "", None, words


def _title_line(spans: list[_Span]) -> dict:
    """一行标题只框标题的字（章号、标签、点线、页码已经切掉）：原位替换按这个框擦字、按基线写译文。"""
    baseline = max((span.baseline for span in spans), default=0.0) or max(span.y1 for span in spans)
    sizes = sorted(span.size for span in spans)
    return {"bbox": [round(min(s.x0 for s in spans), 2), round(min(s.y0 for s in spans), 2),
                     round(max(s.x1 for s in spans), 2), round(max(s.y1 for s in spans), 2)],
            "baseline": round(baseline, 2), "size": round(sizes[len(sizes) // 2], 2),
            "text": _clean(" ".join(span.text for span in spans))}


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
    pending_lines: list[int] = []  # 每一项来自第几个视觉行（认上下文时用）
    page_column_x0s: list[float] = []

    def flush(page_label: str, page_span: _Span | None = None, page_line: int = -1) -> None:
        if not pending:
            return
        number = next((item[0] for item in pending if item[0]), "")
        title_spans = [span for _number, _span, spans_ in pending for span in spans_]
        if not title_spans:
            pending.clear()
            pending_x0.clear()
            pending_lines.clear()
            return
        title = _clean(" ".join(" ".join(span.text for span in spans_) for _n, _s, spans_ in pending))
        bbox = [min(s.x0 for s in title_spans), min(s.y0 for s in title_spans),
                max(s.x1 for s in title_spans), max(s.y1 for s in title_spans)]
        sizes = sorted(span.size for span in title_spans)
        number_x0 = next((item[1].x0 for item in pending if item[1] is not None), None)
        line_boxes = [[min(s.x0 for s in spans_), min(s.y0 for s in spans_), max(s.x1 for s in spans_), max(s.y1 for s in spans_)]
                      for _n, _s, spans_ in pending if spans_]
        number_span = next((item[1] for item in pending if item[1] is not None), None)
        label, label_span, title_lines = "", None, []
        fragments: list[tuple[int, str, _Span]] = []
        for (_n, number_span_, spans_), line_index in zip(pending, pending_lines):
            if number_span_ is not None:
                fragments.append((line_index, "number", number_span_))
            if spans_ and not title_lines and not label:
                label, label_span, spans_ = _split_label(spans_)
                if label_span is not None:
                    fragments.append((line_index, "label", label_span))
            if spans_:
                title_lines.append(_title_line(spans_))
                fragments.extend((line_index, "title", span) for span in spans_)
        if page_span is not None:
            fragments.append((page_line if page_line >= 0 else pending_lines[-1], "page", page_span))
        title_only = _clean(" ".join(line["text"] for line in title_lines))
        result.entries.append(TocEntry(title=title, number=number, page_label=page_label, level=0, bbox=bbox,
                                       font_size=sizes[len(sizes) // 2], line_count=len(pending), number_x0=number_x0,
                                       line_boxes=line_boxes,
                                       page_box=[page_span.x0, page_span.y0, page_span.x1, page_span.y1] if page_span else None,
                                       page_font_size=page_span.size if page_span else None,
                                       number_box=_box(number_span) if number_span is not None else None,
                                       label=label, label_box=_box(label_span) if label_span is not None else None,
                                       title_only=title_only, title_lines=title_lines, fragments=fragments))
        pending.clear()
        pending_x0.clear()
        pending_lines.clear()

    for line_index, line in enumerate(parsed):
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
                flush(page_label, line.page_span, line_index)
            continue
        x0 = line.x0 if line.x0 is not None else (words[0].x0 if words else 0.0)
        # 往左缩出去的行：没章号的条目（论文集里标题上面一行作者）到这里结束；带章号的条目折行常从章号列
        # 甚至更左写起，照旧当折行
        outdented = bool(pending_x0) and not any(item[0] for item in pending) and pending_x0[0] - x0 > OUTDENT
        if pending and (line.number or line.starts_label or outdented):
            flush("")  # 新的一条开始，上面没等到页码的标题单独成一条
        pending.append((line.number, line.number_span, words))
        pending_x0.append(x0)
        pending_lines.append(line_index)
        if page_label:
            if line.page_x0 is not None:
                page_column_x0s.append(line.page_x0)
            flush(page_label, line.page_span, line_index)
        elif line.has_leader:
            flush("")  # 有点线没页码：这一条也到头了
    flush("")
    result.page_column_x0 = min(page_column_x0s) if page_column_x0s else None
    return result


def _acceptable(result: TocPageSplit) -> bool:
    return not _reject_reason(result)


def _reject_reason(result: TocPageSplit) -> str:
    """规则为什么不认这一块（认上下文时交模型核对的原因）；认了回空串。"""
    entries = result.entries
    if len(entries) < MIN_ENTRIES:
        return "few_entries"
    # 三分之二以上的条目没有页码的不是目录（项目符号列表、正文段落被认成目录块）；
    # 论文集的目录每篇下面一行作者、不带页码，占一半上下，照样认
    labeled = sum(1 for entry in entries if entry.page_label)
    if labeled < 2 or labeled * 3 < len(entries):
        return "few_page_labels"
    return "" if _monotonic(entries) else "pages_not_monotonic"


def split_toc_page(pdf_page, block_bbox: list[float]) -> TocPageSplit | None:
    """从文字层读出这一块目录的条目。读不出（没文字层、条目太少、页码倒退）回 None。"""
    parsed_block = _parse_block(pdf_page, block_bbox)
    if parsed_block is None:
        return None
    _lines, _parsed, result = parsed_block
    if not _acceptable(result):
        return None
    _assign_levels(result.entries)
    return result


def _parse_block(pdf_page, block_bbox: list[float]) -> tuple[list[_Line], list[_ParsedLine], TocPageSplit] | None:
    spans = _spans_in(pdf_page, block_bbox)
    if not spans:
        return None
    block_x0, block_x1 = float(block_bbox[0]), float(block_bbox[2])
    page_column_from = block_x0 + (block_x1 - block_x0) * PAGE_COLUMN_FRACTION
    lines = _visual_lines(spans)
    parsed = [_parse_line(line, page_column_from, float(pdf_page.rect.height)) for line in lines]
    use_weak = _use_weak_pages(parsed)
    result = _group(parsed, use_weak=use_weak)
    if use_weak and not _acceptable(result):
        result = _group(parsed, use_weak=False)
    return lines, parsed, result


# 认上下文（R2，2026-11-28）：片段的角色。number 章号、label 标签列、title 标题的字、leader 点线、page 页码、header 页眉、
# author 作者行、other 别的（落单的页码、规则没归到哪一条的字）。规则只给前六种和 other，author 由模型改
FRAGMENT_ROLES = ("number", "label", "title", "leader", "page", "header", "author", "other")


def _fragment(span: _Span, role: str, line_number: int) -> dict:
    return {"line": line_number, "text": _clean(span.text), "bbox": _box(span), "size": round(span.size, 2),
            "baseline": round(span.baseline or span.y1, 2), "font": span.font,
            "bold": bool(span.flags & 16) or "bold" in span.font.lower(),
            "italic": bool(span.flags & 2) or "italic" in span.font.lower() or "oblique" in span.font.lower(),
            "role": role}


def _is_leader_text(text: str) -> bool:
    """点线（中间夹着空格、零星短横也算）；一个「…」也算。"""
    compact = "".join(str(text or "").split())
    return bool(compact) and set(compact) <= set(".·•…‥⋯∙_-–—") and (len(compact) >= 2 or compact in "…‥⋯")


def _leftovers(line: _Line, taken: list[_Span]) -> list[_Span]:
    """一行里没归到哪一段的字（点线、落单的字）：按字的位置找出来，连着的拼成一段。"""
    def covered(x0: float, x1: float) -> bool:
        center = (x0 + x1) / 2
        return any(span.x0 - 0.5 <= center <= span.x1 + 0.5 for span in taken)

    found: list[_Span] = []
    for word in _merge_words(line.spans):
        if len(word.chars) != len(word.text):
            if not any(min(word.x1, span.x1) - max(word.x0, span.x0) > 0 for span in taken):
                found.append(word)
            continue
        start = None
        for index, (char, x0, x1) in enumerate((*word.chars, ("", 0.0, 0.0))):
            free = index < len(word.chars) and (not char.strip() or not covered(x0, x1))
            if free and start is None and char.strip():
                start = index
            elif not free and start is not None:
                piece = _slice(word, start, index)
                if piece is not None:
                    found.append(piece)
                start = None
    return found


def page_draft(pdf_page, block_bbox: list[float]) -> dict | None:
    """规则草稿：这一块目录每个视觉行的片段（字、位置、字号、粗斜体、规则给的角色）和条目归属，规则认不认这一块。
    给目录 agent 认上下文（backend/toc-agent 的 ``context``）：规则拿不准时交模型核对，规则不认的块也照样给出候选。
    没有文字层回 None。"""
    parsed_block = _parse_block(pdf_page, block_bbox)
    if parsed_block is None:
        return None
    lines, parsed, result = parsed_block
    reason = _reject_reason(result)
    if result.entries:
        _assign_levels(result.entries)
    per_line: dict[int, list[tuple[str, _Span, int]]] = {}
    for entry_index, entry in enumerate(result.entries):
        for line_index, role, span in entry.fragments:
            per_line.setdefault(line_index, []).append((role, span, entry_index))
    fragments: list[dict] = []
    entry_fragments: list[list[str]] = [[] for _ in result.entries]
    for line_index, line in enumerate(lines):
        taken = per_line.get(line_index, [])
        if parsed[line_index].header:
            pieces = [("header", span, -1) for span in _merge_words(line.spans)]
        else:
            loose = _leftovers(line, [span for _role, span, _entry in taken])
            pieces = taken + [("leader" if _is_leader_text(span.text) else "other", span, -1) for span in loose]
        for role, span, entry_index in sorted(pieces, key=lambda item: item[1].x0):
            fragment = _fragment(span, role, line_index + 1)
            fragment["id"] = f"f{len(fragments) + 1}"
            fragments.append(fragment)
            if entry_index >= 0:
                entry_fragments[entry_index].append(fragment["id"])
    # 点线挨着哪一条的标题就归哪一条（同一行有这一条的字）
    by_id = {fragment["id"]: fragment for fragment in fragments}
    line_entry = {}
    for entry_index, ids in enumerate(entry_fragments):
        for fragment_id in ids:
            line_entry.setdefault(by_id[fragment_id]["line"], entry_index)
    for fragment in fragments:
        if fragment["role"] == "leader" and fragment["line"] in line_entry:
            entry_fragments[line_entry[fragment["line"]]].append(fragment["id"])
    order = {fragment["id"]: index for index, fragment in enumerate(fragments)}
    entries = [{"fragments": sorted(ids, key=order.get), "level": entry.level} for entry, ids in zip(result.entries, entry_fragments)]
    return {"region": [round(float(value), 2) for value in block_bbox],
            "page_size": [round(float(pdf_page.rect.width), 2), round(float(pdf_page.rect.height), 2)],
            "accepted": not reason, "reason": reason, "fragments": fragments, "entries": entries}


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
        # 原位替换用（2026-11-28）：只框标题的字的每一行（擦这些字、在原基线上写译文），章号、标签的框留在原图上不动
        toc_entry_title=entry.title_only,
        toc_entry_title_lines=[dict(line) for line in entry.title_lines],
        toc_entry_number_bbox=entry.number_box,
        toc_entry_label=entry.label,
        toc_entry_label_bbox=entry.label_box,
        toc_split_parent_block_id=str(parent.get("block_id") or ""),
        # 拆之前那一块目录的框：认上下文（R2）照这个框重读文字层，和拆条目时读到的一样
        toc_split_parent_bbox=[round(float(value), 2) for value in parent.get("bbox") or []] or None,
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


def _group_region(blocks: list[dict]) -> list[float] | None:
    """已经拆开的一组条目的原目录块框：条目里记着就用它（2026-11-28 起），以前拆的用条目和页码框合起来的框。"""
    for block in blocks:
        bbox = (block.get("metadata") or {}).get("toc_split_parent_bbox")
        if isinstance(bbox, list) and len(bbox) == 4:
            return [float(value) for value in bbox]
    boxes = [[float(v) for v in block.get("bbox") or []] for block in blocks]
    boxes = [box for box in boxes if len(box) == 4]
    if not boxes:
        return None
    return [min(b[0] for b in boxes) - 2, min(b[1] for b in boxes) - 2, max(b[2] for b in boxes) + 2, max(b[3] for b in boxes) + 2]


def context_drafts(document: dict, pdf) -> tuple[list[dict], list[int]]:
    """每一块目录的规则草稿（认上下文用，``page_draft``）：已经拆成条目的按原目录块重读，规则不认、还是一整块的也给出候选。
    回（草稿列表，读不出字的页：没有文字层的扫描件）。草稿带 ``page_index``、``parent_block_id``。"""
    drafts: list[dict] = []
    no_text: list[int] = []
    for page_index, page in enumerate(document.get("pages") or []):
        if page_index >= len(pdf):
            break
        groups: dict[str, list[dict]] = {}
        whole: list[dict] = []
        for block in page.get("blocks") or []:
            role = str(block.get("structure_role") or "")
            if role in SPLIT_STRUCTURE_ROLES:
                parent_id = str((block.get("metadata") or {}).get("toc_split_parent_block_id") or "")
                groups.setdefault(parent_id, []).append(block)
            elif _is_toc_block(block):
                whole.append(block)
        targets = [(parent_id, _group_region(blocks), True) for parent_id, blocks in groups.items()]
        targets += [(str(block.get("block_id") or ""), [float(v) for v in block.get("bbox") or [0, 0, 0, 0]], False)
                    for block in whole]
        for parent_id, region, split in targets:
            if region is None:
                continue
            draft = page_draft(pdf[page_index], region)
            if draft is None:
                no_text.append(page_index)
                continue
            if split and not draft["accepted"]:
                continue  # 重读的和拆的时候对不上（以前拆的、框是估的）：不动它
            draft.update(page_index=page_index, parent_block_id=parent_id)
            drafts.append(draft)
    return drafts, sorted(set(no_text))


def _span_of(fragment: dict) -> _Span:
    x0, y0, x1, y1 = (float(value) for value in fragment["bbox"])
    return _Span(str(fragment.get("text") or ""), x0, y0, x1, y1, float(fragment.get("size") or 0.0), (),
                 float(fragment.get("baseline") or y1), str(fragment.get("font") or ""), 0)


def _entry_from_draft(entry: dict, fragments: dict[str, dict]) -> TocEntry | None:
    """认上下文改过的一条 → 条目（和拆条目时一样的字段）。标题的字按行分；章号、标签、页码各取第一段。"""
    parts = [fragments[fragment_id] for fragment_id in entry.get("fragments") or [] if fragment_id in fragments]
    titles = [part for part in parts if part.get("role") == "title"]
    if not titles:
        return None
    first = {role: next((part for part in parts if part.get("role") == role), None) for role in ("number", "label", "page")}
    number, label, page = first["number"], first["label"], first["page"]
    by_line: dict[int, list[_Span]] = {}
    for part in titles:
        by_line.setdefault(int(part.get("line") or 0), []).append(_span_of(part))
    title_lines = [_title_line(spans) for _line, spans in sorted(by_line.items())]
    named = ([label] if label is not None else []) + titles
    line_boxes: dict[int, list[float]] = {}
    for part in named:
        span = _span_of(part)
        box = line_boxes.setdefault(int(part.get("line") or 0), [span.x0, span.y0, span.x1, span.y1])
        box[:] = [min(box[0], span.x0), min(box[1], span.y0), max(box[2], span.x1), max(box[3], span.y1)]
    spans = [_span_of(part) for part in named]
    title_only = _clean(" ".join(line["text"] for line in title_lines))
    label_text = _clean(str(label.get("text") or "")) if label is not None else ""
    sizes = sorted(span.size for span in spans)
    lines = {int(part.get("line") or 0) for part in parts if part.get("role") in ("number", "label", "title")}
    return TocEntry(
        title=_clean(f"{label_text} {title_only}"),
        number=_clean(str(number.get("text") or "")) if number is not None else "",
        page_label=_clean(str(page.get("text") or "")) if page is not None else "",
        level=int(entry.get("level") or 1),
        bbox=[min(s.x0 for s in spans), min(s.y0 for s in spans), max(s.x1 for s in spans), max(s.y1 for s in spans)],
        font_size=sizes[len(sizes) // 2],
        line_count=max(1, len(lines)),
        number_x0=float(number["bbox"][0]) if number is not None else None,
        line_boxes=[box for _line, box in sorted(line_boxes.items())],
        page_box=[float(v) for v in page["bbox"]] if page is not None else None,
        page_font_size=float(page.get("size") or 0.0) if page is not None else None,
        number_box=[round(float(v), 2) for v in number["bbox"]] if number is not None else None,
        label=label_text,
        label_box=[round(float(v), 2) for v in label["bbox"]] if label is not None else None,
        title_only=title_only,
        title_lines=title_lines,
    )


# 认上下文写回（2026-11-28）：不翻的条目、整页保留原文的页，policy 改成不翻（翻译不发请求，排版不擦不画，原字留着）
CONTEXT_KEEP_TRANSLATE_REASON = "toc_context_keep"


def _keep_policy(block: dict) -> None:
    policy = dict(block.get("policy") or {})
    policy.update(translate=False, translate_reason=CONTEXT_KEEP_TRANSLATE_REASON)
    block["policy"] = policy


def _context_metadata(block: dict, *, source: str, keep: str, continues: bool, text_layer: str,
                      authors: list[dict] | None = None) -> None:
    metadata = block.setdefault("metadata", {})
    metadata.update(
        toc_entry_context_source=source,
        toc_entry_keep_original=bool(keep),
        toc_entry_keep_reason=keep,
        toc_entry_continues_prev_page=bool(continues),
        toc_entry_text_layer=text_layer,
        toc_entry_author_lines=list(authors or []),
    )
    if keep:
        _keep_policy(block)


def apply_toc_context(document: dict, pages: list[dict]) -> int:
    """把认上下文的结果写回文档，回改了几块目录。``pages`` 是目录 agent 每页的结果记录（``PageOutcome.to_record``）：

    - ``effect = rebuild``：按模型改过的草稿重建这一块的条目和页码小块（规则不认的整块也按它拆开），整页重编块号；
    - ``effect = keep_page``：这一块的条目整页保留原文（不翻、不擦不画，页码小块也不重画）；规则不认的整块不动；
    - 其余不动。"""
    changed = 0
    touched: set[int] = set()
    page_list = document.get("pages") or []
    for record in pages:
        effect = str(record.get("effect") or "none")
        draft = record.get("draft") or {}
        if effect not in ("rebuild", "keep_page"):
            continue
        page_index = int(draft.get("page_index", -1))
        parent_id = str(draft.get("parent_block_id") or "")
        if not 0 <= page_index < len(page_list):
            continue
        blocks = page_list[page_index].get("blocks") or []
        group = [index for index, block in enumerate(blocks)
                 if (str(block.get("structure_role") or "") in SPLIT_STRUCTURE_ROLES
                     and str((block.get("metadata") or {}).get("toc_split_parent_block_id") or "") == parent_id)
                 or (_is_toc_block(block) and str(block.get("block_id") or "") == parent_id)]
        if not group:
            continue
        split = str(blocks[group[0]].get("structure_role") or "") in SPLIT_STRUCTURE_ROLES
        text_layer = str(draft.get("text_layer") or "visible")
        status = str(record.get("status") or "rules")
        if effect == "keep_page":
            if not split:
                continue
            for index in group:
                if blocks[index].get("structure_role") == ENTRY_STRUCTURE_ROLE:
                    _context_metadata(blocks[index], source=status, keep=status, continues=False, text_layer=text_layer)
                else:
                    _keep_policy(blocks[index])
            changed += 1
            continue
        fragments = {str(fragment.get("id")): fragment for fragment in draft.get("fragments") or []}
        template = next((blocks[index] for index in group if blocks[index].get("structure_role") != PAGE_LABEL_STRUCTURE_ROLE),
                        blocks[group[0]])
        parent = copy.deepcopy(template)
        parent["block_id"] = parent_id
        parent["bbox"] = [float(v) for v in draft.get("region") or template.get("bbox") or [0, 0, 0, 0]]
        parent["metadata"] = {key: value for key, value in (template.get("metadata") or {}).items()
                              if not key.startswith(("toc_entry_", "toc_page_label", "toc_split_", "fixed_translation"))}
        built = [(entry, _entry_from_draft(entry, fragments)) for entry in draft.get("entries") or []]
        built = [(entry, toc_entry) for entry, toc_entry in built if toc_entry is not None]
        if not built:
            continue
        page_x0s = [toc_entry.page_box[0] for _entry, toc_entry in built if toc_entry.page_box]
        right_edge = (min(page_x0s) - TITLE_RIGHT_GAP) if page_x0s else float(parent["bbox"][2])
        rebuilt: list[dict] = []
        for entry, toc_entry in built:
            block = _entry_block(parent, toc_entry, parent_id, right_edge)
            authors = [_title_line([_span_of(fragments[f])]) for f in entry.get("fragments") or []
                       if f in fragments and fragments[f].get("role") == "author"]
            _context_metadata(block, source=status, keep=str(entry.get("keep") or ""),
                              continues=bool(entry.get("continues_prev_page")), text_layer=text_layer, authors=authors)
            rebuilt.append(block)
            label_block = _page_label_block(parent, toc_entry, parent_id)
            if label_block is not None:
                if entry.get("keep"):
                    _keep_policy(label_block)
                rebuilt.append(label_block)
        members = set(group)
        kept = [block for index, block in enumerate(blocks) if index not in members]
        first = group[0]
        page_list[page_index]["blocks"] = kept[:first] + rebuilt + kept[first:]
        touched.add(page_index)
        changed += 1
    for page_index in sorted(touched):
        blocks = _drop_crowded_page_labels(page_list[page_index]["blocks"])
        page_list[page_index]["blocks"] = blocks
        _renumber_page_blocks(document, page_index, blocks)
    return changed


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


__all__ = ["ENTRY_STRUCTURE_ROLE", "FRAGMENT_ROLES", "PAGE_LABEL_FIXED_TRANSLATION_SOURCE", "PAGE_LABEL_STRUCTURE_ROLE", "TocEntry",
           "TocPageSplit", "apply_toc_context", "context_drafts", "page_draft", "split_toc_blocks_with_text_layer", "split_toc_page"]

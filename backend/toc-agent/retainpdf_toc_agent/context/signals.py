"""规则拿不准的信号：一页目录有这些信号才问模型，没有就照规则走、不发请求（2026-11-28 用户定「规则拿不准才问」）。

每个信号是一个短码，结果文件里按页记下来，评测时数「会问几页」不花钱。阈值都在这里，按回归集调过
（docs/ops/planning/toc-agent/20261128-R2：认上下文的agent.md）。
"""
from __future__ import annotations

import re
import statistics

from retainpdf_toc_agent.context.draft import PAGE_RE
from retainpdf_toc_agent.context.draft import TEXT_LAYER_INVISIBLE
from retainpdf_toc_agent.context.draft import PageDraft
from retainpdf_toc_agent.context.draft import page_descents
from retainpdf_toc_agent.match import title_key
from retainpdf_toc_agent.match import title_variants

SIGNAL_RULES_REJECTED = "rules_rejected"  # 规则不认这一块（条目太少、页码倒退、大半没页码），只给出候选
SIGNAL_FEW_ENTRIES = "few_entries"  # 条目少于 3 条
SIGNAL_FEW_PAGE_LABELS = "few_page_labels"  # 带页码的条目不到一半
SIGNAL_PAGES_NOT_MONOTONIC = "pages_not_monotonic"  # 页码往回走
SIGNAL_TWO_COLUMNS = "two_columns"  # 两条页码列 / 双栏
SIGNAL_PAGE_LEFT = "page_left"  # 页码在左
SIGNAL_MANY_FONTS = "many_fonts"  # 标题的字用了 3 种以上字体
SIGNAL_AUTHOR_LINE = "author_line_unrecognized"  # 有斜体或小一号的行，没认出作者行
SIGNAL_MULTILINE_WITHOUT_PAGE = "multiline_without_page"  # 没页码的多行条目
SIGNAL_INVISIBLE_TEXT = "invisible_text_layer"  # 文字层看不见（扫描件的 OCR 层）
SIGNAL_HEADINGS_UNMATCHED = "headings_unmatched"  # 条目和正文标题对得上的太少
SIGNAL_TRANSLATION_REJECTED = "translation_rejected"  # 目录翻译检查退回过（数字对不上：章号页码混进标题）

SIGNALS = (
    SIGNAL_RULES_REJECTED,
    SIGNAL_FEW_ENTRIES,
    SIGNAL_FEW_PAGE_LABELS,
    SIGNAL_PAGES_NOT_MONOTONIC,
    SIGNAL_TWO_COLUMNS,
    SIGNAL_PAGE_LEFT,
    SIGNAL_MANY_FONTS,
    SIGNAL_AUTHOR_LINE,
    SIGNAL_MULTILINE_WITHOUT_PAGE,
    SIGNAL_INVISIBLE_TEXT,
    SIGNAL_HEADINGS_UNMATCHED,
    SIGNAL_TRANSLATION_REJECTED,
)

MIN_ENTRIES = 3
# 字体：按字族算（「Times-Roman」「Times-Bold」是一族，「LMRoman10」「LMRoman12」是一族），这一族至少出现两段才算；
# 标题、标签、作者的字用了 3 族以上。按字体名一个个数时，粗体 + 常规 + 斜体 + 数学字体的普通目录也会亮（回归集 20 页）
MANY_FONTS = 3
MANY_FONTS_MIN_FRAGMENTS = 2
# 作者行：整行斜体（这一页的标题大多不是斜体），或者比这一条别的行小这么多
AUTHOR_SIZE_DROP = 1.0
# 双栏：一行里页码样的字落在左边这一截，右边还有标题的字
TWO_COLUMN_SPLIT = 0.55
TWO_COLUMN_LINES = 3
# 页码在左：这么多行的第一段是纯数字、这一行又没有页码
PAGE_LEFT_LINES = 3
# 和正文标题比：正文标题至少这么多个才比；够格的条目（两个词以上）至少这么多条；对上的不到这个比例算低
HEADINGS_MIN = 10
HEADINGS_MIN_ENTRIES = 3
HEADINGS_MIN_SHARE = 0.3
# 翻译检查退回的原因里，和认条目有关的（数字对不上：章号、页码混进了标题，或者标题被拆错）
TRANSLATION_REJECT_REASONS = frozenset({"number_changed", "number_missing"})
_PLAIN_NUMBER = re.compile(r"^\d{1,4}$")
_SUBSET_PREFIX = re.compile(r"^[A-Z]{6}\+")
_STYLE_WORDS = re.compile(
    r"(bold|italic|oblique|regular|roman|light|medium|semibold|demibold|black|heavy|book|condensed|narrow|mt|ps|psmt|std|pro)$")


def _font_family(font: str) -> str:
    """字体名 → 字族：去掉子集前缀、「-Bold」这类样式后缀和字号数字。"""
    name = _SUBSET_PREFIX.sub("", str(font or "")).strip().lower()
    name = re.split(r"[-,+_ ]", name, maxsplit=1)[0]
    previous = None
    while previous != name:
        previous = name
        name = _STYLE_WORDS.sub("", name.rstrip("0123456789")).rstrip("0123456789")
    return name or previous or ""


def _title_lines(draft: PageDraft):
    """每条的标题按行分：{条目号: {行号: [片段]}}。"""
    by_id = draft.by_id()
    found: dict[str, dict[int, list]] = {}
    for entry in draft.entries:
        for fragment_id in entry.fragments:
            fragment = by_id.get(fragment_id)
            if fragment is not None and fragment.role == "title":
                found.setdefault(entry.id, {}).setdefault(fragment.line, []).append(fragment)
    return found


def _two_columns(draft: PageDraft) -> bool:
    x0, _y0, x1, _y1 = draft.region
    width = x1 - x0
    if width <= 0:
        return False
    split = x0 + width * TWO_COLUMN_SPLIT
    lines: dict[int, list] = {}
    for fragment in draft.fragments:
        lines.setdefault(fragment.line, []).append(fragment)
    hits = 0
    for fragments in lines.values():
        fragments.sort(key=lambda item: item.bbox[0])
        for index, fragment in enumerate(fragments[:-1]):
            if fragment.bbox[2] <= split and PAGE_RE.match(fragment.text.strip()) and any(
                    other.bbox[0] >= x0 + width * 0.45 and not PAGE_RE.match(other.text.strip())
                    and other.role in ("title", "number", "label", "other") for other in fragments[index + 1:]):
                hits += 1
                break
    return hits >= TWO_COLUMN_LINES


def _page_left(draft: PageDraft) -> bool:
    lines: dict[int, list] = {}
    for fragment in draft.fragments:
        lines.setdefault(fragment.line, []).append(fragment)
    hits = 0
    for fragments in lines.values():
        fragments.sort(key=lambda item: item.bbox[0])
        if len(fragments) >= 2 and _PLAIN_NUMBER.match(fragments[0].text.strip()) and not any(
                fragment.role == "page" for fragment in fragments):
            hits += 1
    labeled = sum(1 for entry in draft.entries if draft.role_text(entry, "page"))
    return hits >= PAGE_LEFT_LINES and labeled * 2 < max(1, len(draft.entries))


def _many_fonts(draft: PageDraft) -> bool:
    counts: dict[str, int] = {}
    for fragment in draft.fragments:
        if fragment.role in ("title", "label", "author") and fragment.font:
            family = _font_family(fragment.font)
            counts[family] = counts.get(family, 0) + 1
    return sum(1 for count in counts.values() if count >= MANY_FONTS_MIN_FRAGMENTS) >= MANY_FONTS


def _author_line(draft: PageDraft) -> bool:
    if any(fragment.role == "author" for fragment in draft.fragments):
        return False
    titles = [fragment for fragment in draft.fragments if fragment.role == "title"]
    if not titles:
        return False
    italic_share = sum(1 for fragment in titles if fragment.italic) / len(titles)
    if italic_share < 0.5:
        # 大多不是斜体：整行斜体的标题行像作者行
        for lines in _title_lines(draft).values():
            for fragments in lines.values():
                if all(fragment.italic for fragment in fragments):
                    return True
    for lines in _title_lines(draft).values():
        if len(lines) < 2:
            continue
        sizes = {line: statistics.median(f.size for f in fragments) for line, fragments in lines.items()}
        if max(sizes.values()) - min(sizes.values()) >= AUTHOR_SIZE_DROP:
            return True
    return False


def _multiline_without_page(draft: PageDraft) -> bool:
    lines = _title_lines(draft)
    return any(len(lines.get(entry.id, {})) >= 2 and not draft.role_text(entry, "page") for entry in draft.entries)


def _headings_unmatched(draft: PageDraft, heading_keys: set[str] | frozenset[str]) -> bool:
    eligible = matched = 0
    for entry in draft.entries:
        title = draft.role_text(entry, "title")
        if len(title.split()) < 2:
            continue
        eligible += 1
        if title_variants(title) & heading_keys:
            matched += 1
    return eligible >= HEADINGS_MIN_ENTRIES and matched < eligible * HEADINGS_MIN_SHARE


def heading_keys_of(texts) -> frozenset[str]:
    """正文标题 → 比较键（整句，去掉章号、「Chapter 1:」「Appendix A」的都算）。正文标题不到 ``HEADINGS_MIN`` 个
    （只有目录几页的小任务、论文节选）回空：比不出什么，不亮这个信号。"""
    texts = [text for text in texts or [] if str(text or "").strip()]
    if len(texts) < HEADINGS_MIN:
        return frozenset()
    keys: set[str] = set()
    for text in texts:
        keys |= title_variants(text)
    return frozenset(keys)


def page_signals(
    draft: PageDraft,
    *,
    heading_keys: set[str] | frozenset[str] = frozenset(),
    rejected_title_keys: set[str] | frozenset[str] = frozenset(),
) -> list[str]:
    """这一页的信号（``SIGNALS`` 里的短码，按固定顺序）。空列表 = 规则有把握，不问模型。

    ``heading_keys``：正文标题的比较键（``heading_keys_of``，目录页以外的标题）；``rejected_title_keys``：上一次目录翻译
    检查退回（数字对不上）的标题的比较键。"""
    found = set()
    if not draft.accepted:
        found.add(SIGNAL_RULES_REJECTED)
    entries = draft.entries
    if len(entries) < MIN_ENTRIES:
        found.add(SIGNAL_FEW_ENTRIES)
    labeled = sum(1 for entry in entries if draft.role_text(entry, "page"))
    if entries and labeled * 2 < len(entries):
        found.add(SIGNAL_FEW_PAGE_LABELS)
    if page_descents(draft):
        found.add(SIGNAL_PAGES_NOT_MONOTONIC)
    if _two_columns(draft):
        found.add(SIGNAL_TWO_COLUMNS)
    if _page_left(draft):
        found.add(SIGNAL_PAGE_LEFT)
    if _many_fonts(draft):
        found.add(SIGNAL_MANY_FONTS)
    if _author_line(draft):
        found.add(SIGNAL_AUTHOR_LINE)
    if _multiline_without_page(draft):
        found.add(SIGNAL_MULTILINE_WITHOUT_PAGE)
    if draft.text_layer == TEXT_LAYER_INVISIBLE:
        found.add(SIGNAL_INVISIBLE_TEXT)
    if heading_keys and _headings_unmatched(draft, heading_keys):
        found.add(SIGNAL_HEADINGS_UNMATCHED)
    if rejected_title_keys and any(title_key(draft.role_text(entry, "title")) in rejected_title_keys for entry in entries):
        found.add(SIGNAL_TRANSLATION_REJECTED)
    return [signal for signal in SIGNALS if signal in found]


__all__ = [
    "SIGNALS",
    "TRANSLATION_REJECT_REASONS",
    "heading_keys_of",
    "page_signals",
]

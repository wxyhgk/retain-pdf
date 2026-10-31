from __future__ import annotations

import re

from retainpdf_math.direct_typst import has_balanced_unescaped_dollars

from .formula_gaps import DISPLAY_FORMULA_RE

TOKEN_RE = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
INLINE_MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
# 独立公式 `$$ … $$` 整个算一个记号：以前只认不跨行的 `$…$`，模型写出多行的 `$$\n…\n$$` 时切点落进公式里，
# 两块都渲染坏（2026-10-30 量子化学-14 p029-b019 以 `$$\n\` 结尾）
MATH_AWARE_TOKEN_RE = re.compile(
    rf"(<[futnvc]\d+-[0-9a-z]{{3}}/>|\[\[FORMULA_\d+]]|\s+|{DISPLAY_FORMULA_RE.pattern}|{INLINE_MATH_SPAN_RE.pattern}|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)"
)
ANY_MATH_SPAN_RE = re.compile(rf"{DISPLAY_FORMULA_RE.pattern}|{INLINE_MATH_SPAN_RE.pattern}")
# 引用角标 `$^{12}$`、`$ ^{26-28} $`：句末标点后面紧跟的角标属于前一句，切点放在角标后面
# （2026-10-30 Jensen 第 12 章 p035-b008：`。$^{55}$` 被切到下一页那块的开头）
CITATION_SPAN_RE = re.compile(r"\$\s*\^\s*\{[^{}$]*\}\s*\$")
# 夹着的公式后面那块开头的标点（模型在公式后接 "，其他分量……"）：原文的标点在公式块里，删掉
_AFTER_FORMULA_PUNCTUATION = "，。、；：,.;:"
SPLIT_PUNCTUATION = "。！？；，、,.!?;:)]}）】」』"
# 续段在句中断栏时按比例找切点：切在句末、分句标点之后，比切在两个汉字之间好读；
# 下一块不能以标点开头。奖励以 token 长度计（一个汉字 1 分），句末最多让切点挪 6 个字。
_SENTENCE_BREAK_PUNCTUATION = "。！？；.!?;"
_CLAUSE_BREAK_PUNCTUATION = "，、：,:"
_SENTENCE_BREAK_BONUS = 6.0
_CLAUSE_BREAK_BONUS = 4.0
_CLOSER_BREAK_BONUS = 2.0
_LEADING_PUNCTUATION_PENALTY = 6.0
_LEADING_PUNCTUATION = "，。、；：！？）】」』,.;:!?)]}"
# 句末判断：句号类标点后面允许跟收尾的引号 / 括号。
_SENTENCE_CLOSERS = "\"'”’)]}）】」』"
_CJK_SENTENCE_END = "。！？"
_ASCII_SENTENCE_END = ".!?"
# 成员源文以 "Background:" / "Methodology:" / "Results:" 这类小标题开头。
_SOURCE_LABEL_RE = re.compile(r"^\s*[A-Z][A-Za-z]*(?:[ -][A-Za-z]+){0,3}\s*[:：]\s")
# 译文侧对应的小标题：句首的短词 + 冒号（背景：/方法：/Results:）。
_TRANSLATION_LABEL_RE = re.compile(r"^[一-鿿A-Za-z][一-鿿A-Za-z ]{0,11}[：:]")


def math_spans(text: str) -> list[str]:
    return [match.group(0).strip() for match in INLINE_MATH_SPAN_RE.finditer(str(text or "")) if match.group(0).strip()]


def token_units(token: str) -> float:
    if not token:
        return 0.0
    if token.isspace():
        return 0.2
    if token.startswith("<") or token.startswith("[[FORMULA_"):
        return 3.0
    if re.fullmatch(r"[A-Za-z0-9_\-./]+", token):
        return max(1.0, len(token) * 0.55)
    return 1.0


def text_units(text: str) -> float:
    return sum(token_units(token) for token in TOKEN_RE.findall(str(text or "")))


def tokenize_group_translation(text: str) -> list[str]:
    return MATH_AWARE_TOKEN_RE.findall(str(text or "").strip())


def join_tokens(tokens: list[str]) -> str:
    return "".join(tokens).strip()


def _item_source(item: dict) -> str:
    return str(item.get("protected_source_text") or item.get("source_text") or "")


def source_ends_sentence(text: str) -> bool:
    stripped = str(text or "").rstrip().rstrip(_SENTENCE_CLOSERS).rstrip()
    return bool(stripped) and stripped[-1] in _CJK_SENTENCE_END + _ASCII_SENTENCE_END


def source_starts_with_label(text: str) -> bool:
    return _SOURCE_LABEL_RE.match(str(text or "")) is not None


def _is_citation(token: str) -> bool:
    return bool(token) and CITATION_SPAN_RE.fullmatch(token) is not None


def _next_visible(tokens: list[str], probe: int) -> str:
    return next((token for token in tokens[probe:] if not token.isspace()), "")


def _sentence_ends_before(tokens: list[str], probe: int) -> bool:
    """``tokens[:probe]`` 是否恰好在一句话结束处收尾。"""
    if _is_citation(_next_visible(tokens, probe)):
        return False
    index = probe - 1
    while index >= 0 and (_is_citation(tokens[index]) or (tokens[index].isspace() and index < probe - 1 and _is_citation(tokens[index + 1]))):
        index -= 1
    while index >= 0 and tokens[index] and all(char in _SENTENCE_CLOSERS for char in tokens[index]):
        index -= 1
    if index < 0:
        return False
    token = tokens[index]
    if token.endswith(tuple(_CJK_SENTENCE_END)):
        return True
    if not token.endswith(tuple(_ASCII_SENTENCE_END)):
        return False
    # 英文句号只在后面是空白或文本结尾时才算句末（排除 58.1、e.g 之类的词内点号）。
    return probe >= len(tokens) or tokens[probe].isspace()


def _label_starts_at(tokens: list[str], probe: int) -> bool:
    head = "".join(tokens[probe : probe + 16]).lstrip()
    return _TRANSLATION_LABEL_RE.match(head) is not None


def _sentence_boundary_probe(
    tokens: list[str],
    prefix_costs: list[float],
    *,
    cursor: int,
    max_probe: int,
    target_cost: float,
    next_starts_with_label: bool,
) -> int | None:
    """前一个成员源文以句末标点收尾时，只在译文的句末处切。

    下一个成员源文以小标题开头（Background:/Methodology:/Results:/Conclusion:）
    时，优先选译文里紧跟着小标题（背景：/方法：/结果：/结论：）的那个句末。
    候选里取累计长度最接近源文比例的一个；一个句末都没有就返回 None，交回比例切分。
    """
    candidates = [probe for probe in range(cursor + 1, max_probe + 1) if _sentence_ends_before(tokens, probe)]
    if not candidates:
        return None
    if next_starts_with_label:
        labeled = [probe for probe in candidates if _label_starts_at(tokens, probe)]
        if labeled:
            candidates = labeled
    return min(candidates, key=lambda probe: abs(prefix_costs[probe] - target_cost))


def _direct_typst(items: list[dict]) -> bool:
    return any(str(item.get("math_mode", "") or "").strip() == "direct_typst" for item in items)


def _break_score_adjustment(tokens: list[str], probe: int) -> float:
    """切在 ``tokens[:probe]`` 之后的加减分：负数更好。"""
    adjustment = 0.0
    index = probe - 1
    while 0 <= index < len(tokens) and (_is_citation(tokens[index]) or (tokens[index].isspace() and index > 0 and _is_citation(tokens[index - 1]))):
        index -= 1  # 句末标点后面的角标跟着前一句：越过角标看前面的标点
    prev = tokens[index].rstrip() if 0 <= index < len(tokens) else ""
    if prev.endswith(tuple(_SENTENCE_BREAK_PUNCTUATION)):
        adjustment -= _SENTENCE_BREAK_BONUS
    elif prev.endswith(tuple(_CLAUSE_BREAK_PUNCTUATION)):
        adjustment -= _CLAUSE_BREAK_BONUS
    elif prev.endswith(SPLIT_PUNCTUATION):
        adjustment -= _CLOSER_BREAK_BONUS
    following = _next_visible(tokens, probe)
    if (following[:1] and following[:1] in _LEADING_PUNCTUATION) or _is_citation(following):
        adjustment += _LEADING_PUNCTUATION_PENALTY
    return adjustment


def _formula_key(text: str) -> str:
    return re.sub(r"\s+", "", str(text or "").strip().strip("$"))


def _gap_formula_spans(text: str, gaps: list[str]) -> list[tuple[int, int]] | None:
    """译文里夹着的那几处公式的位置（按顺序，一处几个公式的取整段）；对不上返回 None。

    先按内容找（空白不算，`$$` 写成 `$` 也认）；内容被改过但独立公式的个数正好对得上，就按位置认。"""
    spans: list[tuple[int, int]] = []
    pos = 0
    for gap in gaps:
        found: tuple[int, int] | None = None
        for key in (_formula_key(f) for f in DISPLAY_FORMULA_RE.findall(gap) or [gap]):
            match = next((m for m in ANY_MATH_SPAN_RE.finditer(text, pos) if _formula_key(m.group(0)) == key), None)
            if match is None:
                found = None
                break
            found = (found[0] if found else match.start(), match.end())
            pos = match.end()
        if found is None:
            break
        spans.append(found)
    if len(spans) == len(gaps):
        return spans
    displays = [m.span() for m in DISPLAY_FORMULA_RE.finditer(text)]
    if len(displays) == len(gaps):
        return displays
    return None


def _split_at_gap_formulas(protected_text: str, items: list[dict]) -> list[str] | None:
    """组里两块之间夹着独立公式（`formula_gaps`，拼组时公式原文放进了整段）：在译文的这个公式处切开、公式删掉，
    公式之间的那一段再按比例切给其中的几块。没有夹公式返回 None；译文里认不出那几个公式，删掉独立公式后按比例切。"""
    gaps = [str(item.get("translation_unit_formula_before") or "").strip() for item in items]
    cut_at = [index for index in range(1, len(items)) if gaps[index]]
    if not cut_at or not _direct_typst(items):
        return None
    text = str(protected_text or "")
    spans = _gap_formula_spans(text, [gaps[index] for index in cut_at])
    if spans is None:
        return _split_by_ratio(re.sub(rf"\s*(?:{DISPLAY_FORMULA_RE.pattern})\s*", " ", text).strip(), items)
    pieces: list[str] = []
    start = 0
    for span_start, span_end in spans:
        pieces.append(text[start:span_start])
        start = span_end
    pieces.append(text[start:])
    bounds = [0, *cut_at, len(items)]
    chunks: list[str] = []
    for index, piece in enumerate(pieces):
        piece = piece.strip()
        if index > 0:
            piece = piece.lstrip(_AFTER_FORMULA_PUNCTUATION + " ").strip()
        chunks.extend(_split_by_ratio(piece, items[bounds[index] : bounds[index + 1]]))
    return chunks


def _inline_unrequested_display(protected_text: str, items: list[dict]) -> str:
    """原文各块都没有 `$$`、译文却写成独立公式的，改回行内 `$…$`：正文框里排不下单独一行的公式，
    多半还是模型把行内公式写成了独立公式。"""
    text = str(protected_text or "")
    if not _direct_typst(items) or "$$" not in text or any("$$" in _item_source(item) for item in items):
        return text
    return DISPLAY_FORMULA_RE.sub(lambda m: f"${m.group(0)[2:-2].strip()}$", text)


def split_group_protected_translation(protected_text: str, items: list[dict]) -> list[str]:
    if len(items) <= 1:
        return [str(protected_text or "").strip()]
    at_formulas = _split_at_gap_formulas(protected_text, items)
    if at_formulas is not None:
        return at_formulas
    return _split_by_ratio(_inline_unrequested_display(protected_text, items), items)


def _split_by_ratio(protected_text: str, items: list[dict]) -> list[str]:
    if len(items) <= 1:
        return [str(protected_text or "").strip()]
    if _direct_typst(items) and not has_balanced_unescaped_dollars(str(protected_text or "")):
        # 公式以 `$…$` 原样写在译文里；`$` 不成对时认不出公式边界，任何切点都可能把一个
        # 公式切成两半，两边都渲染坏。整段放进第一个框（内容和公式完整，大不了挤一点），
        # 其余框留空。占位符模式的公式是 <f1-abc/>，那里的 `$` 只是普通字符。
        return [str(protected_text or "").strip()] + [""] * (len(items) - 1)
    tokens = tokenize_group_translation(protected_text)
    if not tokens:
        return [""] * len(items)

    token_costs = [token_units(token) for token in tokens]
    total_cost = sum(token_costs)
    if total_cost <= 0:
        return [join_tokens(tokens)] + [""] * (len(items) - 1)

    source_weights = [max(1.0, text_units(_item_source(item))) for item in items]
    total_source_weight = max(1.0, sum(source_weights))
    prefix_costs = [0.0]
    for cost in token_costs:
        prefix_costs.append(prefix_costs[-1] + cost)

    chunks: list[str] = []
    cursor = 0
    cumulative_target_cost = 0.0
    source_seen = 0.0
    for index, weight in enumerate(source_weights[:-1]):
        source_seen += weight
        target_cost = total_cost * source_seen / total_source_weight
        max_probe = len(tokens) - (len(source_weights) - index - 1)
        if source_ends_sentence(_item_source(items[index])):
            sentence_probe = _sentence_boundary_probe(
                tokens,
                prefix_costs,
                cursor=cursor,
                max_probe=max_probe,
                target_cost=target_cost,
                next_starts_with_label=source_starts_with_label(_item_source(items[index + 1])),
            )
            if sentence_probe is not None:
                chunks.append(join_tokens(tokens[cursor:sentence_probe]))
                cumulative_target_cost = prefix_costs[sentence_probe]
                cursor = sentence_probe
                continue

        # 源文停在半句（续段）或译文里找不到句末：按源文长度比例在锚点附近找切点。
        cumulative = cumulative_target_cost
        anchor = cursor + 1
        while anchor < len(tokens) - (len(source_weights) - index - 1) and cumulative < target_cost:
            cumulative += token_costs[anchor - 1]
            anchor += 1

        left = max(cursor + 1, anchor - 36)
        right = min(len(tokens) - (len(source_weights) - index - 1), anchor + 36)
        best = anchor
        best_score = None
        for probe in range(left, right + 1):
            if probe <= cursor:
                continue
            probe_cost = cumulative_target_cost + sum(token_costs[cursor:probe])
            score = abs(probe_cost - target_cost) + _break_score_adjustment(tokens, probe)
            if best_score is None or score < best_score:
                best = probe
                best_score = score

        chunks.append(join_tokens(tokens[cursor:best]))
        cumulative_target_cost += sum(token_costs[cursor:best])
        cursor = best

    chunks.append(join_tokens(tokens[cursor:]))
    while len(chunks) < len(items):
        chunks.append("")
    return chunks[: len(items)]


__all__ = [
    "INLINE_MATH_SPAN_RE",
    "math_spans",
    "split_group_protected_translation",
    "text_units",
    "token_units",
]

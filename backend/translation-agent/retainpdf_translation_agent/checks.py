"""逐块校验 agent 交回的译文。error 的块会单独重翻一次；warn 只记下来给人看。"""

from __future__ import annotations

import re
from collections import Counter

FORMULA_RE = re.compile(r"\$[^$]+\$")
CITATION_RE = re.compile(r"\[\d+(?:\s*[,–-]\s*\d+)*\]")
FN_RE = re.compile(r"\{\{fn:[^}]+\}\}")
NUMBER_RE = re.compile(r"(?<![\w.])\d+(?:\.\d+)*(?![\w])")
LATIN_WORD_RE = re.compile(r"[A-Za-z]{3,}")
CJK_RE = re.compile(r"[一-鿿]")
# 原文里的小数字，译文写成中文数字也算保留（"level-2 heading" → "二级标题"）
CN_DIGITS = {"1": "一", "2": "二两", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九", "10": "十"}
SHORT_SOURCE = 40  # 原文不到这么多字符（去掉公式等）不查"太短"：短标题翻成中文本来就短
OVERLAP_CHARS = 10  # 接续组里相邻两块的译文有这么多个连续相同的汉字，算重复


def visible_length(text: str) -> int:
    """排出来大约占多少个字：脚注标记 `{{fn:1}}` 是一个上标字，公式按源码长度的一半估。"""
    text = FN_RE.sub("¹", text)
    return len(FORMULA_RE.sub(lambda m: "x" * max(1, (len(m.group(0)) - 2) // 2), text))


def _strip_protected(text: str) -> str:
    return FN_RE.sub(" ", CITATION_RE.sub(" ", FORMULA_RE.sub(" ", text)))


def _issue(code: str, severity: str, message: str) -> dict:
    return {"code": code, "severity": severity, "message": message}


def check_block(source: str, translation: str | None) -> list[dict]:
    if translation is None:
        return [_issue("missing", "error", "agent 没有交回这一块")]
    if not translation.strip():
        return [_issue("empty", "error", "译文是空的")]
    issues: list[dict] = []
    src_formulas = Counter(f.strip() for f in FORMULA_RE.findall(source))
    out_formulas = Counter(f.strip() for f in FORMULA_RE.findall(translation))
    if translation.count("$") % 2:
        issues.append(_issue("formula_unbalanced", "error", "`$` 不成对"))
    if src_formulas != out_formulas:
        lost = sorted((src_formulas - out_formulas).elements())
        added = sorted((out_formulas - src_formulas).elements())
        issues.append(_issue("formula_changed", "error", f"公式和原文不一致：丢了 {lost}，多了 {added}"))
    for name, pattern in (("citation", CITATION_RE), ("footnote_mark", FN_RE)):
        lost = Counter(pattern.findall(source)) - Counter(pattern.findall(translation))
        if lost:
            label = "引用标记" if name == "citation" else "脚注标记"
            issues.append(_issue(f"{name}_lost", "error", f"{label}丢了：{sorted(lost.elements())}"))
    src_numbers = Counter(NUMBER_RE.findall(_strip_protected(source)))
    out_numbers = Counter(NUMBER_RE.findall(_strip_protected(translation)))
    lost_numbers = Counter(
        {n: c for n, c in (src_numbers - out_numbers).items() if not any(ch in _strip_protected(translation) for ch in CN_DIGITS.get(n, ""))}
    )
    if lost_numbers:
        issues.append(_issue("number_lost", "warn", f"数字可能丢了：{sorted(lost_numbers.elements())}"))
    plain_source = _strip_protected(source)
    plain_out = _strip_protected(translation)
    if not CJK_RE.search(plain_source):
        if translation.strip() == source.strip() and LATIN_WORD_RE.search(plain_source):
            issues.append(_issue("untranslated", "error", "译文和原文一模一样"))
        elif not CJK_RE.search(plain_out) and len(LATIN_WORD_RE.findall(plain_source)) >= 3:
            issues.append(_issue("no_chinese", "error", "译文里没有中文"))
        else:
            residue = [w for w in LATIN_WORD_RE.findall(plain_out) if w.lower() not in {"ocr", "pdf", "html", "iou", "doi", "arxiv"}]
            if len(residue) >= 6:
                issues.append(_issue("english_residue", "warn", f"译文里还有不少英文词：{residue[:6]}…"))
    ratio = len(plain_out.strip()) / max(1, len(plain_source.strip()))
    if ratio < 0.15 and len(plain_source.strip()) >= SHORT_SOURCE:
        issues.append(_issue("too_short", "error", f"译文只有原文的 {ratio:.0%}，可能截断"))
    elif ratio > 1.6:
        issues.append(_issue("too_long", "warn", f"译文是原文的 {ratio:.0%}"))
    return issues


def _longest_common(a: str, b: str) -> str:
    """两段文字最长的相同片段（动态规划，段落长度在几百字以内）。"""
    best, best_end = 0, 0
    previous = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        current = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                current[j] = previous[j - 1] + 1
                if current[j] > best:
                    best, best_end = current[j], i
        previous = current
    return a[best_end - best : best_end]


def check_group(members: list[tuple[str, str, str | None]]) -> dict[str, list[dict]]:
    """接续组（按顺序的 [(id, 原文, 译文)]）：相邻两块的译文不能重复，各块译文的占比要和原文占比相当。"""
    issues: dict[str, list[dict]] = {block_id: [] for block_id, _, _ in members}
    if len(members) < 2 or any(t is None for _, _, t in members):
        return issues
    for (a_id, _, a_text), (b_id, _, b_text) in zip(members, members[1:]):
        # 只比汉字：两块里都出现的英文专名、公式不算重复
        common = _longest_common("".join(CJK_RE.findall(a_text)), "".join(CJK_RE.findall(b_text)))
        if len(common) >= OVERLAP_CHARS:
            message = f"和接续组里相邻的块译文重复：“{common[:24]}…”"
            issues[a_id].append(_issue("group_overlap", "error", message))
            issues[b_id].append(_issue("group_overlap", "error", message))
    src_total = sum(len(s) for _, s, _ in members) or 1
    out_total = sum(len(t) for _, _, t in members) or 1
    for block_id, source, translation in members:
        src_share, out_share = len(source) / src_total, len(translation) / out_total
        if abs(src_share - out_share) > 0.2:
            issues[block_id].append(
                _issue("group_share", "warn", f"这块原文占全组 {src_share:.0%}，译文却占 {out_share:.0%}，断点可能挪了")
            )
    return issues


def status_of(issues: list[dict]) -> str:
    if any(i["severity"] == "error" for i in issues):
        return "error"
    if issues:
        return "warn"
    return "ok"

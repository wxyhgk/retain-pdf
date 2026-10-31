"""逐块校验 agent 交回的译文。error 的块会单独重翻一次；warn 只记下来给人看；info 只用来算指标。"""

from __future__ import annotations

import re
from collections import Counter

from retainpdf_translation_agent.memory import find_terms

FORMULA_RE = re.compile(r"\$[^$]+\$")
CITATION_RE = re.compile(r"\[\d+(?:\s*[,–-]\s*\d+)*\]")
FN_RE = re.compile(r"\{\{fn:[^}]+\}\}")
CODE_RE = re.compile(r"`[^`\n]+`")
# 中文中间紧贴着的小写英文词（"实际上those崩溃"）：模型漏翻的残片
STRAY_EN_RE = re.compile(r"(?<=[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])([a-z]{2,})(?=[\u4e00-\u9fff])")
QUOTED_RE = re.compile(r"《[^》]*》|“[^”]*”|「[^」]*」|（[^）]*）|\([^)]*\)")
# 只拿 ASCII 字母数字当边界：中文紧挨着数字（"图1.1""第4章"）照样认得
NUMBER_RE = re.compile(r"(?<![A-Za-z0-9_.])\d+(?:\.\d+)*(?![A-Za-z0-9_])")
LATIN_WORD_RE = re.compile(r"[A-Za-z]{3,}")
CJK_RE = re.compile(r"[一-鿿]")
# 中文译文里不该凭空出现的文字：西里尔、韩文、日文假名、阿拉伯、希伯来、泰文……原文里有的不算。
# 希腊字母不算：理工文献里 "alpha helix" 译成 "α 螺旋" 是正常写法。
# 论文实跑碰到过 "…优化 должна 大致平行于…"（模型冒出一个俄文词），之前的检查都没拦住。
FOREIGN_SCRIPT_RE = re.compile(r"[\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f\u3040-\u30ff\uac00-\ud7af]+")
# 原文里的小数字，译文写成中文数字也算保留（"level-2 heading" → "二级标题"）
CN_DIGITS = {"1": "一", "2": "二两", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九", "10": "十"}
SHORT_SOURCE = 40  # 原文不到这么多字符（去掉公式等）不查"太短"：短标题翻成中文本来就短
OVERLAP_CHARS = 10  # 接续组里相邻两块的译文有这么多个连续相同的汉字，算重复
# 相邻两块的原文本身就有这么多个连续相同的词：原文就重复了一段话，译文跟着重复是对的，不算重复
SOURCE_OVERLAP_WORDS = 6
# 接续组里一块译文占全组的比例和原文占比差这么多（只算正文），而且字数也差这么多，记 group_share 警告。
# 程序按比例切开以后一般不会；切点附近没有能切的地方（长公式）、只好偏开时才会
SHARE_TOLERANCE = 0.2
SHARE_DRIFT_MIN_CHARS = 12
# 检查规则的版本：判对判错的规则改了就升，正式流程据此不再沿用旧的进度和断点（请求缓存照用）。
# 1：2026-10-30 原文本来就重复的话不算接续组重复；接续组一块"太短"而整组不短只记警告
# 2：2026-10-30 接续组模型放的断点和原文比例差太远，程序按比例重切
# 3：2026-10-30 接续组不再让模型放断点，一律由程序按正文比例切开（不落在公式里）；没交的块重翻后还不合格再翻一次
# 4：2026-10-31 不再拿公式和原文逐个比（formula_changed、formula_merged 去掉），只查 `$` 成对
CHECKS_VERSION = "translation-agent-checks-4"


def visible_length(text: str) -> int:
    """排出来大约占多少个字：脚注标记 `{{fn:1}}` 是一个上标字，公式按源码长度的一半估。"""
    text = FN_RE.sub("¹", text)
    return len(FORMULA_RE.sub(lambda m: "x" * max(1, (len(m.group(0)) - 2) // 2), text))


def _formula_key(formula: str) -> str:
    """公式比较用的写法：去掉 `$` 和全部空白。"""
    return re.sub(r"\s+", "", formula.strip()[1:-1])


def restore_formulas(source: str, translation: str | None) -> tuple[str | None, list[str]]:
    """模型把原文公式改了一点点（多半是顺手"修"了 OCR 认错的符号，如 "S'_{rs}'" → "S'_{rs}"）：换回原文的写法。

    只换"原文有、译文没有"和"译文有、原文没有"里相似度 ≥ 0.85 的一对，一对一。返回（新译文，换回了哪些原文公式）。
    公式改成别的意思（相似度低）的不动（公式不再判对错，见 check_block）。
    """
    if not translation:
        return translation, []
    from difflib import SequenceMatcher

    src = [f for f in FORMULA_RE.findall(CODE_RE.sub(" ", source))]
    out = [f for f in FORMULA_RE.findall(CODE_RE.sub(" ", translation))]
    src_keys = Counter(_formula_key(f) for f in src)
    out_keys = Counter(_formula_key(f) for f in out)
    lost = [f for f in src if (src_keys - out_keys)[_formula_key(f)] > 0]
    added = [f for f in out if (out_keys - src_keys)[_formula_key(f)] > 0]
    restored: list[str] = []
    for formula in added:
        key = _formula_key(formula)
        best = max(lost, key=lambda f: SequenceMatcher(None, key, _formula_key(f)).ratio(), default=None)
        if best is not None and SequenceMatcher(None, key, _formula_key(best)).ratio() >= 0.85:
            translation = translation.replace(formula, best, 1)
            lost.remove(best)
            restored.append(best)
    return translation, restored


def _strip_protected(text: str) -> str:
    return FN_RE.sub(" ", CITATION_RE.sub(" ", FORMULA_RE.sub(" ", CODE_RE.sub(" ", text))))


def prose_length(text: str) -> int:
    """正文有多长：去掉公式、脚注和引用标记、行内代码，空白压成一个。接续组算各块占比用它——公式在原文和译文里一样长，
    中文正文却比英文短，按总字数算，带长公式的那块占比会被抬得很高（2026-10-30 论文第 5 页因此被误判断点放错）。"""
    return len(" ".join(_strip_protected(text or "").split()))


def _issue(code: str, severity: str, message: str) -> dict:
    return {"code": code, "severity": severity, "message": message}


def check_block(source: str, translation: str | None) -> list[dict]:
    if translation is None:
        return [_issue("missing", "error", "agent 没有交回这一块")]
    if not translation.strip():
        return [_issue("empty", "error", "译文是空的")]
    issues: list[dict] = []
    # 公式不和原文逐个比（2026-10-31 用户定）：模型把 "$n_{L}^{max}$" 写成 "n_L^max"、数字挪进公式，以前判错、重翻两次还不合格就退回原文，
    # 整段英文比公式写得不像糟得多。只查 `$` 成对——不成对的话后面整段都会被当成公式排。模型顺手改了一点点的公式照旧换回原文写法（restore_formulas）
    src_formulas = Counter(_formula_key(f) for f in FORMULA_RE.findall(CODE_RE.sub(" ", source)))
    if CODE_RE.sub(" ", translation).count("$") % 2:
        issues.append(_issue("formula_unbalanced", "error", "`$` 不成对"))
    lost_code = Counter(CODE_RE.findall(source)) - Counter(CODE_RE.findall(translation))
    if lost_code:
        issues.append(_issue("code_changed", "error", f"行内代码要原样保留：{sorted(lost_code.elements())}"))
    for name, pattern in (("citation", CITATION_RE), ("footnote_mark", FN_RE)):
        lost = Counter(pattern.findall(source)) - Counter(pattern.findall(translation))
        if lost:
            label = "引用标记" if name == "citation" else "脚注标记"
            issues.append(_issue(f"{name}_lost", "error", f"{label}丢了：{sorted(lost.elements())}"))
    src_numbers = Counter(NUMBER_RE.findall(_strip_protected(source)))
    # 原文正文里的数字被译文套进了公式（"n/2" → "$n/2$"）：数数字时这种公式按普通文字算
    unwrapped = FORMULA_RE.sub(lambda m: m.group(0)[1:-1] if _formula_key(m.group(0)) not in src_formulas else m.group(0), translation)
    out_numbers = Counter(NUMBER_RE.findall(_strip_protected(unwrapped)))
    lost_numbers = Counter(
        {n: c for n, c in (src_numbers - out_numbers).items() if not any(ch in _strip_protected(translation) for ch in CN_DIGITS.get(n, ""))}
    )
    if lost_numbers:
        issues.append(_issue("number_lost", "warn", f"数字可能丢了：{sorted(lost_numbers.elements())}"))
    plain_source = _strip_protected(source)
    plain_out = _strip_protected(translation)
    foreign = sorted({w for w in FOREIGN_SCRIPT_RE.findall(plain_out) if w not in plain_source})
    if foreign:
        issues.append(_issue("foreign_script", "error", f"译文里冒出原文没有的外文：{foreign[:5]}"))
    stray = STRAY_EN_RE.findall(QUOTED_RE.sub(" ", plain_out))
    if stray and CJK_RE.search(plain_out):
        issues.append(_issue("stray_english", "error", f"中文句子里夹着英文词：{stray[:5]}"))
    if not CJK_RE.search(plain_source):
        if translation.strip() == source.strip() and LATIN_WORD_RE.search(plain_source):
            issues.append(_issue("untranslated", "error", "译文和原文一模一样"))
        elif not CJK_RE.search(plain_out) and len(LATIN_WORD_RE.findall(plain_source)) >= 3:
            issues.append(_issue("no_chinese", "error", "译文里没有中文"))
        else:
            # 书名号、引号、括号里的（保留原文的书名、外文引语）和大写开头的专名不算残留
            quoted = QUOTED_RE.sub(" ", plain_out)
            residue = [w for w in LATIN_WORD_RE.findall(quoted) if w.islower() and w not in {"ocr", "pdf", "html", "iou", "doi", "arxiv"}]
            if len(residue) >= 6:
                issues.append(_issue("english_residue", "warn", f"译文里还有不少英文词：{residue[:6]}…"))
    ratio = len(plain_out.strip()) / max(1, len(plain_source.strip()))
    if ratio < 0.15 and len(plain_source.strip()) >= SHORT_SOURCE:
        issues.append(_issue("too_short", "error", f"译文只有原文的 {ratio:.0%}，可能截断"))
    elif ratio > 1.6:
        issues.append(_issue("too_long", "warn", f"译文是原文的 {ratio:.0%}"))
    return issues


def _longest_common(a, b):
    """两段文字（或两串词）最长的相同片段（动态规划，段落长度在几百字以内）。"""
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
    for (a_id, a_source, a_text), (b_id, b_source, b_text) in zip(members, members[1:]):
        # 只比汉字：两块里都出现的英文专名、公式不算重复
        common = _longest_common("".join(CJK_RE.findall(a_text)), "".join(CJK_RE.findall(b_text)))
        # 2026-10-30 论文第 11 页：两块原文里有同一句十来个词的话，译文跟着重复，以前判成重复、重翻还是"重复"，
        # 整组退回原文没翻
        source_common = _longest_common(LATIN_WORD_RE.findall(a_source.lower()), LATIN_WORD_RE.findall(b_source.lower()))
        if len(common) >= OVERLAP_CHARS and len(source_common) < SOURCE_OVERLAP_WORDS:
            message = f"和接续组里相邻的块译文重复：“{common[:24]}…”"
            issues[a_id].append(_issue("group_overlap", "error", message))
            issues[b_id].append(_issue("group_overlap", "error", message))
    src_total = sum(prose_length(s) for _, s, _ in members) or 1
    out_total = sum(prose_length(t) for _, _, t in members) or 1
    for block_id, source, translation in members:
        src_share, out_share = prose_length(source) / src_total, prose_length(translation) / out_total
        if abs(src_share - out_share) > SHARE_TOLERANCE and abs(prose_length(translation) - src_share * out_total) >= SHARE_DRIFT_MIN_CHARS:
            issues[block_id].append(
                _issue("group_share", "warn", f"这块原文占全组 {src_share:.0%}，译文却占 {out_share:.0%}，断点可能挪了")
            )
    return issues


def check_terms(source: str, translation: str | None, terms: list[dict], exceptions: set[str] | None = None) -> list[dict]:
    """上下文包里的术语（`context.context_terms` 给的，带 category、status）：审定、锁定的术语要用定好的译法，
    保留原文的专名原样出现，缩写本身保留；候选不查。先在全部条目里按最长匹配找，所以 "access token"（候选）
    盖住的 "token"（审定）不会被查。

    `exceptions` 是译者在这一块声明"意思不同、没照用"的原文词（小写），不算错，由调用方记歧义单。
    """
    if not translation:
        return []
    exceptions = exceptions or set()
    issues: list[dict] = []
    plain_source = _strip_protected(source)
    for term in find_terms(plain_source, terms):
        if term["source"].lower() in exceptions or term.get("status") not in ("approved", "locked"):
            continue
        if term["category"] == "keep" and term["source"] not in translation:
            issues.append(_issue("keep_original_lost", "error", f"“{term['source']}”要原样保留，不要翻译"))
        elif term["category"] == "abbr" and term["source"] not in translation:
            issues.append(_issue("abbr_lost", "warn", f"缩写“{term['source']}”在译文里没有了"))
        elif term["category"] == "name" and term["target"] not in translation:
            issues.append(_issue("name_mismatch", "error", f"人名“{term['source']}”统一译作“{term['target']}”（术语表 {term['id']}）"))
        elif term["category"] == "term" and term["target"] not in translation:
            # 只记警告不重翻：实测重翻代价大，而且定错的译法会被逼着照抄；交给一致性检查和审校
            issues.append(
                _issue(
                    "term_mismatch",
                    "warn",
                    f"术语“{term['source']}”应译作“{term['target']}”（术语表 {term['id']}）；这里意思确实不同的话，在 term_exceptions 里声明并写理由",
                )
            )
    return issues


# 表示保留的词：原文有，译文里就该有"可能""或许"之类（只记提示，算指标用，不影响状态）
HEDGE_RE = re.compile(r"\b(may|might|perhaps|possibly|likely|unlikely|suggests?|suggested|appears? to|appeared to|seems?|seemed|presumably|arguably)\b", re.IGNORECASE)
HEDGE_ZH = ("可能", "或许", "也许", "似乎", "看来", "看起来", "大概", "大约", "未必", "不一定", "表明", "暗示", "提示", "说明", "推测", "显得", "好像", "恐怕", "估计", "或可", "有望", "应该", "大致", "倾向")
WE_RE = re.compile(r"\b(we|our|us)\b", re.IGNORECASE)
WE_ZH = ("我们", "本文", "本书", "本章", "笔者", "作者", "本研究", "咱们")


def style_signals(source: str, translation: str | None) -> list[dict]:
    """作者语气有没有保住：表示保留的词、人称。只出 info，用来算语气词保留率、人称保留率。"""
    if not translation:
        return []
    plain = _strip_protected(source)
    issues: list[dict] = []
    hedges = sorted({m.group(1).lower() for m in HEDGE_RE.finditer(plain)})
    if hedges and not any(word in translation for word in HEDGE_ZH):
        issues.append(_issue("hedge_lost", "info", f"原文有表示保留的词 {hedges}，译文里没找到“可能、或许、表明”之类"))
    if WE_RE.search(plain) and not any(word in translation for word in WE_ZH):
        issues.append(_issue("person_lost", "info", "原文用第一人称（we/our），译文里没有“我们”"))
    return issues


def status_of(issues: list[dict]) -> str:
    """error 优先，其次 warn；info 只是记一笔，不影响状态。"""
    if any(i["severity"] == "error" for i in issues):
        return "error"
    if any(i["severity"] == "warn" for i in issues):
        return "warn"
    return "ok"

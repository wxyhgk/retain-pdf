"""逐块校验 agent 交回的译文。error 的块会单独重翻一次；warn 只记下来给人看；info 只用来算指标。"""

from __future__ import annotations

import re
from collections import Counter

from retainpdf_translation_agent.memory import find_terms

# 独立公式 `$$ … $$`（接续组夹着的）整个算一个。`\$` 是字面的美元符（货币，见 CURRENCY_RE），不算公式边界
FORMULA_RE = re.compile(r"(?<!\\)\$\$[^$]+\$\$|(?<!\\)\$[^$]+(?<!\\)\$")
# 货币的美元符：`$` 紧跟数字（不隔空格），数字后面不是公式的东西（`$`、上下标、运算符）。OCR 的公式写成 "$ … $"（带空格），
# 价格写成 "$12.59"。11-20《The Interloper》"$12.59 to $17" 被当成一个公式换成占位，中间的 to 没翻。
# 这种 `$` 交给模型前写成 `\$`（排版认它是字面美元符），模型交回时漏了反斜杠的也补上。
CURRENCY_RE = re.compile(r"(?<![\\$])\$(?=\d(?:[\d,]*\d)?(?:\.\d+)?(?!\d)(?![,.]?\d)(?!\s*[=+*<>^_{}|\\$])(?![\^_{}\\$]))")
# 只有引注的注释（"35. Keenan 2013, xxiv."、"Ibid., 45."、"See Smith and Jones 2019; Lee 2020, 12–14."）：原样保留就对
_CITE_PAGES = r"(?:\s*,\s*(?:pp?\.\s*)?[\divxlc]+(?:\s*[–-]\s*[\divxlc]+)?(?:n\d+)?)*"
_CITE_PART = (
    r"(?:(?i:see\s+(?:also\s+)?|cf\.\s+))?"
    # 作者：一个；两个（A and B）；三个以上（A, B, and C）；或 et al.
    r"(?:[A-Z][\w'’.-]+(?:(?:\s*,\s*[A-Z][\w'’.-]+)*,?\s+(?:and|&)\s+[A-Z][\w'’.-]+|\s+et\s+al\.)?\s+(?:\d{4}[a-z]?|n\.d\.)" + _CITE_PAGES
    + r"|(?i:ibid)\.?" + _CITE_PAGES + r")"
)
CITATION_ONLY_RE = re.compile(r"^\s*(?:\d{1,4}\.?\s+)?" + _CITE_PART + r"(?:\s*;\s*" + _CITE_PART + r")*\s*\.?\s*$")
CITATION_RE = re.compile(r"\[\d+(?:\s*[,–-]\s*\d+)*\]")
FN_RE = re.compile(r"\{\{fn:[^}]+\}\}")
CODE_RE = re.compile(r"`[^`\n]+`")
# 中文中间紧贴着的小写英文词（"实际上those崩溃"）：模型漏翻的残片
STRAY_EN_RE = re.compile(r"(?<=[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])([a-z]{2,})(?=[\u4e00-\u9fff])")
QUOTED_RE = re.compile(r"《[^》]*》|“[^”]*”|「[^」]*」|（[^）]*）|\([^)]*\)")
# 只拿 ASCII 字母数字当边界：中文紧挨着数字（"图1.1""第4章"）照样认得
NUMBER_RE = re.compile(r"(?<![A-Za-z0-9_.])\d+(?:\.\d+)*(?![A-Za-z0-9_])")
LATIN_WORD_RE = re.compile(r"[A-Za-z]{3,}")
# 要翻的英文词：小写或首字母大写、三个字母以上。原文一个都没有（样品名 "BMS@C-M1 EV"、缩写、网址）就没什么可翻，原样交回不算没翻
PROSE_WORD_RE = re.compile(r"\b[A-Za-z][a-z]{2,}\b")
URL_RE = re.compile(r"(?:https?://|www\.)\S+|\S+@\S+\.\w+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|edu|net|gov|io|info|ac|uk|cn|de|fr|jp)\b(?:/\S*)?")
CJK_RE = re.compile(r"[一-鿿]")
# 中文译文里不该凭空出现的文字：西里尔、韩文、日文假名、阿拉伯、希伯来、泰文……原文里有的不算。
# 希腊字母不算：理工文献里 "alpha helix" 译成 "α 螺旋" 是正常写法。
# 论文实跑碰到过 "…优化 должна 大致平行于…"（模型冒出一个俄文词），之前的检查都没拦住。
FOREIGN_SCRIPT_RE = re.compile(r"[\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f\u3040-\u30ff\uac00-\ud7af]+")
# 原文里的小数字，译文写成中文数字也算保留（"level-2 heading" → "二级标题"）
CN_DIGITS = {"1": "一", "2": "二两", "3": "三", "4": "四", "5": "五", "6": "六", "7": "七", "8": "八", "9": "九", "10": "十"}
SHORT_SOURCE = 40  # 原文不到这么多字符（去掉公式等）不查"太短"：短标题翻成中文本来就短
# 检查规则的版本：判对判错的规则改了就升，正式流程据此不再沿用旧的进度和断点（请求缓存照用）。
# 1：2026-10-30 原文本来就重复的话不算接续组重复；接续组一块"太短"而整组不短只记警告
# 2：2026-10-30 接续组模型放的断点和原文比例差太远，程序按比例重切
# 3：2026-10-30 接续组不再让模型放断点，一律由程序按正文比例切开（不落在公式里）；没交的块重翻后还不合格再翻一次
# 4：2026-10-31 不再拿公式和原文逐个比（formula_changed、formula_merged 去掉），只查 `$` 成对
# 5：2026-10-31 接续组当一块校验、重翻、退回原文（units.py），切开以后不再逐块查：group_overlap、group_share、mark_moved 去掉
# 6：2026-10-31 原文没有要翻的英文词（样品名、缩写、网址）时原样交回不算 untranslated / no_chinese
# 7：2026-10-31 独立公式 `$$ … $$`（接续组夹着的）整个算一个公式
# 8：2026-11-18 不带 http、www 的域名（press.princeton.edu）也算网址；审校改法和前后文重叠时去掉重叠，替换后多出重复就不改
#    （review.py；升版本是为了让已经跑了一半的任务重来一遍、按新规矩重做审校替换，请求缓存照用）
# 9：2026-11-20 货币的 `$12.59` 不算公式（写成 `\$`）；只有引注的注释（"Keenan 2013, xxiv."）原样交回不算 untranslated；
#    译文里成对的直引号换成中文引号（normalize_translation）
# 10：2026-11-20 三个以上作者的引注（"Petriglieri, Ashford, and Wrzesniewski 2019."）也算只有引注
CHECKS_VERSION = "translation-agent-checks-10"


def escape_currency(text: str) -> str:
    """价格里的 `$`（"$12.59"）写成反斜杠加美元符：不算公式边界，排版认它是字面的美元符。已经转义过的不动。"""
    return CURRENCY_RE.sub(lambda _: "\\$", text)


def is_citation_only(text: str) -> bool:
    """整块只是引注（作者、年份、页码，或 Ibid.），没有要翻的话。"""
    return bool(CITATION_ONLY_RE.match(FN_RE.sub(" ", text).strip()))


def nothing_to_translate(text: str) -> str:
    """整块没有要翻的话时给出原因，有要翻的返回空串（2026-11-20，用户定：这类块算「按设计保留原文」，不算没翻成）。

    - `skip_citation_only`：只有引注（"35. Brown-Saracino 2014, 43."、"Ibid., 45."）；
    - `skip_no_prose`：去掉公式、行内代码、角标、引用编号、网址以后一个英文词都没有（纯数字、符号、网址、代码、整块公式）。
    原文有中文的不算（中文原稿另有规矩）。"""
    source = str(text or "")
    if not source.strip() or CJK_RE.search(source):
        return ""
    if is_citation_only(source):
        return "skip_citation_only"
    if not PROSE_WORD_RE.search(URL_RE.sub(" ", _strip_protected(source))):
        return "skip_no_prose"
    return ""


_QUOTE_PROTECTED_RE = re.compile(r"`[^`\n]+`|(?<!\\)\$\$[^$]+\$\$|(?<!\\)\$[^$]+(?<!\\)\$|\{\{fn:[^}]+\}\}")
_SINGLE_QUOTED_CJK_RE = re.compile(r"'([^'\n]{0,60}[\u4e00-\u9fff][^'\n]{0,60})'")


def normalize_quotes(text: str) -> str:
    """中文译文里的直引号换成中文引号：成对的 `"` 依次换成 “ ”（单数个不动，免得配错），引着中文的 '…' 换成 ‘…’。
    公式、行内代码、脚注标记里的不动；没有中文的译文（保留原文的引注、书目）不动。
    11-20《The Interloper》全书 251 块用直引号、79 块用弯引号，同一本书里随块变。"""
    if not text or not CJK_RE.search(text):
        return text
    parts: list[tuple[bool, str]] = []
    last = 0
    for match in _QUOTE_PROTECTED_RE.finditer(text):
        parts.append((False, text[last : match.start()]))
        parts.append((True, match.group(0)))
        last = match.end()
    parts.append((False, text[last:]))
    if sum(chunk.count('"') for protected, chunk in parts if not protected) % 2 == 0:
        opening = True
        out = []
        for protected, chunk in parts:
            if not protected:
                pieces = chunk.split('"')
                rebuilt = pieces[0]
                for piece in pieces[1:]:
                    rebuilt += ("“" if opening else "”") + piece
                    opening = not opening
                chunk = rebuilt
            out.append((protected, chunk))
        parts = out
    return "".join(chunk if protected else _SINGLE_QUOTED_CJK_RE.sub(lambda m: f"‘{m.group(1)}’", chunk) for protected, chunk in parts)


def normalize_translation(translation: str | None) -> str | None:
    """模型交回的译文统一收拾一遍（按节、逐页都走）：价格的 `$` 转义、直引号换中文引号。"""
    if not translation:
        return translation
    return normalize_quotes(escape_currency(translation))


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
    translation = normalize_translation(translation)
    from difflib import SequenceMatcher

    if "\\\\" not in source:
        # 模型照请求 JSON 里的写法交回了两个反斜杠（\\delta）：原文公式里没有连着的两个反斜杠，就并成一个
        translation = FORMULA_RE.sub(lambda m: re.sub(r"\\\\(?=[A-Za-z{}|,;! ])", lambda _: "\\", m.group(0)), translation)

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
    if len(re.findall(r"(?<!\\)\$", CODE_RE.sub(" ", translation))) % 2:
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
    if not CJK_RE.search(plain_source) and PROSE_WORD_RE.search(URL_RE.sub(" ", plain_source)) and not is_citation_only(source):
        if translation.strip() == source.strip():
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
                    f"术语“{term['source']}”应译作“{term['target']}”（术语表 {term['id']}）；这里意思确实不同的话，声明为例外并写理由",
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


# 意思闸门（2026-11-20）：程序逐段打可疑标记，审校只看带标记的段。标记会有误报（作者换了说法），交给审校判断。
DOUBT_RE = re.compile(
    r"\b(may|might|perhaps|maybe|possibly|probably|likely|unlikely|seems?|seemed|appears? to|appeared to|presumably|arguably|apparently|"
    r"I (?:suspect|guess|imagine|think|believe|wonder)|it is possible)\b",
    re.IGNORECASE,
)
DOUBT_ZH = HEDGE_ZH + ("多半", "想必", "八成", "兴许", "说不定", "我猜", "我想", "我估计", "我怀疑", "仿佛", "似是", "或者", "吧", "怕是", "可以说", "我觉得", "我相信", "据说", "显然")
NEG_RE = re.compile(r"\b(not|never|no|none|nothing|nobody|nowhere|neither|nor|without|cannot|hardly|barely|scarcely|seldom|rarely)\b|n't\b", re.IGNORECASE)
NEG_ZH = ("不", "没", "无", "未", "非", "别", "勿", "莫", "否", "毫", "难", "鲜", "罕", "少有", "拒", "缺", "失")


NEG_ZH_RE = re.compile(r"不|没|无|未|非|别|勿|莫|否|毫|难以|鲜|罕|拒绝|缺|失败")
SENT_EN_RE = re.compile(r"[.!?](?:[\"'”’)\]]*)\s+(?=[\"'“‘(]*[A-Z])")
SENT_ZH_RE = re.compile(r"[。！？]")


def _doubt_count(text: str) -> int:
    return sum(text.count(word) for word in DOUBT_ZH)


def meaning_flags(source: str, translation: str | None) -> list[str]:
    """这一段可能丢了意思的地方（给审校的提示，中文一句一条）。按个数比：原文里推测语气、否定、句子有几处，译文里少了就标；
    数字找不到也标。只看"有没有"太粗：一段里删掉一个「不」，别处还有否定词就查不出（11-20 埋错评测 10 处只标出 4 处）。"""
    if not translation or not CJK_RE.search(translation):
        return []
    plain = _strip_protected(source)
    flags: list[str] = []
    doubts = [m.group(1).lower() for m in DOUBT_RE.finditer(plain)]
    if doubts and _doubt_count(translation) < len(doubts):
        flags.append(f"原文有 {len(doubts)} 处表示推测、保留的词 {sorted(set(doubts))[:4]}，译文里只找到 {_doubt_count(translation)} 处「可能、或许、大概、似乎」之类")
    negations = [(m.group(1) or "n't").lower() for m in NEG_RE.finditer(plain)]
    zh_negations = len(NEG_ZH_RE.findall(translation))
    if negations and zh_negations < len(negations):
        flags.append(f"原文有 {len(negations)} 处否定 {sorted(set(negations))[:4]}，译文里只找到 {zh_negations} 处否定词")
    src_sentences = len(SENT_EN_RE.findall(plain.strip() + " X")) if plain.strip() else 0
    zh_sentences = len(SENT_ZH_RE.findall(translation))
    if src_sentences >= 3 and zh_sentences <= src_sentences - 2:
        flags.append(f"原文 {src_sentences} 句，译文只有 {zh_sentences} 句，看看有没有漏掉的句子、分句")
    lost = [i["message"] for i in check_block(source, translation) if i["code"] == "number_lost"]
    if lost:
        flags.append(lost[0])
    return flags


def short_outliers(pairs: list[tuple[str, str, str]], *, min_words: int = 20, share: float = 0.7) -> dict[str, str]:
    """一节里明显比别的段短的译文（可能漏了句子、分句）：每段算「中文字数 / 原文词数」，低于全节中位数的 `share` 倍算短。
    `pairs` 是 [(段 id, 原文, 译文)]；原文不到 `min_words` 个词的不算。返回 {段 id: 提示}。"""
    ratios: dict[str, float] = {}
    for key, source, translation in pairs:
        words = len(PROSE_WORD_RE.findall(_strip_protected(source)))
        if words >= min_words and translation:
            ratios[key] = len(CJK_RE.findall(translation)) / words
    if len(ratios) < 4:
        return {}
    ordered = sorted(ratios.values())
    median = ordered[len(ordered) // 2]
    return {key: f"译文比同一节别的段短不少（每个英文词 {ratio:.1f} 个汉字，全节中位数 {median:.1f}），可能漏了句子" for key, ratio in ratios.items() if ratio < median * share}


def status_of(issues: list[dict]) -> str:
    """error 优先，其次 warn；info 只是记一笔，不影响状态。"""
    if any(i["severity"] == "error" for i in issues):
        return "error"
    if any(i["severity"] == "warn" for i in issues):
        return "warn"
    return "ok"

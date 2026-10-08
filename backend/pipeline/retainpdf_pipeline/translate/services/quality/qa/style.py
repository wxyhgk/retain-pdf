"""只看译文本身的检查：残留英文整句、标点与中英混排。按块做，定位到具体成员。

残留英文：去掉公式、占位符、括注、网址、代码样式的标识符之后，还剩连续 6 个词以上、
且含至少 2 个英文虚词（the / of / is …）的英文串，才算「整句没翻」。纯专名串
（每个词都大写开头）、术语、软件名、数据集名因为不含虚词，自然不会命中。参考文献、
代码块整体跳过（参考文献照录不译）。

标点与混排（全部 minor，同一块同一类只报一条，附计数和例子）：
- 中文语境里的半角标点 , ; : ? ! . 和半角括号；
- 全角数字、全角字母；
- 省略号必须是「……」；破折号必须是「——」；
- 外国人名间隔号必须是「·」（误用 • ・ ‧ ∙）；
- 中文语境里的直引号 "…"；
- 全角标点前后多出来的空格。
"""
from __future__ import annotations

import re

from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders
from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_CRITICAL
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MINOR
from retainpdf_pipeline.translate.services.quality.qa.models import excerpt
from retainpdf_pipeline.translate.services.quality.qa.text import CJK_CLASS
from retainpdf_pipeline.translate.services.quality.qa.text import MATH_MASK
from retainpdf_pipeline.translate.services.quality.qa.text import cjk_count
from retainpdf_pipeline.translate.services.quality.qa.text import mask_math
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem


CHECK_RESIDUE = "english_residue"
CHECK_PUNCTUATION = "punctuation"

RESIDUE_MIN_WORDS = 6
RESIDUE_MAJOR_WORDS = 12
RESIDUE_MIN_FUNCTION_WORDS = 2
_FUNCTION_WORDS = frozenset(
    """the a an of and or to in on at by for with from as is are was were be been being this that these those
    it its we our they their which who whose when where if then than so not but can could may might must
    should will would has have had do does did into onto over under about between through such each""".split()
)
_NAME_PARTICLES = frozenset({"van", "der", "den", "de", "von", "la", "le", "da", "di", "du", "del", "y", "et", "al"})
_URL_RE = re.compile(r"(?:https?://|www\.)\S+|\b10\.\d{4,9}/\S+|\S+@\S+\.\w+", re.IGNORECASE)
_CODE_TOKEN_RE = re.compile(
    r"`[^`]*`|\b\w+\([^()]*\)|\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\b|\b\w*_\w*\b|\b[a-z]+[A-Z]\w*\b"
)
_PAREN_LATIN_RE = re.compile(r"[（(][^（）()]*[A-Za-z][^（）()]*[）)]")
_LATIN_RUN_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*(?:[\s,;:]+[A-Za-z][A-Za-z'’\-]*)+")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'’\-]*")

_CJK = f"[{CJK_CLASS}]"
_CJK_OR_MASK = f"[{CJK_CLASS}{MATH_MASK}]"
# 只抓破折号的误写：单个「—」、三个以上「—」、「--」、「―」。一字线「–」与「－」是
# GB/T 15834 的连接号（「反应物–产物对」「自旋–自旋耦合」），不是破折号。
_BAD_DASH = "(?:-{2,}|(?<!—)—(?!—)|—{3,}|―+)"
_PUNCTUATION_RULES: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "halfwidth_punctuation",
        re.compile(rf"(?<={_CJK})[,;:?!]|[,;:?!](?=\s*{_CJK})|(?<={_CJK})\.(?![\d.]|[A-Za-z])"),
        "中文语境应使用全角标点（，；：？！。）",
    ),
    (
        "halfwidth_parentheses",
        # 化学名里的半角括号是命名规范的一部分：「2-(4-氟苯基)氧杂环丁烷」，括号前是连字符 / 数字 / 撇号，不算。
        re.compile(rf"(?<![-\d′'\[\]()A-Za-z])\((?=[^()]*{_CJK})[^()]*\)(?![-\d(])"),
        "括号内含中文时应使用全角括号（）",
    ),
    ("fullwidth_alnum", re.compile(r"[０-９Ａ-Ｚａ-ｚ]+"), "数字和字母应使用半角"),
    (
        "ellipsis_style",
        # 「0, 1, 2, ...」这种西文数列里的省略号照西文体例，不算。
        re.compile(r"(?<![.…])(?<!\d,\s)(?<!\d,)\.{3,}(?!\.)|(?<!…)(?<!\d,\s)(?<!\d,)…(?!…)|。{2,}|…{3,}"),
        "省略号应写作「……」",
    ),
    (
        "dash_style",
        # 至少一侧是汉字才算中文破折号；两侧都是公式 / 数字的「5–12」是编号或范围，不管。
        re.compile(
            rf"(?<={_CJK})\s*{_BAD_DASH}\s*(?={_CJK_OR_MASK})|(?<={MATH_MASK})\s*{_BAD_DASH}\s*(?={_CJK})"
        ),
        "破折号应写作「——」",
    ),
    (
        "name_separator",
        re.compile(rf"{_CJK}[•・‧∙]{_CJK}"),
        "外国人名间隔号应使用「·」",
    ),
    (
        "straight_quotes",
        re.compile(rf"\"(?=[^\"]*{_CJK})[^\"]*\""),
        "中文语境应使用中文引号“”",
    ),
    (
        "fullwidth_punctuation_spacing",
        # 全角标点与行内公式之间的空格是渲染侧有意加的（surround_inline_math_with_spaces），不算。
        re.compile(
            rf"(?<=[，。；：！？、）】》」』])[ \t]+(?=[^\s{MATH_MASK}])|(?<=[^\s{MATH_MASK}])[ \t]+(?=[，。；：！？、）】》」』])"
        ),
        "全角标点前后不应有空格",
    ),
)
PUNCTUATION_RULE_NAMES = tuple(rule[0] for rule in _PUNCTUATION_RULES)


def _clean_for_residue(text: str) -> str:
    value = strip_placeholders(mask_math(text)).replace(MATH_MASK, " ")
    value = _URL_RE.sub(" ", value)
    value = _PAREN_LATIN_RE.sub(" ", value)
    value = _CODE_TOKEN_RE.sub(" ", value)
    return value


def residue_spans(text: str) -> list[tuple[str, int, int]]:
    """返回 (英文串, 词数, 虚词数)。只返回像整句的英文串。"""
    spans: list[tuple[str, int, int]] = []
    for match in _LATIN_RUN_RE.finditer(_clean_for_residue(text)):
        words = _WORD_RE.findall(match.group(0))
        if len(words) < RESIDUE_MIN_WORDS:
            continue
        function_words = sum(1 for word in words if word.casefold() in _FUNCTION_WORDS)
        if function_words < RESIDUE_MIN_FUNCTION_WORDS:
            continue
        if all(
            word[:1].isupper()
            for word in words
            if word.casefold() not in _FUNCTION_WORDS and word.casefold() not in _NAME_PARTICLES
        ):
            continue  # 书名、机构名、作者列表这类标题式专名
        spans.append((match.group(0).strip(), len(words), function_words))
    return spans


def check_item_residue(item: QaItem) -> list[QaViolation]:
    if item.is_reference or item.is_code:
        return []
    spans = residue_spans(item.translated)
    if not spans:
        return []
    longest = max(spans, key=lambda span: span[1])
    untranslated_block = cjk_count(item.translated) == 0 and longest[1] >= RESIDUE_MAJOR_WORDS
    if untranslated_block:
        severity = SEVERITY_CRITICAL
    elif longest[1] >= RESIDUE_MAJOR_WORDS:
        severity = SEVERITY_MAJOR
    else:
        severity = SEVERITY_MINOR
    return [
        QaViolation(
            check=CHECK_RESIDUE,
            type="untranslated_block" if untranslated_block else "english_sentence_residue",
            severity=severity,
            message=(
                "整块译文没有中文，疑似整段未翻译"
                if untranslated_block
                else f"译文残留英文整句（最长 {longest[1]} 词）"
            ),
            item_ids=[item.item_id],
            page_number=item.page_number,
            block_idx=item.block_idx,
            unit_id=item.unit_id,
            scope="item",
            evidence={
                "residue": [span[0][:200] for span in spans[:3]],
                "longest_word_count": longest[1],
                "source_excerpt": excerpt(item.source, longest[0][:40]),
                "translation_excerpt": excerpt(item.translated, longest[0][:40]),
            },
        )
    ]


def check_item_punctuation(item: QaItem) -> list[QaViolation]:
    if item.is_code or cjk_count(item.translated) == 0:
        return []
    masked = strip_placeholders(mask_math(item.translated))
    violations: list[QaViolation] = []
    for name, pattern, message in _PUNCTUATION_RULES:
        matches = list(pattern.finditer(masked))
        if not matches:
            continue
        examples = []
        for match in matches[:3]:
            left = max(0, match.start() - 8)
            right = min(len(masked), match.end() + 8)
            examples.append(masked[left:right].replace(MATH_MASK, "$…$"))
        violations.append(
            QaViolation(
                check=CHECK_PUNCTUATION,
                type=name,
                severity=SEVERITY_MINOR,
                message=f"{message}（{len(matches)} 处）",
                item_ids=[item.item_id],
                page_number=item.page_number,
                block_idx=item.block_idx,
                unit_id=item.unit_id,
                scope="item",
                evidence={
                    "count": len(matches),
                    "examples": examples,
                    "translation_excerpt": excerpt(item.translated),
                },
            )
        )
    return violations


__all__ = [
    "CHECK_PUNCTUATION",
    "CHECK_RESIDUE",
    "PUNCTUATION_RULE_NAMES",
    "RESIDUE_MAJOR_WORDS",
    "RESIDUE_MIN_FUNCTION_WORDS",
    "RESIDUE_MIN_WORDS",
    "check_item_punctuation",
    "check_item_residue",
    "residue_spans",
]

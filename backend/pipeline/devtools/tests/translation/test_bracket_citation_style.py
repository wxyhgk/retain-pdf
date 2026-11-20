"""原文行内方括号引用 [n] 译文里要保持 [n]，不能被改成上标。

实测：translation_direct_typst_guidance.txt 要求「论文引用 / 参考文献编号统一输出 `$^{117}$`」，
模型把行内 [n] 也改成上标，而且只改一部分——b343d1（Elsevier，行内 [n]）25 个带 [n] 的块里
12 个变成 `$^{[…]}$`（p001-b024 "[12–17]" → "$^{[12-17]}$"），其余保留；1ed40e（BMC）全被改。
同一篇文章里两种引用样式混排。
"""

import json
import re
from pathlib import Path

import pytest

from retainpdf_translation_classic.llm.citation_style import restore_bracket_citations
from retainpdf_translation_classic.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_translation.prompt_loader import load_prompt

FIXTURE = Path(__file__).parent / "fixtures" / "bracket_citations_b343d1_1ed40e.json"
_BARE = re.compile(r"\[\s*(\d{1,4}(?:\s*[,，–—\-−]\s*\d{1,4})*)\s*\]")


def _key(body: str) -> str:
    return re.sub(r"[–—−]", "-", re.sub(r"\s+", "", body)).replace("，", ",")


@pytest.mark.parametrize(
    ("source", "translated", "expected"),
    [
        # 行内方括号被改成「上标 + 方括号」：还原成原文写法（连字符也按原文的 en dash）。
        (
            "an important class of strychnos alkaloids [12–17]. Considerable research since 1872 [18].",
            "马钱子碱类生物碱的一个重要类别 $^{[12-17]}$。自1872年以来已有大量研究 $^{[18]}$。",
            "马钱子碱类生物碱的一个重要类别[12–17]。自1872年以来已有大量研究[18]。",
        ),
        # 被改成不带方括号的纯上标，同样还原。
        (
            "as reported previously [3, 5] and [7].",
            "如先前报道 $^{3, 5}$ 以及 $^{7}$ 所述。",
            "如先前报道[3, 5]以及[7]所述。",
        ),
        # 前后是 ASCII 词时保留一个空格。
        (
            "assigned by VEDA [36] package",
            "通过 VEDA $^{[36]}$ package 指认",
            "通过 VEDA [36] package 指认",
        ),
    ],
)
def test_restores_bracket_citations_turned_into_superscript(source, translated, expected):
    assert restore_bracket_citations(source, translated) == expected


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        # 原文本来就是上标引用：保持上标。
        ("as shown previously<sup>117</sup>.", "如先前所示 $^{117}$。"),
        ("as shown previously $ ^{26-28} $.", "如先前所示 $^{26-28}$。"),
        # Wiley 的上标方括号引用，MinerU 写成 <sup>[1]</sup> 或不带 $ 的 ^{[1]}（9dcd3c / 80509d）。
        ("a paradigm of organic chemistry.<sup>[1]</sup> Since", "有机化学的范式。 $^{[1]}$ 自"),
        ("replaced by C–H units. ^{[1]} As early as 1963, ^{[2]}", "被 C–H 单元取代。 $^{[1]}$ 早在1963年 $^{[2]}$"),
        # 同号既是方括号引用又是同位素上标："$^{1}$H" 不能动。
        ("characterized by <sup>1</sup>H NMR as in [1].", "通过 $^{1}$H NMR 表征，如[1]所示。"),
        # 紧贴数字 / 字母的上标是幂或单位，不是引用。
        ("a rate of 10^3 per second [3].", "速率为 10$^{3}$ 每秒[3]。"),
        # 内容对不上的上标不动：化学名里的 [1,3] 不是引用。
        ("spiro[carbazole-1,2′-[1,3]dithiolane] and <sup>13</sup>C NMR", "螺[咔唑-1,2′-[1,3]二硫杂环戊烷]与 $^{13}$C NMR"),
        # 原文的方括号在公式里，不算行内引用。
        ("the vector $ [12] $ is", "向量 $^{12}$ 是"),
        # 原文没有方括号：完全不碰。
        ("as shown previously.", "如先前所示 $^{[12]}$。"),
    ],
)
def test_leaves_genuine_superscripts_untouched(source, translated):
    assert restore_bracket_citations(source, translated) == translated


def test_canonicalizer_restores_bracket_citations_for_direct_typst_items():
    item = {
        "item_id": "p001-b024",
        "math_mode": "direct_typst",
        "source_text": "carbazole derivatives an important class of strychnos alkaloids [12–17].",
        "protected_source_text": "carbazole derivatives an important class of strychnos alkaloids [12–17].",
    }
    result = canonicalize_batch_result(
        [item],
        {"p001-b024": {"decision": "translate", "translated_text": "咔唑衍生物是马钱子碱类生物碱的一个重要类别 $^{[12-17]}$。"}},
    )
    assert result["p001-b024"]["translated_text"] == "咔唑衍生物是马钱子碱类生物碱的一个重要类别[12–17]。"


_TRANSLATED_SUP = re.compile(r"\$\s*\^\s*\{\s*([^}]*)\}\s*\$")
_SOURCE_SUP = re.compile(r"<sup>\s*([^<]*)</sup>|\^\s*\{\s*([^}]*)\}")


def test_real_translations_follow_source_citation_style():
    cases = json.loads(FIXTURE.read_text(encoding="utf-8"))["cases"]
    converted = []
    for case in cases:
        source, translated = case["source_text"], case["translated_text"]
        restored = restore_bracket_citations(source, translated)
        source_sup_keys = {_key((a or b).strip("[] ")) for a, b in _SOURCE_SUP.findall(source)}
        source_bare_keys = {_key(body) for body in _BARE.findall(re.sub(r"\$[^$]*\$", " ", source))}
        inline_only = source_bare_keys - source_sup_keys
        # 原文只以行内 [n] 出现的编号，还原后不能再有上标形式，且都以 [n] 出现。
        restored_sup_keys = {_key(body.strip("[] ")) for body in _TRANSLATED_SUP.findall(restored)}
        assert not (restored_sup_keys & inline_only), (case["item_id"], restored_sup_keys & inline_only)
        translated_keys = {_key(b) for b in _BARE.findall(translated)} | {
            _key(body.strip("[] ")) for body in _TRANSLATED_SUP.findall(translated)
        }
        restored_bare_keys = {_key(body) for body in _BARE.findall(restored)}
        assert (inline_only & translated_keys) <= restored_bare_keys, case["item_id"]
        # 原文本来就是上标的（Paddle 把 1ed40e 部分引用识别成 $ ^{[1-4]} $）照旧是上标。
        assert (source_sup_keys & restored_sup_keys) == (source_sup_keys & {
            _key(body.strip("[] ")) for body in _TRANSLATED_SUP.findall(translated)
        }), case["item_id"]
        if restored != translated:
            converted.append(case["item_id"])
        # 幂等：再跑一次不再变化。
        assert restore_bracket_citations(source, restored) == restored
    assert converted == [
        "p001-b022", "p001-b023", "p001-b024", "p003-b004", "p005-b005",  # b343d1
        "p002-b011", "p003-b003", "p006-b007",  # 1ed40e：原文行内 [n] 的块；p002-b006 原文就是上标，不动
    ]
    b019 = next(case for case in cases if case["item_id"] == "p001-b019")
    restored = restore_bracket_citations(b019["source_text"], b019["translated_text"])
    assert "$^{1}$H NMR" in restored and "$^{13}$C NMR" in restored


def test_direct_typst_prompt_keeps_inline_bracket_citations():
    guidance = load_prompt("translation_direct_typst_guidance.txt")
    assert "统一输出 LaTeX inline math" not in guidance
    assert "[12]" in guidance and "方括号" in guidance

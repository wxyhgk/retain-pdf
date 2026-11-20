"""书里的边界情况（2026-11-20，Sonnet 审读《The Interloper》那次运行时查出）：价格的 `$` 被当公式、只有引注的尾注被判没翻、
直引号和弯引号混用、按节翻的回答被截断没人发现、按章的术语在别的章也被强推。假模型。"""

from __future__ import annotations

import re

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.checks import FORMULA_RE
from retainpdf_translation_agent.checks import check_block
from retainpdf_translation_agent.checks import escape_currency
from retainpdf_translation_agent.checks import is_citation_only
from retainpdf_translation_agent.checks import normalize_quotes
from retainpdf_translation_agent.checks import normalize_translation
from retainpdf_translation_agent.memory import APPROVED
from retainpdf_translation_agent.memory import Glossary
from retainpdf_translation_agent.section import SECTION_NARRATIVE_PROMPT
from retainpdf_translation_agent.section import build_manuscript
from retainpdf_translation_agent.section import cut_paragraph
from retainpdf_translation_agent.section import parse_section
from retainpdf_translation_agent.section import section_terms
from retainpdf_translation_agent.section import translate_section
from retainpdf_translation_agent.units import merge_groups


def test_prices_are_not_formulas() -> None:
    """"$12.59 to $17" 以前被当成一个公式换成占位，中间的 to 没翻（第 178 页「从$12.59 to $17到不等」）。"""
    escaped = escape_currency("from $12.59 to $17 per hour, or $5 billion and $1,200.50.")
    assert escaped == "from \\$12.59 to \\$17 per hour, or \\$5 billion and \\$1,200.50."
    assert FORMULA_RE.findall(escaped) == []
    for formula in ("$3$", "$2^{n}$", "$ 3 + 4 $", "$3 + 4$", "$x$"):
        assert escape_currency(formula) == formula and FORMULA_RE.findall(formula) == [formula]
    assert escape_currency("\\$12 already") == "\\$12 already"

    _, manuscript = build_manuscript(merge_groups(PageInput(page_label="1", blocks=[BlockInput("a", "paragraph", escaped, True)]))[0])
    assert "⟦F" not in manuscript, "价格不换成公式占位，模型看得到 to"
    # 模型交回时漏了反斜杠：补上，`$` 成对检查不受影响
    assert normalize_translation("从12.59美元到$17不等") == "从12.59美元到\\$17不等"
    assert not [i for i in check_block(escaped, "按资历从 \\$12.59 到 \\$17 不等。") if i["code"] == "formula_unbalanced"]


def test_citation_only_notes_may_stay_in_english() -> None:
    """尾注 "35. Keenan 2013, xxiv." 原样交回以前判 untranslated，重交两三次再退回原文，任务结束时还提示没翻。"""
    for note in ("35. Keenan 2013, xxiv.", "33. Scheper-Hughes 2001, xiii.", "Ibid., 45.", "See Smith and Jones 2019; Lee 2020, 12–14.", "Bourdieu et al. 1999, 3n2."):
        assert is_citation_only(note), note
        assert check_block(note, note) == [], note
    for prose in ("11. On this point, see Keenan 2013.", "The study by Keenan 2013 shows that access was denied."):
        assert not is_citation_only(prose), prose
    assert [i["code"] for i in check_block("11. On this point, see Keenan 2013.", "11. On this point, see Keenan 2013.")] == ["untranslated"]

    # 整段都是英文书目：不当成模型写进译稿的说明删掉（以前删光了，判成漏交）
    entry = "Keenan, Marie. 2013. Child Sexual Abuse and the Catholic Church. Oxford University Press."
    assert parse_section(f"¶1 {entry}\n\n¶2 这一段有中文。\nThis is a note the model added to explain itself.") == {1: entry, 2: "这一段有中文。"}


def test_straight_quotes_become_chinese_quotes() -> None:
    """全书 251 块用直引号、79 块用弯引号，随块变。"""
    assert normalize_quotes('他说"我不知道"，然后\'被看见\'。') == "他说“我不知道”，然后‘被看见’。"
    assert normalize_quotes('他说"我不知道') == '他说"我不知道', "单数个不动，免得配错"
    assert normalize_quotes('公式 $a"b$ 和 `x="1"` 不动，"这里"换') == '公式 $a"b$ 和 `x="1"` 不动，“这里”换'
    assert normalize_quotes('Keenan, "The Title," 2013.') == 'Keenan, "The Title," 2013.', "没有中文的不动"


def test_a_cut_off_last_paragraph_is_asked_again() -> None:
    """按节翻以前不看截断：回答写到上限、最后一段只写了半句，只要不短于原文 15% 就收下。"""
    sources = {1: "He left.", 2: "She stayed for many months.", 3: "Chapter Two"}
    assert cut_paragraph({1: "他走了。", 2: "她留了好几个"}, sources, hit_limit=False) == 2
    assert cut_paragraph({1: "他走了。", 2: "她留了好几个月。"}, sources, hit_limit=False) is None
    assert cut_paragraph({1: "他走了。", 2: "她留了好几个月。"}, sources, hit_limit=True) == 2
    assert cut_paragraph({3: "第二章"}, sources, hit_limit=False) is None, "原文本来就不以句号收尾"

    calls: list[dict] = []

    def model(body: dict) -> dict:
        calls.append(body)
        usage = {"input_tokens": 10, "output_tokens": 5}
        if len(calls) == 1:
            return {"content": [{"type": "text", "text": "¶1 他走了。\n\n¶2 她在那里留了好几"}], "stop_reason": "max_tokens", "usage": usage}
        return {"content": [{"type": "text", "text": "¶2 她在那里留了好几个月。"}], "stop_reason": "end_turn", "usage": usage}

    pages = [PageInput(page_label="1", blocks=[BlockInput("a", "paragraph", "He left the village after the meeting.", True), BlockInput("b", "paragraph", "She stayed there for many long months.", True)])]
    outcome = translate_section(TranslationAgent(model="fake", transport=model), pages, Glossary())
    assert calls[0]["system"][0]["text"].startswith(SECTION_NARRATIVE_PROMPT[:20])
    assert re.search(r"¶2：", calls[1]["messages"][-1]["content"]) and "¶1：" not in calls[1]["messages"][-1]["content"]
    assert outcome.results["b"].translation == "她在那里留了好几个月。" and outcome.info["attempts"] == 2


def test_section_terms_follow_the_chapter_scope() -> None:
    """按章的译法以前在别的章也被强推（section_terms 不看章）。"""
    glossary = Glossary()
    glossary.add("field", "田野", status=APPROVED, reason="test", scope=["第一章"])
    glossary.add("field", "领域", status=APPROVED, reason="test", scope=["第二章"])
    text = "In the field, access matters."
    assert [t.target for t in section_terms(glossary, text, ["第一章"])] == ["田野"]
    assert [t.target for t in section_terms(glossary, text, ["第二章"])] == ["领域"]
    assert [t.target for t in section_terms(glossary, text, ["第三章"])] == []

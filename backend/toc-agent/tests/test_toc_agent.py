"""目录 agent 核心：一次翻完、同文同译、逐条检查退回、对上正文标题、失败退回普通翻译。"""
from __future__ import annotations

import json

from retainpdf_toc_agent import ChatResult
from retainpdf_toc_agent import GlossaryTerm
from retainpdf_toc_agent import Heading
from retainpdf_toc_agent import TocEntry
from retainpdf_toc_agent import translate_toc
from retainpdf_toc_agent.match import heading_translation
from retainpdf_toc_agent.match import title_key
from retainpdf_toc_agent.validate import check_title
from retainpdf_toc_agent.validate import tidy

ENTRIES = [
    TocEntry("p001-b0001", "Analyzing the Audience", "1", 1),
    TocEntry("p001-b0002", "Analyze who your audience is", "", 2),
    TocEntry("p001-b0003", "References", "", 2),
    TocEntry("p001-b0004", "Balancing Precision and Clarity", "2", 1),
    TocEntry("p001-b0005", "References", "", 2),
]
ZH = {
    "Analyzing the Audience": "分析受众",
    "Analyze who your audience is": "分析你的受众是谁",
    "References": "参考文献",
    "Balancing Precision and Clarity": "在精确与清晰之间取得平衡",
}


class FakeModel:
    def __init__(self, answers):
        self.answers = list(answers)
        self.calls = []

    def __call__(self, messages, *, purpose, response_format=None):
        self.calls.append(messages)
        answer = self.answers.pop(0)
        if callable(answer):
            answer = answer(messages)
        return ChatResult(content=json.dumps(answer, ensure_ascii=False), usage={"total_tokens": 10})


def _sent_titles(messages):
    payload = json.loads(messages[1]["content"])
    return [row["title"] for row in payload["entries"]]


def _all_right(messages):
    return {"translations": [{"k": i, "zh": ZH[t]} for i, t in enumerate(_sent_titles(messages))]}


def test_translates_each_title_once_and_composes_numbers():
    model = FakeModel([_all_right])
    result = translate_toc(ENTRIES, chat_fn=model)
    assert result.status == "translated" and result.requests == 1
    # 同样的原文只问一次
    assert _sent_titles(model.calls[0]).count("References") == 1
    assert result.fixed_translations == {
        "p001-b0001": "1 分析受众",
        "p001-b0002": "分析你的受众是谁",
        "p001-b0003": "参考文献",
        "p001-b0004": "2 在精确与清晰之间取得平衡",
        "p001-b0005": "参考文献",
    }
    assert result.usage == {"total_tokens": 10}


def test_rejected_titles_are_sent_back_with_the_reason():
    def first(messages):
        rows = _all_right(messages)["translations"]
        rows[0]["zh"] = "Analyzing the Audience"  # 没译
        rows[1]["zh"] = "分析你的受众是谁 3"  # 混进页码
        return {"translations": rows}

    def second(messages):
        retry = json.loads(messages[-1]["content"].split("\n", 1)[1])
        assert [row["k"] for row in retry] == [0, 1]
        assert "没有译成中文" in retry[0]["problem"] and "数字" in retry[1]["problem"]
        return {"translations": [{"k": 0, "zh": "分析受众"}, {"k": 1, "zh": "分析你的受众是谁"}]}

    model = FakeModel([first, second])
    result = translate_toc(ENTRIES, chat_fn=model)
    assert result.status == "translated" and result.requests == 2
    assert result.fixed_translations["p001-b0001"] == "1 分析受众"


def test_titles_still_wrong_after_the_last_round_are_left_to_normal_translation():
    def stubborn(messages):
        rows = _all_right(messages)["translations"] if len(messages) == 2 else []
        for row in rows:
            if row["k"] == 0:
                row["zh"] = ""
        return {"translations": rows or [{"k": 0, "zh": ""}]}

    result = translate_toc(ENTRIES, chat_fn=FakeModel([stubborn] * 3))
    assert result.status == "partial" and result.requests == 3
    assert "p001-b0001" not in result.fixed_translations
    assert result.rejected == {"Analyzing the Audience": "empty"}


def test_body_headings_get_the_same_wording():
    headings = [
        Heading("p010-b0000", "1 Analyzing the Audience"),
        Heading("p011-b0004", "ANALYZE WHO YOUR AUDIENCE IS"),
        Heading("p013-b0002", "References"),
        Heading("p014-b0001", "Chapter 1"),
        Heading("p001-b0001", "Analyzing the Audience"),  # 条目自己不算标题
    ]
    result = translate_toc(ENTRIES, headings, chat_fn=FakeModel([_all_right]))
    assert result.fixed_translations["p010-b0000"] == "1 分析受众"
    assert result.fixed_translations["p011-b0004"] == "分析你的受众是谁"
    assert result.fixed_translations["p013-b0002"] == "参考文献"
    assert "p014-b0001" not in result.fixed_translations
    assert result.fixed_translations["p001-b0001"] == "1 分析受众"
    assert result.matched_headings == 3


def test_request_failure_keeps_what_was_settled():
    def broken(messages, **kwargs):
        raise RuntimeError("upstream 500")

    result = translate_toc(ENTRIES, chat_fn=broken)
    assert result.status == "request_failed" and result.fixed_translations == {}
    assert "upstream 500" in result.error


def test_no_entries_sends_nothing():
    result = translate_toc([], chat_fn=lambda *a, **k: (_ for _ in ()).throw(AssertionError("no call")))
    assert result.status == "no_entries"


def test_long_contents_are_split_into_requests(monkeypatch):
    import retainpdf_toc_agent.agent as agent

    monkeypatch.setattr(agent, "MAX_TITLES_PER_REQUEST", 2)
    model = FakeModel([_all_right, _all_right])
    result = translate_toc(ENTRIES, chat_fn=model)
    assert [len(_sent_titles(call)) for call in model.calls] == [2, 2]
    assert len(result.fixed_translations) == 5


def test_glossary_terms_are_sent_and_enforced():
    entries = [TocEntry("p1", "Choose the Right Word", "", 1)]
    glossary = [GlossaryTerm("word", "措辞"), GlossaryTerm("unrelated", "无关")]

    def first(messages):
        payload = json.loads(messages[1]["content"])
        assert payload["glossary"] == [{"source": "word", "target": "措辞"}]
        return {"translations": [{"k": 0, "zh": "选择正确的词"}]}

    model = FakeModel([first, {"translations": [{"k": 0, "zh": "选择恰当的措辞"}]}])
    result = translate_toc(entries, chat_fn=model, glossary=glossary)
    assert result.fixed_translations == {"p1": "选择恰当的措辞"} and result.requests == 2


def test_checks_and_tidying():
    assert tidy("「1 分析受众。」", number="1") == "分析受众"
    assert tidy("第1章 分析受众", number="1") == "分析受众"
    assert tidy("2 分析受众", number="1") == "2 分析受众"
    assert check_title("Top 10 Mistakes", "十大错误") == "number_missing"
    assert check_title("Top 10 Mistakes", "10 大错误") == ""
    assert check_title("Using Python", "Using Python") == "not_translated"
    assert check_title("Python", "Python") == ""
    assert check_title("API", "API") == ""
    assert check_title("Index", "索引" * 20) == "too_long"
    assert check_title("Index", "索\n引") == "multiline"


def test_heading_keys_ignore_case_spacing_and_edge_punctuation():
    assert title_key("  Analyzing   the Audience: ") == title_key("analyzing the audience")
    assert title_key("Writer’s Guide") == title_key("Writer's guide")
    by_key = {title_key("Choose the right word"): "选对词"}
    assert heading_translation("2.3 Choose the right word", by_key) == "2.3 选对词"
    assert heading_translation("2.3. Choose the right word", by_key) == "2.3 选对词"
    assert heading_translation("Choose words", by_key) is None
    # 章、附录前缀；文字层拆开的重音
    by_key = {title_key("General Properties of the Schr ̈odinger Equation"): "薛定谔方程的一般性质", title_key("Matlab Code"): "Matlab 代码"}
    assert heading_translation("Chapter 1: General Properties of the Schrödinger Equation", by_key) == "第1章 薛定谔方程的一般性质"
    assert heading_translation("CHAPTER 1 General Properties of the Schrodinger Equation", by_key) == "第1章 薛定谔方程的一般性质"
    assert heading_translation("Appendix g: Matlab Code", by_key) == "附录G Matlab 代码"
    assert heading_translation("Chapter 1", by_key) is None
    assert title_key("Continuity: What It Isn't") == title_key("Continuity: What It Isn’t")

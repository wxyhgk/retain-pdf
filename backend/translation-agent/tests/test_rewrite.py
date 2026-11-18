"""编辑重写（rewrite.py）：整块交回改好的译文，程序裁判。全部用假模型。"""

from __future__ import annotations

import json

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.rewrite import rewrite_page

SOURCE = "By not looking any longer, she felt she had done the right thing, and the decision probably echoed TSA's unease.{{fn:3}}"
DRAFT = "通过不再继续观看，她觉得自己做了正确的事，这个决定大概也呼应了 TSA 的不安。{{fn:3}}"
BETTER = "她没再看下去，觉得自己做得对；这个决定大概也呼应了 TSA 的不安。{{fn:3}}"


class Model:
    def __init__(self, answer: dict) -> None:
        self.answer = answer
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        return {"content": [{"type": "tool_use", "name": body["tools"][0]["name"], "input": self.answer}], "usage": {"input_tokens": 40, "output_tokens": 10}}


def _page() -> PageInput:
    context = {"terms": [{"id": "k1", "source": "TSA", "target": "TSA", "category": "keep", "status": "locked"}]}
    blocks = [BlockInput("p1", "paragraph", SOURCE, True), BlockInput("h", "section_heading", "Hiding", True)]
    return PageInput(page_label="58", blocks=blocks, context=context)


def _results() -> dict[str, BlockResult]:
    return {"p1": BlockResult("p1", DRAFT, [], 1, "ok"), "h": BlockResult("h", "隐藏", [], 1, "ok")}


def _run(*edits: dict, genre: str = "humanities"):
    model = Model({"blocks": list(edits)})
    results = _results()
    report = rewrite_page(TranslationAgent(model="fake", transport=model), _page(), results, genre=genre)
    return model, results, report


def test_a_whole_block_rewrite_replaces_the_draft_and_keeps_history() -> None:
    model, results, report = _run({"block_id": "p1", "category": "fluency", "translation": BETTER, "changes": "去掉直译的“通过……”"})
    assert len(report["applied"]) == 1 and report["mode"] == "rewrite"
    assert results["p1"].translation == BETTER and results["p1"].history[-1]["translation"] == DRAFT
    assert results["p1"].meta["rewritten"] is True
    assert any(i["code"] == "rewrite_fluency" for i in results["p1"].issues)
    sent = json.loads(model.bodies[0]["messages"][0]["content"])
    assert [b["id"] for b in sent["blocks"]] == ["p1"], "short headings are not sent"
    assert "文笔要紧" in model.bodies[0]["system"][0]["text"]


def test_science_books_get_the_conservative_note() -> None:
    model, _, _ = _run(genre="science_paper")
    assert "只改意思错" in model.bodies[0]["system"][0]["text"]


def test_rewrites_that_break_checks_terms_or_length_are_rejected() -> None:
    edits = [
        {"block_id": "p1", "category": "fluency", "translation": BETTER.replace("{{fn:3}}", ""), "changes": "丢了脚注"},
        {"block_id": "p1", "category": "fluency", "translation": BETTER.replace("TSA", "运输安全管理局"), "changes": "改了保留原文的专名"},
        {"block_id": "p1", "category": "fluency", "translation": "她没再看。{{fn:3}}", "changes": "删了一半"},
        {"block_id": "nope", "category": "fluency", "translation": "x", "changes": ""},
        {"block_id": "p1", "category": "meaning", "translation": DRAFT, "changes": "没改"},
    ]
    _, results, report = _run(*edits)
    verdicts = [t["verdict"] for t in report["rejected"]]
    assert verdicts == ["referee_rejected", "terms_broken", "length_changed", "unknown_block", "no_change"], verdicts
    assert results["p1"].translation == DRAFT


def test_only_the_first_rewrite_of_a_block_counts() -> None:
    edit = {"block_id": "p1", "category": "fluency", "translation": BETTER, "changes": "c"}
    _, results, report = _run(edit, dict(edit, translation=BETTER.replace("觉得", "认为")))
    assert [t["verdict"] for t in report["rejected"]] == ["duplicate_block"]
    assert results["p1"].translation == BETTER


def test_a_rewrite_that_adds_words_the_source_does_not_have_is_rejected() -> None:
    """2026-11-18 实测：编辑把 not my proudest moment 改成"那大概是……最不光彩的时刻"、顺手加了"其实""说实话"。"""
    from retainpdf_translation_agent.rewrite import added_words

    source = "The day the police detained my student was not my proudest moment as an educator."
    draft = "警察拘留我学生的那天，并不是我作为教育者最引以为豪的时刻。"
    assert added_words(source, draft, "说实话，警察拘留我学生的那天，并不是我执教以来最光彩的时刻。") == ["说实话"]
    assert added_words(source, draft, "那大概是我执教生涯中最不光彩的时刻之一。") == ["大概"]
    # 原文有对应的英文就不算添
    assert added_words("he understood, it seemed, that the risk was low", "看来他明白风险很低", "看来他大概明白风险很低") == []
    _, results, report = _run({"block_id": "p1", "category": "fluency", "translation": "说实话，" + BETTER, "changes": "加了口气"})
    assert report["rejected"][0]["verdict"] == "added_words" and results["p1"].translation == DRAFT


def test_translationese_signals_flag_the_patterns_and_reach_the_editor() -> None:
    from retainpdf_translation_agent.translationese import translationese_signals

    def codes(text: str) -> list[str]:
        return [x["code"] for x in translationese_signals(text)]

    assert codes("他最先联系的那位法医同样设置了阻碍，他同样不肯回答。") == ["empty_verb", "repeat_similarly"]
    assert codes("他联系的第一位法医就表现出阻碍态度。") == ["attitude"]
    assert codes("通过不再继续观看，她觉得自己做了正确的事。") == ["tongguo_head"]
    assert codes("根据环境不同，阻碍的具体风味会有所不同。") == ["flavor"]
    assert codes("他联系的第一位法医就百般阻挠。") == [], "natural Chinese is not flagged"
    model, _, _ = _run()
    sent = json.loads(model.bodies[0]["messages"][0]["content"])["blocks"][0]
    assert list(sent)[:3] == ["id", "class", "translation"] and "suspects" in sent, "Chinese first, with the flagged spans"

"""意思闸门（2026-11-20）：程序对照原文给段打可疑标记（推测、否定、句子、数字的个数对不上，译文偏短），译者附「@@ 拿不准」，
随段交给审校当提示；`review_page(only=…)` 可以只审这些段。假模型。"""

from __future__ import annotations

import json

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.checks import meaning_flags
from retainpdf_translation_agent.checks import short_outliers
from retainpdf_translation_agent.review import review_page
from retainpdf_translation_agent.section import Paragraph
from retainpdf_translation_agent.section import section_flags
from retainpdf_translation_agent.section import split_tail

SOURCE = "Perhaps he did not know. He never asked anyone. It was 1956. She left the next morning."


def test_meaning_flags_count_doubts_negations_sentences_and_numbers() -> None:
    assert meaning_flags(SOURCE, "或许他并不知道。他从不问人。那是1956年。第二天早上她走了。") == []
    flags = meaning_flags(SOURCE, "他知道，也从不问人，那是1963年。")
    assert len(flags) == 4, flags
    assert "推测" in flags[0] and "否定" in flags[1] and "4 句" in flags[2] and "1956" in flags[3]
    assert meaning_flags(SOURCE, "Perhaps he did not know.") == [], "没有中文的（保留原文）不标"


def test_paragraphs_much_shorter_than_the_rest_of_the_section_are_flagged() -> None:
    long_source = "word " * 40
    pairs = [(f"p{i}", long_source, "中" * 70) for i in range(5)] + [("short", long_source, "中" * 30)]
    flagged = short_outliers(pairs)
    assert list(flagged) == ["short"] and "可能漏了句子" in flagged["short"]
    assert short_outliers(pairs[:3]) == {}, "段太少不比"


def test_translator_doubts_are_parsed_and_joined_with_program_flags() -> None:
    _, tail = split_tail("¶1 一。\n\n¶2 二。\n@@ 拿不准\n¶2：sorry 是惋惜还是道歉拿不准\n- ¶9 不存在的段\n@@ 梗概\n一句话。")
    assert tail.doubts == {2: "sorry 是惋惜还是道歉拿不准", 9: "不存在的段"} and tail.summary == "一句话。"
    paragraphs = [Paragraph(1, BlockInput("a", "paragraph", SOURCE, True), "paragraph", SOURCE), Paragraph(2, BlockInput("b", "paragraph", "I was sorry to leave.", True), "paragraph", "")]
    results = {"a": BlockResult("a", "他知道。", [], 1, "ok"), "b": BlockResult("b", "我很抱歉离开。", [], 1, "ok")}
    flags = section_flags(paragraphs, results, [tail])
    assert set(flags) == {"a", "b"} and flags["b"] == ["译者没把握：sorry 是惋惜还是道歉拿不准"]


class Model:
    def __init__(self) -> None:
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        return {"content": [{"type": "tool_use", "name": "submit_review", "input": {"issues": []}}], "usage": {"input_tokens": 10, "output_tokens": 5}}


def _page() -> tuple[PageInput, dict[str, BlockResult]]:
    blocks = [BlockInput("a", "paragraph", SOURCE, True), BlockInput("b", "paragraph", "The archive was finally opened to the public after many years.", True)]
    results = {"a": BlockResult("a", "他知道。", [], 1, "ok"), "b": BlockResult("b", "多年以后，档案终于向公众开放。", [], 1, "ok")}
    return PageInput(page_label="1", blocks=blocks), results


def test_hints_ride_along_and_only_narrows_the_review() -> None:
    page, results = _page()
    model = Model()
    report = review_page(TranslationAgent(model="fake", transport=model), page, results, accuracy_only=True, hints={"a": ["原文有推测"]})
    sent = json.loads(model.bodies[0]["messages"][0]["content"])["blocks"]
    assert [b["id"] for b in sent] == ["a", "b"] and sent[0]["flags"] == ["原文有推测"] and "flags" not in sent[1]
    assert report["reviewed"] == 2

    model = Model()
    report = review_page(TranslationAgent(model="fake", transport=model), page, results, accuracy_only=True, only={"a": ["原文有推测"]})
    assert [b["id"] for b in json.loads(model.bodies[0]["messages"][0]["content"])["blocks"]] == ["a"] and report["flagged"] == ["a"]

    model = Model()
    report = review_page(TranslationAgent(model="fake", transport=model), page, results, accuracy_only=True, only={})
    assert model.bodies == [] and report["reviewed"] == 0, "没有可疑段就不发请求"

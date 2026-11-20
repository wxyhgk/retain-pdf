"""按节翻跨节的记忆（2026-11-20）：译者附的「@@ 新词」「@@ 梗概」，核实后记进术语表、攒成本章梗概，后面的节照用；
缩写也记「前文已出现」，第一次写「中文全称（缩写）」。以前整本书只有开头通读那一次定术语，AGVA 三节三种译法，
TSA 写成「TSA（Transportation Security Administration）」。假模型。"""

from __future__ import annotations

import json
import re
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.memory import ABBR
from retainpdf_translation_agent.memory import APPROVED
from retainpdf_translation_agent.memory import CANDIDATE
from retainpdf_translation_agent.memory import NAME
from retainpdf_translation_agent.memory import Glossary
from retainpdf_translation_agent.section import SECTION_NARRATIVE_PROMPT
from retainpdf_translation_agent.section import relevant_terms
from retainpdf_translation_agent.section import split_tail
from retainpdf_translation_agent.section import term_kind
from retainpdf_translation_agent.section import translate_section

FILLER = " ".join(["The researchers waited for many long months before anyone answered their letters."] * 120)


def test_the_tail_is_split_off_before_the_paragraphs() -> None:
    body, tail = split_tail(
        "¶1 第一段。\n\n¶2 第二段。\n@@ 新词\nTSA | 运输安全管理局\n- Marie Keenan | 玛丽·基南\n乱写一行\n@@ 梗概：作者讲述被拒之门外的经历。"
    )
    assert body.strip() == "¶1 第一段。\n\n¶2 第二段。"
    assert tail.terms == [("TSA", "运输安全管理局"), ("Marie Keenan", "玛丽·基南")]
    assert tail.summary == "作者讲述被拒之门外的经历。"
    assert split_tail("¶1 只有正文。") == ("¶1 只有正文。", split_tail("")[1])
    assert term_kind("TSA", "运输安全管理局") == ABBR
    assert term_kind("Marie Keenan", "玛丽·基南") == NAME and term_kind("Jean de La Fontaine", "拉封丹") == NAME
    assert term_kind("foot in the door", "登门槛效应") == "term"
    assert term_kind("TSA", "TSA") is None, "译法里没有中文的不要"


def test_abbreviations_get_their_chinese_full_name_and_are_marked_once_seen() -> None:
    glossary = Glossary()
    glossary.add("TSA", "TSA", category=ABBR, status=APPROVED, reason="test")
    glossary.terms[next(iter(glossary.terms))].note = "Transportation Security Administration"
    text = "The TSA screened everyone."
    [line] = relevant_terms(glossary, text, seen_names=set())
    assert line == "- TSA：Transportation Security Administration 的缩写；第一次写「中文全称（TSA）」，全称译成中文，之后只写 TSA"
    assert glossary.learn_abbreviation("TSA", "运输安全管理局", page="16", block_id="p016-b000") == "set"
    assert glossary.learn_abbreviation("TSA", "运输安全局", page="45", block_id="p045-b000") == "kept", "第一个为准"
    assert relevant_terms(glossary, text, seen_names=set()) == ["- TSA：第一次写「运输安全管理局（TSA）」，之后只写 TSA"]
    assert relevant_terms(glossary, text, seen_names={"TSA"}) == ["- TSA（前文已出现，只写 TSA）"]


class Model:
    """按节翻：每段交「译：原文」；第一节附上新词和梗概（其中一条译文里没用上、一条原文里没有，都不该记）。审校交 `tickets`。"""

    def __init__(self, tickets: list[dict] | None = None) -> None:
        self.bodies: list[dict] = []
        self.tickets = tickets or []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        usage = {"input_tokens": 10, "output_tokens": 5}
        tools = [t["name"] for t in body.get("tools") or []]
        if tools == ["submit_review"]:
            return {"content": [{"type": "tool_use", "name": "submit_review", "input": {"issues": self.tickets}}], "usage": usage}
        if tools:
            answer = {"genre": "humanities", "name_policy": "transliterate", "style": "", "terms": [], "headings": []}
            return {"content": [{"type": "tool_use", "name": tools[0], "input": answer}], "usage": usage}
        assert body["system"][0]["text"].startswith(SECTION_NARRATIVE_PROMPT[:20])
        manuscript = body["messages"][0]["content"].split("下面是这一节的原稿：")[-1]
        out = []
        for n, source in re.findall(r"^¶(\d+)(?:（[^）]*）)? (.*)$", manuscript, re.M):
            text = source.replace("TSA", "运输安全管理局（TSA）" if "TSA screened" in source else "TSA").replace("Keenan", "基南")
            out.append(f"¶{n} 译：{text}。")
        answer = "\n\n".join(out)
        if "visiting researcher" in manuscript:
            answer += "\n@@ 拿不准\n¶1 人名译法拿不准"
        if "TSA screened" in manuscript:
            answer += "\n@@ 新词\nTSA | 运输安全管理局\nKeenan | 基南\nMorrill | 莫里尔\nAGVA | 美国综艺艺人工会\n@@ 梗概\n作者在机场安检处碰壁。"
        return {"content": [{"type": "text", "text": answer}], "usage": usage}


def _page(label: str, chapter: str, *texts: str) -> PageInput:
    """以 "## " 开头的是小节标题（新的一节从这里开始）。"""
    blocks = [
        BlockInput(f"p{label}-{i}", "section_heading", t[3:], True) if t.startswith("## ") else BlockInput(f"p{label}-{i}", "paragraph", t, True)
        for i, t in enumerate(texts)
    ]
    return PageInput(page_label=label, chapter=chapter, blocks=blocks)


def test_what_one_section_learns_reaches_the_next(tmp_path: Path) -> None:
    pages = [
        _page("1", "第二章", "The TSA screened everyone, Keenan noted. " + FILLER),
        _page("2", "第二章", "## Back at the Airport", "Later the TSA and Keenan came back. " + FILLER),
    ]
    model = Model()
    run = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, read_first=True, structure="section")
    outcome = run.run(pages)
    assert outcome.status == "done"
    sections = [b for b in model.bodies if not b.get("tools")]
    assert len(sections) == 2, "两页各一节"

    glossary = Glossary.from_dict(json.loads((tmp_path / "glossary.json").read_text(encoding="utf-8")))
    by_source = {t.source: t for t in glossary.terms.values()}
    assert by_source["TSA"].category == ABBR and by_source["TSA"].zh_full == "运输安全管理局"
    assert by_source["Keenan"].category == NAME and by_source["Keenan"].target == "基南" and by_source["Keenan"].status == CANDIDATE
    assert "Morrill" not in by_source, "原文里没有的不记"
    assert "AGVA" not in by_source, "原文里没有的缩写也不记"

    second = sections[1]["messages"][0]["content"]
    assert "- TSA（前文已出现，只写 TSA）" in second
    assert "- Keenan → 基南（前文已出现）" in second
    assert "本章前面各节讲了（只作上下文）：\n- 作者在机场安检处碰壁。" in second
    info = json.loads((tmp_path / "pages" / "0000.json").read_text(encoding="utf-8"))["info"]
    assert info["summary"] == "作者在机场安检处碰壁。" and info["learned"]["abbreviations"] == 1 and info["learned"]["proposed"] == 1

    # 续跑：第一节读回，梗概照样传给第二节
    (tmp_path / "pages" / "0001.json").unlink()
    progress = json.loads((tmp_path / "progress.json").read_text(encoding="utf-8"))
    progress["pages_done"] = ["0000"]
    (tmp_path / "progress.json").write_text(json.dumps(progress), encoding="utf-8")
    again = Model()
    DocumentRun(TranslationAgent(model="fake", transport=again), tmp_path, read_first=True, structure="section").run(pages)
    resumed = [b for b in again.bodies if not b.get("tools")]
    assert len(resumed) == 1 and "- 作者在机场安检处碰壁。" in resumed[0]["messages"][0]["content"]


def test_reviewer_fixes_to_short_names_are_remembered() -> None:
    page = _page("1", "", "In the end Keenan agreed to talk with the visiting researcher about it.")
    ticket = {
        "block_id": "p1-0",
        "category": "number_term",
        "source_quote": "Keenan",
        "translation_quote": "基南",
        "reason": "人名译法和前文不一致",
        "must_fix": True,
        "fix": "基南恩",
    }
    glossary = Glossary()
    outcome = translate_section(TranslationAgent(model="fake", transport=Model([ticket])), [page], glossary, review=True)
    assert outcome.info["review"]["applied"] and outcome.info["learned"]["from_review"] == 1
    assert [(t.source, t.target, t.category) for t in glossary.terms.values()] == [("Keenan", "基南恩", NAME)]

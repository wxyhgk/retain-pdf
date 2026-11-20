"""按节翻译（第二版，2026-11-19）：分节、稿子、段号对回、占位还原、重交、退回第一版、调度按页记断点。全部用假模型。"""

from __future__ import annotations

import json
import re
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.agent import format_answer
from retainpdf_translation_agent.memory import APPROVED
from retainpdf_translation_agent.memory import NAME
from retainpdf_translation_agent.memory import Glossary
from retainpdf_translation_agent.section import SECTION_NARRATIVE_PROMPT
from retainpdf_translation_agent.section import build_manuscript
from retainpdf_translation_agent.section import combine_pages
from retainpdf_translation_agent.section import parse_section
from retainpdf_translation_agent.section import parse_section_notes
from retainpdf_translation_agent.section import plan_sections
from retainpdf_translation_agent.section import quoted_phrases
from retainpdf_translation_agent.section import translate_section
from retainpdf_translation_agent.units import merge_groups

WORDS = "word " * 300


def _page(label: str, *blocks: BlockInput) -> PageInput:
    return PageInput(page_label=label, blocks=list(blocks), document={"title": "The Interloper"})


def _block(block_id: str, text: str, cls: str = "paragraph", group: dict | None = None, translate: bool = True) -> BlockInput:
    return BlockInput(block_id, cls, text, translate, group=group)


def _book() -> list[PageInput]:
    """三页：第一页一段跨到第二页（接续组），第二页有公式、行内代码和脚注标记，第三页一段。"""
    return [
        _page("12", _block("p12-h", "Introduction", cls="heading"), _block("p12-a", '"CATCH," he called out. Paul Rabinow waited'),
              _block("p12-b", "and the door", group={"id": "g1", "index": 1, "of": 2}), _block("p12-f", "12", cls="footer", translate=False)),
        _page("13", _block("p13-a", "finally opened.{{fn:3}}", group={"id": "g1", "index": 2, "of": 2}),
              _block("p13-b", "The cost was $x^2$ dollars, see `--json`.")),
        _page("14", _block("p14-a", "Rabinow left the village after many long months of waiting there.")),
    ]


class Model:
    """按请求认角色：按节翻（系统提示是 SECTION_NARRATIVE_PROMPT）把稿子每段照编号交回「译：原文」，公式占位、标记照留；
    第一版逐块翻（纯文本交卷）按 required_ids 交回；通读交给定体裁。`drop`：第几次按节请求时不交哪些段；`lose`：丢掉哪段的占位。"""

    def __init__(self, *, genre: str = "humanities", drop: dict[int, set[int]] | None = None, lose: dict[int, set[int]] | None = None, tickets: list[dict] | None = None) -> None:
        self.genre, self.drop, self.lose, self.tickets = genre, drop or {}, lose or {}, tickets or []
        self.bodies: list[dict] = []
        self.section_calls = 0

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        usage = {"input_tokens": 10, "output_tokens": 5}
        tools = [t["name"] for t in body.get("tools") or []]
        if tools == ["submit_review"]:
            return {"content": [{"type": "tool_use", "name": "submit_review", "input": {"issues": self.tickets}}], "usage": usage}
        if tools:
            answer = {"genre": self.genre, "name_policy": "transliterate", "style": "", "terms": [], "headings": []}
            return {"content": [{"type": "tool_use", "name": tools[0], "input": answer}], "usage": usage}
        system = body["system"][0]["text"]
        if system.startswith(SECTION_NARRATIVE_PROMPT[:20]):
            self.section_calls += 1
            text = body["messages"][-1]["content"]
            if isinstance(text, list):
                text = "".join(part.get("text", "") for part in text)
            manuscript = body["messages"][0]["content"]
            paragraphs = dict((int(n), body_text) for n, body_text in re.findall(r"^¶(\d+)(?:（[^）]*）)? (.*)$", manuscript, re.M))
            if self.section_calls > 1:
                wanted = {int(n) for n in re.findall(r"¶(\d+)：", text)}
                paragraphs = {n: t for n, t in paragraphs.items() if n in wanted}
            out = []
            for n, source in paragraphs.items():
                if n in self.drop.get(self.section_calls, set()):
                    continue
                translated = "译：" + source
                if n in self.lose.get(self.section_calls, set()):
                    translated = re.sub(r"⟦F\d+⟧", "", translated)
                out.append(f"¶{n} {translated}")
            # 第一遍附一条「拿不准」：审校只看带可疑标记的段（意思闸门），没有标记就不审
            doubt = ("\n@@ 拿不准\n" + "\n".join(f"¶{n} 测试用" for n in paragraphs)) if self.section_calls == 1 else ""
            return {"content": [{"type": "text", "text": "\n\n".join(out) + doubt}], "usage": usage}
        payload = json.loads(body["messages"][0]["content"])
        ids = payload.get("required_ids") or []
        records = {r["id"]: r for r in payload.get("blocks") or []}
        return {"content": [{"type": "text", "text": format_answer({i: "逐块：" + records.get(i, {}).get("text", "") for i in ids})}], "usage": usage}


def test_sections_end_at_page_breaks_by_size_or_heading_and_never_inside_a_paragraph() -> None:
    long_page = lambda label, heading=False, group=None: _page(  # noqa: E731
        label, *([_block(f"{label}-h", "Chapter", cls="heading")] if heading else []), _block(f"{label}-a", WORDS, group=group)
    )
    pages = [long_page("1"), long_page("2"), long_page("3", heading=True), long_page("4"), long_page("5"), long_page("6"), long_page("7"), long_page("8"), long_page("9"), long_page("10")]
    sections = plan_sections(pages, max_words=1500, min_words=600)
    assert sections[0] == (0, 2), "第 3 页以标题开头、前面已经 600 词：断开"
    assert all(end > start for start, end in sections) and sections[-1][1] == 10
    assert (2, 7) in sections, "攒到 1500 词就断"
    spanning = [long_page("1"), long_page("2", group={"id": "g", "index": 1, "of": 2}), long_page("3", heading=True, group={"id": "g", "index": 2, "of": 2})]
    assert plan_sections(spanning, max_words=300, min_words=100) == [(0, 1), (1, 3)], "一段话跨页处不断"


def test_the_manuscript_joins_paragraphs_across_pages_and_protects_formulas() -> None:
    pages = _book()
    pages[0].blocks[0] = BlockInput("p12-h", "heading", "Introduction", True, fixed_translation="导论")
    units, groups = merge_groups(combine_pages(pages))
    paragraphs, manuscript = build_manuscript(units)
    assert [p.unit.id for p in paragraphs] == ["p12-a", "g1", "p13-b", "p14-a"]
    assert "§ Introduction → 导论" in manuscript and "¶2 and the door finally opened.{{fn:3}}" in manuscript
    assert "¶3 The cost was ⟦F1⟧ dollars, see ⟦C1⟧." in manuscript
    assert paragraphs[2].placeholders == {"F1": "$x^2$", "C1": "`--json`"}
    assert "12" not in [p.text for p in paragraphs], "页脚不进稿子"
    assert parse_section("¶1 一\n\n¶2（标题） 二\n二续\n¶2 重复") == {1: "一", 2: "重复"}, "同一编号写了两次，以最后一次为准"


def test_a_section_is_translated_in_one_request_and_split_back_to_blocks() -> None:
    glossary = Glossary()
    glossary.add("Paul Rabinow", "保罗·拉比诺", category=NAME, status=APPROVED, reason="test")
    model = Model()
    agent = TranslationAgent(model="fake", transport=model)
    outcome = translate_section(agent, _book(), glossary, title="The Interloper", style="第一人称", seen_names={"Paul Rabinow"})
    assert model.section_calls == 1 and len(model.bodies) == 1
    request = model.bodies[0]["messages"][0]["content"]
    assert "Paul Rabinow → 保罗·拉比诺（前文已出现）" in request
    results = outcome.results
    assert results["p13-b"].translation == "译：The cost was $x^2$ dollars, see `--json`.", "占位换回原文写法"
    assert results["p12-b"].translation and results["p13-a"].translation, "接续组切回两块"
    assert (results["p12-b"].translation + results["p13-a"].translation).endswith("{{fn:3}}")
    assert results["p12-b"].meta["unit_id"] == "g1" and results["p12-a"].meta["structure"] == "section"
    assert results["p12-h"].translation == "译：Introduction"
    assert "p12-f" not in results
    assert outcome.info["paragraphs"] == 5 and outcome.info["fallback"] == []


def test_missing_or_broken_paragraphs_are_asked_again_then_fall_back_to_block_translation() -> None:
    # 第一次漏了 ¶2、丢了 ¶4 的公式占位；第二次补上
    model = Model(drop={1: {2}}, lose={1: {4}})
    outcome = translate_section(TranslationAgent(model="fake", transport=model), _book(), Glossary())
    assert model.section_calls == 2
    retry = model.bodies[1]["messages"][-1]["content"]
    assert "¶2：" in retry and "¶4：" in retry and "¶1：" not in retry
    assert outcome.results["p13-b"].translation.startswith("译：") and "$x^2$" in outcome.results["p13-b"].translation
    assert outcome.info["attempts"] == 2 and outcome.info["fallback"] == []

    # 两次都没交 ¶5：退回第一版逐块翻这一段
    stubborn = Model(drop={1: {5}, 2: {5}})
    outcome = translate_section(TranslationAgent(model="fake", transport=stubborn), _book(), Glossary())
    assert outcome.info["fallback"] == ["p14-a"]
    assert outcome.results["p14-a"].translation == "逐块：Rabinow left the village after many long months of waiting there."
    assert outcome.results["p14-a"].meta["structure"] == "section_fallback"


def test_document_run_translates_narrative_books_by_section_and_keeps_page_checkpoints(tmp_path: Path) -> None:
    model = Model()
    seen_pages: list[str] = []
    run = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path / "s", read_first=True, review=True, structure="section")
    outcome = run.run(_book(), on_page=lambda index, page, results: seen_pages.append(page.page_label))
    assert outcome.status == "done" and seen_pages == ["12", "13", "14"]
    assert model.section_calls == 1, "三页一节，一次请求"
    assert [b["tools"][0]["name"] for b in model.bodies if b.get("tools")][-1:] == ["submit_review"], "整节审一次意思"
    assert len(model.bodies) == 3, "通读、按节翻、审意思各一次；不做文笔那一轮"
    assert sorted(p.name for p in (tmp_path / "s" / "pages").iterdir()) == ["0000.json", "0001.json", "0002.json"]
    events = [json.loads(line)["type"] for line in (tmp_path / "s" / "events.jsonl").read_text(encoding="utf-8").splitlines()]
    assert events.count("page_started") == 3 and events.count("page_done") == 3 and "translate_call" in events
    assert events.count("review_started") == 1 and events.count("review_done") == 1

    # 续跑：做过的页直接读回，不再请求
    again = Model()
    rerun = DocumentRun(TranslationAgent(model="fake", transport=again), tmp_path / "s", read_first=True, structure="section").run(_book())
    assert again.section_calls == 0 and rerun.results["p13-b"].translation == outcome.results["p13-b"].translation

    # 论文照旧逐页
    science = Model(genre="science_paper")
    DocumentRun(TranslationAgent(model="fake", transport=science), tmp_path / "p", read_first=True, structure="section").run(_book())
    assert science.section_calls == 0 and len(science.bodies) >= 3


def test_a_section_is_reviewed_once_for_meaning_only() -> None:
    """按节审意思（2026-11-19）：整节一次，收意思类的单子改到对应的块（接续组切回前改），文笔单子不收。"""
    tickets = [
        {"block_id": "p14-a", "category": "mistranslation", "source_quote": "left the village", "translation_quote": "译：Rabinow left the village after many long months of waiting there.", "fix": "拉比诺等了好几个月，离开了村子。", "reason": "没译"},
        {"block_id": "p12-a", "category": "fluency", "source_quote": "called out", "translation_quote": "译：", "fix": "", "reason": "文笔"},
    ]
    model = Model(tickets=tickets)
    outcome = translate_section(TranslationAgent(model="fake", transport=model), _book(), Glossary(), review=True)
    assert [b["tools"][0]["name"] for b in model.bodies if b.get("tools")] == ["submit_review"]
    assert model.bodies[-1]["system"][0]["text"].count("这一轮只管意思") == 1
    assert outcome.results["p14-a"].translation == "拉比诺等了好几个月，离开了村子。"
    assert outcome.results["p12-a"].translation.startswith("译：")
    report = outcome.info["review"]
    assert len(report["applied"]) == 1 and [r["verdict"] for r in report["rejected"]] == ["not_accuracy"]


def test_a_self_correction_and_echoed_heading_lines_are_dropped() -> None:
    """2026-11-19 实例（《The Interloper》第二章开头，Haiku）：模型先交「第二章」，接着抄了 § 行、写了一句英文更正，再用同一编号重交。
    以前留第一次，说明和 § 行都进了 CHAPTER TWO 那一块；现在以最后一次为准，§ 行和没有汉字的英文说明去掉、记警告。"""
    answer = (
        "¶10 于是，从前的闯入者如今反倒成了监视入侵的人。\n\n"
        "¶11 第二章\n\n§ 隐匿于视线之外 → 第二章 隐匿于视线之外\n\n"
        "Wait — the heading of ¶11 is a chapter title and should be output as the chapter heading, not as a paragraph line. Correcting the output:\n\n"
        "¶11 第二章\n\n"
        "¶12 有一天，大都会机场的州警察短暂扣留了我的一名研究生。\n"
        "Note: the following paragraph keeps the original footnote marker as requested.\n"
    )
    found, notes = parse_section_notes(answer)
    assert found == {10: "于是，从前的闯入者如今反倒成了监视入侵的人。", 11: "第二章", 12: "有一天，大都会机场的州警察短暂扣留了我的一名研究生。"}
    assert notes[11] == [] and notes[12] == ["Note: the following paragraph keeps the original footnote marker as requested."]
    first, first_notes = parse_section_notes("¶11 第二章\n\n§ 隐匿于视线之外 → 第二章 隐匿于视线之外\n\nWait — the heading of ¶11 is a chapter title. Correcting the output:")
    assert first == {11: "第二章"} and len(first_notes[11]) == 1, "§ 行静默去掉，只记英文说明"
    assert parse_section("¶3 他说：“OK, let's go.” 然后走了。") == {3: "他说：“OK, let's go.” 然后走了。"}, "有汉字的行不动"
    assert parse_section("¶4 The Interloper") == {4: "The Interloper"}, "英文词不到 5 个的不当说明（书名、缩写）"


def test_dropped_notes_are_recorded_as_warnings_on_the_block() -> None:
    class Noisy(Model):
        def __call__(self, body: dict) -> dict:
            response = super().__call__(body)
            if body["system"][0]["text"].startswith(SECTION_NARRATIVE_PROMPT[:20]):
                text = response["content"][0]["text"].replace("¶5 ", "¶5 Wait, I should double check this paragraph before answering it.\n", 1)
                response = {**response, "content": [{"type": "text", "text": text}]}
            return response

    outcome = translate_section(TranslationAgent(model="fake", transport=Noisy()), _book(), Glossary())
    result = outcome.results["p14-a"]
    assert not result.translation.startswith("Wait") and result.status == "warn"
    assert "model_note_dropped" in [i["code"] for i in result.issues]


def test_chapter_labels_are_translated_by_the_program_not_the_model() -> None:
    from retainpdf_translation_agent.section import chapter_label

    cases = {
        "CHAPTER TWO": "第二章", "Chapter 2": "第二章", "CHAPTER II": "第二章", "Chapter Twenty-One": "第二十一章",
        "PART ONE": "第一部分", "Part IV": "第四部分", "BOOK 3": "第三卷", "Chapter 10.": "第十章", "chapter twelve": "第十二章",
    }
    for text, expected in cases.items():
        assert chapter_label(text) == expected, text
    for text in ("CHAPTER TWO Hiding from View", "Chapter", "Part of the problem", "CHAPTER ONE TWO", "Introduction"):
        assert chapter_label(text) is None, text

    pages = [_page("46", _block("p46-a", "CHAPTER TWO", cls="paragraph"), BlockInput("p46-b", "heading", "Hiding from View", True, fixed_translation="第二章 隐匿于视线之外"),
                   _block("p46-c", "The day the State Police detained one of my students was not my proudest moment."))]
    model = Model()
    outcome = translate_section(TranslationAgent(model="fake", transport=model), pages, Glossary())
    manuscript = model.bodies[0]["messages"][0]["content"]
    assert "§ CHAPTER TWO → 第二章" in manuscript and "§ Hiding from View → 隐匿于视线之外" in manuscript and "¶1 The day" in manuscript, "章号块不进稿子，只作上下文"
    assert outcome.results["p46-a"].translation == "第二章"
    assert outcome.results["p46-b"].translation == "隐匿于视线之外", "章名的已定译文去掉重复的章号"


def test_quoted_phrases_are_listed_for_the_translator_to_check_for_terms_of_art() -> None:
    """11-20：foot in the door / door in the face 按字面译成"一只脚踏进门""门被甩在脸上"。引号里的短说法由程序挑出来单列，让模型逐个判断是不是学科术语。"""
    text = (
        'Whether "the fate" of a project lies with a gatekeeper or in alternating between a "foot in the door" and '
        '“door in the face” strategy; titles such as "The Social Psychology of Access in Ethnographic Research", "Dirty Work", "no", '
        'and again "Foot in the door".'
    )
    assert quoted_phrases(text) == ["the fate", "foot in the door", "door in the face"], "一个词的、每个词都大写开头的（书名）、太长的不算；不分大小写去重"

    pages = [_page("14", _block("p14-a", text))]
    model = Model()
    translate_section(TranslationAgent(model="fake", transport=model), pages, Glossary(), title="The Interloper", style="")
    request = model.bodies[0]["messages"][0]["content"]
    assert "原稿里加了引号的说法" in request and "- foot in the door\n- door in the face" in request
    assert "原稿里加了引号的说法" not in _section_request_without_quotes()


def _section_request_without_quotes() -> str:
    model = Model()
    translate_section(TranslationAgent(model="fake", transport=model), _book()[2:], Glossary(), title="The Interloper", style="")
    return model.bodies[0]["messages"][0]["content"]


def test_term_of_art_rule_is_in_the_translator_and_reviewer_prompts() -> None:
    from retainpdf_translation_agent.agent import NARRATIVE_PROMPT
    from retainpdf_translation_agent.review import ACCURACY_NOTE
    from retainpdf_translation_agent.review import REVIEW_PROMPT

    for prompt in (SECTION_NARRATIVE_PROMPT, NARRATIVE_PROMPT):
        assert "习语和术语分清" in prompt and "译名（原文）" in prompt
    assert "按字面直译了" in REVIEW_PROMPT and "number_term" in ACCURACY_NOTE


def test_the_fallback_translator_gets_the_glossary_style_and_only_nearby_paragraphs() -> None:
    """11-20：退回逐块翻的请求以前把整节的块都塞进去（翻 5 块带 106 块），上下文包却是空的，没有术语、人名、文风。"""
    glossary = Glossary()
    glossary.add("Paul Rabinow", "保罗·拉比诺", category=NAME, status=APPROVED, reason="test")
    many = [_page(str(n), _block(f"p{n}-a", f"Paragraph {n} talks about Paul Rabinow and the long months of waiting there.")) for n in range(1, 11)]
    stubborn = Model(drop={1: {10}, 2: {10}})
    outcome = translate_section(TranslationAgent(model="fake", transport=stubborn), many, glossary, title="The Interloper", style="第一人称，学术随笔")
    assert outcome.info["fallback"] == ["p10-a"]
    payload = json.loads(stubborn.bodies[-1]["messages"][0]["content"])
    assert [b["id"] for b in payload["blocks"]] == ["p8-a", "p9-a", "p10-a"], "只带前后各两段"
    assert payload["required_ids"] == ["p10-a"]
    context = payload["context"]
    assert context["style"] == "第一人称，学术随笔"
    assert any(n.get("source") == "Paul Rabinow" for n in context["names"]), context
    assert [p["id"] for p in context["previous"]] == ["p8-a", "p9-a"] and all(p["translation"].startswith("译：") for p in context["previous"])


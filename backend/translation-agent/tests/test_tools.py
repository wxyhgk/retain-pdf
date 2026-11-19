"""初译的只读工具（2026-11-19）：全书搜原文、查术语表；多轮工具循环、次数上限、交卷后的检查问题接在同一段对话里。
全部用假模型，不发网络请求。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import Glossary
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.agent import CHECK_FEEDBACK
from retainpdf_translation_agent.agent import format_answer
from retainpdf_translation_agent.tools import MAX_HITS
from retainpdf_translation_agent.tools import MAX_TOOL_CALLS
from retainpdf_translation_agent.tools import MAX_TOOL_ROUNDS
from retainpdf_translation_agent.tools import SEARCH_TOOL
from retainpdf_translation_agent.tools import TERM_TOOL
from retainpdf_translation_agent.tools import TOOLS_VERSION
from retainpdf_translation_agent.tools import BookTools

DOC = {"title": "T", "source_lang": "en", "target_lang": "zh-CN"}


def _p(label: str, *blocks: tuple[str, str], chapter: str = "c1") -> PageInput:
    return PageInput(page_label=label, chapter=chapter, document=DOC, blocks=[BlockInput(i, "paragraph", t, True) for i, t in blocks])


def _text(translations: dict[str, str], stop: str = "end_turn") -> dict:
    return {"content": [{"type": "text", "text": format_answer(translations)}], "stop_reason": stop, "usage": {"input_tokens": 100, "output_tokens": 20}}


def _tool_use(*calls: tuple[str, dict]) -> dict:
    content = [{"type": "thinking", "thinking": "查一下", "signature": "sig"}]
    content += [{"type": "tool_use", "id": f"toolu_{i}", "name": name, "input": args} for i, (name, args) in enumerate(calls)]
    return {"content": content, "stop_reason": "tool_use", "usage": {"input_tokens": 100, "output_tokens": 10}}


class Model:
    def __init__(self, *answers) -> None:
        self.answers = list(answers)
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(json.loads(json.dumps(body)))
        return self.answers.pop(0)


BOOK = [
    _p("1", ("a1", "The coroner obstructed the inquiry at every turn."), ("a2", "Nothing else here.")),
    _p("2", ("b1", "She wrote to the coroner again."), ("b2", "The CORONER replied in March.")),
    _p("3", ("c1", "Later, the coroner's report was lost."), chapter="c2"),
]


# ---- 工具本身 ----
def test_search_returns_other_pages_nearest_first_with_translations_already_done() -> None:
    tools = BookTools(BOOK, Glossary())
    tools.record({"a1": BlockResult("a1", "验尸官处处阻挠调查。", [], 1, "ok")})
    tools.current = 1
    found = tools.search("coroner")
    assert found["total"] == 2, "the current page (two hits) is not searched"
    assert [h["block"] for h in found["hits"]] == ["a1", "c1"], "pages 1 and 3 are both one away: book order breaks the tie"
    assert found["hits"][0]["translation"] == "验尸官处处阻挠调查。" and "translation" not in found["hits"][1]
    assert found["hits"][0]["page"] == "1" and "obstructed" in found["hits"][0]["source"]

    assert tools.search("coroners")["total"] == 0, "whole words only"
    assert "error" in tools.search(" a ")


def test_search_in_chinese_looks_at_translations_and_hits_are_capped() -> None:
    pages = [_p(str(i), (f"p{i}", f"Block {i} mentions the inquest.")) for i in range(MAX_HITS + 4)]
    tools = BookTools(pages, Glossary())
    tools.record({f"p{i}": BlockResult(f"p{i}", f"第 {i} 块提到了死因调查。", [], 1, "ok") for i in range(3)})
    tools.current = 5
    found = tools.search("inquest")
    assert found["total"] == MAX_HITS + 3 and len(found["hits"]) == MAX_HITS and "只列" in found["note"]
    assert [h["block"] for h in found["hits"][:3]] == ["p4", "p6", "p3"]

    chinese = tools.search("死因调查")
    assert [h["block"] for h in chinese["hits"]] == ["p2", "p1", "p0"] and chinese["hits"][0]["translation"].startswith("第 2 块")
    assert "已经翻过" in tools.search("设置了阻碍")["note"]


def test_lookup_returns_the_whole_entry_with_tickets_and_falls_back_to_related_terms() -> None:
    glossary = Glossary()
    args = dict(category="term", chapter="c1", quote="the coroner obstructed")
    glossary.propose("coroner", "验尸官", block_id="x1", page="1", **args)
    glossary.propose("coroner", "法医", block_id="x2", page="2", **args)
    tools = BookTools(BOOK, glossary)
    entry = tools.lookup("Coroners")["entries"][0]
    assert entry["target"] == "验尸官" and entry["status"] == "candidate" and entry["votes"] == {"验尸官": 1, "法医": 1}
    assert entry["tickets"][0]["proposed"] == "法医" and entry["first_seen"]["page"] == "1"

    glossary.add("autopsy report", "尸检报告", reason="用户术语表", scope=["c2"], note="正式文书")
    related = tools.lookup("report")
    assert related["note"].startswith("术语表里没有这个词本身")
    assert related["entries"][0] | {"id": ""} == {"id": "", "source": "autopsy report", "target": "尸检报告", "category": "term", "status": "locked", "scope": ["c2"], "note": "正式文书"}
    assert tools.lookup("inquest") == {"source": "inquest", "entries": [], "note": "术语表里没有这个词"}
    assert "error" in tools.run("delete_term", {})


# ---- 多轮循环 ----
def _agent(model: Model, pages=BOOK, glossary=None) -> tuple[TranslationAgent, list]:
    agent = TranslationAgent(transport=model)
    agent.tools = BookTools(pages, glossary or Glossary())
    events: list = []
    agent.on_event = lambda kind, fields: events.append((kind, fields))
    return agent, events


def test_tool_calls_are_run_and_answered_until_the_model_submits() -> None:
    model = Model(_tool_use((SEARCH_TOOL, {"query": "coroner"}), (TERM_TOOL, {"source": "coroner"})), _text({"b1": "她又给验尸官写了信。", "b2": "验尸官三月回了信。"}))
    agent, events = _agent(model)
    agent.tools.current = 1
    results, _ = agent.translate_units(BOOK[1])
    assert results["b1"].translation == "她又给验尸官写了信。" and results["b1"].meta["tools_version"] == TOOLS_VERSION

    first, second = model.bodies
    assert [t["name"] for t in first["tools"]] == [SEARCH_TOOL, TERM_TOOL] and first["tool_choice"] == {"type": "auto"}
    assert all(t["strict"] for t in first["tools"]) and "工具（只读" in first["system"][0]["text"]
    assistant, tool_results = second["messages"][1], second["messages"][2]
    assert assistant["content"][0]["type"] == "thinking", "thinking blocks go back unchanged"
    answers = tool_results["content"]
    assert [a["tool_use_id"] for a in answers] == ["toolu_0", "toolu_1"]
    assert json.loads(answers[0]["content"])["total"] == 2 and "cache_control" in answers[-1]
    assert sum("cache_control" in part for m in second["messages"] for part in (m["content"] if isinstance(m["content"], list) else [])) == 1, "one breakpoint, on the newest message"

    calls = [f for kind, f in events if kind == "tool_call"]
    assert calls == [{"role": "translator", "tool": SEARCH_TOOL, "query": "coroner", "found": 2}, {"role": "translator", "tool": TERM_TOOL, "query": "coroner", "found": 0}]
    assert [kind for kind, _ in events].count("translate_call") == 1, "tool rounds are part of the same call"


def test_the_tool_budget_runs_out_and_the_model_must_submit() -> None:
    many = [(SEARCH_TOOL, {"query": "coroner"})] * 3
    model = Model(*[_tool_use(*many) for _ in range(MAX_TOOL_ROUNDS)], _text({"b1": "她又给验尸官写了信。", "b2": "验尸官三月回了信。"}))
    agent, events = _agent(model)
    agent.tools.current = 1
    agent.translate_units(BOOK[1])
    assert [b["tool_choice"]["type"] for b in model.bodies] == ["auto"] * MAX_TOOL_ROUNDS + ["none"]
    calls = [f for kind, f in events if kind == "tool_call"]
    assert len(calls) == 3 * MAX_TOOL_ROUNDS and sum("error" in c for c in calls) == 3 * MAX_TOOL_ROUNDS - MAX_TOOL_CALLS


def test_check_problems_go_back_into_the_same_conversation() -> None:
    model = Model(_text({"b1": "她又给验尸官写了信。"}), _text({"b2": "验尸官三月回了信。"}))
    agent, events = _agent(model)
    agent.tools.current = 1
    results, _ = agent.translate_units(BOOK[1])
    assert results["b2"].translation == "验尸官三月回了信。" and results["b2"].attempts == 2
    retry = model.bodies[1]["messages"]
    assert [m["role"] for m in retry] == ["user", "assistant", "user"]
    feedback = retry[2]["content"][0]["text"]
    assert feedback.startswith(CHECK_FEEDBACK) and json.loads(feedback[len(CHECK_FEEDBACK) :])["required_ids"] == ["b2"]
    assert ("retry", {"blocks": ["b2"]}) in events


def test_without_tools_the_request_is_unchanged() -> None:
    model = Model(_text({"b1": "她又给验尸官写了信。", "b2": "验尸官三月回了信。"}))
    agent = TranslationAgent(transport=model)
    results, _ = agent.translate_units(BOOK[1])
    body = model.bodies[0]
    assert "tools" not in body and "工具" not in body["system"][0]["text"] and isinstance(body["messages"][0]["content"], str)
    assert "tools_version" not in results["b1"].meta


def test_document_run_gives_later_pages_the_earlier_translations(tmp_path: Path) -> None:
    model = Model(
        _text({"a1": "验尸官处处阻挠调查。", "a2": "这里没有别的。"}),
        _tool_use((SEARCH_TOOL, {"query": "coroner"})),
        _text({"b1": "她又给验尸官写了信。", "b2": "验尸官三月回了信。"}),
        _text({"c1": "后来，验尸报告丢了。"}),
    )
    agent = TranslationAgent(transport=model)
    outcome = DocumentRun(agent, tmp_path / "state", tools=True).run(BOOK)
    assert outcome.status == "done" and agent.tools is None
    hits = json.loads(model.bodies[2]["messages"][2]["content"][0]["content"])["hits"]
    assert hits[0] == {"page": "1", "block": "a1", "class": "paragraph", "source": "The coroner obstructed the inquiry at every turn.", "translation": "验尸官处处阻挠调查。"}
    events = [json.loads(line) for line in (tmp_path / "state" / "events.jsonl").read_text(encoding="utf-8").splitlines()]
    assert [e for e in events if e["type"] == "tool_call"][0]["page"] == 2

"""编辑部事件 `events.jsonl`（editorial.v1）：调度和台账同时写，前端只认这些事件画"编辑部"。

格式和取值全集在 docs/ops/planning/translation-agent/20261030-编辑部可视化和事件格式.md，前端解析器
`frontend/web/src/features/editorial-room/domain/events.ts` 按那份取值。这里钉住类型、字段和先后。假模型。
"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import EDITORIAL_EVENT_VERSION
from retainpdf_translation_agent import EVENTS_FILE
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import QuotaExhausted
from retainpdf_translation_agent import TranslationAgent

from test_memory_and_runner import Model
from test_memory_and_runner import _answer
from test_memory_and_runner import _book
from test_memory_and_runner import _p
from test_review import Model as ReviewModel
from test_review import _page as review_page_input
from test_review import _ticket
from test_review import TRANSLATION

# 格式文档里的全部类型和每种的字段（只加不改：可以多出字段，不能少）
FIELDS = {
    "run_started": {"pages", "model", "doc_title"},
    "reading_started": set(),
    "reading_done": {"genre", "name_policy", "terms", "headings"},
    "page_started": {"page", "label", "blocks"},
    "translate_call": {"page", "attempt", "blocks", "role"},
    "check_result": {"page", "attempt", "ok", "warn", "error", "codes"},
    "retry": {"page", "blocks"},
    "fallback": {"page", "block", "reason"},
    "review_started": {"page", "blocks"},
    "review_done": {"page", "tickets", "applied", "rejected"},
    "glossary_changed": {"version", "action", "source", "target"},
    "ticket_opened": {"term", "current", "proposed", "page"},
    "page_done": {"page", "statuses"},
    "run_stopped": {"reason"},
    "run_done": {"pages", "glossary_version", "tickets"},
}


def _events(state: Path) -> list[dict]:
    events = [json.loads(line) for line in (state / EVENTS_FILE).read_text(encoding="utf-8").splitlines()]
    for event in events:
        assert event["v"] == EDITORIAL_EVENT_VERSION and isinstance(event["ts"], float | int)
        assert event["type"] in FIELDS, event
        missing = FIELDS[event["type"]] - set(event)
        assert not missing, (event, missing)
        if "page" in event:
            assert isinstance(event["page"], int), event
    return events


def test_a_run_reports_every_page_from_start_to_done(tmp_path: Path) -> None:
    terms = [{"block_id": "a1", "source": "bounding box", "target": "边界框", "category": "term"}, {"block_id": "a2", "source": "bounding box", "target": "边界框", "category": "term"}]
    model = Model(
        _answer({"a1": "每个边界框来自光学字符识别（OCR）。", "a2": "边界框可能会重叠。"}, terms),
        _answer({"b1": "我们先做光学字符识别（OCR）。"}),
        _answer({"c1": "图的边界框。"}),
    )
    DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path).run(_book())
    events = _events(tmp_path)
    assert events[0] == dict(events[0], type="run_started", pages=3, model="fake", doc_title="T", resumed=0)
    assert events[-1] == dict(events[-1], type="run_done", pages=3)
    per_page = [(e["type"], e.get("page")) for e in events if e["type"] in ("page_started", "translate_call", "check_result", "page_done")]
    assert per_page == [(t, n) for n in (1, 2, 3) for t in ("page_started", "translate_call", "check_result", "page_done")]
    started = next(e for e in events if e["type"] == "page_started")
    assert started["label"] == "1" and started["blocks"] == 2
    call = next(e for e in events if e["type"] == "translate_call")
    assert call["role"] == "translator" and call["attempt"] == 1 and call["blocks"] == ["a1", "a2"]
    done = next(e for e in events if e["type"] == "page_done")
    assert done["statuses"] == {"ok": 2, "warn": 0, "error": 0, "fallback_source": 0}
    changes = [e for e in events if e["type"] == "glossary_changed"]
    assert {"source": "OCR", "action": "add"}.items() <= changes[0].items(), "the prescan registers the abbreviation before page 1"
    assert any(e["source"] == "bounding box" and e["target"] == "边界框" for e in changes)


def test_a_failed_block_is_retried_then_falls_back_to_the_source(tmp_path: Path) -> None:
    page = _p("7", "", ("b1", "We report [4] on 3 pages."))
    model = Model(_answer({"b1": "我们报告。"}), _answer({"b1": "我们在 3 页上报告。"}))
    DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, memory=False).run([page])
    flow = [(e["type"], e.get("attempt")) for e in _events(tmp_path) if e["type"] in ("translate_call", "check_result", "retry", "fallback", "page_done")]
    assert flow == [("translate_call", 1), ("check_result", 1), ("retry", None), ("translate_call", 2), ("check_result", 2), ("fallback", None), ("page_done", None)]
    events = _events(tmp_path)
    first_check = next(e for e in events if e["type"] == "check_result")
    assert first_check["error"] == 1 and first_check["codes"].get("citation_lost") == 1
    assert next(e for e in events if e["type"] == "retry")["blocks"] == ["b1"]
    fallback = next(e for e in events if e["type"] == "fallback")
    assert fallback == dict(fallback, page=1, block="b1", reason="citation_lost")
    assert events[-2]["statuses"]["fallback_source"] == 1


def test_a_stop_is_reported_and_the_resumed_run_appends_after_it(tmp_path: Path) -> None:
    first = Model(_answer({"a1": "每个边界框来自光学字符识别（OCR）。", "a2": "边界框可能会重叠。"}), QuotaExhausted("credit balance too low"))
    DocumentRun(TranslationAgent(model="fake", transport=first), tmp_path).run(_book())
    assert _events(tmp_path)[-1] == dict(_events(tmp_path)[-1], type="run_stopped", reason="quota_exhausted")

    second = Model(_answer({"b1": "我们先做光学字符识别（OCR）。"}), _answer({"c1": "图的边界框。"}))
    DocumentRun(TranslationAgent(model="fake", transport=second), tmp_path).run(_book())
    events = _events(tmp_path)
    restart = max(i for i, e in enumerate(events) if e["type"] == "run_started")
    assert events[restart]["resumed"] == 1
    assert [e["page"] for e in events[restart:] if e["type"] == "page_started"] == [2, 3], "finished pages are not reported again"
    assert events[-1]["type"] == "run_done"


def test_review_reports_its_calls_and_tickets(tmp_path: Path) -> None:
    model = ReviewModel({"translations": [{"id": "p1", "translation": TRANSLATION}, {"id": "h", "translation": "2.5 失败案例"}]}, {"issues": [_ticket()]})
    DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, review=True).run([review_page_input()])
    events = _events(tmp_path)
    kinds = [e["type"] for e in events]
    assert kinds.index("review_started") < kinds.index("review_done") < kinds.index("page_done")
    review_call = next(e for e in events if e["type"] == "translate_call" and e["role"] == "reviewer")
    assert review_call["page"] == 1 and review_call["blocks"] == ["p1"], "headings are not reviewed"
    assert next(e for e in events if e["type"] == "review_done") == dict(next(e for e in events if e["type"] == "review_done"), tickets=1, applied=1, rejected=0)


def test_an_agent_used_outside_a_run_writes_no_events(tmp_path: Path) -> None:
    model = Model(_answer({"b1": "我们报告 $F_1$。"}))
    agent = TranslationAgent(model="fake", transport=model)
    agent.translate_page(_p("1", "", ("b1", "We report $F_1$.")))
    DocumentRun(agent, tmp_path / "unused")
    assert not (tmp_path / "unused").exists()
    assert agent.on_event is None


def test_reading_comes_first_and_its_calls_are_on_page_zero(tmp_path: Path) -> None:
    from test_reader import READING
    from test_reader import Model as ReaderModel
    from test_reader import _book as reader_book
    from test_reader import _tool

    model = ReaderModel(
        _tool("submit_reading", READING),
        _tool("submit_translations", {"translations": [{"id": "p-1", "translation": "阿格尼丝·佩卢（Agnes Pellew）记了一本账簿。账簿记下每一次借阅，账簿也记着罚金。"}, {"id": "p-2", "translation": "后来阿格尼丝·佩卢用账簿里的钱付了账簿上的罚金。"}]}),
    )
    DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, read_first=True).run(reader_book())
    events = _events(tmp_path)
    kinds = [e["type"] for e in events]
    assert kinds[:2] == ["run_started", "reading_started"] and kinds.index("reading_done") < kinds.index("page_started")
    assert next(e for e in events if e["type"] == "reading_done")["genre"] == "humanities"
    reader_call = next(e for e in events if e["type"] == "translate_call")
    assert reader_call["role"] == "reader" and reader_call["page"] == 0

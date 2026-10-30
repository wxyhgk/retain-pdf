"""翻译前通读：候选词组、术语和人名登记、标题和目录的已定译文、调度先通读再逐页翻。全部用假模型。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import Glossary
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.reader import Reading
from retainpdf_translation_agent.reader import apply_reading
from retainpdf_translation_agent.reader import candidate_phrases

LEDGER_TEXT = "Agnes Pellew kept a ledger. The ledger records every loan, and the ledger shows fines."


def _book() -> list[PageInput]:
    toc = PageInput(
        page_label="i",
        chapter="",
        blocks=[BlockInput("toc-1", "toc_entry", "1 The Ledger", True, relations={"toc_target": "h-1"})],
    )
    body = PageInput(
        page_label="1",
        chapter="h-1",
        blocks=[
            BlockInput("h-1", "section_heading", "1 The Ledger", True, attributes={"level": 1}),
            BlockInput("p-1", "paragraph", LEDGER_TEXT, True),
            BlockInput("p-2", "paragraph", "Later Agnes Pellew paid the ledger fines with the ledger money.", True),
        ],
    )
    return [toc, body]


def _tool(name: str, data: dict) -> dict:
    return {"content": [{"type": "tool_use", "name": name, "input": data}], "usage": {"input_tokens": 50, "output_tokens": 10}}


class Model:
    def __init__(self, *answers: dict) -> None:
        self.answers = list(answers)
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        return self.answers.pop(0)


READING = {
    "genre": "humanities",
    "domain": "图书史",
    "name_policy": "transliterate",
    "style": "作者用第一人称，文学性长句，措辞克制。",
    "terms": [
        {"source": "ledger", "target": "账簿", "category": "term"},
        {"source": "Agnes Pellew", "target": "阿格尼丝·佩卢", "category": "name"},
    ],
    "headings": [{"id": "h-1", "translation": "1 账簿"}, {"id": "toc-1", "translation": "1 那本账簿"}],
}


def test_candidates_are_repeated_phrases_and_names_with_example_sentences() -> None:
    candidates = {c["phrase"]: c for c in candidate_phrases(_book())}
    assert candidates["ledger"]["count"] == 5 and candidates["ledger"]["examples"][0]["text"].startswith("Agnes Pellew kept")
    assert "Agnes Pellew" in candidates
    assert "the" not in candidates and "1 The Ledger" not in candidates, "stop words and headings are not candidates"


def test_reading_registers_terms_and_names_and_fixes_headings_with_the_toc_copying_them() -> None:
    glossary = Glossary()
    reading = Reading(name_policy="transliterate", terms=READING["terms"], headings={"h-1": "1 账簿", "toc-1": "1 那本账簿"})
    pages = apply_reading(reading, glossary, _book())
    assert glossary.find("ledger", "h-1").target == "账簿" and glossary.find("ledger", "h-1").binds("any")
    assert glossary.find("Agnes Pellew", "h-1", category="name").target == "阿格尼丝·佩卢"
    fixed = {b.id: b.fixed_translation for p in pages for b in p.blocks}
    assert fixed["h-1"] == "1 账簿" and fixed["toc-1"] == "1 账簿", "the TOC entry copies its heading word for word"
    assert pages[1].to_translate() == pages[1].blocks[1:] and [b.id for b in pages[1].fixed()] == ["h-1"]


def test_names_are_kept_when_the_policy_is_keep_and_bad_heading_translations_are_not_fixed() -> None:
    glossary = Glossary()
    reading = Reading(name_policy="keep", terms=READING["terms"], headings={"h-1": "账簿"})  # 丢了编号 1
    pages = apply_reading(reading, glossary, _book())
    assert glossary.find("Agnes Pellew", "", category="keep").target == "Agnes Pellew"
    assert all(b.fixed_translation is None for p in pages for b in p.blocks)


def test_document_run_reads_first_then_translates_without_resending_headings(tmp_path: Path) -> None:
    model = Model(
        _tool("submit_reading", READING),
        _tool(
            "submit_translations",
            {
                "translations": [
                    {"id": "p-1", "translation": "阿格尼丝·佩卢（Agnes Pellew）记了一本账簿。账簿记下每一次借阅，账簿也记着罚金。"},
                    {"id": "p-2", "translation": "后来阿格尼丝·佩卢用账簿里的钱付了账簿上的罚金。"},
                ]
            },
        ),
    )
    agent = TranslationAgent(model="fake", transport=model)
    outcome = DocumentRun(agent, tmp_path, read_first=True).run(_book())
    assert outcome.status == "done" and len(model.bodies) == 2, "the TOC page needs no request: its only entry was fixed by the reading"
    assert model.bodies[0]["tools"][0]["name"] == "submit_reading"
    sent = json.loads(model.bodies[1]["messages"][0]["content"])
    assert [b["id"] for b in sent["blocks"] if b["translate"]] == ["p-1", "p-2"]
    assert next(b for b in sent["blocks"] if b["id"] == "h-1")["translation"] == "1 账簿"
    assert "阿格尼丝·佩卢" in json.dumps(sent["context"]["names"], ensure_ascii=False) and sent["context"]["names"][0]["first_use"] is True
    assert sent["context"]["style"].startswith("体裁：humanities")
    assert outcome.results["h-1"].translation == "1 账簿" and outcome.results["toc-1"].translation == "1 账簿"
    assert outcome.results["p-1"].status == "ok" and outcome.results["p-2"].status == "ok"
    assert json.loads((tmp_path / "reading.json").read_text(encoding="utf-8"))["genre"] == "humanities"


def test_the_first_mention_of_a_name_without_the_original_is_only_a_warning(tmp_path: Path) -> None:
    model = Model(
        _tool("submit_reading", READING),
        _tool("submit_translations", {"translations": [{"id": "p-1", "translation": "阿格尼丝·佩卢记了一本账簿。账簿记下每一次借阅，账簿也记着罚金。"}, {"id": "p-2", "translation": "后来阿格尼丝·佩卢用账簿里的钱付了账簿上的罚金。"}]}),
    )
    outcome = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, read_first=True).run(_book())
    first = outcome.results["p-1"]
    assert first.attempts == 1 and first.status == "warn" and first.issues[0]["code"] == "name_first_use"


def test_a_name_translated_differently_is_retried(tmp_path: Path) -> None:
    model = Model(
        _tool("submit_reading", READING),
        _tool("submit_translations", {"translations": [{"id": "p-1", "translation": "阿格尼丝·佩卢（Agnes Pellew）记了一本账簿。账簿记下每一次借阅，账簿也记着罚金。"}, {"id": "p-2", "translation": "后来艾格尼丝·佩勒用账簿里的钱付了账簿上的罚金。"}]}),
        _tool("submit_translations", {"translations": [{"id": "p-2", "translation": "后来阿格尼丝·佩卢用账簿里的钱付了账簿上的罚金。"}]}),
    )
    outcome = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, read_first=True).run(_book())
    second = outcome.results["p-2"]
    assert second.attempts == 2 and second.status == "ok" and second.history[0]["issues"][0]["code"] == "name_mismatch"

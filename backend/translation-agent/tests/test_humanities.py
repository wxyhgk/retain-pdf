"""人文书初译写法（2026-11-19）：章首小型大写由程序还原、人文社科和通俗读物的初译接上写法要求、通读不收日常词。全部用假模型。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import RevisionRequest
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.agent import NARRATIVE_PROMPT
from retainpdf_translation_agent.agent import SYSTEM_PROMPT
from retainpdf_translation_agent.agent import format_answer
from retainpdf_translation_agent.reader import READER_PROMPT
from retainpdf_translation_agent.typography import fix_page_typography
from retainpdf_translation_agent.typography import fix_small_caps_opening

OPENING = '"CATCH," HE CALLED OUT LOUDLY. I was in the rather dark office of the director.'


# ---- 章首小型大写 ----
def test_small_caps_openings_are_restored_to_sentence_case() -> None:
    assert fix_small_caps_opening(OPENING) == '"Catch," he called out loudly. I was in the rather dark office of the director.'
    assert fix_small_caps_opening("“WHEN I ARRIVED, the door was closed for good.") == "“When I arrived, the door was closed for good."
    assert fix_small_caps_opening("IN THE SUMMER OF 2012, I flew to Baltimore to meet him.") == "In the summer of 2012, I flew to Baltimore to meet him."
    assert fix_small_caps_opening("THE FBI ARRIVED at dawn, and the FBI agents left.") == "The FBI arrived at dawn, and the FBI agents left.", "acronyms used again later stay"


def test_headings_single_acronyms_and_all_caps_blocks_are_left_alone() -> None:
    for text in ("INTRODUCTION", "THE BODY TRADE", "DNA samples were taken from every donor.", "The FBI ARRIVED at dawn.", "ON THE ROAD again"):
        assert fix_small_caps_opening(text) == text
    pages = [
        PageInput(
            page_label="1",
            blocks=[
                BlockInput("h", "section_heading", "CHAPTER ONE AND MORE of the same old story here", True),
                BlockInput("p", "paragraph", OPENING, True),
            ],
        ),
        PageInput(page_label="2", blocks=[BlockInput("q", "paragraph", "Nothing to fix here at all.", True)]),
    ]
    fixed = fix_page_typography(pages)
    assert fixed[0].blocks[0].text == pages[0].blocks[0].text and fixed[0].blocks[1].text.startswith('"Catch," he')
    assert fixed[1] is pages[1] and pages[0].blocks[1].text == OPENING, "unchanged pages are reused; the caller's pages are not mutated"


# ---- 初译写法 ----
def _answer(translations: dict[str, str]) -> dict:
    return {"content": [{"type": "text", "text": format_answer(translations)}], "usage": {"input_tokens": 10, "output_tokens": 5}}


class Model:
    def __init__(self, *answers: dict) -> None:
        self.answers = list(answers)
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def _page() -> PageInput:
    return PageInput(page_label="12", blocks=[BlockInput("p1", "paragraph", OPENING, True)])


def test_narrative_books_get_the_writing_rules_for_translating_and_retrying_only() -> None:
    model = Model(_answer({}), _answer({"p1": "“接住！”他大声喊道。我当时在主任那间相当昏暗的办公室里。"}), _answer({"p1": "“接住！”他喊。"}))
    agent = TranslationAgent(model="fake", transport=model)
    agent.narrative = True
    agent.translate_units(_page())
    assert [b["system"][0]["text"] for b in model.bodies] == [SYSTEM_PROMPT + NARRATIVE_PROMPT] * 2, "first try and the retry of the missing block"
    agent.revise(_page(), [RevisionRequest("p1", "“接住！”他大声喊道。", max_chars=8)])
    assert model.bodies[2]["system"][0]["text"] == SYSTEM_PROMPT, "shortening keeps the plain rules (no 'length need not match')"

    plain = Model(_answer({"p1": "“接住！”他大声喊道。我当时在主任那间相当昏暗的办公室里。"}))
    TranslationAgent(model="fake", transport=plain).translate_units(_page())
    assert plain.bodies[0]["system"][0]["text"] == SYSTEM_PROMPT


def _reading(genre: str) -> dict:
    data = {"genre": genre, "domain": "d", "name_policy": "keep", "style": "", "terms": [], "headings": []}
    return {"content": [{"type": "tool_use", "name": "submit_reading", "input": data}], "usage": {"input_tokens": 10, "output_tokens": 5}}


def test_document_run_turns_the_rules_on_from_the_reading_and_fixes_small_caps_first(tmp_path: Path) -> None:
    model = Model(_reading("humanities"), _answer({"p1": "“接住！”他大声喊道。我当时在主任那间相当昏暗的办公室里。"}))
    agent = TranslationAgent(model="fake", transport=model)
    outcome = DocumentRun(agent, tmp_path / "h", read_first=True).run([_page()])
    assert outcome.status == "done" and agent.narrative is False, "switched off again after the run"
    sent = json.loads(model.bodies[1]["messages"][0]["content"])
    assert sent["blocks"][0]["text"].startswith('"Catch," he called out loudly.')
    assert model.bodies[1]["system"][0]["text"].endswith(NARRATIVE_PROMPT)

    science = Model(_reading("science_paper"), _answer({"p1": "“接住！”他大声喊道。我当时在主任那间相当昏暗的办公室里。"}))
    DocumentRun(TranslationAgent(model="fake", transport=science), tmp_path / "s", read_first=True).run([_page()])
    assert science.bodies[1]["system"][0]["text"] == SYSTEM_PROMPT


def test_resumed_narrative_runs_keep_the_rules(tmp_path: Path) -> None:
    pages = [_page(), PageInput(page_label="13", blocks=[BlockInput("p2", "paragraph", "So, I was nervous, and for a good reason.", True)])]
    first = Model(_reading("popular_book"), RuntimeError("network down"))
    try:
        DocumentRun(TranslationAgent(model="fake", transport=first), tmp_path, read_first=True).run(pages)
    except RuntimeError:
        pass
    again = Model(_answer({"p1": "“接住！”他大声喊道。我当时在主任那间相当昏暗的办公室里。"}), _answer({"p2": "所以我很紧张，也不是没有道理。"}))
    agent = TranslationAgent(model="fake", transport=again)
    assert DocumentRun(agent, tmp_path, read_first=True).run(pages).status == "done"
    assert all(b["system"][0]["text"].endswith(NARRATIVE_PROMPT) for b in again.bodies), "the genre comes back from reading.json"


def test_the_reader_is_told_to_leave_everyday_words_out_of_narrative_glossaries() -> None:
    assert "access、handling、commitment" in READER_PROMPT and "进入的事始终没有着落" in READER_PROMPT

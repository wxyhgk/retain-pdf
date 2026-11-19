"""人文书第二遍分两轮（2026-11-19）：先对照原文只审意思（问题单），再由编辑把译文当中文读、只改文笔；审校的程序兜底
（括号里的原文不许删、不许添词）。全部用假模型。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.agent import format_answer
from retainpdf_translation_agent.review import ACCURACY_NOTE
from retainpdf_translation_agent.review import review_page
from retainpdf_translation_agent.rewrite import POLISH_STEPS
from retainpdf_translation_agent.rewrite import rewrite_page
from retainpdf_translation_agent.runner import split_review

SOURCE = (
    "As the sociologist Diane Vaughan concluded, all this pushback might seemingly be discounted as non-knowledge, "
    "yet it constitutes very rich data, and I search for an elusive access."
)
DRAFT = "正如社会学家黛安·沃恩（Diane Vaughan）所总结的，所有这些推拒看似可以被贬低为“非知识”，实则构成了极为丰富的数据，我在寻找那 elusive 的进入权。"


class Model:
    """按工具名交回：submit_review 交 `review`，submit_rewrite 交 `rewrite`，submit_reading 交通读，初译交纯文本。"""

    def __init__(self, *, review: list[dict] | None = None, rewrite: list[dict] | None = None, genre: str = "humanities") -> None:
        self.review, self.rewrite, self.genre = review or [], rewrite or [], genre
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        tools = [t["name"] for t in body.get("tools") or []]
        usage = {"input_tokens": 40, "output_tokens": 10}
        if not tools:
            return {"content": [{"type": "text", "text": format_answer({"p1": DRAFT})}], "usage": usage}
        answer = {
            "submit_review": {"issues": self.review},
            "submit_rewrite": {"blocks": self.rewrite},
            "submit_reading": {"genre": self.genre, "name_policy": "transliterate", "style": "", "terms": [], "headings": []},
        }[tools[0]]
        return {"content": [{"type": "tool_use", "name": tools[0], "input": answer}], "usage": usage}


def _page() -> PageInput:
    return PageInput(page_label="15", blocks=[BlockInput("p1", "paragraph", SOURCE, True)])


def _results() -> dict[str, BlockResult]:
    return {"p1": BlockResult("p1", DRAFT, [], 1, "ok")}


def _ticket(category: str, old: str, fix: str, source: str = "might seemingly be discounted") -> dict:
    return {"block_id": "p1", "category": category, "source_quote": source, "translation_quote": old, "fix": fix, "reason": "r"}


# ---- 第一轮：只审意思 ----
def test_the_accuracy_round_takes_meaning_tickets_and_stray_english_but_not_style() -> None:
    tickets = [
        _ticket("tone", "看似可以被贬低为“非知识”，实则", "似乎可以当作“非知识”不予理会，但它们"),
        _ticket("fluency", "极为丰富的数据", "非常丰富的资料", source="very rich data"),
        _ticket("fluency", "那 elusive 的进入权", "那难以获得的进入权", source="an elusive access"),
    ]
    model = Model(review=tickets)
    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=model), _page(), results, accuracy_only=True)
    assert model.bodies[0]["system"][0]["text"].endswith(ACCURACY_NOTE)
    assert [t["verdict"] for t in report["applied"]] == ["applied", "applied"]
    assert [t["verdict"] for t in report["rejected"]] == ["not_accuracy"]
    assert "实则" not in results["p1"].translation and "elusive" not in results["p1"].translation and "极为丰富" in results["p1"].translation

    plain = Model(review=[_ticket("fluency", "极为丰富的数据", "非常丰富的资料", source="very rich data")])
    review_page(TranslationAgent(model="fake", transport=plain), _page(), _results())
    assert plain.bodies[0]["system"][0]["text"].find(ACCURACY_NOTE) < 0, "the plain review is unchanged"


def test_review_keeps_originals_in_parentheses_and_rejects_added_words() -> None:
    tickets = [
        _ticket("number_term", "黛安·沃恩（Diane Vaughan）", "黛安·沃恩", source="Diane Vaughan"),
        _ticket("mistranslation", "实则构成了", "其实构成了"),
    ]
    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=Model(review=tickets)), _page(), results)
    assert [t["verdict"] for t in report["rejected"]] == ["original_removed", "added_words"]
    assert results["p1"].translation == DRAFT


# ---- 第二轮：只改文笔 ----
def test_the_polish_round_reads_the_chinese_as_a_work_and_is_labelled() -> None:
    better = DRAFT.replace("所有这些推拒看似", "这些推拒看似")
    model = Model(rewrite=[{"block_id": "p1", "category": "fluency", "translation": better, "changes": "去掉“所有”"}])
    agent = TranslationAgent(model="fake", transport=model)
    report = rewrite_page(agent, _page(), _results(), genre="humanities", polish=True)
    system = model.bodies[0]["system"][0]["text"]
    assert POLISH_STEPS in system and "先查意思" not in system and "文笔要紧" in system and "不添词" in system
    assert report["mode"] == "polish" and len(report["applied"]) == 1 and agent.calls[0]["label"] == "polish 15"


def test_split_review_runs_both_rounds_in_order_and_merges_the_report() -> None:
    fixed = DRAFT.replace("实则", "但它们").replace("看似可以被贬低为", "似乎可以当作")
    polished = fixed.replace("所有这些推拒", "这些推拒")
    model = Model(
        review=[_ticket("tone", "看似可以被贬低为“非知识”，实则", "似乎可以当作“非知识”，但它们")],
        rewrite=[{"block_id": "p1", "category": "fluency", "translation": polished, "changes": "去掉“所有”"}],
    )
    results = _results()
    report = split_review(TranslationAgent(model="fake", transport=model), _page(), results, genre="humanities")
    assert [b["tools"][0]["name"] for b in model.bodies] == ["submit_review", "submit_rewrite"]
    sent = json.loads(model.bodies[1]["messages"][0]["content"])
    assert sent["blocks"][0]["translation"] == fixed, "the editor works on the reviewed text"
    assert results["p1"].translation == polished and len(results["p1"].history) == 2
    assert report["mode"] == "split" and report["tickets"] == 2 and len(report["applied"]) == 2
    assert report["accuracy"]["applied"][0]["category"] == "tone" and report["polish"]["mode"] == "polish"


def test_document_run_splits_narrative_books_and_keeps_tickets_for_the_rest(tmp_path: Path) -> None:
    pages = [_page()]
    humanities = Model()
    DocumentRun(TranslationAgent(model="fake", transport=humanities), tmp_path / "h", read_first=True, review=True).run(pages)
    assert [(b.get("tools") or [{"name": "translate"}])[0]["name"] for b in humanities.bodies] == ["submit_reading", "translate", "submit_review", "submit_rewrite"]
    assert humanities.bodies[2]["system"][0]["text"].endswith(ACCURACY_NOTE)

    science = Model(genre="science_paper")
    DocumentRun(TranslationAgent(model="fake", transport=science), tmp_path / "s", read_first=True, review=True).run(pages)
    assert [(b.get("tools") or [{"name": "translate"}])[0]["name"] for b in science.bodies] == ["submit_reading", "translate", "submit_review"]
    assert not science.bodies[2]["system"][0]["text"].endswith(ACCURACY_NOTE)

    forced = Model()
    DocumentRun(TranslationAgent(model="fake", transport=forced), tmp_path / "r", read_first=True, review="rewrite").run(pages)
    assert [(b.get("tools") or [{"name": "translate"}])[0]["name"] for b in forced.bodies][-1] == "submit_rewrite" and len(forced.bodies) == 3

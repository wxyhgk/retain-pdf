"""审校：选块、问题单要能逐字找到、程序按单子只改那一段、裁判不许改出新错、每块最多改两处、调度里每页一次。假模型。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import BlockResult
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent.agent import format_answer
from retainpdf_translation_agent.review import review_page

SOURCE = "Adding the font size to each token reduces column merges by about a third, and costs a hundred times as much data."
TRANSLATION = "把字号加入每个词元的特征后，栏合并减少了约三分之一，数据量多了一百倍。"


def _page() -> PageInput:
    return PageInput(page_label="4", blocks=[BlockInput("p1", "paragraph", SOURCE, True), BlockInput("h", "section_heading", "2.5 Failure cases", True)])


def _results() -> dict[str, BlockResult]:
    return {"p1": BlockResult("p1", TRANSLATION, [], 1, "ok", meta={"role": "translator"}), "h": BlockResult("h", "2.5 失败案例", [], 1, "ok")}


class Model:
    def __init__(self, *answers: dict) -> None:
        self.answers = list(answers)
        self.bodies: list[dict] = []

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        data = self.answers.pop(0)
        if "tools" not in body:  # 初译交回纯文本
            text = format_answer({t["id"]: t["translation"] for t in data["translations"]})
            return {"content": [{"type": "text", "text": text}], "usage": {"input_tokens": 40, "output_tokens": 10}}
        return {"content": [{"type": "tool_use", "name": body["tools"][0]["name"], "input": data}], "usage": {"input_tokens": 40, "output_tokens": 10}}


def _ticket(**overrides) -> dict:
    ticket = {
        "block_id": "p1",
        "category": "mistranslation",
        "source_quote": "costs a hundred times as much data",
        "translation_quote": "数据量多了一百倍",
        "fix": "所需数据是原来的一百倍",
        "reason": "times as much 是倍数，不是多了",
    }
    return dict(ticket, **overrides)


def test_a_valid_ticket_replaces_only_the_quoted_span() -> None:
    model = Model({"issues": [_ticket()]})
    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=model), _page(), results)
    sent = json.loads(model.bodies[0]["messages"][0]["content"])
    assert [b["id"] for b in sent["blocks"]] == ["p1"], "headings and short blocks are not reviewed"
    assert report["reviewed"] == 1 and len(report["applied"]) == 1
    assert results["p1"].translation == "把字号加入每个词元的特征后，栏合并减少了约三分之一，所需数据是原来的一百倍。"
    assert results["p1"].history[-1]["translation"] == TRANSLATION and results["p1"].meta["reviewed"] is True
    assert any(i["code"] == "review_mistranslation" for i in results["p1"].issues) and results["p1"].status == "ok"


def test_tickets_that_cannot_be_found_or_would_break_a_check_are_rejected() -> None:
    bad = [
        _ticket(source_quote="costs a thousand times"),
        _ticket(translation_quote="不存在的片段"),
        _ticket(translation_quote="一", fix="二"),  # 出现不止一次，定位不了
        _ticket(fix="数据量多了hundred倍"),  # 改出了中文里夹英文：裁判不收（错误和警告只许减少）
        _ticket(category="style"),
    ]
    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=Model({"issues": bad})), _page(), results)
    verdicts = [t["verdict"] for t in report["rejected"]]
    assert verdicts == ["source_quote_not_found", "translation_quote_not_found", "translation_quote_ambiguous", "referee_rejected", "bad_category"]
    assert results["p1"].translation == TRANSLATION, "nothing was applied"


def test_a_block_gets_at_most_two_edits() -> None:
    tickets = [
        _ticket(translation_quote="把字号", fix="将字号", category="fluency", source_quote="Adding the font size"),
        _ticket(translation_quote="约三分之一", fix="大约三分之一", category="fluency", source_quote="about a third"),
        _ticket(),
    ]
    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=Model({"issues": tickets})), _page(), results)
    assert len(report["applied"]) == 2 and report["rejected"][0]["verdict"] == "too_many_edits"


def test_a_fix_that_rewrites_the_following_words_does_not_duplicate_them() -> None:
    """2026-11-18 实跑：审校把整句写全了（translation_quote 只是前半句），替换后后半句重复了一遍。"""
    tickets = [
        _ticket(
            category="fluency",
            source_quote="reduces column merges by about a third",
            translation_quote="栏合并减少了约三分之一",
            fix="栏合并减少了大约三分之一，所需数据是原来的一百倍。",  # 后文“，数据量……。”已经在了；结尾的。和后文开头的，也会叠
        ),
    ]
    results = _results()
    review_page(TranslationAgent(model="fake", transport=Model({"issues": tickets})), _page(), results)
    assert results["p1"].translation == TRANSLATION.replace("约三分之一", "大约三分之一，所需数据是原来的一百倍"), results["p1"].translation


def test_overlap_with_the_preceding_words_and_doubled_punctuation_are_trimmed() -> None:
    from retainpdf_translation_agent.review import trim_overlap

    current = "他先坐下。然后我们开始谈话，气氛很好。"
    # 改法从前文“然后我们”写起：开头的重叠去掉
    assert trim_overlap(current, "开始谈话", "然后我们开始交谈") == "开始交谈"
    # 改法自己带了句号、后文又以句号开头：去掉一个
    assert trim_overlap("气氛很好。下一句", "气氛很好", "气氛融洽。") == "气氛融洽"
    # 不到 4 个字的巧合重叠不动
    assert trim_overlap("我们开始谈话，气氛很好。", "开始谈话", "开始谈，气") == "开始谈，气"


def test_a_fix_that_would_still_repeat_the_context_is_rejected() -> None:
    """改法和要换的那段对不上（审校定位错了），替换后会多出一整段重复：不改。"""
    tickets = [
        _ticket(
            category="fluency",
            source_quote="reduces column merges by about a third",
            translation_quote="栏合并减少了约三分之一",
            fix="字号加入每个词元的特征后的栏合并大约少了三分之一",  # 和前文对不齐，去不掉
        ),
    ]
    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=Model({"issues": tickets})), _page(), results)
    assert report["rejected"][0]["verdict"] == "duplicates_context"
    assert results["p1"].translation == TRANSLATION


def test_document_run_reviews_every_page_once(tmp_path: Path) -> None:
    model = Model({"translations": [{"id": "p1", "translation": TRANSLATION}, {"id": "h", "translation": "2.5 失败案例"}]}, {"issues": [_ticket()]})
    outcome = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, review=True).run([_page()])
    assert [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies] == ["plain_text", "submit_review"]
    assert outcome.results["p1"].translation.endswith("所需数据是原来的一百倍。")
    ledger = [json.loads(line) for line in (tmp_path / "ledger.jsonl").read_text(encoding="utf-8").splitlines()]
    review = next(e for e in ledger if e["event"] == "review")
    assert review["applied"] == 1 and any(e["event"] == "call" and e["role"] == "reviewer" for e in ledger)
    page_file = json.loads((tmp_path / "pages" / "0000.json").read_text(encoding="utf-8"))
    assert page_file["info"]["review"]["applied"][0]["verdict"] == "applied"


def test_the_reviewer_decides_after_its_reason_and_withdrawn_tickets_are_not_applied() -> None:
    """11-20《The Interloper》：审校被逼着交单，70 张里 50 张改法等于原译，理由写着"应忽略""撤回"的也被改进去。
    现在单子里先写理由、再定 must_fix；false 不改，记成 withdrawn。"""
    schema = __import__("retainpdf_translation_agent.review", fromlist=["REVIEW_TOOL"]).REVIEW_TOOL["input_schema"]["properties"]["issues"]["items"]
    assert list(schema["properties"]).index("reason") < list(schema["properties"]).index("must_fix") < list(schema["properties"]).index("fix")
    assert "must_fix" in schema["required"]

    results = _results()
    withdrawn = _ticket(must_fix=False, reason="意思大体相符，不必改")
    report = review_page(TranslationAgent(model="fake", transport=Model({"issues": [withdrawn]})), _page(), results)
    assert [t["verdict"] for t in report["rejected"]] == ["withdrawn"] and results["p1"].translation == TRANSLATION

    results = _results()
    report = review_page(TranslationAgent(model="fake", transport=Model({"issues": [_ticket(must_fix=True)]})), _page(), results)
    assert len(report["applied"]) == 1 and "所需数据是原来的一百倍" in results["p1"].translation

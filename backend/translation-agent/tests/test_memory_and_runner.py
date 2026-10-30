"""第 1 版：术语表（版本、作用域、候选晋升、歧义单）、缩写抓取、上下文包、术语和语气校验、退回原文、按角色选模型、
整篇调度（台账、进度、停下和接着跑）。全部用假模型，不发网络请求。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation_agent import BREAK
from retainpdf_translation_agent import BlockInput
from retainpdf_translation_agent import DocumentRun
from retainpdf_translation_agent import Glossary
from retainpdf_translation_agent import PageInput
from retainpdf_translation_agent import QuotaExhausted
from retainpdf_translation_agent import RevisionRequest
from retainpdf_translation_agent import TranslationAgent
from retainpdf_translation_agent import blocks_using
from retainpdf_translation_agent import build_context
from retainpdf_translation_agent import check_terms
from retainpdf_translation_agent import extract_abbreviations
from retainpdf_translation_agent import style_signals
from retainpdf_translation_agent.agent import classify_http_error
from retainpdf_translation_agent.agent import retry_wait
from retainpdf_translation_agent.checks import status_of
from retainpdf_translation_agent.context import binding_terms
from retainpdf_translation_agent.memory import find_terms

DOC = {"title": "T", "source_lang": "en", "target_lang": "zh-CN"}


def _answer(translations: dict[str, str], terms: list[dict] | None = None, exceptions: list[dict] | None = None) -> dict:
    data = {"translations": [{"id": k, "translation": v} for k, v in translations.items()]}
    if terms:
        data["terms"] = terms
    if exceptions:
        data["term_exceptions"] = exceptions
    return {"content": [{"type": "tool_use", "name": "submit_translations", "input": data}], "usage": {"input_tokens": 100, "output_tokens": 20}}


class Model:
    """按顺序回放回答；回答也可以是一个异常（模拟额度用完）。"""

    def __init__(self, *answers) -> None:
        self.answers = list(answers)
        self.bodies: list[dict] = []

    @property
    def payloads(self) -> list[dict]:
        return [json.loads(b["messages"][0]["content"]) for b in self.bodies]

    def __call__(self, body: dict) -> dict:
        self.bodies.append(body)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def _p(label: str, chapter: str, *blocks: tuple[str, str]) -> PageInput:
    return PageInput(page_label=label, chapter=chapter, document=DOC, blocks=[BlockInput(i, "paragraph", t, True) for i, t in blocks])


# ---- 术语表 ----
def test_abbreviations_are_found_from_their_definition() -> None:
    text = "We report Intersection over Union (IoU) after optical character recognition (OCR) with convolutional neural networks (CNNs) (see Figure 2)."
    assert extract_abbreviations(text) == [("IoU", "Intersection over Union"), ("OCR", "optical character recognition"), ("CNNs", "convolutional neural networks")]


def test_a_candidate_is_promoted_after_two_blocks_agree_and_a_rival_opens_a_ticket() -> None:
    glossary = Glossary()
    args = dict(category="term", page="1", chapter="c1", quote="q")
    assert glossary.propose("bounding box", "边界框", block_id="b1", **args) == "candidate"
    assert glossary.propose("bounding box", "边界框", block_id="b1", **args) == "candidate", "the same block only counts once"
    assert glossary.propose("Bounding boxes", "边界框", block_id="b2", **args) == "promoted"
    term = glossary.find("bounding box", "c1")
    assert term.status == "approved" and term.version == glossary.version
    assert glossary.propose("bounding box", "包围盒", block_id="b3", **args) == "conflict"
    assert glossary.tickets[-1]["proposed"] == "包围盒" and term.target == "边界框", "approved terms are never silently replaced"

    rival = Glossary()
    rival.propose("reading order", "阅读顺序", block_id="x1", **args)
    assert rival.propose("reading order", "读序", block_id="x2", **args) == "conflict"
    assert rival.find("reading order", "c1").status == "candidate" and len(rival.tickets) == 1


def test_user_terms_are_locked_and_every_change_bumps_the_version() -> None:
    glossary = Glossary()
    term = glossary.add("layout element", "版面元素", reason="用户给的")
    assert term.status == "locked" and glossary.version == 1
    assert glossary.propose("layout element", "布局元素", category="term", block_id="b", page="2", chapter="", quote="q") == "conflict"
    glossary.revise(term.id, "版面要素", reason="用户改")
    assert glossary.version == 2 and term.target == "版面要素" and [c["action"] for c in glossary.changes] == ["add", "revise"]
    restored = Glossary.from_dict(json.loads(json.dumps(glossary.to_dict())))
    assert restored.find("layout element", "").target == "版面要素" and restored.version == 2


def test_two_exceptions_in_one_chapter_make_a_term_that_only_that_chapter_uses() -> None:
    """同词异义：kernel 全书译"卷积核"，系统一章两处声明是"内核"，就加一条只管这一章的审定术语。"""
    glossary = Glossary()
    glossary.add("kernel", "卷积核", status="approved", reason="test")
    args = dict(page="9", chapter="ch3", quote="q", reason="操作系统的内核")
    glossary.declare_exception("kernel", "内核", block_id="s1", **args)
    assert glossary.declare_exception("kernel", "内核", block_id="s2", **args) == "promoted"
    assert glossary.find("kernel", "ch3").target == "内核" and glossary.find("kernel", "ch3").scope == ["ch3"]
    assert glossary.find("kernel", "ch2").target == "卷积核"
    assert [t.target for t in glossary.lookup("the kernel schedules", "ch3")] == ["内核"]


def test_terms_promoted_by_the_translator_bind_only_their_chapters_until_a_second_chapter_agrees() -> None:
    glossary = Glossary()
    args = dict(category="term", page="5", quote="q")
    glossary.propose("token", "词元", block_id="m1", chapter="ch2", **args)
    glossary.propose("token", "词元", block_id="m2", chapter="ch2", **args)
    term = glossary.find("token", "ch2")
    assert term.status == "approved" and term.binds("ch2") and not term.binds("ch3")
    assert term.for_context("ch3")["status"] == "candidate" and term.for_context("ch2")["status"] == "approved"
    assert glossary.propose("token", "词元", block_id="m3", chapter="ch5", **args) == "agreed"
    assert term.chapters == ["ch2", "ch5"] and term.binds("ch3") and glossary.changes[-1]["action"] == "widen"
    assert Glossary().add("x", "甲", status="approved", reason="用户给的").binds("any"), "terms added directly bind everywhere"


def test_find_terms_prefers_the_longest_match_and_names_are_case_sensitive() -> None:
    terms = [
        {"id": "t1", "source": "box", "target": "框", "category": "term"},
        {"id": "t2", "source": "bounding box", "target": "边界框", "category": "term"},
        {"id": "k1", "source": "Pattern Recognition Letters", "target": "Pattern Recognition Letters", "category": "keep"},
    ]
    assert [t["id"] for t in find_terms("Bounding boxes appeared in Pattern Recognition Letters.", terms)] == ["t2", "k1"]
    assert find_terms("pattern recognition letters", terms[2:]) == []


# ---- 上下文包 ----
def test_context_stays_within_budget_and_keeps_approved_terms_first() -> None:
    glossary = Glossary()
    words = [f"widget{i:03d}" for i in range(200)]
    for i, word in enumerate(words):
        glossary.add(word, "部件" + str(i), status="approved" if i % 2 else "candidate", reason="test")
    page = _p("1", "", ("b1", " ".join(words)))
    context = build_context(page, glossary, budget=1500)
    assert context["estimated_tokens"] <= 1500 and context["truncated"]
    statuses = [t["status"] for t in context["terms"]]
    assert statuses == sorted(statuses, key=lambda s: s != "approved"), "candidates are cut before approved terms"
    before = context["hash"]
    glossary.add("widget000", "小部件", status="approved", reason="test")
    assert build_context(page, glossary, budget=1500)["hash"] != before


def test_context_carries_neighbors_abbreviations_and_first_use() -> None:
    glossary = Glossary()
    glossary.add("IoU", "IoU", category="abbr", status="approved", reason="scan", page="3", note="Intersection over Union")
    page = _p("4", "", ("b1", "The IoU threshold is 0.5."))
    context = build_context(page, glossary, previous=[{"id": "p", "source": "x" * 900, "translation": "前一页"}], next_blocks=[{"id": "n", "source": "Next."}])
    assert context["abbreviations"][0] == {"id": context["abbreviations"][0]["id"], "abbr": "IoU", "expansion": "Intersection over Union", "defined_on": "3", "first_use": True}
    assert context["previous"][0]["source"].startswith("…") and len(context["previous"][0]["source"]) <= 401
    assert context["next"][0]["source"] == "Next."
    assert build_context(page, glossary, used_abbreviations={"IoU"})["abbreviations"][0]["first_use"] is False


# ---- 校验 ----
def test_term_checks_and_declared_exceptions() -> None:
    terms = [
        {"id": "t1", "source": "bounding box", "target": "边界框", "category": "term", "status": "approved"},
        {"id": "k1", "source": "Mei", "target": "Mei", "category": "keep", "status": "locked"},
        {"id": "a1", "source": "IoU", "target": "IoU", "category": "abbr", "status": "approved"},
    ]
    source = "Mei computes the IoU of each bounding box."
    assert check_terms(source, "Mei 计算每个边界框的 IoU。", terms) == []
    codes = [i["code"] for i in check_terms(source, "梅计算每个包围盒的交并比。", terms)]
    assert codes == ["keep_original_lost", "abbr_lost", "term_mismatch"]
    assert [i["code"] for i in check_terms(source, "Mei 计算每个包围盒的 IoU。", terms, {"bounding box"})] == []
    # 候选的长词组盖住审定的短词：access token 里的 token 不按"词元"查
    shield = [
        {"id": "t2", "source": "token", "target": "词元", "category": "term", "status": "approved"},
        {"id": "t3", "source": "access token", "target": "访问令牌", "category": "term", "status": "candidate"},
    ]
    assert check_terms("Every request carries an access token.", "每个请求都带着访问令牌。", shield) == []
    assert [i["code"] for i in check_terms("Each token is a patch.", "每个令牌是一个图块。", shield)] == ["term_mismatch"]


def test_style_signals_are_info_and_do_not_change_the_status() -> None:
    issues = style_signals("We suggest that this may help.", "这有帮助。")
    assert [i["code"] for i in issues] == ["hedge_lost", "person_lost"] and status_of(issues) == "ok"
    assert style_signals("We suggest that this may help.", "我们认为这可能有帮助。") == []


# ---- 一页 ----
def test_a_term_that_is_not_used_is_a_warning_without_a_retry() -> None:
    """术语没照用只记警告、不重翻（实测重翻代价大，定错的译法还会被逼着照抄），交给一致性检查和审校。"""
    glossary = Glossary()
    glossary.add("bounding box", "边界框", reason="用户给的")
    page = _p("1", "", ("b1", "Each bounding box has four numbers."), ("b2", "Boxes overlap."))
    context = build_context(page, glossary)
    page.context = context
    model = Model(_answer({"b1": "每个包围盒有四个数。", "b2": "框会重叠。"}))
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert len(model.payloads) == 1
    assert model.payloads[0]["context"]["terms"][0]["target"] == "边界框" and "hash" not in model.payloads[0]["context"]
    assert results["b1"].status == "warn" and results["b1"].issues[0]["code"] == "term_mismatch"
    assert results["b1"].translation == "每个包围盒有四个数。" and results["b2"].status == "ok"
    meta = results["b1"].meta
    assert meta["used_terms"] == [[context["terms"][0]["id"], glossary.version]] and meta["context_hash"] == context["hash"]
    assert meta["role"] == "translator" and meta["model"] == "fake" and meta["attempt"] == 1


def test_a_block_that_still_breaks_a_formula_falls_back_to_the_source() -> None:
    page = _p("1", "", ("b1", "We report $F_1$ on 3 pages."))
    model = Model(_answer({"b1": "我们报告 F1。"}), _answer({"b1": "我们在 3 页上报告 F1。"}))
    result = TranslationAgent(model="fake", transport=model).translate_page(page)[0]["b1"]
    assert result.status == "fallback_source" and result.translation is None
    assert result.history[-1]["translation"] == "我们在 3 页上报告 F1。"


def test_a_group_whose_breaks_stay_wrong_is_kept_whole_in_its_first_block() -> None:
    group = lambda i: {"id": "cg-x", "index": i, "of": 2}  # noqa: E731
    page = PageInput(
        page_label="1",
        document=DOC,
        blocks=[BlockInput("x1", "paragraph", "Chapter 3 is the one I", True, group=group(1)), BlockInput("x2", "paragraph", "wish someone had handed me.", True, group=group(2))],
    )
    whole = "第 3 章是我希望当年有人交给我的那一章。"
    wrong = f"第 3 章{BREAK}是我希望{BREAK}当年有人交给我的那一章。"  # 放多了断点：重翻，还多就整段并进第一块
    model = Model(_answer({"cg-x": wrong}), _answer({"cg-x": wrong}))
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert results["x1"].translation == whole and results["x2"].translation == ""
    assert results["x1"].status == results["x2"].status == "warn"
    assert [i["code"] for i in results["x2"].issues] == ["group_merged"]


def test_the_first_use_of_an_abbreviation_must_spell_it_out() -> None:
    glossary = Glossary()
    glossary.add("OCR", "OCR", category="abbr", status="approved", reason="scan", page="3", note="optical character recognition")
    page = _p("1", "", ("b1", "OCR reads letters."), ("b2", "OCR also fails."))
    page.context = build_context(page, glossary)
    model = Model(_answer({"b1": "OCR 能读出字母。", "b2": "OCR 也会出错。"}), _answer({"b1": "光学字符识别（OCR）能读出字母。"}))
    results, _ = TranslationAgent(model="fake", transport=model).translate_page(page)
    assert [i["code"] for i in results["b1"].history[0]["issues"] if i["severity"] == "error"] == ["abbr_first_use"]
    assert results["b1"].translation.startswith("光学字符识别（OCR）") and results["b2"].status == "ok", "only the first block on the page needs it"


def test_a_footnote_must_keep_its_leading_number() -> None:
    page = PageInput(page_label="1", document=DOC, blocks=[BlockInput("fn11", "footnote", "11 On the French reading rooms see Lyons.", True)])
    model = Model(_answer({"fn11": "注1 关于法国的阅览室，参见 Lyons。"}), _answer({"fn11": "11 关于法国的阅览室，参见 Lyons。"}))
    result = TranslationAgent(model="fake", transport=model).translate_page(page)[0]["fn11"]
    assert "footnote_number_changed" in [i["code"] for i in result.history[0]["issues"]] and result.translation.startswith("11 ")


def test_roles_can_use_their_own_model() -> None:
    model = Model(_answer({"b1": "一个要缩短的长句。"}))
    agent = TranslationAgent(model="cheap", models={"reviser": "strong"}, transport=model)
    page = _p("1", "", ("b1", "A fairly long sentence that needs shortening."))
    result = agent.revise(page, [RevisionRequest("b1", "一个需要缩短的相当长的句子。", max_chars=20)])["b1"]
    assert model.bodies[0]["model"] == "strong" and result.meta["role"] == "reviser"
    assert agent.model_for("translator") == "cheap"


# ---- 整篇 ----
def _book() -> list[PageInput]:
    return [
        _p("1", "ch1", ("a1", "Each bounding box comes from OCR."), ("a2", "A bounding box may overlap.")),
        _p("2", "ch1", ("b1", "We run optical character recognition (OCR) first.")),
        _p("3", "ch2", ("c1", "The bounding box of a figure.")),
    ]


def test_document_run_learns_terms_and_writes_ledger_and_progress(tmp_path: Path) -> None:
    terms = [{"block_id": "a1", "source": "bounding box", "target": "边界框", "category": "term"}, {"block_id": "a2", "source": "bounding box", "target": "边界框", "category": "term"}]
    model = Model(
        _answer({"a1": "每个边界框来自光学字符识别（OCR）。", "a2": "边界框可能会重叠。"}, terms),
        _answer({"b1": "我们先做光学字符识别（OCR）。"}),
        _answer({"c1": "图的边界框。"}),
    )
    outcome = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path).run(_book())
    assert outcome.status == "done" and outcome.pages_done == 3
    page1, page2, page3 = model.payloads
    assert page1["context"]["abbreviations"][0]["abbr"] == "OCR", "abbreviations defined later are known from the first page"
    assert page1["context"]["abbreviations"][0]["first_use"] is True
    assert page2["context"]["abbreviations"][0]["first_use"] is False
    assert page2["context"]["previous"][-1]["translation"] == "边界框可能会重叠。"
    # 第 1 章定的术语到第 2 章只作参考（候选），要第 2 章也这样用了才全书照用
    assert page3["context"]["terms"] == [dict(page3["context"]["terms"][0], source="bounding box", target="边界框", status="candidate")]
    assert "c1" in blocks_using(outcome.results, page3["context"]["terms"][0]["id"])
    ledger = [json.loads(line) for line in (tmp_path / "ledger.jsonl").read_text(encoding="utf-8").splitlines()]
    events = [e["event"] for e in ledger]
    assert events.count("call") == 3 and events[-1] == "done" and "glossary" in events
    call = next(e for e in ledger if e["event"] == "call")
    assert call["role"] == "translator" and call["input_tokens"] == 100 and call["context_hash"]
    progress = json.loads((tmp_path / "progress.json").read_text(encoding="utf-8"))
    assert progress == {"status": "done", "stop_reason": "", "pages_done": ["0000", "0001", "0002"], "pages_total": 3}
    versions = sorted(p.name for p in (tmp_path / "glossary").iterdir())
    assert "v1.json" in versions and len(versions) >= 2


def test_terms_without_evidence_or_from_failed_blocks_are_ignored(tmp_path: Path) -> None:
    bogus = [
        {"block_id": "a1", "source": "neural network", "target": "神经网络", "category": "term"},  # 原文里没有
        {"block_id": "zz", "source": "bounding box", "target": "边界框", "category": "term"},  # 没有这一块
    ]
    model = Model(_answer({"a1": "每个边界框来自光学字符识别（OCR）。", "a2": "边界框可能会重叠。"}, bogus))
    outcome = DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path).run(_book()[:1])
    assert [t.source for t in outcome.glossary.terms.values() if t.category == "term"] == []


def test_a_stopped_run_keeps_its_progress_and_resumes_where_it_stopped(tmp_path: Path) -> None:
    first = Model(_answer({"a1": "每个边界框来自光学字符识别（OCR）。", "a2": "边界框可能会重叠。"}), QuotaExhausted("credit balance too low"))
    stopped = DocumentRun(TranslationAgent(model="fake", transport=first), tmp_path).run(_book())
    assert stopped.status == "stopped" and stopped.stop_reason == "quota_exhausted" and stopped.pages_done == 1
    assert json.loads((tmp_path / "progress.json").read_text(encoding="utf-8"))["pages_done"] == ["0000"]

    second = Model(_answer({"b1": "我们先做光学字符识别（OCR）。"}), _answer({"c1": "图的边界框。"}))
    resumed = DocumentRun(TranslationAgent(model="fake", transport=second), tmp_path).run(_book())
    assert resumed.status == "done" and len(second.bodies) == 2, "finished pages are not requested again"
    assert resumed.results["a1"].translation == "每个边界框来自光学字符识别（OCR）。"
    assert second.payloads[0]["context"]["previous"][-1]["id"] == "a2"


def test_without_memory_pages_go_out_without_a_context(tmp_path: Path) -> None:
    model = Model(_answer({"a1": "每个边界框来自光学字符识别（OCR）。", "a2": "边界框可能会重叠。"}))
    DocumentRun(TranslationAgent(model="fake", transport=model), tmp_path, memory=False).run(_book()[:1])
    assert "context" not in model.payloads[0]


def test_http_errors_are_sorted_into_retry_stop_and_fatal() -> None:
    assert classify_http_error(429, "") == "retry" and classify_http_error(529, "") == "retry"
    assert classify_http_error(401, "") == "auth"
    assert classify_http_error(400, '{"error": {"message": "Your credit balance is too low"}}') == "quota"
    assert classify_http_error(400, "max_tokens too large") == "fatal"
    assert retry_wait(0, "7") == 7.0 and retry_wait(10, None) <= 121.0 and 1.0 <= retry_wait(0, None) <= 2.0


def test_binding_terms_only_include_approved_entries() -> None:
    context = {
        "terms": [{"id": "t1", "source": "a", "target": "甲", "category": "term", "status": "candidate"}, {"id": "t2", "source": "b", "target": "乙", "category": "term", "status": "approved"}],
        "keep": [{"id": "k1", "source": "Mei", "target": "Mei", "status": "candidate"}],
    }
    assert [t["id"] for t in binding_terms(context)] == ["t2"]


def test_a_product_glossary_csv_becomes_locked_and_kept_terms() -> None:
    from retainpdf_translation_agent import glossary_from_csv

    text = "﻿原文,译文,备注,level\nbasis set,基组,,canonical\nBFGS,BFGS,算法名,preserve\nHessian,Hessian 矩阵,,preferred\n,空的,,canonical\n"
    glossary = glossary_from_csv(text)
    assert glossary.find("basis sets", "").target == "基组" and glossary.find("basis set", "").status == "locked"
    assert glossary.find("BFGS", "", category="keep").status == "locked"
    assert glossary.find("Hessian", "").status == "approved" and len(glossary.terms) == 3
    assert glossary_from_csv("basis set,基组\n").find("basis set", "").target == "基组", "no header: source, target, …"

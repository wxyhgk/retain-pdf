"""翻译编辑部（refine=editorial）：主编分流、整块重写、多轮、争议、待人看、台账与续跑。

全部用 mock 模型，不调真实 LLM。译文样例与验收沿用精修的测试夹具。
"""
from __future__ import annotations

import json
from pathlib import Path

from test_translation_refine import B001_SOURCE
from test_translation_refine import B001_TEXT
from test_translation_refine import _assert_checkpoint_consistent
from test_translation_refine import _assert_matches_contract
from test_translation_refine import _build_job
from test_translation_refine import _item
from test_translation_refine import _revisions

from retainpdf_pipeline.translate.public import run_refine_for_render
from retainpdf_pipeline.translate.services.editorial.chief import Attempts
from retainpdf_pipeline.translate.services.editorial.chief import allowed_actions
from retainpdf_pipeline.translate.services.editorial.ledger import read_ledger
from retainpdf_pipeline.translate.services.refine.llm import ChatResult
from retainpdf_pipeline.translate.services.refine.review import Finding
from retainpdf_pipeline.translate.workflow import editorial

B001_FULL = B001_TEXT + "它的能级等间距，而且彼此从不交叉。"
B002_FIXED = "在 298 K 时键长为 1.21 Å。"
# 夹具里质检报的问题：b001 漏译（major，按长度比）；b002 数字丢失（critical）和多出数字（major）。


class EditorialModel:
    """每个角色（purpose）一份脚本；脚本里的元素依次用于该角色的第 1、2… 次请求。"""

    def __init__(self, **scripts) -> None:
        self.scripts = {"review": [{"findings": []}], "chief": [{"decisions": []}], "fix": [{"fixes": []}],
                        "rewrite": [{"rewrites": []}], **scripts}
        self.calls: list[tuple[str, list[dict]]] = []

    def __call__(self, messages, *, purpose, response_format=None):
        self.calls.append((purpose, messages))
        script = self.scripts[purpose]
        index = sum(1 for call_purpose, _ in self.calls if call_purpose == purpose) - 1
        response = script[min(index, len(script) - 1)]
        if isinstance(response, Exception):
            raise response
        content = response if isinstance(response, str) else json.dumps(response, ensure_ascii=False)
        return ChatResult(content=content, usage={"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15})

    def purposes(self) -> list[str]:
        return [purpose for purpose, _ in self.calls]

    def payload(self, purpose: str, nth: int = 0) -> dict:
        messages = [messages for call_purpose, messages in self.calls if call_purpose == purpose][nth]
        return json.loads(messages[-1]["content"])


def _config(**overrides) -> dict:
    return {"mode": "editorial", "trigger": "manual", "model": "mock-model", "start_page": 1, "end_page": 1, **overrides}


def _run(tmp_path: Path, model: EditorialModel, translated: Path | None = None, **overrides) -> tuple[dict, Path]:
    translated = translated or _build_job(tmp_path)
    report = run_refine_for_render(tmp_path, translated, _config(**overrides), chat_fn=model)
    assert report is not None
    return report, translated


def _decide(*rows: tuple[str, str]) -> dict:
    return {"decisions": [{"item_id": item_id, "action": action, "reason": "测试", "note": "按问题改"} for item_id, action in rows]}


def _ledger(tmp_path: Path) -> list[dict]:
    return read_ledger(tmp_path / "artifacts" / "editorial" / "ledger.jsonl")


def _fixes(report: dict, item_id: str) -> list[dict]:
    return [fix for fix in report["fixes"] if fix["item_id"] == item_id]


# ---- 规则框 ----------------------------------------------------------------------


def _finding(category: str, severity: str) -> Finding:
    return Finding("rf-1", "i", 1, category, severity, "", "", "", "", "review")


def test_rule_frame_forbids_keep_on_severe_problems_and_drops_exhausted_actions() -> None:
    allowed, default = allowed_actions([_finding("omission", "critical")], Attempts())
    assert (allowed, default) == (["patch", "rewrite", "escalate"], "rewrite")
    allowed, default = allowed_actions([_finding("mistranslation", "major")], Attempts())
    assert (allowed, default) == (["patch", "rewrite", "keep", "escalate"], "patch")

    dead_end = Attempts()
    dead_end.record("patch", "rejected", "crosses_protected_token")
    assert allowed_actions([_finding("mistranslation", "major")], dead_end) == (["rewrite", "keep", "escalate"], "rewrite")

    spent = Attempts()
    spent.record("rewrite", "rejected", "unchanged")
    spent.record("patch", "skipped", "model_returned_no_edit")
    spent.record("patch", "skipped", "model_returned_no_edit")
    assert allowed_actions([_finding("omission", "critical")], spent) == (["escalate"], "escalate")


# ---- 主流程 ----------------------------------------------------------------------


def test_chief_routes_blocks_and_the_reviser_rewrites_an_omission(tmp_path: Path) -> None:
    model = EditorialModel(
        chief=[_decide(("p001-b001", "rewrite"), ("p001-b002", "patch"))],

        rewrite=[{"rewrites": [{"item_id": "p001-b001", "translation": B001_FULL, "note": "补译第二句"}]}],
        fix=[{"fixes": [{"item_id": "p001-b002", "edits": [{"op": "replace", "find": "289 K", "replace": "298 K"}]}]}],
    )
    report, translated = _run(tmp_path, model)

    assert report["mode"] == "editorial"
    assert model.purposes() == ["review", "chief", "fix", "rewrite"]
    # 主编只看问题清单，不看全文；拿到的是规则框。
    chief_items = {row["item_id"]: row for row in model.payload("chief")["items"]}
    assert "translation" not in chief_items["p001-b001"] and "source" not in chief_items["p001-b001"]
    assert chief_items["p001-b001"]["allowed_actions"] == ["patch", "rewrite", "keep", "escalate"]
    assert chief_items["p001-b002"]["allowed_actions"] == ["patch", "rewrite", "escalate"], "数字丢失不许不改"
    # 修订拿到主编的说明。
    assert model.payload("rewrite")["items"][0]["note"] == "按问题改"

    rewrite = _fixes(report, "p001-b001")[0]
    assert (rewrite["action"], rewrite["round"], rewrite["status"]) == ("rewrite", 1, "applied")
    assert _item(translated, "p001-b001")["translated_text"] == B001_FULL
    patch = _fixes(report, "p001-b002")[0]
    assert (patch["action"], patch["status"]) == ("patch", "applied")
    assert [record["source"] for record in _revisions(translated)] == ["refine", "refine"]
    _assert_checkpoint_consistent(translated)

    section = report["editorial"]
    assert section["rounds"] == 1
    assert section["escalated"] == []
    assert section["decisions"] == {"total": 2, "by_action": {"patch": 1, "rewrite": 1}, "by_source": {"model": 2}, "overridden": 0}
    assert section["models"]["chief"]["thinking"] == "medium", "翻译设置为自动时主编用中等思考深度"
    kinds = [record["kind"] for record in _ledger(tmp_path)]
    assert kinds[0] == "run.start" and kinds[-1] == "run.end"
    assert {"issue.open", "decision", "issue.resolve", "review.done"} <= set(kinds)
    assert report["qa_after"]["by_severity"]["critical"] == 0
    _assert_matches_contract(report)


def test_an_action_outside_the_frame_is_replaced_by_the_default(tmp_path: Path) -> None:
    model = EditorialModel(
        chief=[_decide(("p001-b001", "escalate"), ("p001-b002", "keep"))],
        rewrite=[{"rewrites": [{"item_id": "p001-b002", "translation": B002_FIXED, "note": ""}]}],
    )
    report, translated = _run(tmp_path, model)

    decisions = report["editorial"]["decisions"]
    assert decisions["overridden"] == 1
    assert decisions["by_source"] == {"model": 1, "rule": 1}
    assert _fixes(report, "p001-b002")[0]["action"] == "rewrite", "数字丢失不许不改，按默认整块重写"
    assert _item(translated, "p001-b002")["translated_text"] == B002_FIXED


def test_a_patch_that_hits_a_formula_moves_to_a_rewrite_in_round_two(tmp_path: Path) -> None:
    finding = {"findings": [{
        "item_id": "p001-b003", "category": "mistranslation", "severity": "major",
        "target_span": "每个量子的能量", "source_span": "The energy ... for each quantum",
        "explanation": "语序别扭", "suggestion": "",
    }]}
    rewritten = "对每个量子而言，能量为 $E = h\\nu$。"
    model = EditorialModel(
        review=[finding],
        chief=[_decide(("p001-b003", "patch"), ("p001-b001", "escalate"), ("p001-b002", "escalate")),
               _decide(("p001-b003", "patch"))],
        fix=[{"fixes": [{"item_id": "p001-b003", "edits": [{"op": "replace", "find": "能量为 $E", "replace": "能量是 $E"}]}]}],
        rewrite=[{"rewrites": [{"item_id": "p001-b003", "translation": rewritten, "note": "调整语序"}]}],
    )
    report, translated = _run(tmp_path, model)

    attempts = _fixes(report, "p001-b003")
    assert [(fix["round"], fix["action"], fix["status"], fix["reject_reason"]) for fix in attempts] == [
        (1, "patch", "rejected", "crosses_protected_token"),
        (2, "rewrite", "applied", ""),
    ]
    second_round = {row["item_id"]: row for row in model.payload("chief", 1)["items"]}
    assert second_round["p001-b003"]["allowed_actions"] == ["rewrite", "keep", "escalate"]
    assert second_round["p001-b003"]["attempts"] == ["patch:rejected/crosses_protected_token"]
    assert _item(translated, "p001-b003")["translated_text"] == rewritten
    assert report["editorial"]["rounds"] == 2
    assert report["editorial"]["decisions"]["overridden"] == 1
    escalated = {row["item_id"]: row for row in report["editorial"]["escalated"]}
    assert set(escalated) == {"p001-b001", "p001-b002"}
    assert escalated["p001-b001"]["reason"] == "测试"
    _assert_matches_contract(report)


def test_review_against_a_locked_term_is_ruled_in_favour_of_the_term_base(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    (translated / "term-base.v1.json").write_text(json.dumps({
        "schema": "term_base_v1",
        "schema_version": 1,
        "terms": [{"source": "harmonic oscillator", "target": "谐振子", "origin": "extracted", "treatment": "lock"}],
        "review": {"status": "completed", "by_treatment": {"lock": 1}},
    }, ensure_ascii=False), encoding="utf-8")
    model = EditorialModel(
        review=[{"findings": [{
            "item_id": "p001-b001", "category": "terminology", "severity": "major",
            "target_span": "谐振子", "source_span": "harmonic oscillator",
            "explanation": "应译为谐波振荡器", "suggestion": "谐波振荡器",
        }, {
            # 片段里带着锁定译法、建议照样保留：是在维护术语表，不是争议。
            "item_id": "p001-b001", "category": "terminology", "severity": "major",
            "target_span": "谐振子是分子振动的模型体系", "source_span": "model system for molecular vibrations",
            "explanation": "「模型体系」应统一为「模型系统」", "suggestion": "谐振子是分子振动的模型系统",
        }]}],
        chief=[_decide(("p001-b001", "escalate"), ("p001-b002", "escalate"))],
    )
    report, translated = _run(tmp_path, model, translated=translated)

    disputes = report["editorial"]["disputes"]
    assert [(row["item_id"], row["term_target"], row["ruling"]) for row in disputes] == [
        ("p001-b001", "谐振子", "keep_term_base")
    ]
    chief_spans = [issue.get("target_span") for row in model.payload("chief")["items"] if row["item_id"] == "p001-b001" for issue in row["issues"]]
    assert "谐振子" not in chief_spans, "被裁决的意见不再交给修订"
    assert "谐振子是分子振动的模型体系" in chief_spans, "维护术语表的意见照常处理"
    assert "谐振子" in _item(translated, "p001-b001")["translated_text"]
    assert report["editorial"]["term_review"] == {"status": "completed", "by_treatment": {"lock": 1}}
    kinds = [record["kind"] for record in _ledger(tmp_path)]
    assert "dispute" in kinds and "ruling" in kinds
    _assert_matches_contract(report)


def test_blocks_still_wrong_after_two_rounds_are_left_for_a_person(tmp_path: Path) -> None:
    model = EditorialModel(
        chief=["这不是 JSON"],
        rewrite=[{"rewrites": [{"item_id": "p001-b002", "translation": "在 289 K 时键长为 1.21 Å。", "note": ""}]}],
        fix=[{"fixes": []}],
    )
    report, translated = _run(tmp_path, model)

    # 主编请求失败：全部按规则默认——严重的先整块重写，其余先局部改。
    b002 = _fixes(report, "p001-b002")
    assert [(fix["round"], fix["action"], fix["status"]) for fix in b002] == [(1, "rewrite", "rejected"), (2, "patch", "skipped")]
    b001 = _fixes(report, "p001-b001")
    assert [(fix["round"], fix["action"]) for fix in b001] == [(1, "patch"), (2, "patch")]
    escalated = {row["item_id"]: row for row in report["editorial"]["escalated"]}
    assert set(escalated) == {"p001-b001", "p001-b002"}
    assert escalated["p001-b002"]["reason"] == editorial.ESCALATE_ROUNDS
    assert escalated["p001-b002"]["attempts"] == ["rewrite:rejected/unchanged", "patch:skipped/model_returned_no_edit"]
    assert report["editorial"]["decisions"]["by_source"] == {"rule": report["editorial"]["decisions"]["total"]}
    assert any(error["phase"] == "chief" for error in report["errors"])
    assert _item(translated, "p001-b002")["translated_text"] == "在 289 K 时键长为 1.21 Å。"
    _assert_matches_contract(report)


def test_an_interrupted_run_resumes_without_reviewing_again(tmp_path: Path, monkeypatch) -> None:
    translated = _build_job(tmp_path)
    real_triage = editorial._triage

    def boom(*args, **kwargs):
        raise RuntimeError("进程被杀")

    monkeypatch.setattr(editorial, "_triage", boom)
    first = EditorialModel()
    failed, _ = _run(tmp_path, first, translated=translated)
    assert failed["status"] == "failed"
    assert first.purposes() == ["review"]

    monkeypatch.setattr(editorial, "_triage", real_triage)
    second = EditorialModel(
        chief=[_decide(("p001-b001", "rewrite"), ("p001-b002", "escalate"))],
        rewrite=[{"rewrites": [{"item_id": "p001-b001", "translation": B001_FULL, "note": ""}]}],
    )
    report, translated = _run(tmp_path, second, translated=translated)

    assert "review" not in second.purposes(), "续跑复用台账里的问题单，不重复审校"
    assert report["editorial"]["resumed"] is True
    assert report["editorial"]["run_id"] == failed["editorial"]["run_id"]
    assert _item(translated, "p001-b001")["translated_text"] == B001_FULL
    run_ids = {record["run_id"] for record in _ledger(tmp_path)}
    assert run_ids == {report["editorial"]["run_id"]}
    assert [record["kind"] for record in _ledger(tmp_path)].count("run.start") == 1


def test_a_finished_run_is_not_resumed(tmp_path: Path) -> None:
    translated = _build_job(tmp_path)
    _run(tmp_path, EditorialModel(chief=[_decide(("p001-b001", "escalate"), ("p001-b002", "escalate"))]), translated=translated)
    again = EditorialModel(chief=[_decide(("p001-b001", "escalate"), ("p001-b002", "escalate"))])
    report, _ = _run(tmp_path, again, translated=translated)
    assert again.purposes()[0] == "review"
    assert report["editorial"]["resumed"] is False
    assert len({record["run_id"] for record in _ledger(tmp_path)}) == 2


def test_source_text_of_the_omission_reaches_the_rewriter(tmp_path: Path) -> None:
    model = EditorialModel(chief=[_decide(("p001-b001", "rewrite"), ("p001-b002", "escalate"))])
    _run(tmp_path, model)
    item = model.payload("rewrite")["items"][0]
    assert item["source"] == B001_SOURCE
    assert item["max_chars"] >= len(B001_SOURCE), "补整句漏译要给够长度"
    assert item["context_after"].startswith("在 289 K")

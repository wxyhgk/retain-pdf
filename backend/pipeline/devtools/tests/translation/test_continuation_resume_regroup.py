"""续跑时重新分组，不把已有译文的块和没译的块拼成一组（2026-11-26）。

桌面版一本 1000 多页的书续跑（断点 893 页已完成），在 preparing 报
`Translation checkpoint completed items regressed to pending: p028-b003, …`，整本失败。续跑每次都从头重新分组：
规则那一遍重算，模型复核再连上拿不准的对。和上一轮分得不一样时，一块已经单独译好的块会和一块还没译的块连成一组，
这组算不上译完，整组进待办，断点守卫报 regressed。两条路都会走到：

- 规则那一遍这次判「连」（第 2 次 `checkpoint.update`）；
- 上一轮复核那一批回复解析不了、没记结论，这次重问判「连」（第 3 次 `checkpoint.update`）。结论在报错前已经落盘，
  以后每次重试都在同一处失败。

拆开上一轮复核连上的组（「规则那一遍清掉上一轮的拼接」）不会出事：成员的译文还在 `translation_unit_*` 和自己的字段上，
这里也钉住。
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from retainpdf_translation.core.orchestration.units import KEPT_TRANSLATED_DECISION
from retainpdf_translation.core.orchestration.units import keep_translated_blocks_out_of_mixed_groups
from retainpdf_translation.core.payload import save_translations
from retainpdf_translation.core.payload.parts.apply import apply_translated_text_map
from retainpdf_translation.workflow import prepare as prepare_module
from retainpdf_translation.workflow.checkpoint.contract import advance_checkpoint
from retainpdf_translation.workflow.checkpoint.contract import new_checkpoint
from retainpdf_translation.workflow.checkpoint.contract import project_progress
from retainpdf_translation.workflow.phases import continuation as continuation_phase
from retainpdf_translation.workflow.phases.continuation_memo import CONTINUATION_REVIEW_MEMO_FILE_NAME
from retainpdf_translation.workflow.phases.continuation_memo import save_continuation_review_memo

ORCHESTRATOR = "retainpdf_translation.services.continuation.orchestrator"
STATE = "retainpdf_translation.services.continuation.state"

# 上一页最后一段（已译）和下一页第一段（还没译）
TAIL, HEAD = "p001-b001", "p002-b000"


def _item(page_idx: int, block_idx: int, text: str, role: str) -> dict:
    item_id = f"p{page_idx + 1:03d}-b{block_idx:03d}"
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": block_idx,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "bbox": [50, 100 + block_idx * 40, 500, 130 + block_idx * 40],
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [],
        "protected_map": [],
        "math_mode": "placeholder",
        "should_translate": True,
        "layout_mode": "single",
        "layout_zone": "single_column",
        "layout_boundary_role": role,
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": text,
        "translation_unit_formula_map": [],
        "translation_unit_protected_map": [],
        "translation_unit_protected_translated_text": "",
        "translation_unit_translated_text": "",
        "protected_translated_text": "",
        "translated_text": "",
        "group_protected_translated_text": "",
        "group_translated_text": "",
        "continuation_group": "",
        "final_status": "",
        "translation_diagnostics": {},
    }


def _book() -> dict[int, list[dict]]:
    return {
        0: [
            _item(0, 0, "An opening sentence that is complete.", "head"),
            _item(0, 1, "The results of the experiment were", "tail"),
        ],
        1: [
            _item(1, 0, "surprisingly consistent with the theory.", "head"),
            _item(1, 1, "Another paragraph that stands alone.", "tail"),
        ],
    }


def _translate_alone(item: dict) -> None:
    text = f"译文 {item['item_id']}"
    for field in (
        "translation_unit_protected_translated_text",
        "translation_unit_translated_text",
        "protected_translated_text",
        "translated_text",
    ):
        item[field] = text
    item["final_status"] = "translated"
    item["translation_diagnostics"] = {"final_status": "translated"}


def _dead_letter(item: dict) -> None:
    item["final_status"] = "failed"
    item["translation_diagnostics"] = {"final_status": "failed", "degradation_reason": "dead_letter_queue"}


class _Checkpoint:
    """和 `TranslationCheckpointSession.update` 一样的两步：按当前页算待办，交给 `advance_checkpoint` 比对。"""

    def __init__(self, output_dir: Path, previous: dict | None = None) -> None:
        self.output_dir = output_dir
        self.payload = new_checkpoint(identity={}, attempt_id="attempt", previous=previous)
        self.updates: list[dict] = []

    def update(self, phase: str, page_payloads: dict[int, list[dict]], translation_paths: dict[int, Path]) -> None:
        pages, progress = project_progress(
            output_dir=self.output_dir, page_payloads=page_payloads, translation_paths=translation_paths
        )
        advance_checkpoint(self.payload, phase=phase, pages=pages, progress=progress)
        self.updates.append(progress)

    def pending_ids(self) -> set[str]:
        return {item_id for page in self.payload["pages"] for item_id in page["pending_item_ids"]}


class _StopAfterPreparing(Exception):
    pass


@pytest.fixture
def book_run(monkeypatch):
    """走 `prepare_book_payloads` 的前几步（读页、规则那一遍、模型复核和三次 preparing 断点），页面策略之前停下。

    规则那一遍是真的，只把 TAIL→HEAD 这一对的打分换成 `rule["decision"]`，其余对都判断开；
    模型复核用假函数：`review["reply"]` 为 None 时像回复解析不了（不给结论），否则按它回答。"""
    rule = {"decision": "candidate"}
    review = {"reply": None, "calls": 0}

    def _pair_decision(prev: dict, nxt: dict) -> str:
        if (prev.get("item_id"), nxt.get("item_id")) == (TAIL, HEAD):
            return rule["decision"]
        return "break"

    def _fake_review(batch_pairs, **_kwargs):
        review["calls"] += 1
        if review["reply"] is None:
            return {}
        return {pair["pair_id"]: review["reply"] for pair in batch_pairs}

    def _stop(**_kwargs):
        raise _StopAfterPreparing

    monkeypatch.setattr(f"{STATE}.pair_decision", _pair_decision)
    monkeypatch.setattr(f"{ORCHESTRATOR}.pair_join_score", lambda _prev, _next: 0)
    monkeypatch.setattr(f"{ORCHESTRATOR}.pair_break_score", lambda _prev, _next: 0)
    monkeypatch.setattr(f"{ORCHESTRATOR}.review_candidate_pairs", _fake_review)
    monkeypatch.setattr(prepare_module, "run_page_policy_stage", _stop)
    for name in ("emit_stage_progress", "emit_stage_transition"):
        monkeypatch.setattr(continuation_phase, name, lambda **_kwargs: None)

    def _run(output_dir: Path, pages: dict[int, list[dict]], checkpoint: _Checkpoint) -> dict[int, Path]:
        paths = {page_idx: output_dir / f"page-{page_idx + 1:03d}.json" for page_idx in pages}
        for page_idx, payload in pages.items():
            save_translations(paths[page_idx], payload)
        monkeypatch.setattr(prepare_module, "load_page_payloads", lambda **_kwargs: (paths, pages))
        with pytest.raises(_StopAfterPreparing):
            prepare_module.prepare_book_payloads(
                data={},
                output_dir=output_dir,
                page_indices=range(len(pages)),
                api_key="",
                workers=1,
                model="demo",
                base_url="https://example.com/v1",
                mode="sci",
                classify_batch_size=1,
                skip_title_translation=False,
                sci_cutoff_page_idx=None,
                sci_cutoff_block_idx=None,
                checkpoint=checkpoint,
            )
        return paths

    return _run, rule, review


def _interrupted_attempt(tmp_path: Path, book_run, *, partner: str = "untouched") -> tuple[dict, dict]:
    """上一轮：TAIL→HEAD 判不出来，各自单独翻；HEAD 还没翻（或者转成了死信）时断了。"""
    run, rule, review = book_run
    rule["decision"], review["reply"] = "candidate", None
    pages = _book()
    checkpoint = _Checkpoint(tmp_path)
    paths = run(tmp_path, pages, checkpoint)
    assert all(not item["continuation_group"] for payload in pages.values() for item in payload)
    for payload in pages.values():
        for item in payload:
            if item["item_id"] != HEAD:
                _translate_alone(item)
    if partner == "dead_letter":
        _dead_letter(pages[1][0])
    for page_idx, payload in pages.items():
        save_translations(paths[page_idx], payload)
    checkpoint.update("translating", pages, paths)
    assert checkpoint.pending_ids() == {HEAD}
    return pages, checkpoint.payload


@pytest.mark.parametrize("partner", ["untouched", "dead_letter"])
def test_review_newly_joining_a_translated_block_with_an_untranslated_one_does_not_fail_the_resume(
    tmp_path: Path, book_run, partner: str
) -> None:
    run, _rule, review = book_run
    pages, interrupted = _interrupted_attempt(tmp_path, book_run, partner=partner)

    review["reply"] = "join"  # 这次重问，模型判「连」
    resumed = copy.deepcopy(pages)
    checkpoint = _Checkpoint(tmp_path, previous=interrupted)
    run(tmp_path, resumed, checkpoint)

    assert len(checkpoint.updates) == 3
    assert checkpoint.pending_ids() == {HEAD}
    tail = resumed[0][1]
    assert tail["translated_text"] == f"译文 {TAIL}"  # 已有的译文没丢
    assert tail["continuation_group"] == ""
    assert tail["continuation_decision"] == KEPT_TRANSLATED_DECISION
    assert tail["translation_unit_id"] == TAIL
    memo = json.loads((tmp_path / CONTINUATION_REVIEW_MEMO_FILE_NAME).read_text(encoding="utf-8"))
    assert [(pair["prev_item_id"], pair["join"]) for pair in memo["pairs"]] == [(TAIL, True)]


def test_a_job_already_stuck_on_a_remembered_join_recovers_on_retry(tmp_path: Path, book_run) -> None:
    """已经卡住的任务：失败那一轮把「连」记进了 memo，断点还停在报错前。重试直接用 memo，不再问模型，也不再失败。"""
    run, _rule, review = book_run
    pages, interrupted = _interrupted_attempt(tmp_path, book_run)

    # 失败那一轮：模型判了「连」，复核结论先落了盘，随后第 3 次 update 报 regressed，断点没前进
    save_continuation_review_memo(tmp_path, pages, {(TAIL, HEAD): True})
    calls_before = review["calls"]

    review["reply"] = "break"  # 重试时模型要是被再问一次会给不同答案；memo 让它根本不被问
    retry = copy.deepcopy(pages)
    checkpoint = _Checkpoint(tmp_path, previous=interrupted)
    run(tmp_path, retry, checkpoint)

    assert review["calls"] == calls_before
    assert checkpoint.pending_ids() == {HEAD}
    assert retry[0][1]["translated_text"] == f"译文 {TAIL}"


def test_rule_pass_newly_joining_a_translated_block_with_an_untranslated_one_does_not_fail_the_resume(
    tmp_path: Path, book_run
) -> None:
    run, rule, review = book_run
    rule["decision"], review["reply"] = "break", None
    pages = _book()
    first = _Checkpoint(tmp_path)
    paths = run(tmp_path, pages, first)
    for payload in pages.values():
        for item in payload:
            if item["item_id"] != HEAD:
                _translate_alone(item)
    first.update("translating", pages, paths)

    rule["decision"] = "join"  # 规则的输入变了，这次直接判「连」
    resumed = copy.deepcopy(pages)
    checkpoint = _Checkpoint(tmp_path, previous=first.payload)
    run(tmp_path, resumed, checkpoint)

    assert len(checkpoint.updates) == 3
    assert checkpoint.pending_ids() == {HEAD}
    assert resumed[0][1]["translated_text"] == f"译文 {TAIL}"


@pytest.mark.parametrize("second_review", ["join", "break"])
def test_a_group_translated_as_a_unit_survives_being_split_and_rejoined(
    tmp_path: Path, book_run, second_review: str
) -> None:
    """猜测 (a)：上一轮复核连上的组整组译完，续跑时规则那一遍先把组拆开（第 2 次 update），复核再连上或者不连。
    成员的译文在自己的字段和 `translation_unit_*` 上，拆开不算没译。"""
    run, _rule, review = book_run
    review["reply"] = "join"
    pages = _book()
    first = _Checkpoint(tmp_path)
    paths = run(tmp_path, pages, first)
    flat = [item for page_idx in sorted(pages) for item in pages[page_idx]]
    group_unit = pages[0][1]["translation_unit_id"]
    assert group_unit.startswith("__cg__:")
    apply_translated_text_map(flat, {group_unit: "实验结果和理论惊人地一致。", "p001-b000": "开头一句。"})
    first.update("translating", pages, paths)
    assert first.pending_ids() == {"p002-b001"}

    if second_review == "break":
        (tmp_path / CONTINUATION_REVIEW_MEMO_FILE_NAME).unlink()
    review["reply"] = second_review
    resumed = copy.deepcopy(pages)
    checkpoint = _Checkpoint(tmp_path, previous=first.payload)
    run(tmp_path, resumed, checkpoint)

    assert len(checkpoint.updates) == 3
    assert checkpoint.pending_ids() == {"p002-b001"}


def _group_member(item_id: str, group: str, *, translated: bool) -> dict:
    page_idx = int(item_id[1:4]) - 1
    item = _item(page_idx, int(item_id[-3:]), f"text {item_id}", "middle")
    item["continuation_group"] = group
    if translated:
        _translate_alone(item)
    return item


def test_translated_members_split_an_untranslated_chain_into_runs() -> None:
    chain = [
        _group_member("p001-b001", "cg-001-001", translated=False),
        _group_member("p001-b002", "cg-001-001", translated=True),
        _group_member("p001-b003", "cg-001-001", translated=False),
        _group_member("p001-b004", "cg-001-001", translated=False),
    ]
    assert keep_translated_blocks_out_of_mixed_groups(chain) == 1
    assert [item["continuation_group"] for item in chain] == ["", "", "cg-001-001", "cg-001-001"]
    assert chain[1]["translated_text"] == "译文 p001-b002"


def test_untranslated_and_fully_translated_groups_are_left_alone() -> None:
    fresh = [_group_member(f"p001-b00{i}", "cg-001-001", translated=False) for i in range(3)]
    done = [_group_member(f"p002-b00{i}", "cg-002-001", translated=True) for i in range(2)]
    assert keep_translated_blocks_out_of_mixed_groups([*fresh, *done]) == 0
    assert {item["continuation_group"] for item in fresh} == {"cg-001-001"}
    assert {item["continuation_group"] for item in done} == {"cg-002-001"}


def test_a_member_that_policy_keeps_in_the_original_does_not_count_as_untranslated() -> None:
    translated = _group_member("p001-b001", "cg-001-001", translated=True)
    kept = _group_member("p001-b002", "cg-001-001", translated=False) | {"should_translate": False}
    assert keep_translated_blocks_out_of_mixed_groups([translated, kept]) == 0
    assert translated["continuation_group"] == "cg-001-001"

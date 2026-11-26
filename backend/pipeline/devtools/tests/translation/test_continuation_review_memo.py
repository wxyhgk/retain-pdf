"""跨栏 / 跨页连续段复核的结论落盘，重试时接着用（2026-11-04：6574 页的书每次重试都把 92 批复核请求重发一遍）。"""
from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from retainpdf_translation.workflow.phases.continuation_memo import CONTINUATION_REVIEW_MEMO_FILE_NAME
from retainpdf_translation.workflow.phases import continuation as continuation_phase

ORCHESTRATOR = "retainpdf_translation.services.continuation.orchestrator"


def _item(index: int) -> dict:
    text = f"Continuation fragment {index}"
    return {
        "item_id": f"p001-b{index:03d}",
        "page_idx": 0,
        "block_idx": index,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "bbox": [0, index * 20, 200, index * 20 + 12],
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [],
        "should_translate": True,
        "layout_mode": "single",
        "layout_zone": "single_column",
        "layout_boundary_role": "tail" if index % 2 == 0 else "head",
        "translation_unit_id": f"p001-b{index:03d}",
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [f"p001-b{index:03d}"],
        "translation_unit_protected_source_text": text,
        "translation_unit_formula_map": [],
    }


@pytest.fixture
def reviews(monkeypatch) -> list[list[tuple[str, str]]]:
    """把规则那一步换成固定的 4 对候选，模型复核记下每次送了哪些对；p001-b000→b001 判连，其余判不连。"""
    pairs = [{"prev_item_id": f"p001-b{i:03d}", "next_item_id": f"p001-b{i + 1:03d}"} for i in range(4)]
    monkeypatch.setattr(f"{ORCHESTRATOR}.candidate_continuation_pairs", lambda _payload: pairs)
    monkeypatch.setattr(f"{ORCHESTRATOR}.pair_join_score", lambda _prev, _next: 0)
    monkeypatch.setattr(f"{ORCHESTRATOR}.pair_break_score", lambda _prev, _next: 0)
    monkeypatch.setattr(continuation_phase, "emit_stage_progress", lambda **_kwargs: None)
    monkeypatch.setattr(continuation_phase, "emit_stage_transition", lambda **_kwargs: None)
    sent: list[list[tuple[str, str]]] = []

    def _fake_review(batch_pairs, **_kwargs):
        sent.append([(pair["prev_item_id"], pair["next_item_id"]) for pair in batch_pairs])
        return {
            pair["pair_id"]: "join" if pair["prev_item_id"] == "p001-b000" else "break"
            for pair in batch_pairs
            if pair["prev_item_id"] != "p001-b003"  # 这一对模型没给结论（像回复解析不了）
        }

    monkeypatch.setattr(f"{ORCHESTRATOR}.review_candidate_pairs", _fake_review)
    return sent


def _run(tmp_path: Path, pages: dict[int, list[dict]]) -> None:
    continuation_phase.run_continuation_review(
        page_payloads=pages,
        translation_paths={0: tmp_path / "page-001.json"},
        api_key="",
        model="demo",
        base_url="https://example.com/v1",
        workers=1,
        run_diagnostics=None,
        memo_dir=tmp_path,
    )


def test_a_retry_reuses_the_decisions_and_only_reviews_what_was_left_undecided(tmp_path: Path, reviews) -> None:
    original = {0: [_item(index) for index in range(5)]}
    first = copy.deepcopy(original)
    _run(tmp_path, first)
    assert len(reviews[0]) == 4
    saved = json.loads((tmp_path / CONTINUATION_REVIEW_MEMO_FILE_NAME).read_text(encoding="utf-8"))
    # 模型没给结论的那一对不记成「不连」
    assert {(pair["prev_item_id"], pair["join"]) for pair in saved["pairs"]} == {
        ("p001-b000", True),
        ("p001-b001", False),
        ("p001-b002", False),
    }

    retry = copy.deepcopy(original)  # 重试：同一份文档重新读出来
    _run(tmp_path, retry)
    assert reviews[1:] == [[("p001-b003", "p001-b004")]]
    assert retry[0][0]["continuation_group"] == first[0][0]["continuation_group"] != ""
    assert retry[0][0]["continuation_group"] == retry[0][1]["continuation_group"]


def test_a_pair_whose_text_changed_is_reviewed_again(tmp_path: Path, reviews) -> None:
    original = {0: [_item(index) for index in range(5)]}
    _run(tmp_path, copy.deepcopy(original))
    changed = copy.deepcopy(original)
    changed[0][1]["source_text"] = "OCR 重做过，内容变了"
    _run(tmp_path, changed)
    assert sorted(reviews[1]) == [("p001-b000", "p001-b001"), ("p001-b001", "p001-b002"), ("p001-b003", "p001-b004")]


def test_a_broken_memo_file_is_ignored(tmp_path: Path, reviews) -> None:
    (tmp_path / CONTINUATION_REVIEW_MEMO_FILE_NAME).write_text("{not json", encoding="utf-8")
    _run(tmp_path, {0: [_item(index) for index in range(5)]})
    assert len(reviews[0]) == 4


# ---- 一批出错时（2026-11-26，S11）----
# 复核是顾问性质：以前一批碰上暂时性上游错误（重试用尽）就让整本失败，同一轮里别的批已经付钱判出的结论也不落盘，
# 重试时所有对重新问、答案可能不同、分组跟着变。


def _many_pairs_review(monkeypatch, *, pair_count: int, failing_batch: int, error: Exception) -> list[str]:
    """`pair_count` 对候选（一批 24 对），第 `failing_batch` 批抛 `error`，其余批全判「连」。返回各批的请求标签。"""
    pairs = [{"prev_item_id": f"p001-b{i:03d}", "next_item_id": f"p001-b{i + 1:03d}"} for i in range(pair_count)]
    monkeypatch.setattr(f"{ORCHESTRATOR}.candidate_continuation_pairs", lambda _payload: pairs)
    monkeypatch.setattr(f"{ORCHESTRATOR}.pair_join_score", lambda _prev, _next: 0)
    monkeypatch.setattr(f"{ORCHESTRATOR}.pair_break_score", lambda _prev, _next: 0)
    monkeypatch.setattr(continuation_phase, "emit_stage_progress", lambda **_kwargs: None)
    monkeypatch.setattr(continuation_phase, "emit_stage_transition", lambda **_kwargs: None)
    labels: list[str] = []

    def _fake_review(batch_pairs, **kwargs):
        labels.append(kwargs["request_label"])
        if kwargs["request_label"].startswith(f"continuation-review {failing_batch}/"):
            raise error
        return {pair["pair_id"]: "join" for pair in batch_pairs}

    monkeypatch.setattr(f"{ORCHESTRATOR}.review_candidate_pairs", _fake_review)
    return labels


def _saved_pairs(tmp_path: Path) -> set[str]:
    saved = json.loads((tmp_path / CONTINUATION_REVIEW_MEMO_FILE_NAME).read_text(encoding="utf-8"))
    return {pair["prev_item_id"] for pair in saved["pairs"]}


def test_a_transient_failure_in_one_batch_keeps_rule_decisions_for_that_batch_only(tmp_path: Path, monkeypatch) -> None:
    import requests

    labels = _many_pairs_review(
        monkeypatch, pair_count=30, failing_batch=2, error=requests.ConnectionError("upstream 502 after retries")
    )
    pages = {0: [_item(index) for index in range(31)]}
    _run(tmp_path, pages)  # 不再整本失败
    assert len(labels) == 2
    # 第 1 批（24 对）判出的结论生效、落盘；第 2 批的 6 对维持规则那一遍（不连），也不记进 memo，下次重问
    assert _saved_pairs(tmp_path) == {f"p001-b{i:03d}" for i in range(24)}
    group = pages[0][0]["continuation_group"]
    assert group and all(item["continuation_group"] == group for item in pages[0][:25])
    assert all(item.get("continuation_group", "") != group for item in pages[0][25:])


def test_each_batch_is_saved_as_soon_as_it_is_decided(tmp_path: Path, monkeypatch) -> None:
    """不能放过的错（这里是余额不足）照旧让整本失败，但前面已经判完的批不白花钱：已经落盘，重试时直接用。"""
    from retainpdf_translation.llm.shared import upstream_resilience as resilience

    error = resilience.UpstreamQuotaExhausted("402 余额不足")
    labels = _many_pairs_review(monkeypatch, pair_count=30, failing_batch=2, error=error)
    with pytest.raises(resilience.UpstreamQuotaExhausted):
        _run(tmp_path, {0: [_item(index) for index in range(31)]})
    assert len(labels) == 2
    assert _saved_pairs(tmp_path) == {f"p001-b{i:03d}" for i in range(24)}


def test_parallel_review_saves_the_batches_that_finished_before_raising(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_translation.llm.shared import upstream_resilience as resilience

    _many_pairs_review(monkeypatch, pair_count=50, failing_batch=1, error=resilience.UpstreamQuotaExhausted("402"))
    with pytest.raises(resilience.UpstreamQuotaExhausted):
        continuation_phase.run_continuation_review(
            page_payloads={0: [_item(index) for index in range(51)]},
            translation_paths={0: tmp_path / "page-001.json"},
            api_key="",
            model="demo",
            base_url="https://example.com/v1",
            workers=3,
            run_diagnostics=None,
            memo_dir=tmp_path,
        )
    # 三批同时在跑：第 1 批出错，第 2、3 批照样付了钱，它们的结论记下
    assert _saved_pairs(tmp_path) == {f"p001-b{i:03d}" for i in range(24, 50)}


def test_executor_mode_does_not_swallow_transient_review_errors(tmp_path: Path, monkeypatch) -> None:
    """走 Rust 模型执行器时，失败记在执行器里、整本都会停：这里不当「这一批没判」吞掉。"""
    import requests

    _many_pairs_review(monkeypatch, pair_count=4, failing_batch=1, error=requests.ConnectionError("502"))
    monkeypatch.setattr(f"{ORCHESTRATOR}.execution_enabled", lambda: True)
    with pytest.raises(requests.ConnectionError):
        _run(tmp_path, {0: [_item(index) for index in range(5)]})

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

"""去重：代表块失败时，同文副本不能被永久记成「模型判保留原文」（2026-11-26，S21；状态梳理 T-N1）。

书里重复出现的段落、图注只把代表块交给模型，结果展开给副本。以前代表块碰上超时、校验不过时，副本被写成
`skip_model_keep_origin`、`should_translate=False`、`kept_origin`：不算死信，续跑的策略重置专门豁免它，重翻也救不回来；
代表块在同一次运行里重试成功时，副本拿到了译文，却留着 `should_translate=False` + `final_status=translated` 的矛盾组合
（修订接口会拒绝改它）。
"""
from __future__ import annotations

from retainpdf_translation.artifacts import blocking_untranslated_items
from retainpdf_translation.core.payload.parts.units import pending_translation_items
from retainpdf_translation.services.policy.payload_rules.policy_mutations import reset_policy_state
from retainpdf_translation.services.results.applier import TranslationResultApplier
from retainpdf_translation.services.results.flush import TranslationFlushState
from retainpdf_translation_classic.llm.shared.orchestration.terminal_payloads import translation_failed_payload_for_transport
from retainpdf_translation_classic.workflow.batching.dedupe import _dedupe_pending_items

TEXT = "The same repeated sentence about results."


def _item(block_idx: int) -> dict:
    item_id = f"p001-b{block_idx:03d}"
    return {
        "item_id": item_id, "page_idx": 0, "block_idx": block_idx,
        "block_type": "text", "block_kind": "text", "layout_role": "paragraph",
        "semantic_role": "body", "structure_role": "body", "policy_translate": True,
        "raw_block_type": "text", "bbox": [50, 100 + block_idx * 40, 500, 130 + block_idx * 40],
        "source_text": TEXT, "protected_source_text": TEXT,
        "formula_map": [], "protected_map": [], "math_mode": "placeholder",
        "should_translate": True, "layout_mode": "single", "layout_zone": "single_column",
        "layout_boundary_role": "middle",
        "translation_unit_id": item_id, "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id], "translation_unit_protected_source_text": TEXT,
        "translation_unit_formula_map": [], "translation_unit_protected_map": [],
        "translation_unit_protected_translated_text": "", "translation_unit_translated_text": "",
        "protected_translated_text": "", "translated_text": "",
        "group_protected_translated_text": "", "group_translated_text": "",
        "continuation_group": "", "final_status": "", "translation_diagnostics": {},
    }


def _applier() -> tuple[dict, dict, TranslationResultApplier]:
    rep, duplicate = _item(1), _item(2)
    payload = [rep, duplicate]
    unique, duplicates = _dedupe_pending_items(pending_translation_items(payload))
    assert [unit["item_id"] for unit in unique] == [rep["item_id"]]
    flush = TranslationFlushState(page_payloads={0: payload}, translation_paths={}, flush_interval=1, total_batches=1)
    applier = TranslationResultApplier(
        flat_payload=payload, item_to_page={rep["item_id"]: 0, duplicate["item_id"]: 0},
        duplicate_items_by_rep_id=duplicates, flush_state=flush, memory_store=None,
    )
    return rep, duplicate, applier


def _fail(rep: dict, applier: TranslationResultApplier) -> None:
    failed = translation_failed_payload_for_transport(
        rep, route_path=["block_level", "plain_text"], degradation_reason="transport_timeout", error_code="timeout",
    )
    applier.apply_batch([rep], failed, update_memory=False)


def test_duplicate_of_a_failed_representative_stays_pending() -> None:
    rep, duplicate, applier = _applier()
    _fail(rep, applier)
    assert (rep["final_status"], rep["should_translate"]) == ("failed", True)
    # 副本跟代表块同命：要翻、记失败，不是「模型判保留原文」
    assert duplicate["should_translate"] is True
    assert duplicate["final_status"] == "failed"
    assert duplicate.get("classification_label", "") != "skip_model_keep_origin"
    # 和代表块一样挡着导出（交给最终补救），续跑时策略重置不豁免它，待办里有它
    blocked = {row["item_id"] for row in blocking_untranslated_items({0: [rep, duplicate]})}
    assert blocked == {rep["item_id"], duplicate["item_id"]}
    reset_policy_state([rep, duplicate])
    assert duplicate["should_translate"] is True
    assert {unit["item_id"] for unit in pending_translation_items([rep, duplicate])} == {rep["item_id"], duplicate["item_id"]}


def test_duplicate_gets_the_translation_when_the_representative_succeeds_on_retry() -> None:
    rep, duplicate, applier = _applier()
    _fail(rep, applier)
    # 同一次运行里尾部重试成功（同一个 applier、同一张副本表）
    applier.apply_batch([rep], {rep["item_id"]: {
        "decision": "translate", "translated_text": "同一句关于结果的话。",
        "translation_diagnostics": {"route_path": ["tail_retry"], "final_status": "translated"},
    }}, update_memory=False)
    assert rep["final_status"] == "translated"
    assert duplicate["translated_text"] == "同一句关于结果的话。"
    assert duplicate["final_status"] == "translated"
    # 不再留下 should_translate=False + translated 的矛盾组合
    assert duplicate["should_translate"] is True
    assert duplicate.get("classification_label", "") != "skip_model_keep_origin"
    assert blocking_untranslated_items({0: [rep, duplicate]}) == []

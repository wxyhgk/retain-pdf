from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.core.payload.parts.diagnostics import record_translation_diagnostics


def test_top_level_merge_semantics_unchanged() -> None:
    # 契约:顶层仍是 dict、覆盖式 merge——现有读方(前端/Rust/debug index)零感知。
    item = {
        "translation_diagnostics": {
            "route_path": ["batch"],
            "degradation_reason": "old",
            "untouched_key": 1,
        }
    }

    record_translation_diagnostics(item, "agent_repair", {"degradation_reason": "new"})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["degradation_reason"] == "new"
    assert diagnostics["route_path"] == ["batch"]
    assert diagnostics["untouched_key"] == 1


def test_history_preserves_per_stage_updates() -> None:
    # 此前 degradation_reason/fallback_to 被后写阶段覆盖即丢历史;
    # 现在每个阶段的 updates 都留在 history 里。
    item: dict = {}

    record_translation_diagnostics(
        item, "garbled_reconstruction", {"degradation_reason": "garbled_reconstructed"}
    )
    record_translation_diagnostics(
        item, "final_recovery", {"degradation_reason": "blocking_untranslated_recovered"}
    )

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["degradation_reason"] == "blocking_untranslated_recovered"
    assert diagnostics["history"] == [
        {"stage": "garbled_reconstruction", "degradation_reason": "garbled_reconstructed"},
        {"stage": "final_recovery", "degradation_reason": "blocking_untranslated_recovered"},
    ]


def test_rereads_item_state_instead_of_stale_snapshot() -> None:
    # 覆盖旧模式的病灶:"先构造快照、中间别人写入、再整段回写"。
    # helper 写入前必须重读 item 当前诊断。
    item = {"translation_diagnostics": {"a": 1}}
    item["translation_diagnostics"] = {**item["translation_diagnostics"], "written_in_between": True}

    record_translation_diagnostics(item, "final_recovery", {"b": 2})

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["written_in_between"] is True
    assert diagnostics["a"] == 1
    assert diagnostics["b"] == 2

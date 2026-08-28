from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.final_status import (
    FAILED_STATUS,
    KEPT_ORIGIN_STATUS,
    TRANSLATED_STATUS,
    final_status_violation,
    set_final_status,
)
from services.translation.core.payload.parts.policy_state import (
    mark_policy_skip,
    mark_translation_failed_policy_state,
)


def test_normal_transitions_leave_no_breadcrumb() -> None:
    item: dict = {}

    set_final_status(item, FAILED_STATUS)  # pending -> failed
    set_final_status(item, TRANSLATED_STATUS)  # failed -> translated(修复链拉回)
    set_final_status(item, KEPT_ORIGIN_STATUS)  # translated -> kept_origin(策略收口)

    assert item["final_status"] == KEPT_ORIGIN_STATUS
    assert "translation_diagnostics" not in item


def test_demoting_translated_to_failed_records_breadcrumb_but_still_writes() -> None:
    # Hợp đồng v1: chỉ quan sát không chặn. Vi phạm vẫn ghi bình thường, nhưng phải để lại breadcrumb có thể quan sát.
    item = {"final_status": TRANSLATED_STATUS}

    set_final_status(item, FAILED_STATUS)

    assert item["final_status"] == FAILED_STATUS
    assert item["translation_diagnostics"]["final_status_violations"] == [
        "demotion:translated->failed"
    ]


def test_unknown_status_records_breadcrumb() -> None:
    item: dict = {}

    set_final_status(item, "some_new_status")

    assert item["final_status"] == "some_new_status"
    assert item["translation_diagnostics"]["final_status_violations"] == [
        "unknown_status:some_new_status"
    ]


def test_breadcrumbs_accumulate_and_preserve_existing_diagnostics() -> None:
    item = {
        "final_status": TRANSLATED_STATUS,
        "translation_diagnostics": {"route_path": ["batch"]},
    }

    set_final_status(item, FAILED_STATUS)
    set_final_status(item, "bogus")

    diagnostics = item["translation_diagnostics"]
    assert diagnostics["route_path"] == ["batch"]
    assert diagnostics["final_status_violations"] == [
        "demotion:translated->failed",
        "unknown_status:bogus",
    ]


def test_final_status_violation_is_pure_check() -> None:
    assert final_status_violation("", TRANSLATED_STATUS) == ""
    assert final_status_violation(FAILED_STATUS, TRANSLATED_STATUS) == ""
    assert final_status_violation(TRANSLATED_STATUS, FAILED_STATUS) == "demotion:translated->failed"
    assert final_status_violation("", "nope") == "unknown_status:nope"


def test_policy_helpers_route_through_funnel() -> None:
    # mark_translation_failed_policy_state áp dụng trên item đã dịch = tình huống hạ cấp thực tế,
    # sau khi qua funnel phải để lại breadcrumb; mark_policy_skip thu gọn bình thường không để lại.
    translated_item = {
        "final_status": TRANSLATED_STATUS,
        "translated_text": "已有译文",
    }
    mark_translation_failed_policy_state(translated_item)
    assert translated_item["final_status"] == FAILED_STATUS
    assert (
        "demotion:translated->failed"
        in translated_item["translation_diagnostics"]["final_status_violations"]
    )

    fresh_item = {"source_text": "References", "protected_source_text": "References"}
    mark_policy_skip(fresh_item, "skip_reference_zone")
    assert fresh_item["final_status"] == KEPT_ORIGIN_STATUS
    assert "final_status_violations" not in fresh_item.get("translation_diagnostics", {})

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_policy_skip
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_translation_required
from retainpdf_pipeline.translate.core.payload.parts.common import seed_orchestration_metadata
from retainpdf_pipeline.translate.services.policy.payload_rules.policy_mutations import reset_policy_state


def test_reset_policy_preserves_completed_keep_origin_result() -> None:
    item = {"policy_translate": True, "source_text": "https://example.invalid/reference"}
    mark_policy_skip(item, "skip_model_keep_origin", skip_reason="pure_url")
    item["translation_diagnostics"] = {"route_path": ["fast_path_keep_origin"]}
    expected = dict(item)

    assert reset_policy_state([item]) == 0
    assert all(item[key] == value for key, value in expected.items())


@pytest.mark.parametrize("final_status", ["", "failed"])
def test_reset_policy_does_not_freeze_unfinished_keep_origin_label(final_status: str) -> None:
    item = {
        "policy_translate": True,
        "classification_label": "skip_model_keep_origin",
        "should_translate": False,
        "skip_reason": "stale",
        "final_status": final_status,
    }

    assert reset_policy_state([item]) == 1
    assert item["should_translate"] is True
    assert item["classification_label"] == ""
    assert item["skip_reason"] == ""
    assert item["final_status"] == final_status


def test_reset_policy_still_recomputes_page_policy_labels() -> None:
    item = {"policy_translate": True}
    mark_policy_skip(item, "skip_title")

    assert reset_policy_state([item]) == 1
    assert item["should_translate"] is True
    assert item["classification_label"] == ""


def test_reset_policy_does_not_preserve_inconsistent_keep_origin_state() -> None:
    item = {
        "policy_translate": True,
        "classification_label": "skip_model_keep_origin",
        "should_translate": True,
        "final_status": "kept_origin",
        "skip_reason": "stale",
    }

    assert reset_policy_state([item]) == 1
    assert item["should_translate"] is True
    assert item["skip_reason"] == ""


def test_mark_policy_skip_clears_translation_and_sets_keep_origin_state() -> None:
    item = {
        "source_text": "References",
        "protected_source_text": "References",
        "translated_text": "参考文献",
        "protected_translated_text": "参考文献",
        "translation_unit_translated_text": "参考文献",
        "translation_unit_protected_translated_text": "参考文献",
    }

    mark_policy_skip(item, "skip_reference_zone")

    assert item["classification_label"] == "skip_reference_zone"
    assert item["should_translate"] is False
    assert item["skip_reason"] == "skip_reference_zone"
    assert item["final_status"] == "kept_origin"
    assert item["translated_text"] == ""
    assert item["protected_translated_text"] == ""
    assert item["translation_unit_translated_text"] == ""
    assert item["translation_unit_protected_translated_text"] == ""


def test_mark_translation_required_clears_skip_state_without_touching_translation() -> None:
    item = {
        "classification_label": "skip_reference_zone",
        "should_translate": False,
        "skip_reason": "skip_reference_zone",
        "translated_text": "existing text",
    }

    mark_translation_required(item, label="translate_literal")

    assert item["classification_label"] == "translate_literal"
    assert item["should_translate"] is True
    assert item["skip_reason"] == ""
    assert item["translated_text"] == "existing text"


def test_seed_orchestration_metadata_preserves_policy_skip_reason() -> None:
    # 回归:编排阶段曾无条件用 classification_label 覆盖 policy 写的详细 skip_reason。
    item = {
        "item_id": "p1-b2",
        "classification_label": "formula",
        "should_translate": False,
        "skip_reason": "保留公式原文，避免破坏 LaTeX",
        "protected_source_text": "$x^2$",
    }

    seed_orchestration_metadata(item)

    assert item["skip_reason"] == "保留公式原文，避免破坏 LaTeX"
    # 后半段编排字段仍必须被写入(证明修复没有跳过函数其余职责)。
    assert item["translation_unit_id"] == "p1-b2"
    assert item["translation_unit_kind"] == "single"
    assert item["translation_unit_member_ids"] == ["p1-b2"]


def test_seed_orchestration_metadata_fills_skip_reason_from_label_when_empty() -> None:
    item = {
        "item_id": "p1-b3",
        "classification_label": "skip_short_no_trans",
        "should_translate": False,
        "skip_reason": "",
        "protected_source_text": "Fig. 1",
    }

    seed_orchestration_metadata(item)

    assert item["skip_reason"] == "skip_short_no_trans"


def test_seed_orchestration_metadata_clears_stale_skip_reason_when_translatable() -> None:
    item = {
        "item_id": "p1-b4",
        "classification_label": "",
        "should_translate": True,
        "skip_reason": "stale reason",
        "protected_source_text": "Hello world",
    }

    seed_orchestration_metadata(item)

    assert item["skip_reason"] == ""

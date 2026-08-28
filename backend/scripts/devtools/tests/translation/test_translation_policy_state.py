from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.core.payload.parts.policy_state import mark_policy_skip
from services.translation.core.payload.parts.policy_state import mark_translation_required
from services.translation.core.payload.parts.common import seed_orchestration_metadata


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
    # quay lại:Giai đoạn điều phối đã được sử dụng vô điều kiện classification_label bao trùm policy Viết chi tiết skip_reason。
    item = {
        "item_id": "p1-b2",
        "classification_label": "formula",
        "should_translate": False,
        "skip_reason": "保留公式原文，避免破坏 LaTeX",
        "protected_source_text": "$x^2$",
    }

    seed_orchestration_metadata(item)

    assert item["skip_reason"] == "保留公式原文，避免破坏 LaTeX"
    # Nửa sau của lĩnh vực biên đạo múa vẫn phải được viết(Chứng minh rằng bản sửa lỗi không bỏ qua phần còn lại của trách nhiệm của chức năng)。
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

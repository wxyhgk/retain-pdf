import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.policy.config import build_translation_policy_config
from retainpdf_pipeline.translate.services.policy.flow import apply_translation_policies
from retainpdf_pipeline.translate.services.policy.structured_technical_blocks import (
    collect_structured_technical_hints,
)
from retainpdf_pipeline.translate.services.policy.structured_technical_blocks import (
    looks_like_structured_technical_block,
)


def test_structured_technical_blocks_add_context_without_local_skip() -> None:
    payload = [
        {
            "item_id": "p019-b012",
            "page_idx": 18,
            "block_idx": 12,
            "block_type": "text",
            "block_kind": "text",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": "• Default: 0",
            "protected_source_text": "• Default: 0",
            "metadata": {"structure_role": "body"},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "• Default: 0",
            "translation_unit_formula_map": [],
            "formula_map": [],
            "mixed_original_protected_source_text": "• Default: 0",
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "protected_translated_text": "",
            "translated_text": "",
            "group_protected_translated_text": "",
            "group_translated_text": "",
            "final_status": "",
        },
        {
            "item_id": "p019-b015",
            "page_idx": 18,
            "block_idx": 15,
            "block_type": "text",
            "block_kind": "text",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": "• Required: yes • Format: JSON • Example: config/train.json",
            "protected_source_text": "• Required: yes • Format: JSON • Example: config/train.json",
            "metadata": {"structure_role": "body"},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "• Required: yes • Format: JSON • Example: config/train.json",
            "translation_unit_formula_map": [],
            "formula_map": [],
            "mixed_original_protected_source_text": "• Required: yes • Format: JSON • Example: config/train.json",
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "protected_translated_text": "",
            "translated_text": "",
            "group_protected_translated_text": "",
            "group_translated_text": "",
            "final_status": "",
        },
    ]

    _, summary = apply_translation_policies(
        payload=payload,
        mode="sci",
        classify_batch_size=8,
        workers=1,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        skip_title_translation=False,
        page_idx=18,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
        policy_config=build_translation_policy_config(
            mode="sci",
            skip_title_translation=False,
            enable_page_no_trans_classification=False,
            enable_reference_zone_skip=False,
        ),
    )

    assert summary["structured_technical_blocks"] == 2
    assert all(item["should_translate"] is True for item in payload)
    assert all(item["classification_label"] == "" for item in payload)
    assert all(item["translation_structure_kind"] == "structured_technical_block" for item in payload)
    assert "字段名" in payload[0]["translation_style_hint"]
    assert "Required" in payload[1]["translation_style_hint"]


def test_structured_technical_blocks_do_not_mark_single_field_prose() -> None:
    item = {
        "source_text": (
            "Note: This option controls how the model handles very large training datasets "
            "during graph construction."
        )
    }

    assert looks_like_structured_technical_block(item) is False


def test_structured_technical_blocks_collect_hints_without_mutating_payload() -> None:
    payload = [
        {
            "item_id": "p019-b015",
            "source_text": "• Required: yes • Format: JSON • Example: config/train.json",
            "metadata": {},
            "classification_label": "",
            "should_translate": True,
        }
    ]

    hints = collect_structured_technical_hints(payload)

    assert len(hints) == 1
    assert hints[0].item_id == "p019-b015"
    assert hints[0].structure_kind == "structured_technical_block"
    assert "Required" in hints[0].style_hint
    assert "translation_structure_kind" not in payload[0]
    assert payload[0]["classification_label"] == ""
    assert payload[0]["should_translate"] is True

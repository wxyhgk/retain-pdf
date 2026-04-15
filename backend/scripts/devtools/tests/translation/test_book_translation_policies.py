import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from runtime.pipeline.book_translation_policies import finalize_page_payloads
from services.translation.policy.config import build_translation_policy_config
from services.translation.payload.parts.policy_mutations import apply_cjk_source_keep_origin
from services.translation.payload.parts.policy_mutations import apply_title_skip


def _page_payload_item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    bbox: list[float],
    group_id: str,
    order: int,
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "bbox": bbox,
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [],
        "classification_label": "",
        "should_translate": True,
        "ocr_continuation_source": "provider",
        "ocr_continuation_group_id": group_id,
        "ocr_continuation_role": "head" if order == 0 else "tail",
        "ocr_continuation_scope": "cross_page",
        "ocr_continuation_reading_order": order,
        "layout_mode": "",
        "layout_split_x": 0.0,
        "layout_zone": "",
        "layout_zone_rank": -1,
        "layout_zone_size": 0,
        "layout_boundary_role": "",
        "continuation_group": "",
        "continuation_prev_text": "",
        "continuation_next_text": "",
        "continuation_decision": "",
        "continuation_candidate_prev_id": "",
        "continuation_candidate_next_id": "",
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": text,
        "translation_unit_formula_map": [],
    }


def test_finalize_page_payloads_annotates_layout_before_cross_page_provider_join() -> None:
    group_id = "provider-generic-global-1"
    page_payloads = {
        0: [
            _page_payload_item(
                item_id="p001-b000",
                page_idx=0,
                text="This sentence continues with enough context",
                bbox=[0, 0, 180, 20],
                group_id=group_id,
                order=0,
            )
        ],
        1: [
            _page_payload_item(
                item_id="p002-b000",
                page_idx=1,
                text="and additional evidence from the next page.",
                bbox=[0, 0, 180, 20],
                group_id=group_id,
                order=1,
            )
        ],
    }

    with tempfile.TemporaryDirectory() as tmp:
        translation_paths = {
            0: Path(tmp) / "page-001.json",
            1: Path(tmp) / "page-002.json",
        }
        summary = finalize_page_payloads(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
        )

    assert summary["provider_joined_items"] == 2
    assert page_payloads[0][0]["layout_zone"] == "single_column"
    assert page_payloads[1][0]["layout_zone"] == "single_column"
    assert page_payloads[0][0]["continuation_decision"] == "provider_joined"
    assert page_payloads[1][0]["continuation_decision"] == "provider_joined"
    assert page_payloads[0][0]["continuation_group"] == group_id


def test_policy_config_defaults_keep_legacy_skip_rules_disabled() -> None:
    config = build_translation_policy_config(mode="sci", skip_title_translation=False)

    assert config.enable_narrow_body_noise_skip is False
    assert config.enable_metadata_fragment_skip is False


def test_policy_config_honors_explicit_true_skip_rule_overrides() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_narrow_body_noise_skip=True,
        enable_metadata_fragment_skip=True,
    )

    assert config.enable_narrow_body_noise_skip is True
    assert config.enable_metadata_fragment_skip is True


def test_policy_config_honors_explicit_false_skip_rule_overrides() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_narrow_body_noise_skip=False,
        enable_metadata_fragment_skip=False,
    )

    assert config.enable_narrow_body_noise_skip is False
    assert config.enable_metadata_fragment_skip is False


def test_policy_config_mixes_override_and_default_skip_rule_values() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_narrow_body_noise_skip=True,
    )

    assert config.enable_narrow_body_noise_skip is True
    assert config.enable_metadata_fragment_skip is False


def test_policy_config_keeps_metadata_fragment_page_idx_contract() -> None:
    default_config = build_translation_policy_config(mode="sci", skip_title_translation=False)
    overridden_config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        metadata_fragment_max_page_idx=3,
    )

    assert default_config.metadata_fragment_max_page_idx == 8
    assert overridden_config.metadata_fragment_max_page_idx == 3


def test_policy_config_honors_skip_title_translation_false() -> None:
    config = build_translation_policy_config(mode="sci", skip_title_translation=False)
    assert config.enable_title_skip is False


def test_policy_config_honors_skip_title_translation_true() -> None:
    config = build_translation_policy_config(mode="sci", skip_title_translation=True)
    assert config.enable_title_skip is True


def test_apply_title_skip_preserves_source_text_for_render_fallback() -> None:
    payload = [
        {
            "item_id": "p001-b000",
            "block_type": "title",
            "source_text": "Introduction",
            "protected_source_text": "Introduction",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "protected_translated_text": "",
            "translated_text": "",
            "group_protected_translated_text": "",
            "group_translated_text": "",
        }
    ]

    skipped = apply_title_skip(payload)

    assert skipped == 1
    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_title"
    assert payload[0]["translated_text"] == "Introduction"
    assert payload[0]["protected_translated_text"] == "Introduction"


def test_apply_cjk_source_keep_origin_skips_cjk_body_text() -> None:
    payload = [
        {
            "item_id": "p036-b015",
            "page_idx": 35,
            "block_idx": 15,
            "block_type": "text",
            "source_text": "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。",
            "protected_source_text": "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。",
            "metadata": {"structure_role": "body"},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "protected_translated_text": "",
            "translated_text": "",
            "group_protected_translated_text": "",
            "group_translated_text": "",
            "final_status": "",
        }
    ]

    skipped = apply_cjk_source_keep_origin(payload)

    assert skipped == 1
    assert payload[0]["classification_label"] == "skip_cjk_source_body"
    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_cjk_source_body"
    assert payload[0]["translated_text"] == payload[0]["source_text"]
    assert payload[0]["protected_translated_text"] == payload[0]["protected_source_text"]
    assert payload[0]["final_status"] == "kept_origin"

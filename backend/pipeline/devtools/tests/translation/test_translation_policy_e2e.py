from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.artifacts.status import blocking_review_error_items
from retainpdf_pipeline.translate.artifacts.status import blocking_untranslated_items
from retainpdf_pipeline.translate.core.payload.parts.apply import apply_single_translated_entry
from retainpdf_pipeline.translate.llm.result_payload import result_entry
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
from retainpdf_pipeline.translate.services.agents.review_artifact import build_translation_review
from retainpdf_pipeline.translate.services.finalization.untranslated import recover_blocking_untranslated_items
from retainpdf_pipeline.translate.workflow.batching.plan import _build_translation_batches


def _item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "page_idx": 0,
        "block_idx": 1,
        "block_type": "text",
        "block_kind": "text",
        "raw_block_type": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "metadata": {"structure_role": "body"},
        "source_text": source_text,
        "protected_source_text": source_text,
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": source_text,
        "translation_unit_formula_map": [],
        "translation_unit_protected_map": [],
        "protected_map": [],
        "formula_map": [],
        "should_translate": True,
        "classification_label": "",
        "skip_reason": "",
        "final_status": "",
        "translated_text": "",
        "protected_translated_text": "",
        "translation_unit_translated_text": "",
        "translation_unit_protected_translated_text": "",
    }
    item.update(overrides)
    return item


def test_policy_keep_origin_item_stays_out_of_model_review_and_export_gates() -> None:
    context = build_translation_control_context()
    hex_source = "Answer(slave-Base module):\n" + " ".join(["01", "03", "40", "FF", "00"] * 80)
    payload = [_item("p182-b016", hex_source)]

    batches, immediate_results = _build_translation_batches(
        payload,
        effective_batch_size=4,
        translation_context=context,
    )
    for immediate in immediate_results:
        for item_id, translated_entry in immediate.items():
            apply_single_translated_entry(payload[0], translated_entry)

    review = build_translation_review(translated_pages_map={0: payload})

    assert batches == []
    assert list(immediate_results[0]) == ["p182-b016"]
    assert payload[0]["final_status"] == "kept_origin"
    assert payload[0]["classification_label"] == "skip_model_keep_origin"
    assert blocking_review_error_items(review) == []
    assert blocking_untranslated_items({0: payload}) == []


def test_translatable_empty_result_blocks_then_final_recovery_clears_gate() -> None:
    payload = [_item("p001-b001", "The density functional is evaluated on the numerical grid.")]
    apply_single_translated_entry(payload[0], {"decision": "translate", "translated_text": "", "final_status": "failed"})

    assert blocking_untranslated_items({0: payload})[0]["item_id"] == "p001-b001"

    calls = 0

    def _fake_request(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return "密度泛函在数值网格上求值。"

    summary = recover_blocking_untranslated_items(
        {0: payload},
        api_key="sk-test",
        model="demo-model",
        base_url="https://example.com/v1",
        request_chat_content_fn=_fake_request,
    )

    assert calls == 1
    assert summary.recovered_items == 1
    assert payload[0]["final_status"] == "translated"
    assert blocking_untranslated_items({0: payload}) == []


def test_policy_keep_origin_review_error_does_not_block_review_gate() -> None:
    payload = [
        _item(
            "p002-b008",
            "$$ E = mc^2 $$",
            raw_block_type="display_formula",
            block_type="formula",
            block_kind="formula",
            should_translate=False,
            policy_translate=False,
            classification_label="skip_model_keep_origin",
            skip_reason="skip_model_keep_origin",
            final_status="kept_origin",
        )
    ]
    review = build_translation_review(translated_pages_map={0: payload})
    review["issues"].append(
        {
            "item_id": "p002-b008",
            "page_idx": 0,
            "kind": "empty_translation",
            "severity": "error",
            "message": "Translation output is empty",
            "policy_state": {
                "item_id": "p002-b008",
                "raw_block_type": "display_formula",
                "should_translate": False,
                "policy_translate": False,
                "classification_label": "skip_model_keep_origin",
                "skip_reason": "skip_model_keep_origin",
                "final_status": "kept_origin",
                "source_text": "$$ E = mc^2 $$",
            },
        }
    )

    assert blocking_review_error_items(review) == []

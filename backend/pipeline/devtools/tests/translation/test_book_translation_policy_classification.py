import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.context import TranslationDocumentContext
from retainpdf_pipeline.translate.services.policy.flow import apply_translation_policies
from retainpdf_pipeline.translate.services.policy.planner import TranslationPlanner


def test_translation_planner_reuses_page_context_for_no_trans_classification() -> None:
    captured = {}

    def _fake_request(messages, **kwargs):
        captured["messages"] = messages
        return "no-trans: 1"

    payload = [
        {
            "item_id": "p008-b003",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "bbox": [10, 20, 300, 80],
            "source_text": "$ source deeph/bin/activate",
            "protected_source_text": "$ source deeph/bin/activate",
            "formula_map": [],
            "lines": [{"spans": [{"content": "$ source deeph/bin/activate"}]}],
            "metadata": {"structure_role": "body"},
        }
    ]

    labels = TranslationPlanner(
        TranslationDocumentContext(mode="sci", rule_guidance="technical manual")
    ).classify_no_trans(
        payload,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        batch_size=8,
        request_label="classification page 8",
        request_chat_content_fn=_fake_request,
    )

    assert labels == {"p008-b003": "code"}
    assert "technical manual" in captured["messages"][0]["content"]
    assert "$ source deeph/bin/activate" in captured["messages"][1]["content"]


def test_apply_translation_policies_does_not_call_no_trans_classifier_by_default(monkeypatch) -> None:
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("no-trans classifier should be opt-in")

    monkeypatch.setattr(TranslationPlanner, "classify_no_trans", _fail_if_called)
    payload = [
        {
            "item_id": "p001-b001",
            "page_idx": 0,
            "block_idx": 1,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": "Default: 0\nType: <INT>",
            "protected_source_text": "Default: 0\nType: <INT>",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": "Default: 0\nType: <INT>",
            "translation_unit_formula_map": [],
            "formula_map": [],
            "mixed_original_protected_source_text": "",
            "translation_unit_protected_translated_text": "",
            "translation_unit_translated_text": "",
            "protected_translated_text": "",
            "translated_text": "",
            "group_protected_translated_text": "",
            "group_translated_text": "",
            "final_status": "",
            "layout_zone": "",
        }
    ]

    classified, _ = apply_translation_policies(
        payload=payload,
        mode="sci",
        classify_batch_size=8,
        workers=1,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        skip_title_translation=False,
        page_idx=0,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
    )

    assert classified == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""

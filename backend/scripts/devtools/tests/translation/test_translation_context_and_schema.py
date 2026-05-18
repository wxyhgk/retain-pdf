from __future__ import annotations

import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.translation.continuation import review as continuation_review
from services.translation.llm import domain_context
from services.translation.llm.shared import control_context
from services.translation.context import models as context_models
from services.translation.postprocess import garbled_reconstruction
from services.translation import session_context


def test_continuation_review_uses_strict_json_schema_format() -> None:
    schema = continuation_review.CONTINUATION_REVIEW_RESPONSE_SCHEMA
    assert schema["type"] == "json_schema"
    assert schema["json_schema"]["strict"]
    assert schema["json_schema"]["schema"]["required"] == ["decisions"]


def test_domain_context_uses_strict_json_schema_format() -> None:
    schema = domain_context.DOMAIN_CONTEXT_RESPONSE_SCHEMA
    assert schema["type"] == "json_schema"
    assert schema["json_schema"]["strict"]
    assert schema["json_schema"]["schema"]["required"] == ["domain", "summary", "translation_guidance"]


def test_garbled_reconstruction_uses_strict_json_schema_format() -> None:
    schema = garbled_reconstruction.GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA
    assert schema["type"] == "json_schema"
    assert schema["json_schema"]["strict"]
    assert schema["json_schema"]["schema"]["required"] == ["translated_text"]


def test_garbled_reconstruction_skips_formula_bearing_items() -> None:
    item = {
        "item_id": "p003-b005",
        "block_type": "text",
        "should_translate": True,
        "translation_unit_protected_source_text": "根据 <f1-e29/> 可得 Q_t。",
        "translation_unit_protected_translated_text": "",
        "translation_unit_formula_map": [
            {"placeholder": "<f1-e29/>", "formula_text": r"Q _ { t } = (1 - \beta_t) I + \beta_t 1 m^\top"}
        ],
        "translation_unit_protected_map": [
            {
                "token_tag": "<f1-e29/>",
                "token_type": "formula",
                "original_text": r"Q _ { t } = (1 - \beta_t) I + \beta_t 1 m^\top",
                "restore_text": r"Q _ { t } = (1 - \beta_t) I + \beta_t 1 m^\top",
                "source_offset": 3,
                "checksum": "e29",
            }
        ],
    }
    assert not garbled_reconstruction.should_reconstruct_garbled_item(item)


def test_domain_context_cache_round_trip() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        output_dir = Path(tmp)
        payload = {
            "domain": "chemistry",
            "summary": "cached",
            "translation_guidance": "guidance",
            "preview_text": "preview",
        }
        domain_context.save_domain_context(output_dir, payload)
        loaded = domain_context.load_cached_domain_context(output_dir)
        assert loaded == payload


def test_domain_context_raw_response_round_trip() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        output_dir = Path(tmp)
        path = domain_context.save_domain_context_raw(output_dir, "raw model response")
        assert path.read_text(encoding="utf-8") == "raw model response"


def test_translation_control_context_merges_terms_retrieval_and_extra_guidance() -> None:
    context = control_context.build_translation_control_context(
        mode="sci",
        domain_guidance="domain-guidance",
        rule_guidance="rule-guidance",
        extra_guidance="extra-guidance",
        glossary_entries=[control_context.GlossaryEntry(source="Engram", target="Engram")],
        retrieval_entries=[control_context.RetrievalEvidence(source="rag-1", content="Retrieved note")],
    )
    merged = context.merged_guidance
    assert "domain-guidance" in merged
    assert "rule-guidance" in merged
    assert "Glossary preferences:" in merged
    assert "Retrieved reference context:" in merged
    assert "extra-guidance" in merged


def test_build_translation_context_from_policy_uses_policy_guidance() -> None:
    class _Policy:
        mode = "sci"
        domain_context = {"translation_guidance": "domain-guidance"}
        rule_guidance = "rule-guidance"

    context = session_context.build_translation_context_from_policy(
        _Policy(),
        extra_guidance="extra-guidance",
        retrieval_entries=[session_context.RetrievalEvidence(source="rag", content="snippet")],
    )
    assert context.mode == "sci"
    assert "domain-guidance" in context.merged_guidance
    assert "rule-guidance" in context.merged_guidance
    assert "extra-guidance" in context.merged_guidance
    assert "snippet" in context.merged_guidance
    assert context.engine_profile_name == "balanced"
    assert context.batch_policy.plain_batch_size == 6


def test_build_translation_context_uses_model_profile_overrides() -> None:
    class _Policy:
        mode = "sci"
        domain_context = {"translation_guidance": "domain-guidance"}
        rule_guidance = "rule-guidance"

    context = session_context.build_translation_context_from_policy(
        _Policy(),
        model="qwen35-9b-q4km",
        base_url="http://example.com/v1",
    )
    assert context.engine_profile_name == "qwen35_low_concurrency_fast"
    assert context.fallback_policy.formula_segment_attempts == 2
    assert context.segmentation_policy.prefer_plain_when_segment_count_leq == 6


def test_translation_item_context_normalizes_prompt_context() -> None:
    context = context_models.build_item_context(
        {
            "item_id": "p006-b056",
            "page_idx": 5,
            "block_idx": 56,
            "block_type": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "source_text": "The combination of these results",
            "protected_source_text": "The combination of these results",
            "continuation_group": "cg-001",
            "continuation_prev_text": "before <f1-2e5/> context",
            "continuation_next_text": "after @@P12@@ [[FORMULA_3]] context",
            "metadata": {"structure_role": "body"},
        },
        order=3,
    )

    assert context.item_id == "p006-b056"
    assert context.page_idx == 5
    assert context.order == 3
    assert context.block_kind == "text"
    assert context.effective_role == "paragraph"
    assert context.context_before_for_prompt() == "before context"
    assert context.context_after_for_prompt() == "after context"
    assert context.as_batch_payload()["context_after"] == "仅供理解，禁止翻译进输出：after context"

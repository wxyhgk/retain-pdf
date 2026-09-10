from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.policy import translation_policy_verdict


def _item(item_id: str, source_text: str, **overrides) -> dict:
    item = {
        "item_id": item_id,
        "block_type": "text",
        "block_kind": "text",
        "source_text": source_text,
        "protected_source_text": source_text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_policy_verdict_translatable_body_calls_model_and_blocks_empty_export() -> None:
    verdict = translation_policy_verdict(
        _item("body", "The density functional is evaluated on the numerical grid.")
    )

    assert verdict.action == "translate"
    assert verdict.should_call_model is True
    assert verdict.allow_keep_origin is False
    assert verdict.blocks_export is True
    assert verdict.fast_path_keep_origin is False


def test_policy_verdict_policy_skip_keeps_origin_without_model_or_export_block() -> None:
    verdict = translation_policy_verdict(
        _item("formula", "$$ E = mc^2 $$", raw_block_type="display_formula", should_translate=False)
    )

    assert verdict.action == "keep_origin"
    assert verdict.reason == "policy_skip"
    assert verdict.should_call_model is False
    assert verdict.allow_keep_origin is True
    assert verdict.blocks_export is False
    assert verdict.fast_path_keep_origin is True


def test_policy_verdict_protocol_hex_dump_keeps_origin_without_model_or_export_block() -> None:
    source = "Answer(slave-Base module):\n" + " ".join(["01", "03", "40", "FF", "00"] * 80)
    verdict = translation_policy_verdict(_item("p182-b016", source))

    assert verdict.action == "keep_origin"
    assert verdict.reason == "protocol_hex_dump"
    assert verdict.should_call_model is False
    assert verdict.allow_keep_origin is True
    assert verdict.blocks_export is False
    assert verdict.fast_path_keep_origin is True


def test_policy_verdict_canonical_and_legacy_formula_inputs_are_equivalent() -> None:
    canonical = _item(
        "canonical-formula",
        "$$ E = mc^2 $$",
        block_type="formula",
        block_kind="formula",
        block_class="formula",
        raw_block_type="",
    )
    legacy = _item(
        "legacy-formula",
        "$$ E = mc^2 $$",
        block_type="text",
        block_kind="text",
        raw_block_type="display_formula",
    )

    canonical_verdict = translation_policy_verdict(canonical)
    legacy_verdict = translation_policy_verdict(legacy)

    assert canonical_verdict.action == legacy_verdict.action == "keep_origin"
    assert canonical_verdict.reason == legacy_verdict.reason == "non_textual_raw_block"
    assert canonical_verdict.should_call_model is legacy_verdict.should_call_model is False


def test_policy_verdict_canonical_body_overrides_stale_formula_alias() -> None:
    verdict = translation_policy_verdict(
        _item(
            "conflicting-body",
            "This canonical body paragraph must be translated.",
            block_class="body",
            layout_role="paragraph",
            semantic_role="body",
            structure_role="body",
            raw_block_type="display_formula",
            normalized_sub_type="display_formula",
        )
    )

    assert verdict.action == "translate"
    assert verdict.should_call_model is True

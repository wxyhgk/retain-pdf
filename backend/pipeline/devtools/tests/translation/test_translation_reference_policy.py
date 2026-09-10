import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.policy.payload_rules.legacy_policy_mutations import apply_ref_text_skip
from retainpdf_pipeline.translate.services.policy.payload_rules.policy_mutations import apply_reference_zone_skip
from retainpdf_pipeline.translate.services.policy.config import build_translation_policy_config
from retainpdf_pipeline.translate.services.policy.flow import apply_translation_policies


def test_apply_reference_zone_skip_uses_top_level_contract_fields_without_metadata() -> None:
    payload = [
        {
            "item_id": "p010-b001",
            "page_idx": 9,
            "block_idx": 8,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "heading",
            "semantic_role": "reference",
            "structure_role": "reference_heading",
            "source_text": "References",
            "protected_source_text": "References",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
        },
        {
            "item_id": "p010-b002",
            "page_idx": 9,
            "block_idx": 9,
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "reference",
            "structure_role": "reference_entry",
            "source_text": "[1] Example reference entry.",
            "protected_source_text": "[1] Example reference entry.",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
        },
    ]

    skipped = apply_reference_zone_skip(
        payload,
        page_idx=9,
        cutoff_page_idx=9,
        cutoff_block_idx=8,
    )

    assert skipped == 2
    assert payload[0]["skip_reason"] == "skip_reference_heading"
    assert payload[1]["skip_reason"] == "skip_reference_zone"


def test_apply_ref_text_skip_uses_top_level_normalized_sub_type_without_metadata() -> None:
    payload = [
        {
            "item_id": "p011-b003",
            "block_type": "text",
            "block_kind": "text",
            "normalized_sub_type": "ref_text",
            "source_text": "[12] Stewart, J. J. P. Gaussian expansions for orbitals.",
            "protected_source_text": "[12] Stewart, J. J. P. Gaussian expansions for orbitals.",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
        }
    ]

    skipped = apply_ref_text_skip(payload)

    assert skipped == 1
    assert payload[0]["skip_reason"] == "skip_ref_text"
    assert payload[0]["final_status"] == "kept_origin"


def test_apply_ref_text_skip_preserves_numbered_summary_prose() -> None:
    payload = [
        {
            "item_id": "p012-b001",
            "block_type": "text",
            "source_text": (
                "1. Consider frontier molecular orbital (FMO) distribution. "
                "Adding donor or acceptor groups to positions where only one FMO is localized, "
                "a specific FMO is electronically modulated without affecting the other."
            ),
            "protected_source_text": (
                "1. Consider frontier molecular orbital (FMO) distribution. "
                "Adding donor or acceptor groups to positions where only one FMO is localized, "
                "a specific FMO is electronically modulated without affecting the other."
            ),
            "metadata": {
                "ocr_sub_type": "metadata",
                "normalized_sub_type": "metadata",
                "source": {"raw_type": "ref_text"},
            },
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
        }
    ]

    skipped = apply_ref_text_skip(payload)

    assert skipped == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["skip_reason"] == ""


def test_apply_translation_policies_preserves_numbered_summary_ref_text_prose() -> None:
    source = (
        "1. Consider frontier molecular orbital (FMO) distribution. "
        "Adding donor or acceptor groups to positions where only one FMO is localized, "
        "a specific FMO is electronically modulated without affecting the other."
    )
    payload = [
        {
            "item_id": "p012-b001",
            "page_idx": 11,
            "block_idx": 1,
            "block_type": "text",
            "source_text": source,
            "protected_source_text": source,
            "metadata": {
                "ocr_sub_type": "metadata",
                "normalized_sub_type": "metadata",
                "source": {"raw_type": "ref_text"},
            },
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_kind": "single",
            "translation_unit_protected_source_text": source,
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

    apply_translation_policies(
        payload=payload,
        mode="sci",
        classify_batch_size=8,
        workers=1,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        skip_title_translation=False,
        page_idx=11,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
        policy_config=build_translation_policy_config(
            mode="sci",
            skip_title_translation=False,
            enable_reference_zone_skip=False,
        ),
    )

    assert payload[0]["should_translate"] is True
    assert payload[0]["skip_reason"] == ""
    assert payload[0]["classification_label"] == ""


def test_apply_ref_text_skip_still_skips_reference_entry() -> None:
    payload = [
        {
            "item_id": "p012-b017",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "",
            "semantic_role": "",
            "structure_role": "",
            "policy_translate": True,
            "raw_block_type": "ref_text",
            "normalized_sub_type": "metadata",
            "source_text": "[1] A. H. Coons, H. J. Creech, R. N. Jones, E. Berliner, J. Immunol. 1949, 45, 159-170.",
            "protected_source_text": "[1] A. H. Coons, H. J. Creech, R. N. Jones, E. Berliner, J. Immunol. 1949, 45, 159-170.",
            "metadata": {
                "ocr_sub_type": "metadata",
                "normalized_sub_type": "metadata",
                "source": {"raw_type": "ref_text"},
            },
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
        }
    ]

    skipped = apply_ref_text_skip(payload)

    assert skipped == 1
    assert payload[0]["classification_label"] == "skip_ref_text"
    assert payload[0]["should_translate"] is False


def test_apply_ref_text_skip_still_skips_numbered_reference_entry() -> None:
    payload = [
        {
            "item_id": "p013-b007",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "",
            "semantic_role": "",
            "structure_role": "",
            "policy_translate": True,
            "raw_block_type": "ref_text",
            "normalized_sub_type": "metadata",
            "source_text": "1. Smith J. Molecular spectroscopy and orbital effects in aromatic systems.",
            "protected_source_text": "1. Smith J. Molecular spectroscopy and orbital effects in aromatic systems.",
            "metadata": {
                "ocr_sub_type": "metadata",
                "normalized_sub_type": "metadata",
                "source": {"raw_type": "ref_text"},
            },
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
        }
    ]

    skipped = apply_ref_text_skip(payload)

    assert skipped == 1
    assert payload[0]["classification_label"] == "skip_ref_text"
    assert payload[0]["should_translate"] is False

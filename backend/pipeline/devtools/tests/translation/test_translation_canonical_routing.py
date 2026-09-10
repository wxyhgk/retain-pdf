import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.shared.orchestration.common import (
    is_low_risk_deepseek_batch_item,
)
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_long_text import (
    should_split_direct_typst_long_text,
)
from retainpdf_pipeline.translate.llm.validation.english_residue import (
    should_force_translate_body_text,
)


def _body_item(**overrides) -> dict:
    source = overrides.pop(
        "translation_unit_protected_source_text",
        "This canonical body paragraph contains enough ordinary English prose to require a translated result.",
    )
    item = {
        "item_id": "p001-b001",
        "block_type": "text",
        "block_kind": "text",
        "block_class": "body",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "raw_block_type": "paragraph",
        "translation_unit_protected_source_text": source,
    }
    item.update(overrides)
    return item


def test_body_translation_gate_has_canonical_and_legacy_parity() -> None:
    canonical = _body_item()
    legacy = {
        "item_id": "p001-b002",
        "block_type": "text",
        "raw_block_type": "text",
        "translation_unit_protected_source_text": canonical["translation_unit_protected_source_text"],
    }
    conflicting_caption = _body_item(
        block_class="caption",
        layout_role="caption",
        semantic_role="unknown",
        structure_role="figure_caption",
        raw_block_type="text",
    )

    assert should_force_translate_body_text(canonical) is True
    assert should_force_translate_body_text(legacy) is True
    assert should_force_translate_body_text(conflicting_caption) is False


def test_low_risk_batch_gate_reads_canonical_text_kind_not_provider_label() -> None:
    item = _body_item()

    assert is_low_risk_deepseek_batch_item(
        item,
        batch_low_risk_max_placeholders=4,
        batch_low_risk_min_chars=20,
        batch_low_risk_max_chars=500,
    )


def test_direct_typst_long_split_reads_canonical_text_kind_not_provider_label() -> None:
    item = _body_item(
        math_mode="direct_typst",
        translation_unit_protected_source_text=(
            "This canonical paragraph contains substantial technical prose and inline formula context. " * 70
        ),
    )

    assert should_split_direct_typst_long_text(item) is True

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.placeholder_guard import _is_reference_like_item


def test_placeholder_guard_reference_detection_uses_top_level_contract_fields() -> None:
    item = {
        "item_id": "p020-b004",
        "block_type": "text",
        "block_kind": "text",
        "semantic_role": "reference",
        "structure_role": "reference_entry",
        "translation_unit_protected_source_text": "[4] Stewart, J. J. P. Semiempirical methods for quantum chemistry.",
        "metadata": {
            "semantic_role": "",
            "structure_role": "",
            "normalized_sub_type": "",
        },
    }

    assert _is_reference_like_item(item) is True

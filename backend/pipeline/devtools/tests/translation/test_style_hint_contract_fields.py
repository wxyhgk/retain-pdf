import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.classification.page_classifier import _candidate_record
from retainpdf_pipeline.translate.llm.style_hints import structure_style_hint


def test_structure_style_hint_prefers_top_level_structure_role() -> None:
    item = {
        "structure_role": "heading",
        "metadata": {
            "structure_role": "body",
        },
    }

    hint = structure_style_hint(item)

    assert "section heading" in hint


def test_structure_style_hint_appends_translation_style_hint() -> None:
    item = {
        "structure_role": "body",
        "translation_style_hint": "保持结构化字段名和值。",
    }

    hint = structure_style_hint(item)

    assert "保持结构化字段名和值" in hint


def test_candidate_record_projects_contract_fields_for_classification() -> None:
    record = _candidate_record(
        {
            "item_id": "p001-b001",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "heading",
            "semantic_role": "reference",
            "structure_role": "reference_heading",
            "policy_translate": False,
            "bbox": [0, 0, 10, 10],
            "source_text": "References",
            "formula_map": [],
            "lines": [],
            "metadata": {
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
            },
        },
        order=1,
    )

    assert record["block_kind"] == "text"
    assert record["layout_role"] == "heading"
    assert record["semantic_role"] == "reference"
    assert record["effective_role"] == "heading"

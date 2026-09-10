import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.core.orchestration.units import finalize_payload_orchestration_metadata
from retainpdf_pipeline.translate.core.payload.parts.units import pending_translation_items


def test_heavy_continuation_group_is_split_back_to_single_units() -> None:
    def member(item_id: str, source: str):
        return {
            "item_id": item_id,
            "translation_unit_id": "__cg__:heavy",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a", "b"],
            "block_type": "text",
            "should_translate": True,
            "protected_source_text": source,
            "source_text": source,
            "formula_map": [{"placeholder": "<f1-a7c/>"}],
            "protected_map": [{"token_tag": "<f1-a7c/>", "token_type": "formula", "checksum": "a7c"}],
            "continuation_group": "cg-heavy",
        }

    source_a = " ".join(f"left text {idx} <f1-a7c/>" for idx in range(1, 8))
    source_b = " ".join(f"right text {idx} <f1-a7c/>" for idx in range(1, 8))
    payload = [member("a", source_a), member("b", source_b)]

    units = pending_translation_items(payload)

    assert [unit["item_id"] for unit in units] == ["a", "b"]
    assert all(unit["translation_unit_kind"] == "single" for unit in units)
    assert all(unit["group_split_reason"] == "formula_heavy_group" for unit in units)
    assert all(unit["continuation_group"] == "" for unit in units)
    assert all(not unit.get("group_protected_source_text") for unit in units)


def test_finalize_payload_orchestration_metadata_clears_orphan_group_state() -> None:
    payload = [
        {
            "item_id": "a",
            "continuation_group": "cg-orphan",
            "classification_label": "",
            "should_translate": True,
            "protected_source_text": "orphan body text",
            "formula_map": [],
            "protected_map": [],
            "translation_unit_id": "__cg__:cg-orphan",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a", "ghost"],
            "translation_unit_protected_source_text": "stale combined",
            "translation_unit_formula_map": [{"placeholder": "<f1-a7c/>"}],
            "translation_unit_protected_map": [{"token_tag": "<f1-a7c/>"}],
            "group_protected_source_text": "stale combined",
            "group_formula_map": [{"placeholder": "<f1-a7c/>"}],
            "group_protected_map": [{"token_tag": "<f1-a7c/>"}],
            "group_protected_translated_text": "旧组结果",
            "group_translated_text": "旧组结果",
            "continuation_candidate_prev_id": "",
            "continuation_candidate_next_id": "",
        }
    ]

    finalize_payload_orchestration_metadata(payload)

    assert payload[0]["translation_unit_id"] == "a"
    assert payload[0]["translation_unit_kind"] == "single"
    assert payload[0]["translation_unit_member_ids"] == ["a"]
    assert payload[0]["translation_unit_protected_source_text"] == "orphan body text"
    assert payload[0]["group_protected_source_text"] == ""
    assert payload[0]["group_translated_text"] == ""


def test_pending_translation_items_refreshes_member_ids_for_real_group() -> None:
    payload = [
        {
            "item_id": "a",
            "translation_unit_id": "__cg__:cg-real",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a"],
            "block_type": "text",
            "should_translate": True,
            "protected_source_text": "left body text",
            "source_text": "left body text",
            "formula_map": [],
            "protected_map": [],
            "continuation_group": "cg-real",
            "metadata": {"structure_role": "body"},
        },
        {
            "item_id": "b",
            "translation_unit_id": "b",
            "translation_unit_kind": "single",
            "translation_unit_member_ids": ["b"],
            "block_type": "text",
            "should_translate": True,
            "protected_source_text": "right body text",
            "source_text": "right body text",
            "formula_map": [],
            "protected_map": [],
            "continuation_group": "cg-real",
            "metadata": {"structure_role": "body"},
        },
    ]

    units = pending_translation_items(payload)

    assert [unit["item_id"] for unit in units] == ["__cg__:cg-real"]
    assert payload[0]["translation_unit_member_ids"] == ["a", "b"]
    assert payload[1]["translation_unit_member_ids"] == ["a", "b"]
    assert payload[0]["translation_unit_kind"] == "group"
    assert payload[1]["translation_unit_kind"] == "group"
    assert units[0]["translation_unit_members"] == [
        {"item_id": "a", "protected_source_text": "left body text"},
        {"item_id": "b", "protected_source_text": "right body text"},
    ]


def test_fragmented_formula_continuation_group_stays_grouped() -> None:
    def member(item_id: str, source: str, placeholders: list[str]):
        return {
            "item_id": item_id,
            "translation_unit_id": "__cg__:light-fragmented",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a", "b"],
            "block_type": "text",
            "should_translate": True,
            "protected_source_text": source,
            "source_text": source,
            "formula_map": [{"placeholder": token} for token in placeholders],
            "protected_map": [
                {"token_tag": token, "token_type": "formula", "checksum": "a7c"}
                for token in placeholders
            ],
            "continuation_group": "cg-light-fragmented",
            "metadata": {"structure_role": "body"},
        }

    payload = [
        member("a", "the catalyst <f1-a7c/> and the surface <f2-a7c/> and", ["<f1-a7c/>", "<f2-a7c/>"]),
        member("b", "the intermediate <f1-a7c/> and the product <f2-a7c/> show stable activity.", ["<f1-a7c/>", "<f2-a7c/>"]),
    ]

    units = pending_translation_items(payload)

    assert [unit["item_id"] for unit in units] == ["__cg__:light-fragmented"]
    assert units[0]["translation_unit_id"] == "__cg__:light-fragmented"
    assert units[0]["continuation_group"] == "cg-light-fragmented"
    assert "group_split_reason" not in payload[0] or not payload[0]["group_split_reason"]


def test_direct_typst_continuation_group_preserves_math_mode_on_group_unit() -> None:
    payload = [
        {
            "item_id": "a",
            "translation_unit_id": "__cg__:direct-typst",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a", "b"],
            "block_type": "text",
            "should_translate": True,
            "math_mode": "direct_typst",
            "protected_source_text": "Anthropic and OpenAI: the providers captured more wallet share and",
            "source_text": "Anthropic and OpenAI: the providers captured more wallet share and",
            "continuation_group": "cg-direct-typst",
            "metadata": {"structure_role": "body"},
        },
        {
            "item_id": "b",
            "translation_unit_id": "__cg__:direct-typst",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a", "b"],
            "block_type": "text",
            "should_translate": True,
            "math_mode": "direct_typst",
            "protected_source_text": "investors increasingly viewed them as application software firms.",
            "source_text": "investors increasingly viewed them as application software firms.",
            "continuation_group": "cg-direct-typst",
            "metadata": {"structure_role": "body"},
        },
    ]

    units = pending_translation_items(payload)

    assert [unit["item_id"] for unit in units] == ["__cg__:direct-typst"]
    assert units[0]["math_mode"] == "direct_typst"


def test_long_continuation_group_stays_grouped_when_not_formula_heavy() -> None:
    def member(item_id: str, source: str):
        return {
            "item_id": item_id,
            "translation_unit_id": "__cg__:long-continuation",
            "translation_unit_kind": "group",
            "translation_unit_member_ids": ["a", "b"],
            "block_type": "text",
            "should_translate": True,
            "protected_source_text": source,
            "source_text": source,
            "continuation_group": "cg-long",
            "metadata": {"structure_role": "body"},
        }

    text_a = " ".join(f"left segment {idx} discusses correlated quantum chemistry" for idx in range(40))
    text_b = " ".join(f"right segment {idx} continues the same paragraph and should stay grouped" for idx in range(40))
    payload = [member("a", text_a), member("b", text_b)]
    units = pending_translation_items(payload)

    assert [unit["item_id"] for unit in units] == ["__cg__:long-continuation"]
    assert units[0]["continuation_group"] == "cg-long"
    assert payload[0]["translation_unit_kind"] == "group"
    assert payload[1]["translation_unit_kind"] == "group"


def test_large_continuation_group_stays_grouped_even_when_member_count_exceeds_limit() -> None:
    payload = []
    for idx in range(4):
        text = f"segment {idx} continues the same paragraph across columns and should stay grouped for coherent translation."
        payload.append(
            {
                "item_id": f"m{idx}",
                "translation_unit_id": "__cg__:wide-continuation",
                "translation_unit_kind": "group",
                "translation_unit_member_ids": [f"m{i}" for i in range(4)],
                "block_type": "text",
                "should_translate": True,
                "protected_source_text": text,
                "source_text": text,
                "continuation_group": "cg-wide",
                "metadata": {"structure_role": "body"},
            }
        )

    units = pending_translation_items(payload)

    assert [unit["item_id"] for unit in units] == ["__cg__:wide-continuation"]
    assert units[0]["continuation_group"] == "cg-wide"
    assert all(item["translation_unit_kind"] == "group" for item in payload)
    assert all(not item.get("group_split_reason") for item in payload)

import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from runtime.pipeline.book_translation_batches import _build_translation_batches
from runtime.pipeline.book_translation_batches import _dedupe_pending_items
from runtime.pipeline.book_translation_batches import _expand_duplicate_results
from runtime.pipeline.book_translation_batches import _effective_translation_batch_size
from services.translation.llm.control_context import build_translation_control_context
from services.translation.llm.control_context import resolve_engine_profile
from services.translation.payload.parts.units import pending_translation_items


def _item(item_id: str, text: str, **overrides):
    item = {
        "item_id": item_id,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "should_translate": True,
    }
    item.update(overrides)
    return item


def test_default_profile_enables_provider_agnostic_plain_batching() -> None:
    context = build_translation_control_context()
    assert (
        _effective_translation_batch_size(
            batch_size=1,
            model="gpt-4.1-mini",
            base_url="https://api.openai.com/v1",
            translation_context=context,
        )
        == 4
    )


def test_deepseek_profile_can_raise_plain_batch_size() -> None:
    context = build_translation_control_context(
        engine_profile=resolve_engine_profile(
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
        )
    )
    assert (
        _effective_translation_batch_size(
            batch_size=1,
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            translation_context=context,
        )
        == 6
    )
    assert context.segmentation_policy.prefer_plain_when_segment_count_leq == 6
    assert context.fallback_policy.formula_segment_attempts == 2


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
    assert all(not unit.get("group_protected_source_text") for unit in units)


def test_smarter_batches_group_low_risk_items_and_keep_complex_items_single() -> None:
    context = build_translation_control_context()
    batchable_text = "This sentence describes antibacterial activity and provides enough body text for translation."
    pending = [
        _item("a", batchable_text),
        _item("b", batchable_text),
        _item("c", "After <f1-a7c/> hours, activity increased.", formula_map=[{"placeholder": "<f1-a7c/>"}]),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["a", "b"], ["c"]]
    assert all(item.get("_batched_plain_candidate") for item in batches[0])
    assert not batches[1][0].get("_batched_plain_candidate")


def test_smarter_batches_do_not_group_reference_like_text() -> None:
    context = build_translation_control_context()
    body_text = "This sentence describes antibacterial activity and provides enough body text for translation."
    reference_text = "[1] Antimicrobial Resistance Collaborators, Lancet. 2022, 399, 629."
    pending = [
        _item("body-a", body_text),
        _item("body-b", body_text),
        _item("ref", reference_text),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body-a", "body-b"]]
    assert [list(result)[0] for result in immediate] == ["ref"]
    assert all(item.get("_batched_plain_candidate") for item in batches[0])


def test_fast_path_keep_origin_is_removed_from_network_batches() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item("placeholder-only", "<f1-a7c/>"),
            _item("short-number", "12.5"),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["placeholder-only", "short-number"]
    assert all(list(result.values())[0]["decision"] == "keep_origin" for result in immediate)


def test_fast_path_keep_origin_skips_short_non_body_labels() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item(
                "caption-e",
                "E",
                block_type="image_caption",
                layout_zone="non_flow",
                metadata={"structure_role": "caption"},
            ),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["caption-e"]
    assert list(immediate[0].values())[0]["translation_diagnostics"]["degradation_reason"] == "short_non_body_label"


def test_fast_path_keep_origin_skips_editorial_metadata_tokens() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item(
                "crossmark",
                "CrossMark",
                block_type="text",
                metadata={"structure_role": "body"},
                page_idx=0,
                lines=[{"spans": [{"content": "CrossMark"}]}],
            ),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["crossmark"]
    assert list(immediate[0].values())[0]["translation_diagnostics"]["degradation_reason"] == "metadata_like_fragment"


def test_duplicate_plain_items_are_collapsed_and_expanded_with_item_diagnostics() -> None:
    pending = [
        _item("a", "A", block_type="image_caption", page_idx=0),
        _item("b", "A", block_type="image_caption", page_idx=1),
        _item("c", "B", block_type="image_caption", page_idx=1),
    ]
    unique, duplicates = _dedupe_pending_items(pending)
    assert [item["item_id"] for item in unique] == ["a", "c"]
    assert [item["item_id"] for item in duplicates["a"]] == ["b"]

    expanded = _expand_duplicate_results(
        {
            "a": {
                "decision": "translate",
                "translated_text": "甲",
                "final_status": "translated",
                "translation_diagnostics": {"item_id": "a", "page_idx": 0, "route_path": ["block_level"]},
            }
        },
        duplicate_items_by_rep_id=duplicates,
    )
    assert expanded["b"]["translated_text"] == "甲"
    assert expanded["b"]["translation_diagnostics"]["item_id"] == "b"
    assert expanded["b"]["translation_diagnostics"]["page_idx"] == 1

import sys
from pathlib import Path
from unittest import mock

import requests

REPO_SCRIPTS_ROOT = Path("/home/wxyhgk/tmp/Code/backend/scripts")
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from runtime.pipeline.book_translation_batches import _build_translation_batches
from runtime.pipeline.book_translation_batches import _allocate_translation_queue_workers
from runtime.pipeline.book_translation_batches import _classify_translation_batches
from runtime.pipeline.book_translation_batches import _dedupe_pending_items
from runtime.pipeline.book_translation_batches import _expand_duplicate_results
from runtime.pipeline.book_translation_batches import _effective_translation_batch_size
from runtime.pipeline.book_translation_batches import _translate_batch_or_keep_origin
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
        == 6
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
        == 8
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


def test_smarter_batches_group_low_risk_items_and_keep_complex_items_single() -> None:
    context = build_translation_control_context()
    batchable_text = "This sentence describes antibacterial activity and provides enough body text for translation."
    pending = [
        _item("a", batchable_text),
        _item("b", batchable_text),
        _item(
            "c",
            "After <f1-a7c/> hours, activity increased while the catalyst remained active in the reaction system.",
            formula_map=[{"placeholder": "<f1-a7c/>"}],
            metadata={"structure_role": "body"},
        ),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["a", "b", "c"]]
    assert all(item.get("_batched_plain_candidate") for item in batches[0])


def test_smarter_batches_keep_continuation_group_out_of_batched_plain_path_even_without_placeholders() -> None:
    context = build_translation_control_context()
    pending = [
        _item(
            "a",
            "This continuation block still contains enough body text to remain batchable after policy relaxation.",
            continuation_group="cg-1",
        ),
        _item(
            "b",
            "This companion block stays in the same continuation group and should join the batched plain path.",
            continuation_group="cg-1",
        ),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["a"], ["b"]]
    assert all(not batch[0].get("_batched_plain_candidate") for batch in batches)


def test_smarter_batches_keep_continuation_group_with_placeholders_out_of_batched_plain_path() -> None:
    context = build_translation_control_context()
    pending = [
        _item(
            "__cg__:cg-1",
            "This continuation block mentions <f1-a7c/> and keeps enough body text for translation while preserving placeholders.",
            continuation_group="cg-1",
            translation_unit_id="__cg__:cg-1",
            formula_map=[{"placeholder": "<f1-a7c/>"}],
            translation_unit_formula_map=[{"placeholder": "<f1-a7c/>"}],
            metadata={"structure_role": "body"},
        ),
        _item(
            "body",
            "This sentence describes antibacterial activity and provides enough body text for translation.",
        ),
    ]
    batches, immediate = _build_translation_batches(
        pending,
        effective_batch_size=4,
        translation_context=context,
    )
    assert immediate == []
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"], ["__cg__:cg-1"]]
    assert batches[0][0].get("_batched_plain_candidate")
    assert not batches[1][0].get("_batched_plain_candidate")


def test_queue_classification_routes_only_true_slow_blocks_to_single_slow() -> None:
    batched_fast_batches, single_fast_batches, single_slow_batches = _classify_translation_batches(
        [
            [
                _item(
                    "body-a",
                    "This sentence describes antibacterial activity and provides enough body text for translation.",
                    _batched_plain_candidate=True,
                )
            ],
            [
                _item(
                    "__cg__:cg-1",
                    "Continuation with <f1-a7c/> placeholder.",
                    continuation_group="cg-1",
                    translation_unit_id="__cg__:cg-1",
                )
            ],
            [
                _item(
                    "formula-1",
                    "Text with <f1-a7c/> formula marker.",
                    formula_map=[{"placeholder": "<f1-a7c/>"}],
                    math_mode="direct_typst",
                )
            ],
            [
                _item(
                    "formula-heavy",
                    "Heavy split chunk with <f1-a7c/> and <f2-b2d/> markers.",
                    formula_map=[{"placeholder": "<f1-a7c/>"}, {"placeholder": "<f2-b2d/>"}],
                    _heavy_formula_split_applied=True,
                )
            ],
            [
                _item(
                    "body-b",
                    "This sentence describes antibacterial activity and provides enough body text for translation.",
                    _batched_plain_candidate=True,
                ),
                _item(
                    "body-c",
                    "This sentence describes antibacterial activity and provides enough body text for translation.",
                    _batched_plain_candidate=True,
                ),
            ],
        ]
    )
    assert [[item["item_id"] for item in batch] for batch in batched_fast_batches] == [["body-a"], ["body-b", "body-c"]]
    assert [[item["item_id"] for item in batch] for batch in single_fast_batches] == [["__cg__:cg-1"], ["formula-1"]]
    assert [[item["item_id"] for item in batch] for batch in single_slow_batches] == [["formula-heavy"]]


def test_queue_worker_allocation_reserves_small_tail_pool() -> None:
    assert _allocate_translation_queue_workers(
        1,
        batched_fast_count=0,
        single_fast_count=3,
        single_slow_count=1,
    ) == {"batched_fast": 0, "single_fast": 1, "single_slow": 0}
    assert _allocate_translation_queue_workers(
        8,
        batched_fast_count=4,
        single_fast_count=6,
        single_slow_count=2,
    ) == {"batched_fast": 3, "single_fast": 4, "single_slow": 1}
    assert _allocate_translation_queue_workers(
        24,
        batched_fast_count=2,
        single_fast_count=10,
        single_slow_count=3,
    ) == {"batched_fast": 4, "single_fast": 18, "single_slow": 2}
    assert _allocate_translation_queue_workers(
        12,
        batched_fast_count=0,
        single_fast_count=0,
        single_slow_count=5,
    ) == {"batched_fast": 0, "single_fast": 0, "single_slow": 12}


def test_direct_typst_singleton_uses_single_fast_queue() -> None:
    batched_fast_batches, single_fast_batches, single_slow_batches = _classify_translation_batches(
        [
            [
                _item(
                    "dt-1",
                    "Observe $x_{i}$ under the boundary condition and translate directly.",
                    math_mode="direct_typst",
                )
            ]
        ]
    )
    assert batched_fast_batches == []
    assert [[item["item_id"] for item in batch] for batch in single_fast_batches] == [["dt-1"]]
    assert single_slow_batches == []


def test_smarter_batches_leave_reference_like_text_as_single_batch_without_fast_skip() -> None:
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
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body-a", "body-b"], ["ref"]]
    assert immediate == []
    assert all(item.get("_batched_plain_candidate") for item in batches[0])
    assert not batches[1][0].get("_batched_plain_candidate")


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
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"], ["short-number"]]
    assert [list(result)[0] for result in immediate] == ["placeholder-only"]
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
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"], ["crossmark"]]
    assert immediate == []


def test_fast_path_keep_origin_skips_pure_email_fragments_only() -> None:
    context = build_translation_control_context()
    batches, immediate = _build_translation_batches(
        [
            _item(
                "email",
                "author@example.edu",
                block_type="text",
                metadata={"structure_role": "body"},
                page_idx=0,
                lines=[{"spans": [{"content": "author@example.edu"}]}],
            ),
            _item("body", "This sentence describes antibacterial activity and provides enough body text for translation."),
        ],
        effective_batch_size=4,
        translation_context=context,
    )
    assert [[item["item_id"] for item in batch] for batch in batches] == [["body"]]
    assert [list(result)[0] for result in immediate] == ["email"]
    assert list(immediate[0].values())[0]["translation_diagnostics"]["degradation_reason"] == "hard_metadata_fragment"


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


def test_translate_batch_wrapper_degrades_transport_failure_to_keep_origin() -> None:
    context = build_translation_control_context()
    batch = [
        _item("a", "This sentence describes antibacterial activity and provides enough body text for translation."),
        _item("b", "This paragraph keeps enough content for translation even when the network request times out."),
    ]
    with mock.patch(
        "runtime.pipeline.book_translation_batches.translate_batch",
        side_effect=requests.ConnectionError("Read timed out"),
    ):
        result = _translate_batch_or_keep_origin(
            batch,
            api_key="sk-test",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            request_label="book: batch 1/1",
            domain_guidance="",
            mode="fast",
            context=context,
        )

    assert result["a"]["decision"] == "keep_origin"
    assert result["b"]["decision"] == "keep_origin"
    assert result["a"]["translation_diagnostics"]["degradation_reason"] == "batch_transport_timeout_budget_exceeded"
    assert result["a"]["translation_diagnostics"]["route_path"] == ["block_level", "batched_plain", "keep_origin"]

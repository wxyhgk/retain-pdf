"""Cache identity follows prompt context, without model or network calls."""

import hashlib
import json

import pytest

from retainpdf_pipeline.translate.core.context import build_item_context
from retainpdf_pipeline.translate.llm.shared import cache
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import single_user_prompt


OPTIONS = {"model": "qwen3.8-flash", "base_url": "https://example.invalid/v1"}
BASE_ITEM = {
    "item_id": "p001-b001",
    "source_text": "The response remains stable.",
    "math_mode": "direct_typst",
}
RESULT = {"decision": "translate", "translated_text": "响应保持稳定。"}
CONTEXT_FIELDS = (
    "translation_context_before",
    "translation_context_after",
    "continuation_prev_text",
    "continuation_next_text",
)


def key(item):
    return cache.cache_key_for_item(item, **OPTIONS)


def prompt(item):
    return single_user_prompt(
        build_item_context(item), mode="fast", response_style="plain_text",
        target_language_name="简体中文",
    )


@pytest.fixture(autouse=True)
def isolated_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(cache.paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path)
    monkeypatch.setattr(cache, "_ENSURED_SHARD_DIRS", set())
    monkeypatch.setattr(cache, "_PRUNE_DONE", True)


@pytest.mark.parametrize("field", CONTEXT_FIELDS)
def test_changed_prompt_context_never_reuses_cached_translation(field):
    first = {**BASE_ITEM, field: "This describes an electrical circuit."}
    second = {**BASE_ITEM, field: "This describes an immune response."}
    assert prompt(first) != prompt(second)
    cache.store_cached_translation(first, RESULT, **OPTIONS)
    assert cache.load_cached_translation(first, **OPTIONS) == RESULT
    assert key(first) != key(second)
    assert cache.load_cached_translation(second, **OPTIONS) == {}
    assert cache.load_cached_translation(BASE_ITEM, **OPTIONS) == {}


@pytest.mark.parametrize("context", [{}, {"translation_context_before": "A prior sentence."}])
def test_identical_context_hits_across_item_identity_and_runtime_state(context):
    item = {**BASE_ITEM, **context}
    cache.store_cached_translation(item, RESULT, **OPTIONS)
    same_input = {**item, "item_id": "p099-b004", "page_idx": 98, "final_status": "pending", "retry_count": 4}
    assert cache.load_cached_translation(same_input, **OPTIONS) == RESULT


@pytest.mark.parametrize("field", CONTEXT_FIELDS)
def test_context_normalization_matches_prompt_normalization(field):
    first = {**BASE_ITEM, field: "  The\n prior\t[[FORMULA_1]] sentence.  "}
    normalized = {**BASE_ITEM, field: "The prior sentence."}
    assert prompt(first) == prompt(normalized)
    assert key(first) == key(normalized)
    cache.store_cached_translation(first, RESULT, **OPTIONS)
    assert cache.load_cached_translation(normalized, **OPTIONS) == RESULT


@pytest.mark.parametrize("field", CONTEXT_FIELDS)
@pytest.mark.parametrize("empty", [None, "", " \n ", "[[FORMULA_1]]"])
def test_prompt_empty_context_matches_absent_context(field, empty):
    item = {**BASE_ITEM, field: empty}
    assert prompt(item) == prompt(BASE_ITEM)
    assert key(item) == key(BASE_ITEM)


def test_context_off_excludes_continuation_but_keeps_explicit_window():
    off = {**BASE_ITEM, "translation_context_mode": " OFF ", "continuation_prev_text": "Ignored before.", "continuation_next_text": "Ignored after."}
    assert prompt(off) == prompt(BASE_ITEM)
    assert key(off) == key(BASE_ITEM)
    explicit = {**off, "translation_context_before": "Still sent to the model."}
    assert prompt(explicit) != prompt(off)
    assert key(explicit) != key(off)


def test_continuation_context_mode_changes_prompt_and_cache_key():
    enabled = {**BASE_ITEM, "continuation_next_text": "This is supplied to the model."}
    disabled = {**enabled, "translation_context_mode": "off"}
    assert prompt(enabled) != prompt(disabled)
    assert key(enabled) != key(disabled)


def test_merged_context_order_and_segment_context_remain_distinct():
    explicit = {**BASE_ITEM, "translation_context_before": "Prior text."}
    continuation = {**BASE_ITEM, "continuation_prev_text": "Prior text."}
    assert prompt(explicit) == prompt(continuation)
    # Formula-segment fallback only consumes continuation, not explicit windows.
    assert key(explicit) != key(continuation)
    first = {**BASE_ITEM, "translation_context_before": "First.", "continuation_prev_text": "Second."}
    swapped = {**BASE_ITEM, "translation_context_before": "Second.", "continuation_prev_text": "First."}
    assert prompt(first) != prompt(swapped)
    assert key(first) != key(swapped)


def test_pre_context_cache_entries_are_invalidated_even_without_context(tmp_path):
    # Reconstruct the previous wire identity, rather than merely comparing two
    # arbitrary version strings. No migration may trust this context-blind key.
    legacy_payload = {
        **OPTIONS,
        "base_url": cache.normalize_base_url(OPTIONS["base_url"]),
        "domain_guidance": "", "mode": "fast", "target_lang": "zh-CN",
        "target_language_name": "简体中文",
        **cache.translation_engine_identity(mode="fast"),
        "strategy_signature": cache.PLAIN_TEXT_STRATEGY_VERSION,
        "translation_style_hint": "", "translation_structure_kind": "",
        "source_text": BASE_ITEM["source_text"],
    }
    old_key = hashlib.sha256(json.dumps(legacy_payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    old_path = tmp_path / old_key[:2] / f"{old_key}.json"
    old_path.parent.mkdir(parents=True)
    old_path.write_text(json.dumps({"cache_key": old_key, **RESULT}), encoding="utf-8")
    assert old_key != key(BASE_ITEM)
    assert cache.load_cached_translation(BASE_ITEM, **OPTIONS) == {}


def test_cache_key_schema_version_is_part_of_identity(monkeypatch):
    before = key(BASE_ITEM)
    monkeypatch.setattr(cache, "UNIT_CACHE_KEY_VERSION", "next-context-contract")
    assert key(BASE_ITEM) != before

"""Pre-refactor message digests and isolation of formerly live raw-item reads."""
from dataclasses import FrozenInstanceError
import hashlib
import json

import pytest

from retainpdf_pipeline.translate.core.context import build_item_context, TranslationItemContext
from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_messages, build_group_member_messages, build_single_item_fallback_messages,
)


def _item(math_mode):
    return dict(item_id="a", source_text="Energy $E$ remains.", math_mode=math_mode,
                structure_role="reference", _scoped_terms_guidance="Energy => 能量",
                translation_unit_member_ids=[" b ", "a", "b", "missing"],
                translation_unit_members=[{"item_id": "b", "source_text": "First."},
                                          {"item_id": "a", "protected_source_text": "Energy $E$"},
                                          {"item_id": "b", "source_text": "Last."}],
                translation_context_after="Next sentence.")


_BUILDERS = [build_single_item_fallback_messages, lambda item: build_messages([item]), build_group_member_messages]
# Captured from the previous implementation, not computed by the new renderer.
_DIGESTS = {
    False: ["92f286faeba1db6ce9a76cf68360a3a3fe1c4806ea528d8258d879677fe7b4c0",
            "517126bb63dbde134291b00af08c9892b901f623335067179400430a24ecaf27",
            "5e819e5e3685f7a25bb9d7360d34537933633ab035287c3ed85daaa8e8539a59"],
    True: ["43061554f49d7d4ec056bbe2c1bab3c05b37579a1652dc910682b66b59202722",
           "27dc11dfd8d26b4e12b99c2614349404b48b72a694b7b6d681c65a4309d1f80a",
           "137a1fecb22255568923b813a86ad8d4bd72ba93412ff13c35619133cf92b15e"],
}


@pytest.mark.parametrize("math_mode", ["placeholder", "direct_typst", " direct_typst ", ""])
@pytest.mark.parametrize("route", range(3))
def test_messages_match_pre_snapshot_bytes(math_mode, route):
    messages = _BUILDERS[route](_item(math_mode))
    digest = hashlib.sha256(json.dumps(messages, ensure_ascii=False).encode()).hexdigest()
    assert digest == _DIGESTS[math_mode.strip() == "direct_typst"][route]


@pytest.mark.parametrize("direct_constructor", [False, True])
def test_source_mutation_cannot_change_prompt_values(direct_constructor):
    original = _item("direct_typst")
    context = (TranslationItemContext(item_id="a", source_text=original["source_text"],
                                     protected_source_text=original["source_text"],
                                     math_mode="direct_typst", raw_item=original)
               if direct_constructor else build_item_context(original))
    before = [builder(context) for builder in _BUILDERS]
    original["_scoped_terms_guidance"] = "CHANGED"
    original["structure_role"] = "title"
    original["math_mode"] = "placeholder"
    original["translation_unit_member_ids"].reverse()
    original["translation_unit_members"][2]["source_text"] = "CHANGED"
    original["translation_unit_members"].append({"item_id": "missing", "source_text": "NEW"})
    assert [builder(context) for builder in _BUILDERS] == before
    assert context.raw_item is original  # Compatibility handle, not prompt authority.
    with pytest.raises(FrozenInstanceError):
        context.scoped_terms_guidance = "changed"
    group = json.loads(before[2][1]["content"])["group"]
    assert group["member_ids"] == ["b", "a", "b", "missing"]
    assert group["members"][0]["source_text"] == "Last."
    assert group["combined_source_text"] == original["source_text"]


def test_direct_constructor_keeps_historical_raw_math_mode_distinction():
    context = TranslationItemContext(item_id="a", source_text="$E", protected_source_text="$E",
                                     math_mode="direct_typst", raw_item={})
    payload = json.loads(build_group_member_messages(context)[1]["content"])
    assert "math_delimiter_note" not in payload["group"]
    assert payload["group"]["member_ids"] == ["a"]


@pytest.mark.parametrize("value", [None, [], 7, "invalid"])
def test_optional_unused_member_metadata_does_not_break_single_route(value):
    original = _item("placeholder")
    original.pop("translation_unit_member_ids")
    original.pop("translation_unit_members")
    expected = build_single_item_fallback_messages(original)
    original.update(translation_unit_member_ids=value, translation_unit_members=value)
    assert build_single_item_fallback_messages(original) == expected


@pytest.mark.parametrize("field", ["translation_unit_member_ids", "translation_unit_members"])
@pytest.mark.parametrize("value", [None, 7, False])
def test_invalid_group_metadata_fails_only_when_group_consumes_it(field, value):
    original = _item("placeholder")
    original[field] = value
    context = build_item_context(original)
    build_single_item_fallback_messages(context)
    # Mutating the source after extraction cannot erase the captured failure.
    original[field] = []
    with pytest.raises(TypeError, match=f"'{type(value).__name__}' object is not iterable"):
        build_group_member_messages(context)


def test_historical_iterable_member_metadata_is_not_newly_validated():
    original = _item("placeholder")
    original.update(translation_unit_member_ids="ab", translation_unit_members={"a": "ignored"})
    group = json.loads(build_group_member_messages(original)[1]["content"])["group"]
    assert group["member_ids"] == ["a", "b"]
    assert [member["source_text"] for member in group["members"]] == ["", ""]

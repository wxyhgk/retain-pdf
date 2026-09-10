"""Protocol routing contracts, including the historical structured-decision branch."""

from copy import deepcopy
import json

import pytest

from retainpdf_pipeline.translate.llm.shared.prompt_building import (
    build_group_member_messages,
    build_messages,
    build_single_item_fallback_messages,
)
from retainpdf_pipeline.translate.llm.shared.prompt_protocols import (
    build_translation_system_prompt,
    direct_math_guidance,
)
from retainpdf_pipeline.translate.prompt_loader import load_prompt


def _item(math_mode):
    return {"item_id": "p001-a", "math_mode": math_mode,
            "protected_source_text": "Energy $E=mc^2$ remains conserved.",
            "translation_style_hint": "formal"}


@pytest.mark.parametrize("math_mode", ["placeholder", "direct_typst"])
@pytest.mark.parametrize("mode", ["fast", "sci"])
@pytest.mark.parametrize("style", ["plain_text", "json"])
@pytest.mark.parametrize("decision", [False, True])
def test_single_protocol_system_bytes_and_decision_compatibility(math_mode, mode, style, decision):
    item = _item(math_mode)
    before = deepcopy(item)
    messages = build_single_item_fallback_messages(
        item, mode=mode, response_style=style, structured_decision=decision,
        domain_guidance=" domain ", target_language_name="English",
    )
    structured = mode == "sci" and decision
    expected = build_translation_system_prompt(
        domain_guidance=" domain ", mode=mode,
        response_style="json" if style == "json" else "tagged" if structured else "plain_text",
        include_sci_decision=structured, target_language_name="English",
    )
    if structured:
        if style == "json":
            expected += '\n\n只返回符合 {"decision":"translate","translated_text":"translated text"} 的 JSON。不要包含 Markdown、代码块或解释说明。'
    else:
        expected += "\n" + load_prompt("translation_output_single_json.txt" if style == "json" else "translation_output_plain_text.txt")
        if math_mode == "direct_typst":
            expected += "\n" + direct_math_guidance(target_language_name="English")
    assert messages[0] == {"role": "system", "content": expected}
    assert [message["role"] for message in messages] == ["system", "user"]
    assert item == before
    if math_mode == "placeholder" and (structured or style == "json"):
        payload = json.loads(messages[1]["content"])
        assert list(payload) == ["task", "items" if structured else "item"]
        source = payload["items"][0] if structured else payload["item"]
        assert list(source) == (["item_id", "source_text", "style_hint"] if structured else ["item_id", "source_text"])


@pytest.mark.parametrize("math_mode", ["placeholder", "direct_typst"])
@pytest.mark.parametrize("mode", ["fast", "sci"])
@pytest.mark.parametrize("style", ["tagged", "json"])
def test_batch_protocol_separators_and_style(math_mode, mode, style):
    messages = build_messages([_item(math_mode)], mode=mode, response_style=style)
    expected = build_translation_system_prompt(mode=mode, response_style=style)
    expected += "\n\n" + (load_prompt("translation_output_json.txt") if style == "json" else
                            load_prompt("translation_output_tagged.txt").format(tagged_header="<<<ITEM item_id=ITEM_ID>>>"))
    if math_mode == "direct_typst":
        expected += "\n\n" + direct_math_guidance()
    assert messages[0]["content"] == expected


@pytest.mark.parametrize("math_mode", ["placeholder", "direct_typst"])
@pytest.mark.parametrize("mode", ["fast", "sci"])
def test_group_protocol_is_json_and_preserves_member_order(math_mode, mode):
    item = _item(math_mode)
    item["translation_unit_member_ids"] = ["p002-b", "p001-a"]
    before = deepcopy(item)
    messages = build_group_member_messages(item, mode=mode)
    expected = build_translation_system_prompt(mode=mode, response_style="json")
    expected += ('\n\nReturn only valid JSON. Required schema: '
                 '{"member_translations":[{"item_id":"...","translated_text":"..."}]}. '
                 'Every member_id from the request must appear exactly once.')
    if math_mode == "direct_typst":
        expected += "\n" + direct_math_guidance()
    assert messages[0]["content"] == expected
    assert json.loads(messages[1]["content"])["group"]["member_ids"] == item["translation_unit_member_ids"]
    assert item == before

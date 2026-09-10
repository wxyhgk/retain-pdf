import json

import pytest

from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import parse_translation_payload


@pytest.mark.parametrize("protocol", ["tagged", "json"])
@pytest.mark.parametrize("copies", [2, 3])
@pytest.mark.parametrize("conflicting", [True, False])
def test_duplicate_id_never_overwrites_or_resurrects(protocol, copies, conflicting):
    entries = [{"item_id": "a", "translated_text": "甲"}]
    entries += [{"item_id": "a", "translated_text": "乙" if conflicting else "甲"}
                for _ in range(copies - 1)]
    entries.insert(1, {"item_id": "b", "translated_text": "保留的有效译文"})
    if protocol == "json":
        content = json.dumps({"translations": entries})
    else:
        content = "\n".join(f"<<<ITEM item_id={entry['item_id']}>>>\n{entry['translated_text']}\n<<<END>>>"
                            for entry in entries)
    result = parse_translation_payload(content)
    assert set(result) == {"b"}
    assert result["b"]["translated_text"] == "保留的有效译文"


def test_all_duplicate_tagged_members_are_unresolved_not_json_parse_errors():
    content = "<<<ITEM item_id=a>>>\n甲\n<<<END>>>\n" * 2
    assert parse_translation_payload(content) == {}

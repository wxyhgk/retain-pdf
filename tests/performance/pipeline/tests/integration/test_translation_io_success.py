"""Business input/output contracts; only the external model is synthetic."""
import json
from collections import Counter

import pytest

from support.translation_io_support import (
    TRANSLATIONS,
    document,
    prepare,
    run,
)
from support.translation_io_assertions import assert_complete_artifacts


@pytest.mark.parametrize("transport", ["legacy", "rust"])
@pytest.mark.parametrize("workers", [1, 8])
def test_document_to_renderer_preserves_members_and_translations(tmp_path, transport, workers):
    root = prepare(tmp_path, transport=transport, workers=workers)
    result = run(root)
    assert result["ok"], result
    assert result["violations"] == []
    assert result["calls"], "Success must exercise the external model boundary"
    translation_calls = [call for call in result["calls"] if call["kind"] == "translation"]
    submitted_members = Counter(member for call in translation_calls for member in call["members"])
    assert submitted_members == Counter(TRANSLATIONS.keys())
    assert "p001-b002" not in submitted_members
    if transport == "rust":
        assert all(call["purpose"] == "primary" for call in translation_calls)
    items = assert_complete_artifacts(root, {
        0: ["p001-b000", "p001-b001", "p001-b002", "p001-b003"],
        1: ["p002-b000", "p002-b001", "p002-b002"],
    })
    formula = items["p001-b001"]
    assert formula["math_mode"] == "direct_typst"
    assert formula["source_text"].count("$E=mc^2$") == 1
    assert formula["translated_text"].count("$E=mc^2$") == 1
    members = ["p001-b003", "p002-b000"]
    for identity in members:
        member = items[identity]
        assert member["continuation_group"] == "io-cross-page"
        assert member["translation_unit_member_ids"] == members
        assert member["translated_text"] != member["group_translated_text"]
    assert items[members[0]]["translated_text"] != items[members[1]]["translated_text"]


@pytest.mark.parametrize("data", [{}, {"schema": "normalized_document_v1", "pages": []}],
                         ids=["not-normalized", "empty-document"])
def test_invalid_document_is_rejected_before_any_model_request(tmp_path, data):
    root = prepare(tmp_path, data=data)
    result = run(root)
    assert not result["ok"]
    assert result["error_type"] == "RuntimeError"
    assert result["error"]
    assert result["calls"] == []
    assert result["violations"] == []
    manifest = root / "translated" / "translation-manifest.json"
    assert not manifest.exists() or json.loads(manifest.read_text())["status"] != "complete"


@pytest.mark.parametrize("transport", ["legacy", "rust"])
@pytest.mark.parametrize("selected_page", [0, 1])
def test_selected_page_does_not_publish_out_of_range_members(tmp_path, transport, selected_page):
    # Page selection is independent of cross-page-group expansion semantics.
    data = document()
    for page in data["pages"]:
        for block in page["blocks"]:
            block.pop("continuation_hint", None)
    root = prepare(tmp_path, transport=transport, data=data,
                   start_page=selected_page, end_page=selected_page)
    result = run(root)
    assert result["ok"], result
    assert result["violations"] == []
    expected = {0: ["p001-b000", "p001-b001", "p001-b002", "p001-b003"],
                1: ["p002-b000", "p002-b001", "p002-b002"]}
    assert_complete_artifacts(root, {selected_page: expected[selected_page]})

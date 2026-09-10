"""Selected pages must not silently expand to a provider's cross-page group."""
from collections import Counter

import pytest

from support.translation_io_support import prepare, run
from support.translation_io_assertions import assert_complete_artifacts


@pytest.mark.parametrize("transport", ["legacy", "rust"])
@pytest.mark.parametrize("selected_page", [0, 1])
def test_selected_page_with_cross_page_hint_keeps_requests_and_outputs_in_scope(
    tmp_path, transport, selected_page,
):
    # Keep real provider continuation hints; unlike the independent-page test,
    # the other member of io-cross-page is outside the requested page interval.
    root = prepare(tmp_path, transport=transport, start_page=selected_page, end_page=selected_page)
    result = run(root)
    assert result["ok"], result
    assert result["violations"] == [], result
    expected_ids = {
        0: ["p001-b000", "p001-b001", "p001-b002", "p001-b003"],
        1: ["p002-b000", "p002-b001", "p002-b002"],
    }[selected_page]
    items = assert_complete_artifacts(root, {selected_page: expected_ids})
    allowed = set(expected_ids)
    for call in result["calls"]:
        assert set(call["members"]) <= allowed
    requests = Counter(member for call in result["calls"] if call["kind"] == "translation"
                       for member in call["members"])
    assert requests == Counter(allowed - {"p001-b002"})
    for item in items.values():
        assert set(item["translation_unit_member_ids"]) <= allowed

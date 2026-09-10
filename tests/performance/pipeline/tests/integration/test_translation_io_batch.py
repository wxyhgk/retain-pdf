"""Multi-item model replies through the public workflow and real renderer."""
from collections import Counter

import pytest

from support.translation_io_support import document, prepare, run
from support.translation_io_assertions import assert_complete_artifacts


@pytest.mark.parametrize("transport", ["legacy", "rust"])
@pytest.mark.parametrize("outcome", ["success", "batch_missing", "batch_duplicate"])
def test_batch_reply_preserves_identity_and_does_not_retry_successes(tmp_path, transport, outcome):
    data = document()
    for page in data["pages"]:
        for block in page["blocks"]:
            block.pop("continuation_hint", None)
    root = prepare(tmp_path, transport=transport, outcome=outcome, data=data,
                   batch_size=8, start_page=1, end_page=1)
    result = run(root)
    assert result["violations"] == [], result
    assert result["ok"], result
    calls = [call for call in result["calls"] if call["kind"] == "translation"]
    batches = [call for call in calls if call["protocol"] == "batch"]
    assert batches, calls
    expected_ids = ["p002-b000", "p002-b001", "p002-b002"]
    assert set(batches[0]["members"]) == {"p002-b001", "p002-b002"}
    response_ids = list(reversed(batches[0]["members"]))
    if outcome == "batch_missing":
        response_ids.remove(batches[0]["members"][0])
    elif outcome == "batch_duplicate":
        response_ids.append(batches[0]["members"][0])
    assert batches[0]["response_members"] == response_ids
    assert_complete_artifacts(root, {1: expected_ids})
    submitted = Counter(key for call in calls for key in call["members"])
    expected = Counter(expected_ids)
    if outcome in {"batch_missing", "batch_duplicate"}:
        expected[batches[0]["members"][0]] += 1
    assert submitted == expected, calls
    if transport == "rust" and outcome != "success":
        repair = [call for call in calls if call["purpose"] == "repair"]
        assert len(repair) == 1
        assert repair[0]["members"] == [batches[0]["members"][0]]
        assert repair[0]["unit_id"] == batches[0]["unit_id"]

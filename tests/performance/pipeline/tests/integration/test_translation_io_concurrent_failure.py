"""Real concurrent failure, durable in-flight success, and fresh-process resume."""
import hashlib
import json
from collections import Counter

import pytest

from support.translation_io_support import TRANSLATIONS, prepare, run
from support.translation_io_assertions import assert_complete_artifacts, assert_unpublished


@pytest.mark.parametrize("attempt", range(3))
def test_inflight_success_commits_after_failure_and_is_not_requested_on_resume(tmp_path, attempt):
    root = prepare(tmp_path / str(attempt), workers=2, outcome="concurrent_failure")
    result = run(root)
    assert not result["ok"]
    assert result["error_type"] == "ExecutorError"
    assert result["violations"] == [], result
    calls = [call for call in result["calls"] if call["kind"] == "translation"]
    assert Counter(member for call in calls for member in call["members"]) == Counter(
        ["p001-b000", "p001-b001"])
    assert all(call["purpose"] == "primary" for call in calls)
    good = next(call for call in calls if call["members"] == ["p001-b001"])
    assert good["returned_after_failure_latched"] is True
    assert_unpublished(root)
    output = root / "translated"
    checkpoint = json.loads((output / "translation-checkpoint.v1.json").read_text())
    committed = set()
    for page in checkpoint["pages"]:
        raw = (output / page["path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == page["page_hash"]
        for item in json.loads(raw):
            if item["final_status"] == "translated":
                assert item["translated_text"] == TRANSLATIONS[item["item_id"]]
                committed.add(item["item_id"])
    assert committed == {"p001-b001"}
    spec_path = root / "spec.json"
    spec = json.loads(spec_path.read_text())
    spec["outcome"] = "success"
    spec_path.write_text(json.dumps(spec))
    resumed = run(root)
    assert resumed["ok"], resumed
    assert resumed["violations"] == [], resumed
    requested = Counter(member for call in resumed["calls"] if call["kind"] == "translation"
                        for member in call["members"])
    assert requested == Counter(set(TRANSLATIONS) - committed)
    assert_complete_artifacts(root, {
        0: ["p001-b000", "p001-b001", "p001-b002", "p001-b003"],
        1: ["p002-b000", "p002-b001", "p002-b002"],
    })

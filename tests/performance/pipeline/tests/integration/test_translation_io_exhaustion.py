"""Budget exhaustion must not publish partial output as a complete document."""
import json

from support.translation_io_support import document, prepare, run
from support.translation_io_assertions import assert_complete_artifacts, assert_unpublished


def test_legacy_exhaustion_cannot_publish_zero_translations_as_complete(tmp_path):
    data = document()
    data["pages"] = data["pages"][:1]
    data["pages"][0]["blocks"] = data["pages"][0]["blocks"][:1]
    root = prepare(tmp_path, transport="legacy", outcome="protocol", data=data)
    result = run(root)
    assert result["violations"] == [], result
    calls = result["calls"]
    assert [call["protocol"] for call in calls] == [
        "single", "single", "single", "single", "agent_repair", "single",
    ]
    assert all(call["members"] == ["p001-b000"] for call in calls)
    assert not result["ok"], "Exhausted translation was published as complete"
    assert_unpublished(root)
    checkpoint = json.loads((root / "translated/translation-checkpoint.v1.json").read_text())
    assert checkpoint["progress"]["pending_item_count"] == 1
    assert checkpoint["pages"][0]["pending_item_ids"] == ["p001-b000"]
    rows = json.loads((root / "translated" / checkpoint["pages"][0]["path"]).read_text())
    assert rows[0]["final_status"] == "failed"
    assert rows[0]["should_translate"] is True
    assert rows[0]["translation_diagnostics"]["dead_letter"] is True

    spec_path = root / "spec.json"
    spec = json.loads(spec_path.read_text())
    spec["outcome"] = "success"
    spec_path.write_text(json.dumps(spec))
    resumed = run(root)
    assert resumed["ok"], resumed
    assert resumed["violations"] == []
    assert [call["members"] for call in resumed["calls"]] == [["p001-b000"]]
    assert_complete_artifacts(root, {0: ["p001-b000"]})


def test_batch_exhaustion_stops_at_budget_and_resumes_in_a_fresh_process(tmp_path):
    data = document()
    for page in data["pages"]:
        for block in page["blocks"]:
            block.pop("continuation_hint", None)
    root = prepare(tmp_path, outcome="batch_exhaust", batch_size=8, data=data,
                   start_page=1, end_page=1)
    result = run(root)
    assert not result["ok"], result
    assert result["error_type"] == "ExecutorError"
    assert result["violations"] == [], result
    calls = [call for call in result["calls"] if call["kind"] == "translation"]
    batch = next(call for call in calls if len(call["members"]) > 1)
    same_unit = [call for call in calls if call["unit_id"] == batch["unit_id"]]
    assert [call["purpose"] for call in same_unit] == ["primary", "repair"]
    assert same_unit[1]["members"] == ["p002-b001"]
    assert calls[-1] == same_unit[-1]
    assert_unpublished(root)

    # Only already committed members are protected across a process restart.
    # Accepted in-memory members of the failed batch are not durable outputs.
    output = root / "translated"
    checkpoint = json.loads((output / "translation-checkpoint.v1.json").read_text())
    committed = set()
    for page in checkpoint["pages"]:
        rows = json.loads((output / page["path"]).read_text())
        committed.update(item["item_id"] for item in rows if item["final_status"] == "translated")
    assert committed == {"p002-b000"}
    spec_path = root / "spec.json"
    spec = json.loads(spec_path.read_text())
    spec["outcome"] = "success"
    spec_path.write_text(json.dumps(spec))
    resumed = run(root)
    assert resumed["ok"], resumed
    assert resumed["violations"] == []
    requested = {member for call in resumed["calls"] if call["kind"] == "translation"
                 for member in call["members"]}
    assert requested == {"p002-b001", "p002-b002"}
    assert_complete_artifacts(root, {1: ["p002-b000", "p002-b001", "p002-b002"]})

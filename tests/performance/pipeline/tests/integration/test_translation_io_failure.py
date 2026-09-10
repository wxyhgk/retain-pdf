"""Request-cost and failed-publication contracts at the document boundary."""
import pytest

from support.translation_io_support import TRANSLATIONS, prepare, read_artifacts, run
from support.translation_io_assertions import assert_unpublished


@pytest.mark.parametrize("transport", ["rust", "legacy"])
def test_document_repair_finishes_with_real_consumer_readable_translation(tmp_path, transport):
    root = prepare(tmp_path, transport=transport, workers=1, outcome="repair")
    result = run(root)
    assert result["ok"], result
    assert result["violations"] == []
    attempts = [call for call in result["calls"]
                if call["kind"] == "translation" and "p001-b000" in call["members"]]
    assert [call["purpose"] for call in attempts] == (
        ["primary", "repair"] if transport == "rust" else [None, None])
    assert len({call["unit_id"] for call in attempts}) == 1
    if transport == "rust":
        assert attempts[0]["unit_id"]
    pages, manifest, checkpoint = read_artifacts(root)
    items = {item["item_id"]: item for page in pages.values() for item in page}
    assert items["p001-b000"]["translated_text"] == TRANSLATIONS["p001-b000"]
    assert checkpoint["status"] == "complete"
    assert checkpoint["final_manifest"] == "translation-manifest.json"
    assert manifest


@pytest.mark.parametrize("outcome,purposes", [
    ("protocol", ["primary", "repair"]),
    ("transport", ["primary"]),
])
def test_failed_document_stops_requests_and_cannot_publish(tmp_path, outcome, purposes):
    # Single worker makes the no-fresh-work assertion deterministic: later
    # units have not started when the first unit exhausts its request budget.
    root = prepare(tmp_path, transport="rust", workers=1, outcome=outcome)
    result = run(root)
    assert not result["ok"]
    assert result["error_type"] == "ExecutorError"
    assert result["violations"] == []
    attempts = [call for call in result["calls"] if call["kind"] == "translation"]
    assert [call["purpose"] for call in attempts] == purposes
    assert all(call["members"] == ["p001-b000"] for call in attempts)
    assert len({call["unit_id"] for call in attempts}) == 1
    assert attempts[0]["unit_id"]
    assert result["calls"][-1] == attempts[-1]
    assert_unpublished(root)

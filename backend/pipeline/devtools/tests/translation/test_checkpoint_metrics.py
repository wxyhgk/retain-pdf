import json

import pytest

from retainpdf_pipeline.translate.workflow.checkpoint.session import TranslationCheckpointSession


def test_metrics_measure_submillisecond_success_and_failure_without_payload_mutation(tmp_path, monkeypatch):
    session = TranslationCheckpointSession(output_dir=tmp_path, identity={}, attempt_id="test")
    ticks = iter([0, 100, 100, 350])
    monkeypatch.setattr("retainpdf_pipeline.translate.workflow.checkpoint.session.time.perf_counter_ns", lambda: next(ticks))
    assert session._measure("save", lambda: "ok") == "ok"
    def fail():
        raise RuntimeError("original")
    with pytest.raises(RuntimeError, match="original"):
        session._measure("save", fail)
    metrics = session.metrics()
    assert metrics["save_count"] == 1
    assert metrics["save_failed_count"] == 1
    assert metrics["save_elapsed_ms"] == pytest.approx(0.00035)
    assert session.payload is None
    metrics["save_count"] = 999
    assert session.metrics()["save_count"] == 1


def test_initialize_and_complete_include_persist_metrics_but_never_checkpoint_fields(tmp_path):
    session = TranslationCheckpointSession(output_dir=tmp_path, identity={"fingerprint": "test"}, attempt_id="test")
    session.store.acquire()
    try:
        session._initialize()
        session.update("validating", {}, {})
        session.complete(tmp_path / "manifest.json")
        metrics = session.metrics()
        assert metrics["persist_count"] == 3
        assert metrics["update_count"] == 1
        assert metrics["projection_count"] == 1
        assert metrics["change_validation_count"] == 1
        assert metrics["save_count"] == 3
        assert metrics["observer_count"] == 0
        assert not any(key in json.loads(session.store.path.read_text()) for key in metrics)
    finally:
        session.close()


def test_persist_failure_is_not_success_and_preserves_original_exception(tmp_path, monkeypatch):
    session = TranslationCheckpointSession(output_dir=tmp_path, identity={}, attempt_id="test")
    session.payload = {}
    def fail(payload):
        raise OSError("disk unavailable")
    monkeypatch.setattr(session.store, "save", fail)
    with pytest.raises(OSError, match="disk unavailable"):
        session._persist(committed_pages=[])
    metrics = session.metrics()
    assert metrics["persist_count"] == metrics["save_count"] == 0
    assert metrics["persist_failed_count"] == metrics["save_failed_count"] == 1
    assert metrics["snapshot_count"] == 1
    assert metrics["event_count"] == 0

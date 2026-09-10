from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from retainpdf_pipeline.translate.core import execution_policy as policy
from retainpdf_pipeline.translate.llm.shared.rust_executor import ExecutorError
from retainpdf_pipeline.translate.core.engine_identity import translation_engine_identity
from retainpdf_pipeline.translate.workflow.checkpoint.session import TranslationCheckpointSession
from retainpdf_pipeline.translate.workflow.scheduling.tail_retry import _drain_translation_tail_queue


def test_policy_preserves_legacy_default_and_error_identity(monkeypatch):
    monkeypatch.delenv("RETAIN_TRANSLATION_TRANSPORT", raising=False)
    assert policy.execution_enabled() is False
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", "invalid")
    assert policy.strategy() == "baseline"
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "invalid")
    with pytest.raises(ExecutorError, match="direct fallback is disabled"):
        policy.execution_enabled()


def test_engine_fingerprint_fields_are_unchanged(monkeypatch):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    before = translation_engine_identity()
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")
    monkeypatch.setenv("RETAIN_TRANSLATION_OPTIMIZATION", "baseline")
    monkeypatch.setenv("RETAIN_MODEL_CONNECTION_FINGERPRINT", "fixed")
    assert translation_engine_identity() == {
        **before, "model_transport": "rust_executor_v1", "scheduler": "shared_page_order_v1",
        "optimization": "baseline", "connection_fingerprint": "fixed",
    }


def test_disallowed_tail_does_not_consume_queue():
    context = Mock()
    result = _drain_translation_tail_queue(translation_context=context, result_applier=Mock(),
                                           flush_state=Mock(), tail_workers=8, allow_tail_retry=False)
    assert result["items"] == 0
    assert context.mock_calls == []


@pytest.mark.parametrize("save_fails", [False, True])
def test_commit_observer_stays_after_durable_save(tmp_path, save_fails):
    session = TranslationCheckpointSession(output_dir=tmp_path, identity={}, attempt_id="test")
    session.payload = {"generation": 0}
    order = []
    def save(payload):
        order.append("save")
        if save_fails:
            raise OSError("fake failure")
    session.store = SimpleNamespace(snapshot_pages=lambda p: order.append("snapshot"), save=save,
                                    prune_snapshots=lambda g: order.append("prune"))
    session._event_payload = Mock(return_value={})
    session._emit_pipeline_checkpoint = lambda p: order.append("event")
    session.on_pages_committed = lambda p: order.append("observe")
    if save_fails:
        with pytest.raises(OSError):
            session._persist(committed_pages=[])
        assert order == ["snapshot", "save"]
    else:
        session._persist(committed_pages=[])
        assert order == ["snapshot", "save", "observe", "prune", "event"]

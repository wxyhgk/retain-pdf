"""Output ownership must precede journal initialization and paid preparation."""
from types import SimpleNamespace
import os

import pytest

from retainpdf_pipeline.translate.artifacts.request_journal import TranslationRequestJournal
from retainpdf_pipeline.translate.workflow import execution, execution_plan
from retainpdf_pipeline.translate.workflow.checkpoint.contract import translation_checkpoint_path
from retainpdf_pipeline.translate.workflow.checkpoint.store import CheckpointStore


def request_for(tmp_path):
    return execution.TranslationExecutionRequest(
        source_json_path=tmp_path / "input.json", output_dir=tmp_path / "job" / "translated",
        api_key="", mode="sci", source_pdf_path=tmp_path / "input.pdf",
    )


def test_execute_rejects_owned_output_before_journal_or_domain(tmp_path, monkeypatch):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    request = request_for(tmp_path)
    store = CheckpointStore(translation_checkpoint_path(request.output_dir))
    store.acquire()
    journal_path = request.output_dir / execution_plan.TRANSLATION_REQUEST_JOURNAL_FILE_NAME
    journal_path.write_bytes(b"existing bytes, including an incomplete record")
    domain_path = request.output_dir / "domain-context.json"
    domain_path.write_bytes(b"existing domain")
    before = {p.name: p.read_bytes() for p in request.output_dir.iterdir()}
    calls = []
    monkeypatch.setattr(execution_plan, "TranslationRequestJournal", lambda *a, **k: calls.append("journal"))
    monkeypatch.setattr(execution_plan, "build_book_translation_policy_config", lambda **k: calls.append("domain"))
    try:
        with pytest.raises(RuntimeError, match="already owned"):
            execution.execute_translation_request(request)
        assert calls == []
        assert {p.name: p.read_bytes() for p in request.output_dir.iterdir()} == before
    finally:
        store.close()


@pytest.mark.parametrize("failure", [ValueError("plan failed"), KeyboardInterrupt()])
def test_execute_plan_failure_closes_journal_and_releases_lease(tmp_path, monkeypatch, failure):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    request = request_for(tmp_path)
    monkeypatch.setattr(execution_plan, "load_ocr_json", lambda path: {})
    monkeypatch.setattr(execution_plan, "get_page_count", lambda data: 1)
    journals = []
    def journal(*args, **kwargs):
        instance = TranslationRequestJournal(*args, **kwargs)
        journals.append(instance)
        return instance
    def fail(**kwargs):
        competing = CheckpointStore(translation_checkpoint_path(request.output_dir))
        with pytest.raises(RuntimeError, match="already owned"):
            competing.acquire()
        raise failure
    monkeypatch.setattr(execution_plan, "TranslationRequestJournal", journal)
    monkeypatch.setattr(execution_plan, "build_book_translation_policy_config", fail)
    with pytest.raises(type(failure)):
        execution.execute_translation_request(request)
    assert len(journals) == 1 and journals[0]._closed
    store = CheckpointStore(translation_checkpoint_path(request.output_dir))
    store.acquire()
    store.close()


def test_execute_closes_journal_on_runner_failure_without_masking_error(tmp_path, monkeypatch):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    request = request_for(tmp_path)
    closed = []
    def close():
        closed.append(True)
        raise OSError("cleanup")
    plan = SimpleNamespace(run_diagnostics=SimpleNamespace(request_journal=SimpleNamespace(close=close)))
    monkeypatch.setattr(execution, "build_translation_execution_plan", lambda request: plan)
    def fail(request, plan, *, checkpoint_store):
        checkpoint_store.require_owned_path(translation_checkpoint_path(request.output_dir))
        raise ValueError("original failure")
    monkeypatch.setattr(execution, "run_translation_execution_plan", fail)
    with pytest.raises(ValueError, match="original failure"):
        execution.execute_translation_request(request)
    assert closed == [True]
    store = CheckpointStore(translation_checkpoint_path(request.output_dir))
    store.acquire()
    store.close()


def test_borrowed_checkpoint_store_rejects_wrong_or_unowned_path(tmp_path):
    store = CheckpointStore(tmp_path / "a" / "checkpoint.json")
    with pytest.raises(RuntimeError, match="does not own"):
        store.require_owned_path(store.path)
    store.acquire()
    try:
        with pytest.raises(RuntimeError, match="does not own"):
            store.require_owned_path(tmp_path / "b" / "checkpoint.json")
    finally:
        store.close()


def test_copied_resume_reinitializes_under_same_borrowed_lease(tmp_path, monkeypatch):
    from retainpdf_pipeline.translate.workflow.checkpoint.session import (
        TranslationCheckpointSession, ResumeCandidateFingerprintMismatch,
    )
    from retainpdf_pipeline.translate.workflow.checkpoint.resume import discard_copied_resume_candidate
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    request = request_for(tmp_path)
    request.source_json_path.write_text("{}")
    plan = SimpleNamespace(start=0, stop=0, glossary_entries=[], policy_config=SimpleNamespace(
        rule_profile_name="general_sci", custom_rules_text="",
    ))
    with TranslationCheckpointSession.acquire(request, plan) as previous:
        previous.payload["attempt_id"] = "old-attempt"
        previous.payload["fingerprint"] = "incompatible"
        previous.store.save(previous.payload)
    store = CheckpointStore(translation_checkpoint_path(request.output_dir))
    store.acquire()
    try:
        with pytest.raises(ResumeCandidateFingerprintMismatch):
            TranslationCheckpointSession.acquire(request, plan, store=store)
        store.require_owned_path(store.path)
        discard_copied_resume_candidate(request.output_dir, source_attempt_id="old-attempt", store=store)
        with TranslationCheckpointSession.acquire(request, plan, store=store) as fresh:
            assert fresh.payload["attempt_id"] == "job"
        store.require_owned_path(store.path)
    finally:
        store.close()


def test_journal_constructor_failure_releases_open_descriptor(tmp_path, monkeypatch):
    from retainpdf_pipeline.translate.artifacts import request_journal
    opened = []
    original_open = os.open
    def tracked_open(*args, **kwargs):
        fd = original_open(*args, **kwargs)
        opened.append(fd)
        return fd
    def fail(fd):
        raise OSError("stat failed")
    monkeypatch.setattr(request_journal.os, "open", tracked_open)
    monkeypatch.setattr(request_journal.os, "fstat", fail)
    with pytest.raises(OSError, match="stat failed"):
        TranslationRequestJournal(tmp_path / "journal.jsonl", attempt_id="job")
    assert len(opened) == 1
    with pytest.raises(OSError):
        os.read(opened[0], 1)


def test_journal_close_releases_descriptor_after_write_failure(tmp_path):
    journal = TranslationRequestJournal(tmp_path / "journal.jsonl", attempt_id="job")
    journal._failure = OSError("write failed")
    journal.close()
    assert journal._closed
    with pytest.raises(OSError):
        os.read(journal._fd, 1)

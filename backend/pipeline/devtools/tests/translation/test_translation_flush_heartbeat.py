"""The result consumer commits completed work even while another call is blocked."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import threading
import time

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.services.results.applier import TranslationResultApplier
from retainpdf_pipeline.translate.services.results.flush import TranslationFlushState
from retainpdf_pipeline.translate.workflow import batch_runner


def test_parallel_idle_heartbeat_saves_success_before_slow_request_returns(monkeypatch, tmp_path):
    slow_started = threading.Event()
    release_slow = threading.Event()
    first_applied = threading.Event()
    first_committed = threading.Event()
    failures: list[BaseException] = []
    commits = []
    requested = []
    payloads = {
        page: [{"item_id": identity, "page_idx": page, "source_text": source,
                "translated_text": "", "should_translate": True}]
        for page, identity, source in [(0, "a", "The first experiment succeeded."),
                                      (1, "b", "The second experiment succeeded.")]
    }
    paths = {page: tmp_path / f"page-{page}.json" for page in payloads}

    def translate(batch, **_kwargs):
        identity = batch[0]["item_id"]
        requested.append(identity)
        if identity == "a":
            assert slow_started.wait(5), "second worker did not start"
        else:
            slow_started.set()
            assert release_slow.wait(10), "parent did not release blocked model call"
        return {identity: {"decision": "translate", "translated_text": "译文" + identity,
                           "final_status": "translated"}}

    def progress(completed, _total, _pages, _substage):
        if completed == 1:
            # Exclude startup time: the first success is below the count and
            # time thresholds. Only a later idle heartbeat can commit it.
            state._last_flush_at = time.perf_counter()
            first_applied.set()

    def committed(pages, changed):
        # This callback runs after real page IO, not instead of it.
        saved = {page: json.loads(paths[page].read_text()) for page in pages}
        commits.append((pages, changed, saved, threading.get_ident()))
        if pages == {0}:
            first_committed.set()

    state = TranslationFlushState(
        page_payloads=payloads, translation_paths=paths,
        flush_interval=100, total_batches=2, flush_max_delay_seconds=0.75,
        progress_callback=progress, flush_callback=committed,
    )
    applier = TranslationResultApplier(
        flat_payload=[item for page in payloads.values() for item in page],
        item_to_page={"a": 0, "b": 1}, duplicate_items_by_rep_id={},
        flush_state=state, memory_store=None,
    )
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    monkeypatch.setattr(batch_runner, "translate_batch", translate)

    def run():
        try:
            batch_runner.run_translation_batches_parallel(
                batched_fast_batches=[], single_fast_batches=list(payloads.values()),
                single_slow_batches=[], queue_workers={"single_fast": 2},
                api_key="test", model="test", base_url="https://example.invalid",
                domain_guidance="", mode="plain", translation_context=None,
                memory_store=None, result_applier=applier, flush_state=state,
            )
        except BaseException as error:
            failures.append(error)

    consumer = threading.Thread(target=run)
    consumer.start()
    try:
        assert first_applied.wait(5), failures
        assert first_committed.wait(5), "completed translation stayed uncommitted during idle wait"
        assert consumer.is_alive()
        assert not release_slow.is_set()
        assert not paths[1].exists()
        assert len(commits) == 1
        pages, changed, saved, writer = commits[0]
        assert pages == {0}
        assert changed == {0: {"a"}}
        assert saved[0][0]["translated_text"] == "译文a"
        assert writer == consumer.ident
    finally:
        release_slow.set()
        consumer.join(10)
    assert not consumer.is_alive()
    assert failures == []
    assert sorted(requested) == ["a", "b"]
    assert [commit[0] for commit in commits] == [{0}, {1}]
    assert all(commit[3] == consumer.ident for commit in commits)
    assert json.loads(paths[1].read_text())[0]["translated_text"] == "译文b"
    assert state.dirty_pages == set()

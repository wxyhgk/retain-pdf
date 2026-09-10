from __future__ import annotations

import sys
import time
import pytest
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.services.results import (
    flush as flush_module,
)
from retainpdf_pipeline.translate.services.results.flush import (
    TranslationFlushState,
)


@pytest.mark.parametrize("failed", [False, True])
def test_flush_total_includes_checkpoint_and_preserves_dirty_on_failure(monkeypatch, tmp_path, failed):
    clock = [0]
    monkeypatch.setattr(flush_module.time, "perf_counter_ns", lambda: clock[0])
    monkeypatch.setattr(flush_module.time, "perf_counter", lambda: clock[0] / 1_000_000_000)

    def save(*args, **kwargs):
        clock[0] += 2_000_000

    def checkpoint(*args):
        clock[0] += 10_000_000
        if failed:
            raise RuntimeError("synthetic checkpoint failure")

    monkeypatch.setattr(flush_module, "save_pages", save)
    state = TranslationFlushState(page_payloads={0: []}, translation_paths={0: tmp_path / "page.json"},
                                  flush_interval=1, total_batches=1, flush_callback=checkpoint)
    state.mark_dirty({0}, {0: {"item"}})
    if failed:
        with pytest.raises(RuntimeError, match="synthetic checkpoint"):
            state.flush(label="test")
    else:
        state.flush(label="test")
    stats = state.stats()
    assert stats["flush_elapsed_ms"] == 2
    assert stats["flush_callback_elapsed_ms"] == 10
    assert stats["flush_total_elapsed_ms"] == 12
    assert stats["flush_commit_count"] == int(not failed)
    assert stats["flush_callback_failed_count"] == int(failed)
    assert state.dirty_pages == ({0} if failed else set())
    assert state.dirty_item_ids_by_page == ({0: {"item"}} if failed else {})


def test_flush_keeps_submillisecond_samples_until_export(monkeypatch, tmp_path):
    clock = [0]
    monkeypatch.setattr(flush_module.time, "perf_counter_ns", lambda: clock[0])
    monkeypatch.setattr(flush_module, "save_pages", lambda *a, **k: None)
    def callback(*args):
        clock[0] += 100_000
    state = TranslationFlushState(page_payloads={0: []}, translation_paths={0: tmp_path / "page.json"},
                                  flush_interval=1, total_batches=10, flush_callback=callback)
    for _ in range(10):
        state.mark_dirty({0}, {0: {"item"}})
        state.flush(label="test")
    assert state.stats()["flush_callback_elapsed_ms"] == 1
    assert state.stats()["flush_total_elapsed_ms"] == 1


def test_diagnostics_reads_latest_checkpoint_metrics_and_safe_repair_counts():
    from retainpdf_pipeline.translate.artifacts.aggregator import TranslationRunDiagnostics
    diagnostics = TranslationRunDiagnostics("fake", "fake", "https://example.invalid", 1, 1, 1)
    metrics = {"persist_count": 1, "persist_elapsed_ms": 1.25}
    diagnostics.set_checkpoint_metrics_provider(lambda: dict(metrics))
    assert diagnostics.build_summary()["checkpoint_timing"]["persist_count"] == 1
    metrics["persist_count"] = 3  # Includes complete/failure persistence after batch stage.
    diagnostics.set_garbled_reconstruction_stats({"garbled_failed": 2, "raw_error": "private"})
    summary = diagnostics.build_summary()
    assert summary["checkpoint_timing"]["persist_count"] == 3
    assert summary["garbled_reconstruction"] == {"garbled_failed": 2}


def test_translation_batch_flush_skips_full_unit_refresh(monkeypatch, tmp_path: Path) -> None:
    calls: list[dict] = []

    def _save_pages(page_payloads, translation_paths, page_indices=None, *, refresh_units=True):
        calls.append(
            {
                "page_indices": set(page_indices or []),
                "refresh_units": refresh_units,
            }
        )

    monkeypatch.setattr(flush_module, "save_pages", _save_pages)

    state = TranslationFlushState(
        page_payloads={0: [{"item_id": "p001-b001"}], 1: [{"item_id": "p002-b001"}]},
        translation_paths={0: tmp_path / "page-001.json", 1: tmp_path / "page-002.json"},
        flush_interval=1,
        total_batches=2,
    )
    state.mark_dirty({1}, {1: {"p002-b001"}})
    state.flush(label="test flush")

    assert calls == [{"page_indices": {1}, "refresh_units": False}]
    assert state.stats()["flush_count"] == 1
    assert state.stats()["flushed_page_total"] == 1
    assert state.stats()["max_flush_pages"] == 1
    assert state.stats()["flush_elapsed_ms"] >= 0


def test_translation_flush_forwards_precise_item_ids(monkeypatch, tmp_path: Path) -> None:
    callbacks: list[tuple[set[int], dict[int, set[str]]]] = []
    monkeypatch.setattr(flush_module, "save_pages", lambda *_args, **_kwargs: None)
    state = TranslationFlushState(
        page_payloads={0: [], 1: []},
        translation_paths={0: tmp_path / "page-001.json", 1: tmp_path / "page-002.json"},
        flush_interval=20,
        total_batches=100,
        flush_callback=lambda pages, items: callbacks.append((pages, items)),
    )
    state.mark_dirty({0}, {0: {"p001-b003"}})
    state.mark_dirty({1}, {1: {"p002-b004", "p002-b005"}})

    state.flush(label="precise flush")

    assert callbacks == [
        (
            {0, 1},
            {0: {"p001-b003"}, 1: {"p002-b004", "p002-b005"}},
        )
    ]
    assert state.dirty_item_ids_by_page == {}


def test_translation_flush_uses_time_threshold(monkeypatch, tmp_path: Path) -> None:
    calls: list[set[int]] = []
    monkeypatch.setattr(
        flush_module,
        "save_pages",
        lambda _payloads, _paths, pages, **_kwargs: calls.append(set(pages)),
    )
    state = TranslationFlushState(
        page_payloads={0: [{"item_id": "p001-b001"}]},
        translation_paths={0: tmp_path / "page-001.json"},
        flush_interval=100,
        total_batches=100,
        flush_max_delay_seconds=0.75,
    )
    state.mark_dirty({0}, {0: {"p001-b001"}})
    state._last_flush_at = time.perf_counter() - 0.8

    state.flush_if_due(1, label="timed flush")

    assert calls == [{0}]

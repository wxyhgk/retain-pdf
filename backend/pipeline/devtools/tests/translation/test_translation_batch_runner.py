from __future__ import annotations

import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.services.results.applier import (
    TranslationResultApplier,
)
from retainpdf_pipeline.translate.workflow import batch_runner


class _FlushState:
    def __init__(self) -> None:
        self.dirty_pages: set[int] = set()
        self.progress: list[tuple[int, set[int], str]] = []
        self.flush_labels: list[str] = []
        self.final_flushed = False
        self.total_batches = 0

    def mark_dirty(self, pages: set[int], _changed_item_ids_by_page: dict[int, set[str]]) -> None:
        self.dirty_pages.update(pages)

    def record_progress(self, completed: int, touched_pages: set[int], *, substage: str = "translation_batches") -> None:
        self.progress.append((completed, set(touched_pages), substage))

    def flush_if_due(self, _completed: int, *, label: str) -> None:
        self.flush_labels.append(label)

    def final_flush(self) -> None:
        self.final_flushed = True


def test_parallel_batch_runner_drains_successes_after_one_future_exception(monkeypatch) -> None:
    good_batch = [{"item_id": "a", "page_idx": 0, "source_text": "A"}]
    bad_batch = [{"item_id": "b", "page_idx": 1, "source_text": "B"}]

    def _translate(batch, **_kwargs):
        if batch[0]["item_id"] == "b":
            raise ValueError("broken result parser")
        return {"a": {"decision": "translate", "translated_text": "甲", "final_status": "translated"}}

    monkeypatch.setattr(batch_runner, "translate_batch", _translate)
    payload = [
        {"item_id": "a", "page_idx": 0, "source_text": "A", "translated_text": ""},
        {"item_id": "b", "page_idx": 1, "source_text": "B", "translated_text": ""},
    ]
    flush_state = _FlushState()
    applier = TranslationResultApplier(
        flat_payload=payload,
        item_to_page={"a": 0, "b": 1},
        duplicate_items_by_rep_id={},
        flush_state=flush_state,
        memory_store=None,
    )

    batch_runner.run_translation_batches_parallel(
        batched_fast_batches=[],
        single_fast_batches=[good_batch, bad_batch],
        single_slow_batches=[],
        queue_workers={"batched_fast": 1, "single_fast": 1, "single_slow": 1},
        api_key="sk-test",
        model="deepseek-chat",
        base_url="https://example.test",
        domain_guidance="",
        mode="plain",
        translation_context=None,
        memory_store=None,
        result_applier=applier,
        flush_state=flush_state,
    )

    assert payload[0]["translated_text"] == "甲"
    assert payload[0]["final_status"] == "translated"
    assert payload[1]["final_status"] == "failed"
    assert payload[1]["translation_diagnostics"]["degradation_reason"] == "batch_unhandled_exception"
    assert flush_state.final_flushed is True
    assert flush_state.progress[-1] == (2, {0, 1}, "translation_batches")

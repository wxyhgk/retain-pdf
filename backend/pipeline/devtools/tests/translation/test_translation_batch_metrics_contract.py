"""Timing is application-only; exceptions still publish partial diagnostics."""
from __future__ import annotations

from pathlib import Path
import sys
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from retainpdf_pipeline.translate.artifacts import TranslationRunDiagnostics
from retainpdf_pipeline.translate.llm.shared import executor_context
from retainpdf_pipeline.translate.services.results.applier import TranslationResultApplier
from retainpdf_pipeline.translate.workflow import batch_runner
from retainpdf_pipeline.translate.workflow.phases import batch_translation


def _stage_args(tmp_path, *, workers, diagnostics, count=1):
    payload = [{"item_id": f"p001-b00{index}", "page_idx": 0,
                "source_text": f"The chemical experiment number {index} produced a clear solution.",
                "protected_source_text": f"The chemical experiment number {index} produced a clear solution.",
                "block_type": "text", "should_translate": True, "translated_text": ""}
               for index in range(count)]
    return dict(page_payloads={0: payload}, translation_paths={0: tmp_path / "page.json"},
                batch_size=1, workers=workers, api_key="test", model="test",
                base_url="https://example.invalid", domain_guidance="", mode="plain",
                translation_context=None, run_diagnostics=diagnostics)


def _diagnostics(workers):
    return TranslationRunDiagnostics(provider_family="test", model="test",
        base_url="https://example.invalid", configured_workers=workers,
        configured_batch_size=1, configured_classify_batch_size=1)


@pytest.mark.parametrize("workers", [1, 2])
def test_apply_timing_excludes_model_wait_and_flush(monkeypatch, tmp_path, workers):
    clock = [0.0]
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    # Replace only this module's clock, not the process-wide time module.
    monkeypatch.setattr(batch_runner, "time", SimpleNamespace(perf_counter=lambda: clock[0]))
    def translate(batch, **_kwargs):
        clock[0] += 100.0
        return {item["item_id"]: {"decision": "translate", "translated_text": "实验成功。"}
                for item in batch}
    monkeypatch.setattr(batch_runner, "translate_batch", translate)
    method = "apply_batch" if workers == 1 else "apply_batches"
    original = getattr(TranslationResultApplier, method)
    def apply(self, *args, **kwargs):
        result = original(self, *args, **kwargs)
        clock[0] += 0.125
        return result
    monkeypatch.setattr(TranslationResultApplier, method, apply)
    def flushed(*_args):
        clock[0] += 50.0
    diagnostics = _diagnostics(workers)
    summary = batch_translation.run_translation_batch_stage(
        **_stage_args(tmp_path, workers=workers, diagnostics=diagnostics),
        flush_callback=flushed,
    )
    assert summary["apply_elapsed_ms"] == 125
    assert summary["applied_batches"] == 1
    assert summary["flush_count"] == 1
    assert clock[0] >= 150
    assert diagnostics.build_summary()["result_apply"]["apply_elapsed_ms"] == 125


@pytest.mark.parametrize("workers", [1, 2])
def test_failed_stage_retains_partial_stats_and_does_not_emit_success(monkeypatch, tmp_path, workers):
    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "rust")
    runtime = executor_context.ExecutorRuntime(client=None)
    monkeypatch.setattr(executor_context, "_runtime", runtime)
    failure = executor_context.ExecutorError("synthetic request exhausted")
    events = []
    monkeypatch.setattr(batch_translation, "emit_stage_progress", lambda **event: events.append(event))
    def translate(batch, **_kwargs):
        if batch[0]["item_id"] == "p001-b001":
            raise failure
        return {item["item_id"]: {"decision": "translate", "translated_text": "实验成功。"}
                for item in batch}
    # Boundary fake supplies deterministic model outcomes; real consumer,
    # result application, page IO, failure latch and diagnostics all run.
    monkeypatch.setattr(batch_runner, "_translate_batch_or_keep_origin", translate)
    diagnostics = _diagnostics(workers)
    with pytest.raises(executor_context.ExecutorError) as caught:
        batch_translation.run_translation_batch_stage(
            **_stage_args(tmp_path, workers=workers, diagnostics=diagnostics, count=2))
    assert caught.value is failure
    report = diagnostics.build_summary()
    assert report["total_batches"] == 2
    # Parallel counts normalized results passed to the applier, including the
    # empty failed result. Sequential failure never reaches the applier.
    assert report["result_apply"]["applied_batches"] == (1 if workers == 1 else 2)
    assert report["result_flush"]["flush_count"] >= 1
    assert report["result_flush"]["flushed_page_total"] >= 1
    assert "translation_batches" in report["phase_elapsed_ms"]
    assert diagnostics._stage_stats["translation_batches"].started_at is None
    assert all(event.get("message") != "翻译批次完成" for event in events)


def test_preparation_failure_still_closes_phase_without_inventing_result_stats(monkeypatch, tmp_path):
    failure = ValueError("synthetic invalid input")
    def fail(**_kwargs):
        raise failure
    monkeypatch.setattr(batch_translation, "translate_pending_units", fail)
    diagnostics = _diagnostics(1)
    with pytest.raises(ValueError) as caught:
        batch_translation.run_translation_batch_stage(**_stage_args(tmp_path, workers=1, diagnostics=diagnostics))
    assert caught.value is failure
    report = diagnostics.build_summary()
    assert report["result_apply"] == {}
    assert diagnostics._stage_stats["translation_batches"].started_at is None

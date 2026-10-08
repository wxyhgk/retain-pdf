"""Timing is application-only; exceptions still publish partial diagnostics."""
from __future__ import annotations

from types import SimpleNamespace

import pytest


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


def test_batch_progress_counts_this_rounds_blocks_and_completed_pages(monkeypatch, tmp_path):
    """翻译进度按「本轮待翻译块」计,unit=block,批次号只进 payload。

    分母取进入批量翻译时 checkpoint 的 pending_item_count(样本 408),不是全文
    块数(642):续跑时前几轮已完成的 234 块不该让进度一开始就显示 37%。
    页数只报「已整页完成」的,不写「约第 x 页」——批次乱序完成。
    """
    snapshots = iter([
        {"item_count": 642, "completed_item_count": 234, "pending_item_count": 408, "completed_page_count": 5},
        {"item_count": 642, "completed_item_count": 330, "pending_item_count": 312, "completed_page_count": 9},
        {"item_count": 642, "completed_item_count": 642, "pending_item_count": 0, "completed_page_count": 48},
    ])
    state = {"latest": None}

    def snapshot():
        state["latest"] = next(snapshots, state["latest"])
        return state["latest"]

    def fake_pending(**kwargs):
        kwargs["progress_callback"](40, 167, {3, 4}, "translation_batches")
        kwargs["progress_callback"](167, 167, {47}, "translation_batches")
        kwargs["progress_callback"](3, 5, {2}, "translation_tail_retry")
        return {"total_batches": 167, "pending_items": 408, "effective_batch_size": 4}

    events = []
    monkeypatch.setattr(batch_translation, "translate_pending_units", fake_pending)
    monkeypatch.setattr(batch_translation, "emit_stage_progress", lambda **event: events.append(event))
    args = _stage_args(tmp_path, workers=1, diagnostics=None)
    args["page_payloads"] = {index: [] for index in range(48)}
    batch_translation.run_translation_batch_stage(**args, checkpoint_progress=snapshot)

    first, second, tail, finished = events
    assert first["substage"] == "translation_batches"
    assert (first["progress_current"], first["progress_total"]) == (96, 408)
    assert first["message"] == first["stage_detail"] == "已翻译 96/408 块 · 已完成 9/48 页"
    assert first["payload"]["progress_unit"] == "block"
    assert (first["payload"]["batch_current"], first["payload"]["batch_total"]) == (40, 167)
    assert (first["payload"]["completed_page_count"], first["payload"]["page_count"]) == (9, 48)
    assert "约第" not in first["message"]
    assert (second["progress_current"], second["progress_total"]) == (408, 408)
    assert second["stage_detail"] == "已翻译 408/408 块 · 已完成 48/48 页"
    # 尾部重试队列是另一个 substage,沿用原口径。
    assert tail["substage"] == "translation_tail_retry"
    assert "progress_unit" not in tail["payload"]
    assert finished["message"] == "翻译批次完成"
    assert finished["stage_detail"] == "已翻译 408/408 块 · 已完成 48/48 页"
    assert finished["payload"]["progress_unit"] == "block"
    assert finished["payload"]["pending_items"] == 408


def test_batch_progress_without_checkpoint_keeps_batch_wording(monkeypatch, tmp_path):
    def fake_pending(**kwargs):
        kwargs["progress_callback"](2, 5, {0}, "translation_batches")
        return {"total_batches": 5, "pending_items": 9, "effective_batch_size": 2}

    events = []
    monkeypatch.setattr(batch_translation, "translate_pending_units", fake_pending)
    monkeypatch.setattr(batch_translation, "emit_stage_progress", lambda **event: events.append(event))
    batch_translation.run_translation_batch_stage(**_stage_args(tmp_path, workers=1, diagnostics=None))
    assert events[0]["message"].startswith("已完成第 2/5 批翻译")
    assert "progress_unit" not in events[0]["payload"]


def test_token_usage_counts_cache_hits_from_deepseek_and_dashscope():
    diagnostics = _diagnostics(1)
    # DeepSeek：顶层报命中与未命中。
    diagnostics.record_token_usage({
        "prompt_tokens": 1000, "completion_tokens": 100, "total_tokens": 1100,
        "prompt_cache_hit_tokens": 640, "prompt_cache_miss_tokens": 360,
    })
    # DashScope（Qwen）：只在 prompt_tokens_details 里报命中数，未命中按差值补。
    diagnostics.record_token_usage({
        "prompt_tokens": 2000, "completion_tokens": 200, "total_tokens": 2200,
        "prompt_tokens_details": {"cached_tokens": 1536},
    })
    # 没有任何缓存字段的接口：缓存两项不动。
    diagnostics.record_token_usage({"prompt_tokens": 10, "completion_tokens": 1, "total_tokens": 11})

    usage = diagnostics._token_usage
    assert usage["requests_with_usage"] == 3
    assert usage["prompt_tokens"] == 3010
    assert usage["prompt_cache_hit_tokens"] == 640 + 1536
    assert usage["prompt_cache_miss_tokens"] == 360 + 464

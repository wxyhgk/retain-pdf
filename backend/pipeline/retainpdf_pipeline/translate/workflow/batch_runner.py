from __future__ import annotations

from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Empty, Queue
import time
from typing import Callable
from retainpdf_pipeline.translate.llm.shared.executor_context import execution_enabled, runtime as executor_runtime, raise_if_executor_failed
from retainpdf_pipeline.translate.llm.shared.rust_executor import ExecutorError

from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration import translate_batch
from retainpdf_pipeline.translate.services.memory import JobMemoryStore
from retainpdf_pipeline.translate.services.memory import flush_translation_memory

from retainpdf_pipeline.translate.workflow.batching.executor import _translate_batch_or_keep_origin
from retainpdf_pipeline.translate.services.results.flush import TranslationFlushState
from retainpdf_pipeline.translate.services.results.applier import TranslationResultApplier
from retainpdf_pipeline.translate.workflow.scheduling.failures import _failed_results_for_unhandled_batch_exception
from retainpdf_pipeline.translate.workflow.scheduling.pool_specs import (
    TranslationTask,
    build_pool_specs,
    translation_tasks as _translation_tasks,
)
from retainpdf_pipeline.translate.workflow.scheduling.metrics import SchedulerMetrics
from retainpdf_pipeline.translate.workflow.scheduling.tail_retry import _drain_translation_tail_queue
from retainpdf_pipeline.translate.workflow.scheduling.tail_retry import _should_drain_translation_tail_early
from retainpdf_pipeline.translate.workflow.scheduling.tail_retry import _transport_tail_retry_workers

TranslationResult = tuple[
    str,
    int,
    list[dict],
    dict[str, dict[str, str]] | None,
    Exception | None,
]
AppliedTranslationResult = tuple[list[dict], dict[str, dict[str, str]]]
RESULT_DRAIN_BATCH_SIZE = 64


def _empty_tail_retry_stats() -> dict[str, int]:
    return {
        "tail_retry_drains": 0,
        "tail_retry_items": 0,
        "tail_retry_completed": 0,
        "tail_retry_failed": 0,
        "tail_retry_elapsed_ms": 0,
        "early_tail_retry_drains": 0,
        "final_tail_retry_drains": 0,
    }


def _merge_tail_retry_stats(target: dict[str, int], stats: dict | None, *, early: bool) -> None:
    if not stats or int(stats.get("items", 0) or 0) <= 0:
        return
    target["tail_retry_drains"] += 1
    target["tail_retry_items"] += int(stats.get("items", 0) or 0)
    target["tail_retry_completed"] += int(stats.get("completed", 0) or 0)
    target["tail_retry_failed"] += int(stats.get("failed", 0) or 0)
    target["tail_retry_elapsed_ms"] += int(stats.get("elapsed_ms", 0) or 0)
    if early:
        target["early_tail_retry_drains"] += 1
    else:
        target["final_tail_retry_drains"] += 1


def run_translation_batches_sequential(
    batches: list[list[dict]],
    *,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    result_applier: TranslationResultApplier,
    flush_state: TranslationFlushState,
    apply_stats_callback: Callable[..., None] | None = None,
) -> None:
    total_batches = len(batches)
    for index, batch in enumerate(batches, start=1):
        batch_label = f"book: batch {index}/{total_batches}"
        try:
            translated = _translate_batch_or_keep_origin(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=batch_label,
                domain_guidance=domain_guidance,
                mode=mode,
                context=translation_context,
                memory_store=memory_store,
                translate_fn=translate_batch,
            )
        except ExecutorError:
            flush_translation_memory(memory_store)
            flush_state.final_flush()
            raise
        apply_started = time.perf_counter()
        touched_pages = result_applier.apply_batch(batch, translated)
        apply_elapsed = time.perf_counter() - apply_started
        if apply_stats_callback is not None:
            apply_stats_callback(batch_count=1, elapsed_s=apply_elapsed)
        flush_state.record_progress(index, touched_pages)
        flush_state.flush_if_due(index, label=f"flushed after batch {index}/{total_batches}")
    _drain_translation_tail_queue(
        allow_tail_retry=not execution_enabled(),
        translation_context=translation_context,
        result_applier=result_applier,
        flush_state=flush_state,
        tail_workers=1,
    )
    flush_translation_memory(memory_store)
    flush_state.final_flush()


def _run_translation_queue_worker(
    *,
    task_queue: Queue[TranslationTask],
    result_queue: Queue[TranslationResult],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    metrics: SchedulerMetrics | None = None,
) -> None:
    while True:
        try:
            queue_name, index, queue_total, batch = task_queue.get_nowait()
        except Empty:
            return
        if metrics is not None:
            metrics.start()
        translated: dict[str, dict[str, str]] | None = None
        exc: Exception | None = None
        try:
            translated = _translate_batch_or_keep_origin(
                batch,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"book: {queue_name} batch {index}/{queue_total}",
                domain_guidance=domain_guidance,
                mode=mode,
                context=translation_context,
                memory_store=memory_store,
                translate_fn=translate_batch,
            )
        except Exception as caught:
            exc = caught
        finally:
            task_queue.task_done()
            if metrics is not None:
                metrics.finish()
        result_queue.put((queue_name, index, batch, translated, exc))


def _start_translation_queue_workers(
    *,
    tasks: list[TranslationTask],
    worker_count: int,
    result_queue: Queue[TranslationResult],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    metrics: SchedulerMetrics | None = None,
) -> tuple[ThreadPoolExecutor, list]:
    task_queue: Queue[TranslationTask] = Queue()
    for task in tasks:
        task_queue.put(task)
    resolved_worker_count = max(1, min(int(worker_count or 1), len(tasks)))
    executor = ThreadPoolExecutor(max_workers=resolved_worker_count)
    futures = [
        executor.submit(
            _run_translation_queue_worker,
            task_queue=task_queue,
            result_queue=result_queue,
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            memory_store=memory_store,
            metrics=metrics,
        )
        for _ in range(resolved_worker_count)
    ]
    return executor, futures


def _normalize_translation_result(result: TranslationResult) -> AppliedTranslationResult:
    queue_name, _batch_index, batch, translated, exc = result
    if execution_enabled() and isinstance(exc, ExecutorError):
        executor_runtime().fail(exc)
        # Leave failed items pending. Successful in-flight batches still pass
        # through the normal applier/flush path; no fake keep-origin completion.
        return batch, {}
    if exc is not None:
        print(
            f"book: {queue_name} batch failed, preserving remaining completed results: {type(exc).__name__}: {exc}",
            flush=True,
        )
        translated = _failed_results_for_unhandled_batch_exception(batch, exc)
    return batch, translated or {}


def _drain_available_results(
    first_result: TranslationResult,
    result_queue: Queue[TranslationResult],
    *,
    max_results: int = RESULT_DRAIN_BATCH_SIZE,
) -> list[AppliedTranslationResult]:
    drained = [_normalize_translation_result(first_result)]
    while len(drained) < max(1, max_results):
        try:
            drained.append(_normalize_translation_result(result_queue.get_nowait()))
        except Empty:
            break
    return drained


def run_translation_batches_parallel(
    *,
    batched_fast_batches: list[list[dict]],
    single_fast_batches: list[list[dict]],
    single_slow_batches: list[list[dict]],
    queue_workers: dict[str, int],
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None,
    result_applier: TranslationResultApplier,
    flush_state: TranslationFlushState,
    apply_stats_callback: Callable[..., None] | None = None,
    tail_retry_stats_callback: Callable[..., None] | None = None,
    flush_stats_callback: Callable[..., None] | None = None,
    use_shared_queue: bool | None = None,
) -> None:
    # Direct callers retain environment-selected scheduling; production passes
    # the choice already made by its dispatch plan. Runtime failure gates remain
    # independent of this pool-layout choice.
    if use_shared_queue is None:
        use_shared_queue = execution_enabled()
    executors: list[ThreadPoolExecutor] = []
    worker_futures = []
    result_queue: Queue[TranslationResult] = Queue()
    batches_by_queue = {
        "batched_fast": batched_fast_batches,
        "single_fast": single_fast_batches,
        "single_slow": single_slow_batches,
    }
    total_batches = sum(len(batches) for batches in batches_by_queue.values())
    metrics = SchedulerMetrics(total_batches, min(total_batches, max(1, sum(queue_workers.values())))) if use_shared_queue else None
    tail_retry_workers = _transport_tail_retry_workers(queue_workers)
    pool_specs = build_pool_specs(
        batched_fast_batches=batched_fast_batches,
        single_fast_batches=single_fast_batches,
        single_slow_batches=single_slow_batches,
        queue_workers=queue_workers,
        use_shared_queue=use_shared_queue,
    )
    for pool_name, tasks, worker_count in pool_specs:
        if not tasks:
            continue
        worker_count = max(1, int(worker_count or 0))
        print(f"book: start {pool_name} translation pool tasks={len(tasks)} workers={min(worker_count, len(tasks))}", flush=True)
        executor, futures = _start_translation_queue_workers(
            tasks=tasks,
            worker_count=worker_count,
            result_queue=result_queue,
            api_key=api_key,
            model=model,
            base_url=base_url,
            domain_guidance=domain_guidance,
            mode=mode,
            translation_context=translation_context,
            memory_store=memory_store,
            metrics=metrics,
        )
        executors.append(executor)
        worker_futures.extend(futures)
    completed = 0
    applied_batch_count = 0
    apply_elapsed_s = 0.0
    max_result_drain_batch = 0
    tail_retry_stats = _empty_tail_retry_stats()
    try:
        while completed < total_batches:
            try:
                _queue_name, _batch_index, batch, translated, exc = result_queue.get(timeout=0.5)
            except Empty:
                # A slow in-flight request must not hold already-applied pages
                # in memory until another result arrives. Keep all page writes
                # on this consumer thread, including the idle heartbeat.
                flush_state.flush_if_due(
                    completed,
                    label=f"flushed while waiting after completed batch {completed}/{total_batches}",
                )
                if worker_futures and all(future.done() for future in worker_futures):
                    failed_workers = [future for future in worker_futures if future.exception() is not None]
                    if failed_workers:
                        raise failed_workers[0].exception()
                    raise RuntimeError(
                        f"translation worker queues stopped early: completed={completed} total={total_batches}"
                    )
                continue
            drained = _drain_available_results(
                (_queue_name, _batch_index, batch, translated, exc),
                result_queue,
            )
            apply_started = time.perf_counter()
            touched_pages = result_applier.apply_batches(drained)
            apply_elapsed = time.perf_counter() - apply_started
            if metrics is not None:
                metrics.applied(touched_pages)
            applied_batch_count += len(drained)
            apply_elapsed_s += max(0.0, apply_elapsed)
            max_result_drain_batch = max(max_result_drain_batch, len(drained))
            if apply_stats_callback is not None:
                apply_stats_callback(batch_count=len(drained), elapsed_s=apply_elapsed)
            completed += len(drained)
            flush_state.record_progress(completed, touched_pages)
            flush_state.flush_if_due(completed, label=f"flushed after completed batch {completed}/{total_batches}")
            print(f"book: completed batch {completed}/{total_batches} (+{len(drained)})", flush=True)
            if _should_drain_translation_tail_early(completed, total_batches):
                tail_stats = _drain_translation_tail_queue(
                    allow_tail_retry=not execution_enabled(),
                    translation_context=translation_context,
                    result_applier=result_applier,
                    flush_state=flush_state,
                    tail_workers=tail_retry_workers,
                    update_total_batches=False,
                    label_prefix="early translation tail retry",
                )
                _merge_tail_retry_stats(tail_retry_stats, tail_stats, early=True)
        if execution_enabled():
            flush_translation_memory(memory_store)
            flush_state.final_flush()
            raise_if_executor_failed()
        final_tail_stats = _drain_translation_tail_queue(
            allow_tail_retry=not execution_enabled(),
            translation_context=translation_context,
            result_applier=result_applier,
            flush_state=flush_state,
            tail_workers=tail_retry_workers,
            update_total_batches=True,
            label_prefix="translation tail retry",
        )
        _merge_tail_retry_stats(tail_retry_stats, final_tail_stats, early=False)
        flush_translation_memory(memory_store)
        flush_state.final_flush()
    finally:
        for executor in executors:
            executor.shutdown(wait=True, cancel_futures=False)
        if metrics is not None:
            from retainpdf_pipeline.translate.artifacts.aggregator import get_active_translation_run_diagnostics
            diagnostics = get_active_translation_run_diagnostics()
            if diagnostics is not None:
                diagnostics.set_scheduler_metrics(metrics.snapshot())
        if apply_stats_callback is not None:
            apply_stats_callback(
                batch_count=0,
                elapsed_s=0.0,
                reported_applied_batches=applied_batch_count,
                reported_apply_elapsed_s=apply_elapsed_s,
                reported_max_result_drain_batch=max_result_drain_batch,
            )
        if tail_retry_stats_callback is not None:
            tail_retry_stats_callback(**tail_retry_stats)
        if flush_stats_callback is not None:
            flush_stats_callback(**flush_state.stats())
        for future in worker_futures:
            if future.done() and future.exception() is not None:
                raise future.exception()


__all__ = [
    "run_translation_batches_parallel",
    "run_translation_batches_sequential",
]

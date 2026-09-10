from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.translate.core.execution_policy import execution_enabled
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.workflow.scheduling.page_order import page_ordered_batches
from retainpdf_pipeline.translate.workflow.batching.batching import _build_translation_batches as _build_translation_batches_impl
from retainpdf_pipeline.translate.workflow.batching.batching import _classify_translation_batches
from retainpdf_pipeline.translate.workflow.batching.batching import _effective_translation_batch_size
from retainpdf_pipeline.translate.workflow.batching.batching import _save_flush_interval
from retainpdf_pipeline.translate.workflow.batching.batching import chunked
from retainpdf_pipeline.translate.workflow.batching.dedupe import _dedupe_pending_items
from retainpdf_pipeline.translate.workflow.batching.dedupe import _dedupe_signature
from retainpdf_pipeline.translate.workflow.batching.dedupe import _source_text
from retainpdf_pipeline.translate.services.fast_path.keep_origin import _fast_path_keep_origin_result
from retainpdf_pipeline.translate.services.fast_path.keep_origin import _is_fast_path_keep_origin_item
from retainpdf_pipeline.translate.services.fast_path.keep_origin import _normalized_text_without_placeholders
from retainpdf_pipeline.translate.services.fast_path.keep_origin import _plan_item_view
from retainpdf_pipeline.translate.workflow.scheduling.allocation import _adaptive_floor_limit
from retainpdf_pipeline.translate.workflow.scheduling.allocation import _adaptive_initial_limit
from retainpdf_pipeline.translate.workflow.scheduling.allocation import _allocate_translation_queue_workers
from retainpdf_pipeline.translate.workflow.scheduling.allocation import _provider_adaptive_initial_limit
from retainpdf_pipeline.translate.workflow.scheduling.allocation import _slow_worker_cap
from retainpdf_pipeline.translate.workflow.scheduling.stats import TranslationBatchRunStats


def _build_translation_batches(
    pending: list[dict],
    *,
    effective_batch_size: int,
    translation_context,
) -> tuple[list[list[dict]], list[dict[str, dict[str, str]]]]:
    return _build_translation_batches_impl(
        pending,
        effective_batch_size=effective_batch_size,
        translation_context=translation_context,
        is_fast_path_keep_origin_item_fn=_is_fast_path_keep_origin_item,
        fast_path_keep_origin_result_fn=_fast_path_keep_origin_result,
        plan_item_view_fn=_plan_item_view,
    )


def effective_translation_batch_size(
    *,
    batch_size: int,
    model: str,
    base_url: str,
    translation_context,
) -> int:
    return _effective_translation_batch_size(
        batch_size=batch_size,
        model=model,
        base_url=base_url,
        translation_context=translation_context,
    )


@dataclass(frozen=True)
class BatchDispatchPlan:
    """Prepared dispatch data, not an immutable copy of document items.

    Singleton and duplicate items deliberately retain their original references;
    low-risk batch candidates retain the existing builder's shallow-copy behavior.
    Preparation of translation-unit metadata is the caller's responsibility.
    """

    pending: list[dict]
    duplicate_items_by_rep_id: dict[str, list[dict]]
    batches: list[list[dict]]
    immediate_results: list[dict[str, dict[str, str]]]
    batched_fast_batches: list[list[dict]]
    single_fast_batches: list[list[dict]]
    single_slow_batches: list[list[dict]]
    queue_workers: dict[str, int]
    run_stats: TranslationBatchRunStats
    shared_workers: int | None

    @property
    def total_batches(self) -> int:
        return self.run_stats.total_batches

    @property
    def flush_interval(self) -> int:
        return self.run_stats.flush_interval

    def stats_payload(self) -> dict[str, int]:
        payload = self.run_stats.as_dict()
        if self.shared_workers is not None:
            payload["shared_workers"] = self.shared_workers
        return payload


def build_batch_dispatch_plan(
    pending: list[dict],
    *,
    batch_size: int,
    workers: int,
    model: str,
    base_url: str,
    translation_context: TranslationControlContext | None,
) -> BatchDispatchPlan:
    """Plan already-prepared units without file, model or memory-store I/O.

    Existing environment-selected strategy and transport policy remain in force.
    Do not call pending_translation_items here: that preparation mutates document
    metadata and must occur exactly once, before this planning boundary.
    """
    pending, duplicates = _dedupe_pending_items(pending)
    effective_batch_size = _effective_translation_batch_size(
        batch_size=batch_size, model=model, base_url=base_url,
        translation_context=translation_context,
    )
    batches, immediate_results = _build_translation_batches(
        pending, effective_batch_size=effective_batch_size,
        translation_context=translation_context,
    )
    use_shared_queue = execution_enabled()
    if use_shared_queue:
        batches = page_ordered_batches(batches)
    batched_fast, single_fast, single_slow = _classify_translation_batches(batches)
    total_batches = len(batches)
    flush_interval = _save_flush_interval(workers=workers, total_batches=total_batches)
    slow_worker_limit = _slow_worker_cap(max(1, workers), len(single_slow))
    queue_workers = _allocate_translation_queue_workers(
        workers, batched_fast_count=len(batched_fast),
        single_fast_count=len(single_fast), single_slow_count=len(single_slow),
        slow_worker_limit=slow_worker_limit,
    )
    run_stats = TranslationBatchRunStats(
        pending_items=len(pending), total_batches=total_batches,
        effective_batch_size=effective_batch_size, flush_interval=flush_interval,
        effective_workers=max(1, workers), batched_fast_batches=len(batched_fast),
        single_fast_batches=len(single_fast), single_slow_batches=len(single_slow),
        batched_fast_workers=queue_workers["batched_fast"],
        single_fast_workers=queue_workers["single_fast"],
        single_slow_workers=queue_workers["single_slow"],
        slow_worker_limit=slow_worker_limit,
    )
    return BatchDispatchPlan(
        pending=pending, duplicate_items_by_rep_id=duplicates,
        batches=batches, immediate_results=immediate_results,
        batched_fast_batches=batched_fast, single_fast_batches=single_fast,
        single_slow_batches=single_slow, queue_workers=queue_workers,
        run_stats=run_stats,
        shared_workers=min(max(1, workers), total_batches) if use_shared_queue else None,
    )


__all__ = [
    "BatchDispatchPlan",
    "build_batch_dispatch_plan",
    "chunked",
    "TranslationBatchRunStats",
    "_adaptive_floor_limit",
    "_adaptive_initial_limit",
    "_provider_adaptive_initial_limit",
    "_allocate_translation_queue_workers",
    "_build_translation_batches",
    "_classify_translation_batches",
    "_dedupe_pending_items",
    "_dedupe_signature",
    "effective_translation_batch_size",
    "_effective_translation_batch_size",
    "_fast_path_keep_origin_result",
    "_is_fast_path_keep_origin_item",
    "_normalized_text_without_placeholders",
    "_plan_item_view",
    "_save_flush_interval",
    "_slow_worker_cap",
    "_source_text",
]

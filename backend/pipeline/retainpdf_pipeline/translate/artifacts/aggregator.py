from __future__ import annotations

import math
import re
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from dataclasses import field
from statistics import mean
from typing import Any, Callable

from retainpdf_pipeline.translate.core.provider_identity import is_deepseek_family_provider
from retainpdf_pipeline.translate.core.provider_identity import is_deepseek_official_endpoint

from .request_journal import TranslationRequestJournal


_ACTIVE_RUN_LOCK = threading.RLock()
_ACTIVE_RUN: "TranslationRunDiagnostics | None" = None
_REQUEST_REQ_SUFFIX_RE = re.compile(r"\s+req#\d+\b")


def classify_provider_family(*, base_url: str, model: str) -> str:
    """把 provider 归类成诊断产物里的 family 标签。

    判定口径来自 core.provider_identity 这个唯一真相源,本函数只负责映射成标签:
    这里刻意**不**对 base_url 做 normalize——空 base_url 归一化后会落到官方端点,
    若在这里归一化,就会把"没配 base_url"的任务标成 deepseek_official,
    进而打开官方档位的并发/超时。诊断标签描述的是配置里写了什么。
    """
    if is_deepseek_official_endpoint(base_url):
        return "deepseek_official"
    if is_deepseek_family_provider(model=model, base_url=base_url):
        return "deepseek_compatible"
    return "other"


def infer_stage_from_request_label(request_label: str) -> str:
    label = (request_label or "").strip().lower()
    if not label:
        return "unspecified"
    if label.startswith("book: batch") or label.startswith("book: batched_fast batch"):
        return "translation"
    if label.startswith("book: single_fast batch") or label.startswith("book: single_slow batch"):
        return "translation"
    if label.startswith("classification page"):
        return "classification"
    if label.startswith("continuation-review"):
        return "continuation_review"
    if label.startswith("mixed-split"):
        return "mixed_literal_split"
    if label.startswith("garbled-reconstruct"):
        return "garbled_reconstruction"
    if label.startswith("domain-infer"):
        return "domain_context"
    if " typst-repair" in label or label.startswith("typst-repair"):
        return "typst_repair"
    return "other_llm"


def get_active_translation_run_diagnostics() -> "TranslationRunDiagnostics | None":
    with _ACTIVE_RUN_LOCK:
        return _ACTIVE_RUN


@contextmanager
def translation_run_diagnostics_scope(run: "TranslationRunDiagnostics"):
    global _ACTIVE_RUN
    with _ACTIVE_RUN_LOCK:
        previous = _ACTIVE_RUN
        _ACTIVE_RUN = run
    try:
        yield run
    finally:
        with _ACTIVE_RUN_LOCK:
            _ACTIVE_RUN = previous


@dataclass
class _StageStats:
    started_at: float | None = None
    elapsed_ms: int = 0


@dataclass
class TranslationRunDiagnostics:
    provider_family: str
    model: str
    base_url: str
    configured_workers: int
    configured_batch_size: int
    configured_classify_batch_size: int
    request_journal: TranslationRequestJournal | None = field(default=None, repr=False)
    run_started_at: float = field(default_factory=time.perf_counter)
    _lock: threading.RLock = field(default_factory=threading.RLock, init=False, repr=False)
    _request_seq: int = field(default=0, init=False, repr=False)
    _request_index: dict[int, dict[str, Any]] = field(default_factory=dict, init=False, repr=False)
    _inflight_by_stage: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _peak_inflight_by_stage: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _latencies_ms: list[int] = field(default_factory=list, init=False, repr=False)
    _stage_stats: dict[str, _StageStats] = field(default_factory=dict, init=False, repr=False)
    _request_label_retry_counts: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _request_counts: dict[str, int] = field(
        default_factory=lambda: {
            "total_http_attempts": 0,
            "succeeded_attempts": 0,
            "failed_attempts": 0,
            "retried_attempts": 0,
            "timeout_attempts": 0,
            "http_error_attempts": 0,
            "request_exception_attempts": 0,
        },
        init=False,
        repr=False,
    )
    _effective: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _workload: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _slow_requests: list[dict[str, Any]] = field(default_factory=list, init=False, repr=False)
    _adaptive_condition: threading.Condition = field(default_factory=threading.Condition, init=False, repr=False)
    _adaptive_inflight: int = field(default=0, init=False, repr=False)
    _adaptive_limit: int = field(default=0, init=False, repr=False)
    _adaptive_initial_limit: int = field(default=0, init=False, repr=False)
    _adaptive_peak_limit: int = field(default=0, init=False, repr=False)
    _adaptive_floor_limit: int = field(default=0, init=False, repr=False)
    _adaptive_success_streak: int = field(default=0, init=False, repr=False)
    _adaptive_recent_failure_count: int = field(default=0, init=False, repr=False)
    _adaptive_slow_success_streak: int = field(default=0, init=False, repr=False)
    _warmup_pending: bool = field(default=False, init=False, repr=False)
    _warmup_restore_limit: int = field(default=0, init=False, repr=False)
    _result_stats: dict[str, Any] = field(default_factory=dict, init=False, repr=False)
    _queue_split: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _flush_stats: dict[str, int | float] = field(default_factory=dict, init=False, repr=False)
    _checkpoint_metrics_provider: Callable[[], dict] | None = field(default=None, init=False, repr=False)
    _garbled_stats: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _tail_retry_stats: dict[str, int] = field(default_factory=dict, init=False, repr=False)
    _token_usage: dict[str, int] = field(
        default_factory=lambda: {
            "requests_with_usage": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "prompt_cache_hit_tokens": 0,
            "prompt_cache_miss_tokens": 0,
        },
        init=False,
        repr=False,
    )

    def __post_init__(self) -> None:
        initial_limit = max(1, int(self.configured_workers))
        self._adaptive_limit = initial_limit
        self._adaptive_initial_limit = initial_limit
        self._adaptive_peak_limit = initial_limit
        self._adaptive_floor_limit = max(1, min(8, initial_limit))

    def set_effective_settings(
        self,
        *,
        translation_workers: int,
        policy_workers: int,
        continuation_workers: int,
        mixed_split_workers: int,
        translation_batch_size: int,
    ) -> None:
        with self._lock:
            self._effective = {
                "effective_workers_translation": int(max(1, translation_workers)),
                "effective_workers_policy": int(max(1, policy_workers)),
                "effective_workers_continuation": int(max(1, continuation_workers)),
                "effective_workers_mixed_split": int(max(1, mixed_split_workers)),
                "effective_batch_size_translation": int(max(1, translation_batch_size)),
            }

    def set_workload(
        self,
        *,
        pending_items: int,
        total_batches: int,
    ) -> None:
        with self._lock:
            self._workload["pending_items"] = int(max(0, pending_items))
            self._workload["total_batches"] = int(max(0, total_batches))

    def set_effective_translation_batch_size(self, value: int) -> None:
        with self._lock:
            self._effective["effective_batch_size_translation"] = int(max(1, value))

    def set_scheduler_metrics(self, metrics: dict) -> None:
        with self._lock:
            self._scheduler_metrics = metrics

    def record_committed_pages(self, pages: list[dict]) -> None:
        with self._lock:
            if not hasattr(self, "_first_page_commit_ms"):
                self._first_page_commit_ms = {}
            for page in pages:
                index = page.get("page_index")
                if isinstance(index, int) and index >= 0:
                    self._first_page_commit_ms.setdefault(str(index + 1), round((time.perf_counter() - self.run_started_at) * 1000, 3))

    def set_translation_queue_workers(
        self,
        *,
        batched_fast_workers: int,
        single_fast_workers: int,
        single_slow_workers: int,
        slow_worker_limit: int,
        batched_fast_batches: int = 0,
        single_fast_batches: int = 0,
        single_slow_batches: int = 0,
        shared_workers: int = 0,
    ) -> None:
        with self._lock:
            if shared_workers:
                batched_fast_workers = single_fast_workers = single_slow_workers = slow_worker_limit = 0
            self._effective["effective_workers_batched_fast"] = int(max(0, batched_fast_workers))
            self._effective["effective_workers_single_fast"] = int(max(0, single_fast_workers))
            self._effective["effective_workers_single_slow"] = int(max(0, single_slow_workers))
            self._effective["slow_worker_limit"] = int(max(0, slow_worker_limit))
            self._queue_split = {
                "batched_fast_batches": int(max(0, batched_fast_batches)),
                "single_fast_batches": int(max(0, single_fast_batches)),
                "single_slow_batches": int(max(0, single_slow_batches)),
                "fast_queue_batches": int(max(0, batched_fast_batches)) + int(max(0, single_fast_batches)),
                "slow_queue_batches": int(max(0, single_slow_batches)),
                "batched_fast_workers": int(max(0, batched_fast_workers)),
                "single_fast_workers": int(max(0, single_fast_workers)),
                "single_slow_workers": int(max(0, single_slow_workers)),
            }
            if shared_workers:
                self._queue_split.update(scheduler="shared_page_order", shared_workers=shared_workers)

    def set_checkpoint_metrics_provider(self, provider: Callable[[], dict]) -> None:
        self._checkpoint_metrics_provider = provider

    def set_garbled_reconstruction_stats(self, summary: dict) -> None:
        with self._lock:
            self._garbled_stats = {
                key: max(0, int(summary[key])) for key in (
                    "garbled_candidates", "garbled_attempted", "garbled_skipped_by_budget",
                    "garbled_reconstructed", "garbled_applied", "garbled_rejected",
                    "garbled_no_result", "garbled_failed", "garbled_completed",
                ) if key in summary
            }

    def set_translation_result_stats(
        self,
        *,
        applied_batches: int,
        apply_elapsed_ms: int,
        max_result_drain_batch: int,
        flush_count: int = 0,
        flushed_page_total: int = 0,
        flush_elapsed_ms: int = 0,
        flush_callback_elapsed_ms: float = 0,
        flush_total_elapsed_ms: float = 0,
        flush_commit_count: int = 0,
        flush_callback_failed_count: int = 0,
        max_flush_pages: int = 0,
        tail_retry_drains: int = 0,
        tail_retry_items: int = 0,
        tail_retry_completed: int = 0,
        tail_retry_failed: int = 0,
        tail_retry_elapsed_ms: int = 0,
        early_tail_retry_drains: int = 0,
        final_tail_retry_drains: int = 0,
    ) -> None:
        with self._lock:
            self._result_stats = {
                "applied_batches": int(max(0, applied_batches)),
                "apply_elapsed_ms": int(max(0, apply_elapsed_ms)),
                "max_result_drain_batch": int(max(0, max_result_drain_batch)),
            }
            self._flush_stats = {
                "flush_count": int(max(0, flush_count)),
                "flushed_page_total": int(max(0, flushed_page_total)),
                "flush_elapsed_ms": int(max(0, flush_elapsed_ms)),
                "flush_callback_elapsed_ms": max(0, flush_callback_elapsed_ms),
                "flush_total_elapsed_ms": max(0, flush_total_elapsed_ms),
                "flush_commit_count": max(0, flush_commit_count),
                "flush_callback_failed_count": max(0, flush_callback_failed_count),
                "max_flush_pages": int(max(0, max_flush_pages)),
            }
            self._tail_retry_stats = {
                "tail_retry_drains": int(max(0, tail_retry_drains)),
                "tail_retry_items": int(max(0, tail_retry_items)),
                "tail_retry_completed": int(max(0, tail_retry_completed)),
                "tail_retry_failed": int(max(0, tail_retry_failed)),
                "tail_retry_elapsed_ms": int(max(0, tail_retry_elapsed_ms)),
                "early_tail_retry_drains": int(max(0, early_tail_retry_drains)),
                "final_tail_retry_drains": int(max(0, final_tail_retry_drains)),
            }

    def set_http_pool_settings(self, *, pool_size: int, pool_cap: int) -> None:
        with self._lock:
            self._effective["http_pool_size"] = int(max(1, pool_size))
            self._effective["http_pool_cap"] = int(max(1, pool_cap))

    def configure_adaptive_concurrency(
        self,
        *,
        initial_limit: int,
        floor_limit: int | None = None,
        warmup: bool = False,
    ) -> None:
        limit = max(1, min(max(1, self.configured_workers), int(initial_limit or 1)))
        floor = max(1, min(limit, int(floor_limit if floor_limit is not None else min(8, limit))))
        with self._adaptive_condition:
            # warmup:先只放行 1 条请求,让 provider 的前缀缓存写入公共
            # 系统提示词,首条请求结束后恢复全并发——后续请求命中缓存,
            # 同时避免全并发冷启动惊群。
            self._warmup_pending = bool(warmup) and limit > 1
            self._warmup_restore_limit = limit
            self._adaptive_limit = 1 if self._warmup_pending else limit
            self._adaptive_initial_limit = limit
            self._adaptive_peak_limit = max(self._adaptive_peak_limit, limit)
            self._adaptive_floor_limit = floor
            self._adaptive_condition.notify_all()

    def mark_phase_start(self, phase: str) -> None:
        if not phase:
            return
        with self._lock:
            stats = self._stage_stats.setdefault(phase, _StageStats())
            stats.started_at = time.perf_counter()

    def mark_phase_end(self, phase: str) -> None:
        if not phase:
            return
        with self._lock:
            stats = self._stage_stats.setdefault(phase, _StageStats())
            if stats.started_at is None:
                return
            stats.elapsed_ms = int(round((time.perf_counter() - stats.started_at) * 1000))
            stats.started_at = None

    def record_request_start(
        self,
        *,
        stage: str,
        request_label: str,
        timeout_s: int,
        attempt: int,
    ) -> int:
        normalized_stage = stage or "unspecified"
        normalized_label = request_label or ""
        logical_label = _REQUEST_REQ_SUFFIX_RE.sub("", normalized_label).strip() or normalized_label
        with self._lock:
            self._request_seq += 1
            request_id = self._request_seq
            self._request_counts["total_http_attempts"] += 1
            if attempt > 1:
                self._request_counts["retried_attempts"] += 1
                if logical_label:
                    self._request_label_retry_counts[logical_label] = max(
                        attempt,
                        self._request_label_retry_counts.get(logical_label, 1),
                    )
            current = self._inflight_by_stage.get(normalized_stage, 0) + 1
            self._inflight_by_stage[normalized_stage] = current
            self._peak_inflight_by_stage[normalized_stage] = max(
                current,
                self._peak_inflight_by_stage.get(normalized_stage, 0),
            )
            all_current = self._inflight_by_stage.get("__all__", 0) + 1
            self._inflight_by_stage["__all__"] = all_current
            self._peak_inflight_by_stage["__all__"] = max(
                all_current,
                self._peak_inflight_by_stage.get("__all__", 0),
            )
            self._request_index[request_id] = {
                "stage": normalized_stage,
                "request_label": normalized_label,
                "logical_label": logical_label,
                "timeout_s": int(timeout_s),
                "attempt": int(attempt),
            }
            return request_id

    def record_request_dispatch(self, request_id: int, *, request_key: str) -> None:
        journal = self.request_journal
        if journal is None:
            return
        with self._lock:
            meta = self._request_index.get(request_id)
            if meta is None:
                return
            stage = str(meta["stage"])
            request_label = str(meta["request_label"])
            attempt = int(meta["attempt"])
        request_token = journal.record_dispatch(
            request_key=request_key,
            stage=stage,
            request_label=request_label,
            http_attempt=attempt,
        )
        with self._lock:
            current = self._request_index.get(request_id)
            if current is not None:
                current["journal_request_token"] = request_token
                current["journal_request_key"] = request_key

    def acquire_request_slot(self) -> None:
        with self._adaptive_condition:
            while self._adaptive_inflight >= self._adaptive_limit:
                self._adaptive_condition.wait(timeout=0.25)
            self._adaptive_inflight += 1

    def release_request_slot(
        self,
        *,
        success: bool,
        elapsed_ms: int,
        status_code: int | None = None,
        error_class: str = "",
    ) -> None:
        with self._adaptive_condition:
            self._adaptive_inflight = max(0, self._adaptive_inflight - 1)
            if self._warmup_pending:
                # 无论首条请求成败都恢复全并发:预热是尽力而为,失败时
                # 不能把整个运行钉死在串行。
                self._warmup_pending = False
                self._adaptive_limit = max(self._adaptive_limit, self._warmup_restore_limit)
            self._rebalance_adaptive_limit(
                success=success,
                elapsed_ms=elapsed_ms,
                status_code=status_code,
                error_class=error_class,
            )
            self._adaptive_condition.notify_all()

    def _rebalance_adaptive_limit(
        self,
        *,
        success: bool,
        elapsed_ms: int,
        status_code: int | None,
        error_class: str,
    ) -> None:
        min_limit = max(1, min(self._adaptive_floor_limit, self.configured_workers))
        max_limit = max(1, self.configured_workers)
        timeout_like = error_class in {"ReadTimeout", "ConnectTimeout", "Timeout", "ConnectionError"}
        overloaded_status = status_code in {408, 429, 500, 502, 503, 504}
        high_capacity_provider = self.provider_family == "deepseek_official"
        if not success and overloaded_status:
            self._adaptive_recent_failure_count += 1
            ratio = 0.75 if high_capacity_provider else 0.5
            reduced = max(min_limit, int(math.floor(self._adaptive_limit * ratio)))
            self._adaptive_limit = reduced
            self._adaptive_success_streak = 0
            self._adaptive_slow_success_streak = 0
            return
        if not success and timeout_like:
            self._adaptive_recent_failure_count += 1
            self._adaptive_success_streak = 0
            self._adaptive_slow_success_streak = 0
            if high_capacity_provider:
                # 孤立超时容忍不降速;但失败连续堆积说明网络/provider 边缘
                # 正在劣化(实测连接超时风暴中 limit 钉死 100 只会加剧惊群),
                # 每堆积 5 次温和降速一档。成功会清零计数。
                if self._adaptive_recent_failure_count % 5 == 0:
                    self._adaptive_limit = max(min_limit, int(math.floor(self._adaptive_limit * 0.85)))
                return
            reduced = max(min_limit, int(math.floor(self._adaptive_limit * 0.5)))
            self._adaptive_limit = reduced
            return
        if high_capacity_provider and success:
            self._adaptive_recent_failure_count = 0
            self._adaptive_slow_success_streak = 0
            self._adaptive_success_streak += 1
            if elapsed_ms <= 15000 and self._adaptive_success_streak >= 12 and self._adaptive_limit < max_limit:
                self._adaptive_limit += 1
                self._adaptive_peak_limit = max(self._adaptive_peak_limit, self._adaptive_limit)
                self._adaptive_success_streak = 0
            return
        if success and elapsed_ms >= 90000:
            self._adaptive_limit = max(min_limit, int(math.floor(self._adaptive_limit * 0.5)))
            self._adaptive_success_streak = 0
            self._adaptive_slow_success_streak = 0
            return
        if success and elapsed_ms >= 60000:
            self._adaptive_limit = max(min_limit, int(math.floor(self._adaptive_limit * 0.75)))
            self._adaptive_success_streak = 0
            self._adaptive_slow_success_streak = 0
            return
        if success and elapsed_ms >= 45000:
            self._adaptive_slow_success_streak += 1
            self._adaptive_success_streak = 0
            if self._adaptive_slow_success_streak >= 2:
                self._adaptive_limit = max(min_limit, int(math.floor(self._adaptive_limit * 0.85)))
                self._adaptive_slow_success_streak = 0
            return
        if success:
            self._adaptive_recent_failure_count = 0
            self._adaptive_slow_success_streak = 0
            self._adaptive_success_streak += 1
            if elapsed_ms <= 15000 and self._adaptive_success_streak >= 12 and self._adaptive_limit < max_limit:
                self._adaptive_limit += 1
                self._adaptive_peak_limit = max(self._adaptive_peak_limit, self._adaptive_limit)
                self._adaptive_success_streak = 0

    def record_request_end(
        self,
        request_id: int,
        *,
        success: bool,
        elapsed_ms: int,
        status_code: int | None = None,
        error_class: str = "",
        journal_outcome: str = "",
    ) -> None:
        journal_terminal: tuple[str, str] | None = None
        with self._lock:
            meta = self._request_index.pop(request_id, None)
            if meta is None:
                return
            stage = meta["stage"]
            self._inflight_by_stage[stage] = max(0, self._inflight_by_stage.get(stage, 0) - 1)
            self._inflight_by_stage["__all__"] = max(0, self._inflight_by_stage.get("__all__", 0) - 1)
            elapsed = int(max(0, elapsed_ms))
            self._latencies_ms.append(elapsed)
            if success:
                self._request_counts["succeeded_attempts"] += 1
            else:
                self._request_counts["failed_attempts"] += 1
                normalized_error = (error_class or "").strip()
                if normalized_error in {"ReadTimeout", "ConnectTimeout", "Timeout"}:
                    self._request_counts["timeout_attempts"] += 1
                elif status_code is not None:
                    self._request_counts["http_error_attempts"] += 1
                else:
                    self._request_counts["request_exception_attempts"] += 1
            slow_sample = {
                "stage": stage,
                "request_label": meta["request_label"],
                "attempt": meta["attempt"],
                "elapsed_ms": elapsed,
                "timeout_s": meta["timeout_s"],
                "success": success,
            }
            if status_code is not None:
                slow_sample["status_code"] = int(status_code)
            if error_class:
                slow_sample["error_class"] = error_class
            self._remember_slow_request(slow_sample)
            request_token = str(meta.get("journal_request_token") or "")
            request_key = str(meta.get("journal_request_key") or "")
            if request_token and request_key:
                journal_terminal = (request_token, request_key)
        if self.request_journal is not None and journal_terminal is not None:
            request_token, request_key = journal_terminal
            self.request_journal.record_terminal(
                request_token=request_token,
                request_key=request_key,
                outcome=journal_outcome or ("succeeded" if success else "ambiguous"),
                status_code=status_code,
                error_class=error_class,
            )

    def record_token_usage(self, usage: dict[str, Any]) -> None:
        # Accumulates the provider-reported `usage` block (OpenAI-compatible),
        # including DeepSeek's prompt cache hit/miss split, so runs can be
        # costed and cache effectiveness verified from the run summary.
        if not isinstance(usage, dict):
            return
        with self._lock:
            self._token_usage["requests_with_usage"] += 1
            for key in (
                "prompt_tokens",
                "completion_tokens",
                "total_tokens",
                "prompt_cache_hit_tokens",
                "prompt_cache_miss_tokens",
            ):
                value = usage.get(key)
                if isinstance(value, (int, float)):
                    self._token_usage[key] += int(value)

    def _remember_slow_request(self, sample: dict[str, Any], limit: int = 12) -> None:
        self._slow_requests.append(sample)
        self._slow_requests.sort(key=lambda item: int(item.get("elapsed_ms", 0)), reverse=True)
        del self._slow_requests[limit:]

    def _latency_summary(self) -> dict[str, int | float]:
        if not self._latencies_ms:
            return {"count": 0, "min": 0, "p50": 0, "p90": 0, "p95": 0, "max": 0, "mean": 0.0}
        ordered = sorted(self._latencies_ms)
        return {
            "count": len(ordered),
            "min": ordered[0],
            "p50": _percentile(ordered, 50),
            "p90": _percentile(ordered, 90),
            "p95": _percentile(ordered, 95),
            "max": ordered[-1],
            "mean": round(mean(ordered), 2),
        }

    def _phase_elapsed_summary(self) -> dict[str, int]:
        phases: dict[str, int] = {}
        for phase, stats in self._stage_stats.items():
            if stats.elapsed_ms > 0:
                phases[phase] = stats.elapsed_ms
        return phases

    def _recommendations(self) -> list[str]:
        recommendations: list[str] = []
        timeout_attempts = self._request_counts["timeout_attempts"]
        peak_translation = self._peak_inflight_by_stage.get("translation", 0)
        p95 = int(self._latency_summary().get("p95", 0))
        if timeout_attempts > 0 and peak_translation >= 32:
            recommendations.append("Timeouts under high inflight translation suggest upstream saturation; reduce workers or keep adaptive concurrency enabled.")
        if timeout_attempts > 0 and p95 >= 60000:
            recommendations.append("High p95 latency plus timeouts suggests upstream queueing; inspect provider-side rate limits and retry budget.")
        if not recommendations and peak_translation > 0:
            recommendations.append("Observed concurrency is stable; use this artifact as the baseline before changing workers or timeout values.")
        return recommendations

    def build_summary(self) -> dict[str, Any]:
        with self._lock:
            retrying_labels = sum(1 for attempts in self._request_label_retry_counts.values() if attempts > 1)
            summary = {
                "provider_family": self.provider_family,
                "model": self.model,
                "base_url": self.base_url,
                "configured_workers": self.configured_workers,
                "configured_batch_size": self.configured_batch_size,
                "configured_classify_batch_size": self.configured_classify_batch_size,
                **self._effective,
                **self._workload,
                "request_counts": dict(self._request_counts),
                "latency_summary_ms": self._latency_summary(),
                "retry_summary": {
                    "retrying_request_labels": retrying_labels,
                    "max_http_attempt": max(self._request_label_retry_counts.values(), default=1),
                },
                "concurrency_observed": {
                    "peak_inflight_translation_requests": self._peak_inflight_by_stage.get("translation", 0),
                    "peak_inflight_classification_requests": self._peak_inflight_by_stage.get("classification", 0),
                    "peak_inflight_policy_requests": self._peak_inflight_by_stage.get("mixed_literal_split", 0),
                    "peak_inflight_all_llm_requests": self._peak_inflight_by_stage.get("__all__", 0),
                },
                "translation_queue_split": dict(self._queue_split),
                "scheduler_metrics": getattr(self, "_scheduler_metrics", None),
                "first_page_commit_ms_since_run_start": getattr(self, "_first_page_commit_ms", None),
                "adaptive_concurrency": {
                    "enabled": True,
                    "configured_limit": self.configured_workers,
                    "initial_limit": self._adaptive_initial_limit,
                    "current_limit": self._adaptive_limit,
                    "peak_limit": self._adaptive_peak_limit,
                    "floor_limit": self._adaptive_floor_limit,
                },
                "result_apply": dict(self._result_stats),
                "result_flush": dict(self._flush_stats),
                "garbled_reconstruction": dict(self._garbled_stats),
                "tail_retry": dict(self._tail_retry_stats),
                "token_usage": dict(self._token_usage),
                "phase_elapsed_ms": self._phase_elapsed_summary(),
                "slow_request_samples": list(self._slow_requests),
                "recommendations": self._recommendations(),
            }
        if self.request_journal is not None:
            summary["request_journal"] = self.request_journal.summary()
        if self._checkpoint_metrics_provider is not None:
            summary["checkpoint_timing"] = dict(self._checkpoint_metrics_provider())
        return summary


def _percentile(values: list[int], percentile: int) -> int:
    if not values:
        return 0
    if len(values) == 1:
        return int(values[0])
    rank = (len(values) - 1) * (percentile / 100.0)
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return int(values[lower])
    weight = rank - lower
    interpolated = values[lower] * (1.0 - weight) + values[upper] * weight
    return int(round(interpolated))

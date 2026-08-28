from __future__ import annotations

import math
import re
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from dataclasses import field
from statistics import mean
from typing import Any


_ACTIVE_RUN_LOCK = threading.RLock()
_ACTIVE_RUN: "TranslationRunDiagnostics | None" = None
_REQUEST_REQ_SUFFIX_RE = re.compile(r"\s+req#\d+\b")


def classify_provider_family(*, base_url: str, model: str) -> str:
    normalized_base = (base_url or "").strip().lower()
    normalized_model = (model or "").strip().lower()
    if "api.deepseek.com" in normalized_base:
        return "deepseek_official"
    if "deepseek" in normalized_base or normalized_model.startswith("deepseek"):
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
    _flush_stats: dict[str, int] = field(default_factory=dict, init=False, repr=False)
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
    ) -> None:
        with self._lock:
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

    def set_translation_result_stats(
        self,
        *,
        applied_batches: int,
        apply_elapsed_ms: int,
        max_result_drain_batch: int,
        flush_count: int = 0,
        flushed_page_total: int = 0,
        flush_elapsed_ms: int = 0,
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
            # warmup: chỉ cho phép 1 yêu cầu đầu tiên để provider ghi bộ nhớ đệm tiền tố vào
            # prompt hệ thống chung, sau khi yêu cầu đầu kết thúc thì khôi phục toàn bộ đồng thời —
            # các yêu cầu sau sẽ trúng bộ nhớ đệm, đồng thời tránh hiện tượng "thức tỉnh đột ngột" khi khởi động lạnh với toàn bộ đồng thời.
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
                # bất kể yêu cầu đầu tiên thành công hay thất bại đều khôi phục toàn bộ đồng thời: warmup là nỗ lực hết sức, khi thất bại
                # không thể khóa toàn bộ quá trình vào chế độ tuần tự.
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
                # chấp nhận timeout riêng lẻ mà không giảm tốc; nhưng khi thất bại liên tục chồng chất cho thấy mạng/lớp biên của provider
                # đang xuống cấp (thực tế trong cơn bão timeout kết nối, cố định limit ở 100 chỉ làm trầm trọng thêm hiện tượng "thức tỉnh đột ngột"),
                # cứ mỗi 5 lần thất bại thì giảm tốc độ một cách nhẹ nhàng. Thành công sẽ xóa bộ đếm.
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
    ) -> None:
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
            return {
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
                "tail_retry": dict(self._tail_retry_stats),
                "token_usage": dict(self._token_usage),
                "phase_elapsed_ms": self._phase_elapsed_summary(),
                "slow_request_samples": list(self._slow_requests),
                "recommendations": self._recommendations(),
            }


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

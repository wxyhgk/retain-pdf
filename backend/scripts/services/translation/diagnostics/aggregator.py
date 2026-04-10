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
    if label.startswith("book: batch"):
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
    _adaptive_peak_limit: int = field(default=0, init=False, repr=False)
    _adaptive_success_streak: int = field(default=0, init=False, repr=False)

    def __post_init__(self) -> None:
        initial_limit = max(1, int(self.configured_workers))
        self._adaptive_limit = initial_limit
        self._adaptive_peak_limit = initial_limit

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
        if self.provider_family != "deepseek_official":
            return
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
        if self.provider_family != "deepseek_official":
            return
        with self._adaptive_condition:
            self._adaptive_inflight = max(0, self._adaptive_inflight - 1)
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
        min_limit = max(1, min(8, self.configured_workers))
        max_limit = max(1, self.configured_workers)
        timeout_like = error_class in {"ReadTimeout", "ConnectTimeout", "Timeout"}
        overloaded_status = status_code in {408, 429, 500, 502, 503, 504}
        if not success and (timeout_like or overloaded_status):
            reduced = max(min_limit, int(self._adaptive_limit * 0.7))
            self._adaptive_limit = min(self._adaptive_limit - 1, reduced) if self._adaptive_limit > min_limit else min_limit
            self._adaptive_success_streak = 0
            return
        if success and elapsed_ms >= 90000:
            self._adaptive_limit = max(min_limit, self._adaptive_limit - 1)
            self._adaptive_success_streak = 0
            return
        if success:
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
        if self.provider_family == "other":
            recommendations.append("Current provider is not DeepSeek; compare with DeepSeek official for baseline stability.")
        if timeout_attempts > 0 and peak_translation >= 32:
            recommendations.append("Timeouts under high inflight translation suggest provider saturation; reduce workers for this provider.")
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
                "adaptive_concurrency": {
                    "enabled": self.provider_family == "deepseek_official",
                    "current_limit": self._adaptive_limit,
                    "peak_limit": self._adaptive_peak_limit,
                },
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

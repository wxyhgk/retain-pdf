"""Upstream resilience classification for translate LLM calls.

Single source of truth for transient vs non-retryable upstream errors:

- transient (limited retry, exponential backoff): Timeout / 429 / 5xx /
  connection errors / DNS errors.
- non-retryable (fail fast, no retry): 400 / 401 / 403 / 402.
  402 means quota exhausted -> surface a "recharge" hint instead of
  burning the whole retry budget.
"""

from __future__ import annotations

import random
import socket

import requests


TRANSIENT_STATUS_CODES = frozenset({408, 429, 500, 502, 503, 504})
NON_RETRYABLE_STATUS_CODES = frozenset({400, 401, 402, 403})
QUOTA_STATUS_CODE = 402

REVIEW_MAX_RETRIES = 2
REVIEW_BACKOFF_BASE_SECS = 1.0
REVIEW_BACKOFF_CAP_SECS = 8.0

_TRANSPORT_MESSAGE_MARKERS = (
    "temporary failure in name resolution",
    "name resolution",
    "failed to resolve",
    "max retries exceeded",
    "connection aborted",
    "connection reset",
    "connection refused",
    "connect timeout",
    "read timeout",
    "timed out",
    "server disconnected",
    "remote end closed connection",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "too many requests",
)


def http_status_of(exc: BaseException) -> int | None:
    """Best-effort extraction of the upstream HTTP status code."""
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    if status is None and isinstance(exc, requests.HTTPError):
        response = getattr(exc, "response", None)
        status = getattr(response, "status_code", None) if response is not None else None
    try:
        return int(status) if status is not None else None
    except (TypeError, ValueError):
        return None


def is_quota_error(exc: BaseException) -> bool:
    return http_status_of(exc) == QUOTA_STATUS_CODE


def is_auth_error(exc: BaseException) -> bool:
    return http_status_of(exc) in {401, 403}


def is_bad_request_error(exc: BaseException) -> bool:
    return http_status_of(exc) == 400


def is_non_retryable_client_error(exc: BaseException) -> bool:
    return http_status_of(exc) in NON_RETRYABLE_STATUS_CODES


def is_transient_upstream_error(exc: BaseException) -> bool:
    """True for errors worth a limited retry: Timeout/429/5xx/connection."""
    if isinstance(exc, (ValueError, KeyError)):
        return False
    try:
        import json as _json

        if isinstance(exc, _json.JSONDecodeError):
            return False
    except Exception:  # noqa: BLE001 - json import must never break classification
        pass
    status = http_status_of(exc)
    if status is not None:
        if status in NON_RETRYABLE_STATUS_CODES:
            return False
        if status in TRANSIENT_STATUS_CODES:
            return True
        if 400 <= status < 500:
            return False
        if 500 <= status < 600:
            return True
    if isinstance(exc, (requests.Timeout, requests.ConnectionError, socket.gaierror)):
        return True
    text = str(exc).lower()
    if any(marker in text for marker in _TRANSPORT_MESSAGE_MARKERS):
        # A 4xx body can echo a transport phrase; status wins above.
        return status is None or status not in NON_RETRYABLE_STATUS_CODES
    if isinstance(exc, requests.HTTPError):
        return False
    return isinstance(exc, requests.RequestException)


def hint_for_status(status: int | None) -> str:
    if status == 402:
        return "上游返回 402（余额不足/欠费）：请检查账户余额并充值后重试；本次直接失败，不再重试。"
    if status in (401, 403):
        return f"上游返回 {status}（鉴权失败）：请检查 API Key/权限与 base_url 配置；本次直接失败，不再重试。"
    if status == 400:
        return "上游返回 400（请求非法）：请检查请求参数/Key 权限；本次直接失败，不再重试。"
    return ""


def describe_upstream_error(exc: BaseException) -> str:
    """Original error text plus a balance/Key hint for 400/401/402/403."""
    base = f"{type(exc).__name__}: {exc}"
    hint = hint_for_status(http_status_of(exc))
    return f"{base} | {hint}" if hint else base


def skipped_after_auth_rejection_error(rejected: BaseException) -> requests.HTTPError:
    """同一组凭据已被拒过：这次不发请求，直接抛一个同状态码的错误（各处照旧按 401/403 处理）。"""
    status = http_status_of(rejected)
    return requests.HTTPError(
        f"{rejected} | 同一组 base_url 和 API Key 已被上游拒绝（{status}），这次没有再发请求",
        response=getattr(rejected, "response", None),
    )


def credential_rejected_error(rejected: BaseException) -> requests.HTTPError:
    """翻译凭据被拒后整份翻译停下时抛的错误：中文说明放最前（结构化失败的摘录只取前 280 字）。"""
    status = http_status_of(rejected)
    return requests.HTTPError(
        f"翻译 API Key 被上游拒绝（HTTP {status}），已停止翻译，剩下的块没有再发请求。"
        f"请检查 API Key、权限和 base_url 配置后重试 | 第一次被拒：{rejected}",
        response=getattr(rejected, "response", None),
    )


def raise_if_credential_rejected(run_diagnostics, *, base_url: str, api_key: str) -> None:
    """本次运行里这组凭据被上游以 401/403 拒过，就抛 ``credential_rejected_error``。

    ``run_diagnostics`` 为 None（单测直接调阶段函数）时什么都不做。
    """
    if run_diagnostics is None:
        return
    rejected = run_diagnostics.auth_rejection(base_url=base_url, api_key=api_key)
    if rejected is not None:
        raise credential_rejected_error(rejected)


def retry_after_seconds(exc: BaseException) -> float | None:
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None) if response is not None else None
    if not headers:
        return None
    try:
        raw = str(headers.get("Retry-After", "") or "").strip()
    except Exception:  # noqa: BLE001 - header read must never break retry
        return None
    if raw.isdigit():
        return float(max(1, int(raw)))
    return None


def review_retry_delay(retry_index: int) -> float:
    """Exponential backoff for review retries: 1s, 2s, 4s ... capped at 8s."""
    base = min(float(REVIEW_BACKOFF_CAP_SECS), float(REVIEW_BACKOFF_BASE_SECS) * (2 ** max(0, retry_index)))
    return min(float(REVIEW_BACKOFF_CAP_SECS), base + random.uniform(0.0, max(0.25, base * 0.25)))


__all__ = [
    "NON_RETRYABLE_STATUS_CODES",
    "QUOTA_STATUS_CODE",
    "REVIEW_BACKOFF_BASE_SECS",
    "REVIEW_BACKOFF_CAP_SECS",
    "REVIEW_MAX_RETRIES",
    "TRANSIENT_STATUS_CODES",
    "credential_rejected_error",
    "describe_upstream_error",
    "hint_for_status",
    "http_status_of",
    "is_auth_error",
    "is_bad_request_error",
    "is_non_retryable_client_error",
    "is_quota_error",
    "is_transient_upstream_error",
    "raise_if_credential_rejected",
    "retry_after_seconds",
    "review_retry_delay",
    "skipped_after_auth_rejection_error",
]

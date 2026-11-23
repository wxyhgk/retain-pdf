"""Upstream resilience classification for translate LLM calls.

Single source of truth for transient vs non-retryable upstream errors:

- transient (limited retry, exponential backoff): Timeout / 429 / 5xx /
  connection errors / DNS errors.
- non-retryable (fail fast, no retry): 400 / 401 / 403 / 402.
  402 means quota exhausted -> surface a "recharge" hint instead of
  burning the whole retry budget.
- 4xx 先看响应体的业务码（``upstream_error_codes``）：429 / 400 / 403 里的余额、额度、预算用完
  （``UpstreamQuotaExhausted``）和 Key 的套餐不能用这个模型（``UpstreamAccessDenied``）不重试，和 402、401/403 一样
  整份翻译停下。真限流照旧退避、认 Retry-After。
"""

from __future__ import annotations

import random
import socket

import requests

from retainpdf_translation.llm.shared import upstream_error_codes as _codes
from retainpdf_translation.llm.shared.upstream_error_codes import UpstreamRejection
from retainpdf_base.upstream import llm_vendor_for_url
from retainpdf_base.upstream import tag_upstream


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


class UpstreamRejected(requests.HTTPError):
    """上游按业务码说「重试没用」的 4xx。带 ``status_code``、``provider_code``、``provider``（不含 Key、不含响应体）。

    构造参数和 ``requests.HTTPError`` 一样（``type(exc)(message)`` 也能用，种类跟着类走）。"""

    kind = ""
    retain_failure_code = ""

    def __init__(self, *args, rejection: UpstreamRejection | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        self.rejection = rejection
        response = getattr(self, "response", None)
        status = getattr(response, "status_code", None)
        if status is None and rejection is not None:
            status = rejection.http_status
        self.status_code = int(status) if isinstance(status, int) else None
        self.provider_code = rejection.code if rejection is not None else ""
        self.provider = rejection.provider if rejection is not None else ""


class UpstreamQuotaExhausted(UpstreamRejected):
    """余额、额度、预算用完（429 / 400 / 403 + 计费业务码）：和 402 一样整份停下，归 ``upstream_quota_exhausted``。"""

    kind = _codes.QUOTA
    retain_failure_code = "upstream_quota_exhausted"


class UpstreamAccessDenied(UpstreamRejected):
    """Key 的套餐不能用这个模型（智谱 1311、1315）：和 401/403 一样整份停下，归 ``auth_failed``。"""

    kind = _codes.ACCESS
    retain_failure_code = "auth_failed"


_REJECTION_CLASSES = {_codes.QUOTA: UpstreamQuotaExhausted, _codes.ACCESS: UpstreamAccessDenied}


def upstream_rejection(exc: BaseException) -> UpstreamRejection | None:
    """错误里认出来的业务码（自带的，或从 ``exc.response`` 读）；没有交回 None。"""
    found = getattr(exc, "rejection", None)
    if isinstance(found, UpstreamRejection):
        return found
    return _codes.classify_response(getattr(exc, "response", None))


def rejection_kind(exc: BaseException) -> str:
    """``quota`` / ``access`` / 空串。类型本身说了算（``type(exc)(message)`` 丢了 response 也认）。"""
    kind = getattr(type(exc), "kind", "") if isinstance(exc, UpstreamRejected) else ""
    if kind:
        return kind
    if not isinstance(exc, requests.RequestException):
        return ""
    rejection = upstream_rejection(exc)
    return rejection.kind if rejection is not None else ""


def rejection_error(message: str, *, response, rejection: UpstreamRejection) -> UpstreamRejected:
    """按认出的种类建错误（``UpstreamQuotaExhausted`` / ``UpstreamAccessDenied``）。"""
    return _REJECTION_CLASSES[rejection.kind](message, response=response, rejection=rejection)


def tag_upstream_vendor(exc: BaseException, *, base_url: str) -> BaseException:
    """在请求失败的异常上记下服务商编号（按配置的接口地址认：openai / anthropic / deepseek / zhipu / qwen / opencode，
    认不出是 custom），结构化失败的 ``upstream.provider`` 读它。只写 ``upstream_provider``，不影响重试和失败分类。"""
    vendor = llm_vendor_for_url(base_url)
    if vendor:
        try:
            tag_upstream(exc, provider=vendor)
        except AttributeError:  # 个别异常类型不让加属性：不记就是了
            pass
    return exc


def _carry_upstream(source: BaseException, target: BaseException) -> BaseException:
    """新建的错误接着带上原错误记下的服务商（响应对象照旧传过去，状态码、错误码从响应读）。"""
    vendor = str(getattr(source, "upstream_provider", "") or "")
    if vendor:
        tag_upstream(target, provider=vendor)
    return target


def is_quota_error(exc: BaseException) -> bool:
    return http_status_of(exc) == QUOTA_STATUS_CODE or rejection_kind(exc) == _codes.QUOTA


def is_auth_error(exc: BaseException) -> bool:
    kind = rejection_kind(exc)
    if kind:
        return kind == _codes.ACCESS
    return http_status_of(exc) in {401, 403}


def is_bad_request_error(exc: BaseException) -> bool:
    return http_status_of(exc) == 400 and not rejection_kind(exc)


def is_non_retryable_client_error(exc: BaseException) -> bool:
    return http_status_of(exc) in NON_RETRYABLE_STATUS_CODES or bool(rejection_kind(exc))


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
    if rejection_kind(exc):
        # 429 里的余额、额度用完：重试没用
        return False
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


def hint_for_rejection(rejection: UpstreamRejection) -> str:
    """按业务码认出的「重试没用」：说清状态码、服务商的码和该怎么办（给用户看，不含 Key）。"""
    if rejection.kind == _codes.ACCESS:
        return (
            f"上游拒绝（{rejection.describe()}）：这个 API Key 的套餐不能用这个模型，请换模型或换 Key；"
            "本次直接失败，不再重试。"
        )
    return (
        f"上游账户余额或额度不足（{rejection.describe()}）：这不是限流，等待重试没用；"
        "请充值、提高消费上限或等额度重置后重试；本次直接失败，不再重试。"
    )


def hint_for_error(exc: BaseException) -> str:
    rejection = upstream_rejection(exc)
    if rejection is not None:
        return hint_for_rejection(rejection)
    return hint_for_status(http_status_of(exc))


def describe_upstream_error(exc: BaseException) -> str:
    """Original error text plus a balance/Key hint for 400/401/402/403 and quota business codes."""
    base = f"{type(exc).__name__}: {exc}"
    hint = hint_for_error(exc)
    if hint and hint in base:
        return base
    return f"{base} | {hint}" if hint else base


def described_error(exc: BaseException) -> BaseException:
    """同种错误、说明加上余额 / Key 提示：保留 response 和业务码（额度用完的 429 不会变回普通 HTTPError 被当成限流）。"""
    message = describe_upstream_error(exc)
    if not isinstance(exc, requests.RequestException):
        return type(exc)(message)
    kind = rejection_kind(exc)
    if kind:
        return _REJECTION_CLASSES[kind](message, response=exc.response, rejection=upstream_rejection(exc))
    return type(exc)(message, response=exc.response)


CREDENTIAL_REJECTION_STATUS_CODES = frozenset({401, 402, 403})


def is_credential_rejection(exc: BaseException) -> bool:
    """这组 base_url + Key 之后的请求注定同样被拒：Key 无效、没权限（401/403）、账户余额不足（402），
    或业务码说余额、额度用完 / 套餐不能用这个模型（429 等，见 ``upstream_error_codes``）。"""
    return http_status_of(exc) in CREDENTIAL_REJECTION_STATUS_CODES or bool(rejection_kind(exc))


def _rejection_reason(rejected: BaseException) -> str:
    status = http_status_of(rejected)
    kind = rejection_kind(rejected)
    if kind == _codes.QUOTA:
        return "账户余额不足" if status == QUOTA_STATUS_CODE else "以余额或额度不足拒绝"
    if status == QUOTA_STATUS_CODE:
        return "账户余额不足"
    return "被拒绝"


def _same_kind_error(rejected: BaseException, message: str) -> requests.HTTPError:
    """和第一次被拒同一种错误（同状态码、同业务码）：各处照旧按种类处理，429 的额度用完也不会被当成限流重试。"""
    response = getattr(rejected, "response", None)
    rejection = upstream_rejection(rejected)
    kind = rejection_kind(rejected)
    if kind:
        cls = _REJECTION_CLASSES[kind]
        return cls(message, response=response, rejection=rejection)
    return requests.HTTPError(message, response=response)


def skipped_after_credential_rejection_error(rejected: BaseException) -> requests.HTTPError:
    """同一组凭据已被拒过：这次不发请求，直接抛一个同种的错误（各处照旧按 401/402/403、额度用完处理）。"""
    status = http_status_of(rejected)
    return _carry_upstream(rejected, _same_kind_error(
        rejected,
        f"{rejected} | 同一组 base_url 和 API Key 已被上游{_rejection_reason(rejected)}（{status}），这次没有再发请求",
    ))


def credential_rejected_error(rejected: BaseException) -> requests.HTTPError:
    """翻译凭据被拒后整份翻译停下时抛的错误：中文说明放最前（结构化失败的摘录只取前 280 字）。"""
    status = http_status_of(rejected)
    rejection = upstream_rejection(rejected)
    kind = rejection_kind(rejected)
    if kind == _codes.QUOTA and status != QUOTA_STATUS_CODE:
        detail = rejection.describe() if rejection is not None else f"HTTP {status}"
        head = (
            f"翻译 API 账户余额或额度不足（{detail}），已停止翻译，剩下的块没有再发请求。"
            "这不是限流，等待重试没用：请充值、提高消费上限或等额度重置后重试"
        )
    elif kind == _codes.ACCESS:
        detail = rejection.describe() if rejection is not None else f"HTTP {status}"
        head = (
            f"翻译 API Key 的套餐不能用这个模型（{detail}），已停止翻译，剩下的块没有再发请求。"
            "请换模型或换 API Key 后重试"
        )
    elif status == QUOTA_STATUS_CODE:
        head = (
            f"翻译 API 账户余额不足（HTTP {status}），已停止翻译，剩下的块没有再发请求。"
            "请充值或检查账户额度后重试"
        )
    else:
        head = (
            f"翻译 API Key 被上游拒绝（HTTP {status}），已停止翻译，剩下的块没有再发请求。"
            "请检查 API Key、权限和 base_url 配置后重试"
        )
    return _carry_upstream(rejected, _same_kind_error(rejected, f"{head} | 第一次被拒：{rejected}"))


def raise_if_credential_rejected(run_diagnostics, *, base_url: str, api_key: str) -> None:
    """本次运行里这组凭据被上游以 401/402/403（或额度用完的业务码）拒过，就抛 ``credential_rejected_error``。

    ``run_diagnostics`` 为 None（单测直接调阶段函数）时什么都不做。
    """
    if run_diagnostics is None:
        return
    rejected = run_diagnostics.credential_rejection(base_url=base_url, api_key=api_key)
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
    "CREDENTIAL_REJECTION_STATUS_CODES",
    "NON_RETRYABLE_STATUS_CODES",
    "QUOTA_STATUS_CODE",
    "REVIEW_BACKOFF_BASE_SECS",
    "REVIEW_BACKOFF_CAP_SECS",
    "REVIEW_MAX_RETRIES",
    "TRANSIENT_STATUS_CODES",
    "UpstreamAccessDenied",
    "UpstreamQuotaExhausted",
    "UpstreamRejected",
    "credential_rejected_error",
    "describe_upstream_error",
    "described_error",
    "hint_for_error",
    "hint_for_rejection",
    "hint_for_status",
    "http_status_of",
    "is_auth_error",
    "is_bad_request_error",
    "is_credential_rejection",
    "is_non_retryable_client_error",
    "is_quota_error",
    "is_transient_upstream_error",
    "raise_if_credential_rejected",
    "rejection_error",
    "rejection_kind",
    "retry_after_seconds",
    "review_retry_delay",
    "skipped_after_credential_rejection_error",
    "upstream_rejection",
    "tag_upstream_vendor",
]

"""服务商限流等待（upstream_wait）：请求因为上游限流（429）、过载（529）、暂不可用（503）在退避等待时，
在阶段进度里报一声「在等」，等完再报一声「不等了」。

发什么、怎么并：
- 同一阶段（user_stage）里第一个开始等的请求发一条 ``stage_progress``（payload ``upstream_wait`` 是等待信息，
  ``upstream_wait_transition="started"``）；别的请求接着也在等时不另发，只更新等待信息。
- 这个阶段所有在等的请求都等完，发一条 ``upstream_wait=null``、``upstream_wait_transition="ended"``。
- 两条都是照这个阶段最近一条进度原样重发（阶段、子阶段、进度数字、阶段说明不变），只换 message。
- 等待期间别的进度事件也带上 ``upstream_wait``。
没有活动的事件 writer（单测、命令行直接调）时什么都不做。

调用方只需要把原来的 ``sleep(秒数)`` 包进 ``upstream_wait_scope(...)``；重试与否、等多久照旧由调用方决定。
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from typing import Any
from typing import Iterator
from urllib.parse import urlsplit

from .events import get_process_pipeline_event_writer


# 只有这几种算「服务商限流 / 忙」：429 限流、529 过载（Anthropic overloaded）、503 暂不可用。
# 其余 5xx、超时、连不上照旧退避重试，但不报等待。
UPSTREAM_WAIT_STATUSES = frozenset({429, 503, 529})
_REASONS = {429: "rate_limited", 529: "overloaded", 503: "unavailable"}

# 翻译服务商：按 base_url 的域名认（和 backend/packages/retainpdf-config/src/providers.rs 的清单一致），认不出是 custom。
_MODEL_VENDOR_HOSTS = (
    ("api.deepseek.com", "deepseek"),
    ("dashscope.aliyuncs.com", "qwen"),
    ("dashscope-intl.aliyuncs.com", "qwen"),
    ("api.openai.com", "openai"),
    ("api.anthropic.com", "anthropic"),
    ("open.bigmodel.cn", "zhipu"),
    ("opencode.ai", "opencode"),
)
_CODE_MAX_CHARS = 64


def wait_reason(http_status: int | None) -> str | None:
    """``rate_limited`` / ``overloaded`` / ``unavailable``；不是这三种状态码返回 None（不报等待）。"""
    try:
        return _REASONS.get(int(http_status)) if http_status is not None else None
    except (TypeError, ValueError):
        return None


def vendor_for_base_url(base_url: str) -> str:
    """翻译服务商 id（deepseek、qwen、openai、anthropic、zhipu、opencode），认不出是 ``custom``。"""
    try:
        host = (urlsplit(str(base_url or "").strip()).hostname or "").lower()
    except ValueError:
        return "custom"
    for known, vendor in _MODEL_VENDOR_HOSTS:
        if host == known or host.endswith("." + known):
            return vendor
    return "custom"


def error_code_from_body(text: str) -> str:
    """上游错误体里的错误码（``error.code`` / ``error.type`` / 顶层 ``code``），没有返回空串。只取短字符串，不带正文。"""
    try:
        data = json.loads(text or "")
    except (TypeError, ValueError):
        return ""
    candidates: list[Any] = []
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, dict):
            candidates += [error.get("code"), error.get("type")]
        candidates += [data.get("code"), data.get("type") if data.get("type") != "error" else None]
    for value in candidates:
        if isinstance(value, (str, int)) and not isinstance(value, bool):
            code = str(value).strip()
            if code and len(code) <= _CODE_MAX_CHARS:
                return code
    return ""


def error_code_from_response(response: Any) -> str:
    if response is None:
        return ""
    try:
        text = response.text
    except Exception:  # noqa: BLE001 - 读不了正文就不带错误码
        return ""
    return error_code_from_body(text if isinstance(text, str) else "")


def _iso(moment: datetime) -> str:
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def build_wait_info(
    *,
    provider: str,
    http_status: int,
    wait_s: float,
    attempt: int | None = None,
    max_attempts: int | None = None,
    code: str = "",
    wait_source: str = "",
    now: datetime | None = None,
) -> dict[str, Any]:
    started = now or datetime.now(timezone.utc)
    wait_s = max(0.0, float(wait_s))
    return {
        "provider": str(provider or "custom"),
        "http_status": int(http_status),
        "reason": wait_reason(http_status),
        "code": str(code or "") or None,
        "retry_after_s": round(wait_s, 3),
        "wait_source": str(wait_source or "") or None,
        "attempt": int(attempt) if attempt is not None else None,
        "max_attempts": int(max_attempts) if max_attempts is not None else None,
        "started_at": _iso(started),
        "until": _iso(started + timedelta(seconds=wait_s)),
    }


def _start_message(info: dict[str, Any]) -> str:
    return (
        f"服务商限流，等待中（{info['provider']} HTTP {info['http_status']}，"
        f"约 {info['retry_after_s']:.0f} 秒后重试）"
    )


def begin_upstream_wait(*, user_stage: str, info: dict[str, Any]) -> bool:
    """报「开始等」。返回 True 表示记上了（之后要调 ``end_upstream_wait``）。"""
    writer = get_process_pipeline_event_writer()
    if writer is None or wait_reason(info.get("http_status")) is None:
        return False
    try:
        writer.begin_upstream_wait(user_stage=user_stage, info=info, message=_start_message(info))
    except Exception as exc:  # noqa: BLE001 - 报等待失败不能影响请求本身
        print(f"upstream wait report failed: {type(exc).__name__}: {exc}", flush=True)
        return False
    return True


def end_upstream_wait(*, user_stage: str) -> None:
    writer = get_process_pipeline_event_writer()
    if writer is None:
        return
    try:
        writer.end_upstream_wait(user_stage=user_stage, message="服务商限流等待结束，继续请求")
    except Exception as exc:  # noqa: BLE001
        print(f"upstream wait report failed: {type(exc).__name__}: {exc}", flush=True)


@contextmanager
def upstream_wait_scope(
    *,
    provider: str,
    http_status: int | None,
    wait_s: float,
    attempt: int | None = None,
    max_attempts: int | None = None,
    code: str = "",
    wait_source: str = "",
    user_stage: str = "translation",
) -> Iterator[None]:
    """把一次退避等待包起来：限流类状态码进来时报开始，出去时（含异常、被中断）报结束；别的状态码什么都不做。"""
    reported = False
    if wait_reason(http_status) is not None:
        info = build_wait_info(
            provider=provider,
            http_status=int(http_status),
            wait_s=wait_s,
            attempt=attempt,
            max_attempts=max_attempts,
            code=code,
            wait_source=wait_source,
        )
        reported = begin_upstream_wait(user_stage=user_stage, info=info)
    try:
        yield
    finally:
        if reported:
            end_upstream_wait(user_stage=user_stage)


__all__ = [
    "UPSTREAM_WAIT_STATUSES",
    "begin_upstream_wait",
    "build_wait_info",
    "end_upstream_wait",
    "error_code_from_body",
    "error_code_from_response",
    "upstream_wait_scope",
    "vendor_for_base_url",
    "wait_reason",
]

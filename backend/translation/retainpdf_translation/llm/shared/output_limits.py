"""回答不完整、单次请求太长：两种「这一块没翻成，但不是配置错误」的上游结果（2026-11-23）。

**回答不完整（HTTP 200）**：服务商回了 200，但译文没写完。以前只要有文字就收下，半截译文进了结果，
只有单块的长度比例校验能兜住一部分。现在请求层看结束原因，不完整就抛 ``ModelOutputIncomplete``
（``ValueError`` 子类，和「回答解析不了」走同一条路：这一块重试、批量的拆成单块、最终保留原文记死信）：

- OpenAI Chat Completions（含各家兼容接口）``choices[0].finish_reason``：``length``（输出到上限）、
  ``content_filter``（被内容过滤）；智谱另有 ``sensitive``（内容安全）、``network_error``（推理异常中断）、
  ``model_context_window_exceeded``；DeepSeek 另有 ``insufficient_system_resource``（资源不足中断）。
- OpenAI Responses：``status=incomplete``，``incomplete_details.reason`` 是 ``max_output_tokens`` /
  ``content_filter``；其余原因（``max_messages``、``steered`` 等，我们走 HTTP 不会遇到 steered）同样按没写完处理。
- Anthropic ``stop_reason``：``max_tokens``、``model_context_window_exceeded``（截断），``refusal``（被安全分类器中止）。

``stop``、``end_turn``、``stop_sequence``、``tool_calls``、没有结束原因的照旧收下。错误带 ``kind``（截断 / 内容过滤 /
中途停止 / 没写完）、``field``、``reason`` 和 ``partial_content``（已经写出来的半截，批量翻译拿它留下完整交回的块）。

**单次请求太长（400 / 413）**：Anthropic 400「prompt is too long」、413 ``request_too_large``，OpenAI 400
``context_length_exceeded``（DeepSeek 等兼容接口是「maximum context length」），智谱 1261，千问
``InternalError.Algo.InvalidParameter``（多半是输入超长，按正文的码认）。抛 ``UpstreamRequestTooLong``
（``requests.HTTPError`` 子类，状态码照旧）：请求层不再换思考字段、退 json_object 重发同样长的请求；批量翻译拆成
单块再发，单块还太长就这一块保留原文（记死信，不再重试）；不记凭据、不让整份翻译停下。

Rust 模型执行器（``model_executor/limits.rs``）认同样的规则，改一处要改另一处。只看状态码和响应体里的码 / 说法，
不读、不记 Key，报错里不带响应体原文以外的东西。
"""

from __future__ import annotations

import json
from typing import Any

import requests


TRUNCATED = "truncated"
CONTENT_FILTER = "content_filter"
INTERRUPTED = "interrupted"
INCOMPLETE = "incomplete"

KIND_LABELS = {
    TRUNCATED: "输出到上限被截断",
    CONTENT_FILTER: "被内容过滤中止",
    INTERRUPTED: "服务商中途停止生成",
    INCOMPLETE: "回答没有写完",
}

# Chat Completions 的 finish_reason（OpenAI 和各家兼容接口）
CHAT_FINISH_REASONS = {
    "length": TRUNCATED,
    "model_context_window_exceeded": TRUNCATED,  # 智谱
    "content_filter": CONTENT_FILTER,
    "sensitive": CONTENT_FILTER,  # 智谱：内容安全
    "insufficient_system_resource": INTERRUPTED,  # DeepSeek：推理资源不足，生成被打断
    "network_error": INTERRUPTED,  # 智谱：模型推理异常
}
# Responses 的 incomplete_details.reason；不在表里的（max_messages、steered……）按 INCOMPLETE
RESPONSES_INCOMPLETE_REASONS = {
    "max_output_tokens": TRUNCATED,
    "content_filter": CONTENT_FILTER,
}
ANTHROPIC_STOP_REASONS = {
    "max_tokens": TRUNCATED,
    "model_context_window_exceeded": TRUNCATED,
    "refusal": CONTENT_FILTER,
}


class ModelOutputIncomplete(ValueError):
    """HTTP 200 但回答不完整（截断、被内容过滤、服务商中途停了）：半截译文不收，这一块按没翻成处理。"""

    failure_summary = "模型回答不完整（输出到上限被截断或被内容过滤），没有收下半截译文"

    def __init__(self, *, kind: str, field: str, reason: str, partial_content: str = "") -> None:
        self.kind = kind
        self.field = field
        self.reason = reason
        self.partial_content = partial_content or ""
        label = KIND_LABELS.get(kind, KIND_LABELS[INCOMPLETE])
        super().__init__(
            f"model output incomplete: {field}={reason}（{label}），半截译文不收，这一块按没翻成处理"
        )


def chat_finish_incomplete(finish_reason: Any, partial_content: str = "") -> ModelOutputIncomplete | None:
    reason = str(finish_reason or "").strip()
    kind = CHAT_FINISH_REASONS.get(reason)
    if kind is None:
        return None
    return ModelOutputIncomplete(kind=kind, field="finish_reason", reason=reason, partial_content=partial_content)


def chat_completion_incomplete(data: Any) -> ModelOutputIncomplete | None:
    """非流式 Chat Completions 的回答：``choices[0].finish_reason`` 说没写完就交回错误（被过滤时可能没有 content，也认）。"""
    choices = data.get("choices") if isinstance(data, dict) else None
    first = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
    message = first.get("message") if isinstance(first.get("message"), dict) else {}
    partial = message.get("content")
    return chat_finish_incomplete(first.get("finish_reason"), partial if isinstance(partial, str) else "")


def responses_incomplete(data: Any, partial_content: str = "") -> ModelOutputIncomplete | None:
    """Responses：``status=incomplete`` 就是没写完，按 ``incomplete_details.reason`` 分种类。"""
    if not isinstance(data, dict) or str(data.get("status") or "") != "incomplete":
        return None
    details = data.get("incomplete_details")
    reason = str((details or {}).get("reason") or "") if isinstance(details, dict) else ""
    kind = RESPONSES_INCOMPLETE_REASONS.get(reason, INCOMPLETE)
    return ModelOutputIncomplete(
        kind=kind,
        field="incomplete_details.reason",
        reason=reason or "unknown",
        partial_content=partial_content,
    )


def anthropic_incomplete(data: Any, partial_content: str = "") -> ModelOutputIncomplete | None:
    reason = str((data or {}).get("stop_reason") or "").strip() if isinstance(data, dict) else ""
    kind = ANTHROPIC_STOP_REASONS.get(reason)
    if kind is None:
        return None
    return ModelOutputIncomplete(kind=kind, field="stop_reason", reason=reason, partial_content=partial_content)


# ---------------------------------------------------------------------------
# 单次请求太长
# ---------------------------------------------------------------------------

# 响应体里的码（error.code / error.type / 顶层 code）→ 报错里写的码
REQUEST_TOO_LONG_CODES = {
    "context_length_exceeded": "context_length_exceeded",  # OpenAI
    "request_too_large": "request_too_large",  # Anthropic 413
    "1261": "1261",  # 智谱：Prompt 超长
    "InternalError.Algo.InvalidParameter": "InternalError.Algo.InvalidParameter",  # 千问：多半是输入超长
}
# message 里的说法（小写）→ 码。兼容接口常常没有码，只有 OpenAI 式的说法。
REQUEST_TOO_LONG_MESSAGES = (
    ("prompt is too long", "prompt_too_long"),  # Anthropic
    ("exceed context limit", "prompt_too_long"),  # Anthropic 旧模型：input length and max_tokens exceed context limit
    ("maximum context length", "context_length_exceeded"),  # OpenAI / DeepSeek / vLLM
    ("context_length_exceeded", "context_length_exceeded"),
    ("range of input length", "input_length_out_of_range"),  # 千问 InvalidParameter
    ("input is too long", "input_too_long"),
)
REQUEST_TOO_LONG_STATUSES = frozenset({400, 413})


def _error_codes_and_message(body: Any) -> tuple[list[str], str]:
    if isinstance(body, (bytes, bytearray)):
        body = bytes(body).decode("utf-8", "replace")
    text = body if isinstance(body, str) else ""
    parsed = body
    if isinstance(body, str):
        try:
            parsed = json.loads(body)
        except ValueError:
            parsed = None
    codes: list[str] = []
    message = ""
    if isinstance(parsed, dict):
        error = parsed.get("error")
        containers = [error] if isinstance(error, dict) else []
        containers.append(parsed)
        for container in containers:
            for key in ("code", "type"):
                value = container.get(key)
                if value not in (None, "") and not isinstance(value, (dict, list, bool)):
                    codes.append(str(value).strip())
            if not message and isinstance(container.get("message"), str):
                message = container["message"]
        if isinstance(error, str) and not message:
            message = error
    return codes, f"{message}\n{text}"


def request_too_long_code(status: Any, body: Any) -> str | None:
    """一次 4xx 是不是「单次请求太长」；是就交回认出的码（见上面两张表，413 没码时是 ``http_413``），否则 None。"""
    try:
        status = int(status) if status is not None else None
    except (TypeError, ValueError):
        return None
    if status not in REQUEST_TOO_LONG_STATUSES:
        return None
    codes, text = _error_codes_and_message(body)
    for code in codes:
        if code in REQUEST_TOO_LONG_CODES:
            return REQUEST_TOO_LONG_CODES[code]
    lowered = text.lower()
    for marker, code in REQUEST_TOO_LONG_MESSAGES:
        if marker in lowered:
            return code
    return "http_413" if status == 413 else None


def response_request_too_long_code(response: Any) -> str | None:
    """``requests.Response`` 版本；读不了正文只看状态码。"""
    if response is None:
        return None
    try:
        text = response.text or ""
    except Exception:  # noqa: BLE001 - 正文读不出来不影响原来的处理
        text = ""
    return request_too_long_code(getattr(response, "status_code", None), text)


class UpstreamRequestTooLong(requests.HTTPError):
    """单次请求太长（400 / 413 + 超长的码或说法）：同样的请求再发也一样，拆小了再发；单块还太长就保留原文。

    不是配置错误、不是 Key 的问题：不记凭据，不让整份翻译停下。带 ``status_code``、``provider_code``。"""

    failure_summary = "单次请求太长，超过了模型的上下文或请求体上限"

    def __init__(self, *args, provider_code: str = "", **kwargs):
        super().__init__(*args, **kwargs)
        response = getattr(self, "response", None)
        status = getattr(response, "status_code", None)
        self.status_code = int(status) if isinstance(status, int) else None
        self.provider_code = provider_code


def is_request_too_long(exc: BaseException) -> bool:
    return isinstance(exc, UpstreamRequestTooLong)


REQUEST_TOO_LONG_HINT = (
    "单次请求太长（超过模型上下文或请求体上限）：不是配置错误；批量翻译会拆成单块再发，单块还太长就这一块保留原文"
)


__all__ = [
    "ANTHROPIC_STOP_REASONS",
    "CHAT_FINISH_REASONS",
    "CONTENT_FILTER",
    "INCOMPLETE",
    "INTERRUPTED",
    "KIND_LABELS",
    "ModelOutputIncomplete",
    "REQUEST_TOO_LONG_CODES",
    "REQUEST_TOO_LONG_HINT",
    "REQUEST_TOO_LONG_MESSAGES",
    "RESPONSES_INCOMPLETE_REASONS",
    "TRUNCATED",
    "UpstreamRequestTooLong",
    "anthropic_incomplete",
    "chat_completion_incomplete",
    "chat_finish_incomplete",
    "is_request_too_long",
    "request_too_long_code",
    "response_request_too_long_code",
    "responses_incomplete",
]

"""OpenAI-compatible model transport used by the retrieval agent."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable
from typing import Any

import httpx

from .config import Settings
from .request_control import AIProviderError, AIRequestTimeout, AIStreamIncomplete, RequestControl
from .runtimes.contracts import ChatFn


def assemble_streaming_message(
    lines: Iterable[str | bytes],
    on_delta: Callable[[str], None] | None = None,
    request_control: RequestControl | None = None,
) -> dict[str, Any]:
    """Assemble an SSE response into the non-streaming assistant shape."""
    content_parts: list[str] = []
    tool_calls: dict[int, dict[str, Any]] = {}
    saw_tool_calls = False
    # The model may emit prose before tool calls. Hold a small prefix until the
    # turn is classified so that tool-call preambles never leak as answer text.
    holdback_chars = 64
    pending: list[str] = []
    pending_flushed = False
    done = False
    finish_reason = None

    def flush_pending() -> None:
        nonlocal pending_flushed
        if on_delta is not None and pending:
            on_delta("".join(pending))
        pending.clear()
        pending_flushed = True

    for raw in lines:
        if request_control is not None:
            request_control.raise_if_stopped()
        try:
            line = raw.decode("utf-8") if isinstance(raw, bytes) else raw
        except UnicodeDecodeError as exc:
            raise AIStreamIncomplete() from exc
        line = line.strip()
        if not line or not line.startswith("data:"):
            continue
        data = line[len("data:") :].strip()
        if data == "[DONE]":
            done = True
            break
        try:
            chunk = json.loads(data)
        except json.JSONDecodeError as exc:
            raise AIStreamIncomplete() from exc
        if not isinstance(chunk, dict) or "error" in chunk:
            raise AIStreamIncomplete()
        choices = chunk.get("choices")
        if not isinstance(choices, list):
            raise AIStreamIncomplete()
        if not choices:
            continue
        if not isinstance(choices[0], dict):
            raise AIStreamIncomplete()
        choice = choices[0]
        reason = choice.get("finish_reason")
        if reason is not None:
            if reason not in {"stop", "tool_calls"}:
                raise AIStreamIncomplete()
            finish_reason = reason
        delta = choice.get("delta") or {}
        if not isinstance(delta, dict):
            raise AIStreamIncomplete()
        delta_tool_calls = delta.get("tool_calls") or []
        if not isinstance(delta_tool_calls, list):
            raise AIStreamIncomplete()
        if delta_tool_calls:
            if not saw_tool_calls:
                pending.clear()
            saw_tool_calls = True
            for call in delta_tool_calls:
                if not isinstance(call, dict):
                    raise AIStreamIncomplete()
                index = call.get("index", 0)
                if type(index) is not int or index < 0:
                    raise AIStreamIncomplete()
                slot = tool_calls.setdefault(
                    index,
                    {
                        "id": "",
                        "type": "function",
                        "function": {"name": "", "arguments": ""},
                    },
                )
                if call.get("id"):
                    slot["id"] = call["id"]
                if call.get("type"):
                    slot["type"] = call["type"]
                function = call.get("function") or {}
                if not isinstance(function, dict) or any(
                    key in function and not isinstance(function[key], str)
                    for key in ("name", "arguments")
                ):
                    raise AIStreamIncomplete()
                if function.get("name"):
                    slot["function"]["name"] += function["name"]
                if function.get("arguments"):
                    slot["function"]["arguments"] += function["arguments"]
        piece = delta.get("content")
        if piece is not None and not isinstance(piece, str):
            raise AIStreamIncomplete()
        if piece:
            content_parts.append(piece)
            if on_delta is not None and not saw_tool_calls:
                if pending_flushed:
                    on_delta(piece)
                else:
                    pending.append(piece)
                    if sum(len(part) for part in pending) >= holdback_chars:
                        flush_pending()
    if request_control is not None:
        request_control.raise_if_stopped()
    if not done or finish_reason != ("tool_calls" if saw_tool_calls else "stop"):
        raise AIStreamIncomplete()
    if not saw_tool_calls and not pending_flushed:
        flush_pending()
    message: dict[str, Any] = {
        "role": "assistant",
        "content": "".join(content_parts),
    }
    if tool_calls:
        message["tool_calls"] = [tool_calls[index] for index in sorted(tool_calls)]
    return message


def friendly_llm_error(status_code: int, detail: str = "") -> RuntimeError:
    """Translate provider HTTP failures into actionable, bounded messages."""
    hint = {
        400: "请求被模型服务拒绝（参数或上下文过长）",
        401: "模型 API Key 无效或未授权：请到 设置 → API 设置 检查 Key",
        402: "模型账户余额不足：请前往服务商充值后重试",
        403: "模型服务拒绝访问：请检查 Key 权限或所选模型",
        404: "模型或接口地址不存在：请检查模型名称与 Base URL",
        429: "模型请求过于频繁（限流）：请稍候几秒再试",
    }.get(status_code)
    if hint is None:
        if status_code >= 500:
            hint = "模型服务暂时不可用（上游故障）：请稍后重试"
        else:
            hint = f"模型服务返回错误（HTTP {status_code}）"
    return AIProviderError(hint)


def build_deepseek_chat_fn(
    settings: Settings,
    client: httpx.Client | None = None,
    *,
    on_delta: Callable[[str], None] | None = None,
    request_control: RequestControl | None = None,
) -> ChatFn:
    """Build the request-scoped OpenAI-compatible chat function."""
    http = client or httpx.Client(timeout=settings.llm_timeout_s)
    if client is None and request_control is not None:
        # Closing the request-owned client interrupts a connection that is
        # still waiting for response headers when the browser disconnects.
        request_control.add_cancel_callback(http.close)
    url = f"{settings.llm_base_url}/chat/completions"
    api_key = f"{settings.llm_api_key or ''}".strip()
    if not api_key:

        def missing_key(
            _messages: list[dict[str, Any]],
            _tools: list[dict[str, Any]],
        ) -> dict[str, Any]:
            raise RuntimeError(
                "缺少 LLM API Key：请在前端「设置 → 凭据」填写模型 API Key，"
                "或配置环境变量 RETAIN_AI_LLM_API_KEY。"
            )

        return missing_key
    headers = {"Authorization": f"Bearer {api_key}"}

    def chat(
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if request_control is not None:
            request_control.raise_if_stopped()
        body: dict[str, Any] = {
            "model": settings.llm_model,
            "messages": messages,
            "tools": tools,
            "temperature": 0.2,
        }
        request_timeout = settings.llm_timeout_s
        if request_control is not None:
            request_timeout = max(
                0.1,
                min(request_timeout, request_control.remaining_seconds),
            )
        if on_delta is None:
            try:
                response = http.post(
                    url, headers=headers, json=body, timeout=request_timeout
                )
            except httpx.TimeoutException as exc:
                if request_control is not None:
                    request_control.raise_if_stopped()
                raise AIRequestTimeout() from exc
            except Exception:
                if request_control is not None:
                    request_control.raise_if_stopped()
                raise
            if request_control is not None:
                request_control.raise_if_stopped()
            if response.status_code >= 400:
                raise friendly_llm_error(response.status_code)
            return response.json()["choices"][0]["message"]
        body["stream"] = True
        try:
            with http.stream(
                "POST", url, headers=headers, json=body, timeout=request_timeout
            ) as response:
                close_response = response.close
                if request_control is not None:
                    request_control.add_cancel_callback(close_response)
                try:
                    if response.status_code >= 400:
                        raise friendly_llm_error(response.status_code)
                    message = assemble_streaming_message(response.iter_lines(), on_delta, request_control)
                    if request_control is not None:
                        request_control.raise_if_stopped()
                    return message
                finally:
                    if request_control is not None:
                        request_control.remove_cancel_callback(close_response)
        except httpx.TimeoutException as exc:
            if request_control is not None:
                request_control.raise_if_stopped()
            raise AIRequestTimeout() from exc
        except Exception:
            if request_control is not None:
                request_control.raise_if_stopped()
            raise

    return chat


# Original private helper name remains available to compatibility facades.
_friendly_llm_error = friendly_llm_error

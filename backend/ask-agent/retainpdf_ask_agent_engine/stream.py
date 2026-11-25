"""自带 agent 的模型调用：三种协议的流式请求，产出核心认识的事件（见 ``retainpdf_ask_agent.server``）。

请求体用翻译底座 ``model_wire`` 的构造函数（和翻译同一套写法、思考档位、图片换写法），再打开流：

- Anthropic Messages：``thinking_delta`` → 思考，``text_delta`` → 正文；用量在 ``message_start`` / ``message_delta``
  （输入 = input + cache_read + cache_creation）。前几轮的最后一块打 ``cache_control``，接着问时前面的对话按缓存读。
- OpenAI Chat：``delta.reasoning_content``（DeepSeek、Qwen 这类）→ 思考，``delta.content`` → 正文；
  ``stream_options.include_usage`` 要最后一块带用量，缓存命中在 ``prompt_tokens_details.cached_tokens``（DeepSeek 是
  ``prompt_cache_hit_tokens``）。这些服务商的前缀缓存是自动的。
- OpenAI Responses：``response.reasoning_summary_text.delta`` → 思考（要了 ``reasoning.summary = auto``），
  ``response.output_text.delta`` → 正文，``response.completed`` 带用量。

取消：每读一行看一次取消标记，叫停就关掉连接返回。HTTP 出错抛 ``RuntimeError``（服务商的状态码和一句说明，不带 key）。
"""
from __future__ import annotations

import copy
import json
import threading
from typing import Any, Iterator

import requests

from retainpdf_translation.llm.providers.deepseek.client import DEFAULT_BASE_URL
from retainpdf_translation.llm.providers.deepseek.client import build_headers
from retainpdf_translation.llm.providers.deepseek.client import chat_completions_url
from retainpdf_translation.llm.shared import model_wire

ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com/v1"
CONNECT_TIMEOUT_SECS = 15
READ_TIMEOUT_SECS = 180
ERROR_BODY_CHARS = 300

Event = tuple[str, Any]


def _stop_reason(raw: Any) -> str:
    value = str(raw or "")
    if value in ("max_tokens", "length", "max_output_tokens"):
        return "max_tokens"
    if value in ("refusal", "content_filter"):
        return "refusal"
    return "end_turn"


def _http_error(response: requests.Response) -> RuntimeError:
    try:
        payload = response.json()
        error = payload.get("error") if isinstance(payload, dict) else None
        detail = (error.get("message") if isinstance(error, dict) else error) or payload
    except ValueError:
        detail = response.text
    return RuntimeError(f"模型服务返回 HTTP {response.status_code}：{str(detail)[:ERROR_BODY_CHARS]}")


def _sse_events(response: requests.Response, cancel: threading.Event) -> Iterator[tuple[str, dict[str, Any]]]:
    """SSE → (事件名, data 的 JSON)。``[DONE]`` 和不是 JSON 的 data 跳过。

    一律按 UTF-8 读：``text/event-stream`` 没写 charset 时 requests 按 ISO-8859-1 解码，中文全成乱码（端到端测试抓到的）。"""
    response.encoding = "utf-8"
    event = ""
    for raw in response.iter_lines(decode_unicode=True):
        if cancel.is_set():
            return
        line = raw if isinstance(raw, str) else (raw or b"").decode("utf-8", "replace")
        if not line:
            event = ""
            continue
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data = line[5:].strip()
            if not data or data == "[DONE]":
                continue
            try:
                payload = json.loads(data)
            except ValueError:
                continue
            if isinstance(payload, dict):
                yield event or str(payload.get("type") or ""), payload


def _mark_history_cache(body: dict[str, Any]) -> None:
    """Anthropic：倒数第二条（上一轮的回答）最后一块打缓存断点，前面的对话下一问按缓存读。只有一问时不打。"""
    turns = body.get("messages") or []
    if len(turns) < 3:
        return
    previous = turns[-2]
    content = previous.get("content")
    blocks = [{"type": "text", "text": content}] if isinstance(content, str) else list(content or [])
    if blocks and isinstance(blocks[-1], dict):
        blocks[-1] = {**blocks[-1], "cache_control": {"type": "ephemeral"}}
        previous["content"] = blocks


def _anthropic(messages, cancel, *, model, base_url, api_key, thinking) -> Iterator[Event]:
    url = model_wire.anthropic_messages_url(base_url or ANTHROPIC_DEFAULT_BASE_URL)
    headers = model_wire.anthropic_headers(api_key)
    candidates = model_wire.anthropic_thinking_candidates(thinking, model=model)
    response = None
    for index, fields in enumerate(candidates):
        body = model_wire.anthropic_body(model=model, messages=messages, temperature=None, response_format=None, thinking_fields=fields)
        body["stream"] = True
        _mark_history_cache(body)
        response = requests.post(url, headers=headers, json=body, stream=True, timeout=(CONNECT_TIMEOUT_SECS, READ_TIMEOUT_SECS))
        # 模型不认这种思考写法（400）就换下一种；别的错误直接报
        if response.status_code == 400 and index < len(candidates) - 1:
            response.close()
            continue
        break
    assert response is not None
    if response.status_code >= 400:
        raise _http_error(response)
    usage: dict[str, int] = {}
    with response:
        for event, data in _sse_events(response, cancel):
            if event == "message_start":
                raw = (data.get("message") or {}).get("usage") or {}
                cache_read = int(raw.get("cache_read_input_tokens") or 0)
                cache_write = int(raw.get("cache_creation_input_tokens") or 0)
                usage.update({
                    "input_tokens": int(raw.get("input_tokens") or 0) + cache_read + cache_write,
                    "cache_read_tokens": cache_read,
                    "cache_write_tokens": cache_write,
                })
            elif event == "content_block_delta":
                delta = data.get("delta") or {}
                if delta.get("type") == "thinking_delta" and delta.get("thinking"):
                    yield "thought", delta["thinking"]
                elif delta.get("type") == "text_delta" and delta.get("text"):
                    yield "text", delta["text"]
            elif event == "message_delta":
                raw = data.get("usage") or {}
                if raw.get("output_tokens") is not None:
                    usage["output_tokens"] = int(raw["output_tokens"])
                reason = (data.get("delta") or {}).get("stop_reason")
                if reason:
                    yield "stop", _stop_reason(reason)
            elif event == "error":
                raise RuntimeError(f"模型服务报错：{str((data.get('error') or {}).get('message') or data)[:ERROR_BODY_CHARS]}")
    if usage:
        yield "usage", usage


def _openai_chat(messages, cancel, *, model, base_url, api_key, thinking) -> Iterator[Event]:
    base_url = base_url or DEFAULT_BASE_URL
    url = chat_completions_url(base_url)
    headers = build_headers(api_key, base_url)
    fields = model_wire.openai_thinking_candidates(model=model, base_url=base_url, thinking=thinking)[0]
    body = {"model": model, "messages": model_wire.merge_system_messages(messages), "stream": True,
            "stream_options": {"include_usage": True}, **fields}
    response = requests.post(url, headers=headers, json=body, stream=True, timeout=(CONNECT_TIMEOUT_SECS, READ_TIMEOUT_SECS))
    if response.status_code >= 400:
        raise _http_error(response)
    usage: dict[str, int] = {}
    with response:
        for _, data in _sse_events(response, cancel):
            for choice in data.get("choices") or []:
                delta = choice.get("delta") or {}
                if delta.get("reasoning_content"):
                    yield "thought", delta["reasoning_content"]
                if delta.get("content"):
                    yield "text", delta["content"]
                if choice.get("finish_reason"):
                    yield "stop", _stop_reason(choice["finish_reason"])
            raw = data.get("usage")
            if isinstance(raw, dict):
                details = raw.get("prompt_tokens_details") or {}
                usage = {
                    "input_tokens": int(raw.get("prompt_tokens") or 0),
                    "output_tokens": int(raw.get("completion_tokens") or 0),
                    "cache_read_tokens": int(details.get("cached_tokens") or raw.get("prompt_cache_hit_tokens") or 0),
                    "reasoning_tokens": int((raw.get("completion_tokens_details") or {}).get("reasoning_tokens") or 0),
                }
    if usage:
        yield "usage", usage


def _openai_responses(messages, cancel, *, model, base_url, api_key, thinking) -> Iterator[Event]:
    base_url = base_url or DEFAULT_BASE_URL
    url = model_wire.responses_url(base_url)
    headers = build_headers(api_key, base_url)
    fields = copy.deepcopy(model_wire.responses_thinking_candidates(model=model, base_url=base_url, thinking=thinking)[0])
    body = model_wire.responses_body(model=model, messages=model_wire.merge_system_messages(messages), temperature=None,
                                     response_format=None, thinking_fields=fields)
    body["stream"] = True
    if isinstance(body.get("reasoning"), dict) and body["reasoning"].get("effort") not in (None, "none"):
        body["reasoning"]["summary"] = "auto"
    response = requests.post(url, headers=headers, json=body, stream=True, timeout=(CONNECT_TIMEOUT_SECS, READ_TIMEOUT_SECS))
    if response.status_code >= 400:
        raise _http_error(response)
    with response:
        for event, data in _sse_events(response, cancel):
            kind = event or str(data.get("type") or "")
            if kind == "response.reasoning_summary_text.delta" and data.get("delta"):
                yield "thought", data["delta"]
            elif kind == "response.output_text.delta" and data.get("delta"):
                yield "text", data["delta"]
            elif kind in ("response.completed", "response.incomplete"):
                result = data.get("response") or {}
                raw = result.get("usage") or {}
                yield "usage", {
                    "input_tokens": int(raw.get("input_tokens") or 0),
                    "output_tokens": int(raw.get("output_tokens") or 0),
                    "cache_read_tokens": int((raw.get("input_tokens_details") or {}).get("cached_tokens") or 0),
                    "reasoning_tokens": int((raw.get("output_tokens_details") or {}).get("reasoning_tokens") or 0),
                }
                reason = (result.get("incomplete_details") or {}).get("reason")
                yield "stop", _stop_reason(reason) if kind == "response.incomplete" else "end_turn"
            elif kind in ("response.failed", "error"):
                error = (data.get("response") or {}).get("error") or data.get("error") or data
                raise RuntimeError(f"模型服务报错：{str(error)[:ERROR_BODY_CHARS]}")


def make_stream_fn(*, model: str, base_url: str, api_key: str, protocol: str = "", thinking: str = ""):
    """按连接配置给核心一个 ``stream_fn(messages, cancel)``。"""
    profile = model_wire.resolve_profile(base_url=base_url or DEFAULT_BASE_URL, model=model, protocol=protocol or None, thinking=thinking or None)
    options = {"model": model, "base_url": base_url, "api_key": api_key, "thinking": profile.thinking}
    if profile.protocol == model_wire.PROTOCOL_ANTHROPIC:
        target = _anthropic
    elif profile.protocol == model_wire.PROTOCOL_OPENAI_RESPONSES:
        target = _openai_responses
    else:
        target = _openai_chat

    def stream(messages: list[dict[str, Any]], cancel: threading.Event) -> Iterator[Event]:
        return target(messages, cancel, **options)

    return stream


__all__ = ["make_stream_fn"]

"""自带 agent 的模型调用：三种协议的流式请求，产出核心认识的事件（见 ``retainpdf_ask_agent.server``）。

请求体用翻译底座 ``model_wire`` 的构造函数（和翻译同一套写法、思考档位、图片换写法），再打开流：

- Anthropic Messages：``thinking_delta`` → 思考（Claude 只给摘要，要 ``thinking.display = summarized``），``text_delta`` → 正文；用量在 ``message_start`` / ``message_delta``
  （输入 = input + cache_read + cache_creation）。前几轮的最后一块打 ``cache_control``，接着问时前面的对话按缓存读。
- OpenAI Chat：``delta.reasoning_content``（DeepSeek、Qwen 这类）→ 思考，``delta.content`` → 正文；
  ``stream_options.include_usage`` 要最后一块带用量，缓存命中在 ``prompt_tokens_details.cached_tokens``（DeepSeek 是
  ``prompt_cache_hit_tokens``）。这些服务商的前缀缓存是自动的。
- OpenAI Responses：``response.reasoning_summary_text.delta`` → 思考（要了 ``reasoning.summary = auto``），
  ``response.output_text.delta`` → 正文，``response.completed`` 带用量。

思考档位（2026-11-26）：没改过档位时按握手的思考深度换字段（``model_wire.setting_thinking_candidates``，和翻译一样）；会话里改过的
（``thinking_level``）按档位表 ``model_wire.thinking_menu`` 发那一档。三种协议都按候选顺序发，服务商回 400 就换下一种写法，最后不加思考字段。
``thinking_options`` 给核心报 ``configOptions`` 用的档位（中文名、说明）和当前档（记住的上次选的优先）。

取消：每读一行看一次取消标记，叫停就关掉连接返回。HTTP 出错抛 ``RuntimeError``（服务商的状态码和一句说明，不带 key）。

工具（读书，2026-11-25）：核心给了 ``tools``（名字、说明、JSON Schema）和 ``tool_choice``（``auto`` / ``none``）时按各家写法带上，
流里的工具调用拼完整后产出 ``("tool_call", {id, name, arguments})``，最后产出 ``("native", …)``——这一轮回答要原样带回去的东西：

- Anthropic：整轮的内容块（思考块带签名，开了思考又调工具时必须原样带回；``tool_use`` 的 ``input_json_delta`` 拼成 JSON）。
  工具结果是下一条用户消息里的 ``tool_result`` 块，图片直接放在块里。每次请求的最后一条消息打缓存断点，下一轮按缓存读。
- OpenAI Chat：``delta.tool_calls`` 按 ``index`` 拼；``reasoning_content`` 记下来跟着这一轮带回（DeepSeek 思考模式调工具时要求带回）。
  工具结果是 ``role: tool`` 消息（只能是文字），图片另起一条用户消息。
- Responses：``response.output_item.done`` 里的 ``function_call``；结果是 ``function_call_output``，图片另起一条用户消息。
  带回时不带条目的 ``id``、不带推理条目（``store: false`` 时服务商那边查不到）。
"""
from __future__ import annotations

import copy
import dataclasses
import json
import threading
import uuid
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


# 自适应思考按档位留出回答的预算（2026-11-27）：Claude 新模型用 effort 调思考，思考 token 也算在 max_tokens 里，
# 原来固定的 16384（model_wire 的默认）在 max 档会被思考全部吃掉，回答是空的（前端真机测：claude-haiku-5-5 max 档
# 76 秒后 stop_reason=max_tokens）。档位越高上限越高，最多 64000（Haiku 4.5 的输出上限；5 系都是 128K）。
# 只是上限：用不到不花钱。只管提问，翻译的请求不走这里。
ADAPTIVE_EFFORT_MAX_TOKENS = {"medium": 24576, "high": 32768, "xhigh": 49152, "max": 64000}


def _effort_max_tokens(body: dict[str, Any], fields: dict[str, Any]) -> None:
    """按这次发的思考档位（``output_config.effort``）把 ``max_tokens`` 抬到 ``ADAPTIVE_EFFORT_MAX_TOKENS``，只抬不降。"""
    effort = str((fields.get("output_config") or {}).get("effort") or "")
    floor = ADAPTIVE_EFFORT_MAX_TOKENS.get(effort)
    if floor and int(body.get("max_tokens") or 0) < floor:
        body["max_tokens"] = floor


def _with_summarized_thinking(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Claude 不给思考原文，只给摘要，而且要 ``thinking.display = summarized`` 才发（不写就是 omitted，什么都不发）。
    每个开思考的写法先带上它试，不认（400）再去掉；原有的退回顺序不变。"""
    expanded: list[dict[str, Any]] = []
    for fields in candidates:
        thinking = fields.get("thinking")
        if isinstance(thinking, dict) and thinking.get("type") in ("adaptive", "enabled"):
            expanded.append({**fields, "thinking": {**thinking, "display": "summarized"}})
        expanded.append(fields)
    return expanded


def _split_tool_turns(messages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """这一问调工具以后的消息（带 ``tool_calls`` 的回答、``tool`` 结果）都在最后：前面照旧用 ``model_wire`` 换写法，后面各家自己换。"""
    for index, message in enumerate(messages):
        if message.get("role") == "tool" or (message.get("role") == "assistant" and message.get("tool_calls") is not None):
            return messages[:index], messages[index:]
    return messages, []


def _arguments(call: dict[str, Any]) -> dict[str, Any]:
    arguments = call.get("arguments")
    return arguments if isinstance(arguments, dict) else {}


def _data_url(image: dict[str, Any]) -> str:
    return f"data:{image.get('mime_type') or 'image/jpeg'};base64,{image.get('data') or ''}"


IMAGES_NOTE = "上面工具取回的页图："


def _anthropic_tool_turns(suffix: list[dict[str, Any]]) -> list[dict[str, Any]]:
    turns: list[dict[str, Any]] = []
    for message in suffix:
        if message.get("role") == "assistant":
            native = message.get("native")
            if isinstance(native, dict) and native.get("protocol") == "anthropic" and native.get("content"):
                blocks = copy.deepcopy(native["content"])
            else:
                blocks = ([{"type": "text", "text": message["content"]}] if message.get("content") else []) + [
                    {"type": "tool_use", "id": call["id"], "name": call["name"], "input": _arguments(call)}
                    for call in message.get("tool_calls") or []
                ]
            turns.append({"role": "assistant", "content": blocks})
        elif message.get("role") == "tool":
            content: list[dict[str, Any]] = [{"type": "text", "text": str(message.get("content") or "（空）")}]
            content += [{"type": "image", "source": {"type": "base64", "media_type": image.get("mime_type") or "image/jpeg", "data": image.get("data") or ""}}
                        for image in message.get("images") or []]
            block = {"type": "tool_result", "tool_use_id": message.get("tool_call_id"), "content": content}
            if message.get("is_error"):
                block["is_error"] = True
            if turns and turns[-1]["role"] == "user":
                turns[-1]["content"].append(block)
            else:
                turns.append({"role": "user", "content": [block]})
    return turns


def _mark_last_message(body: dict[str, Any]) -> None:
    """Anthropic：最后一条消息的最后一块打缓存断点（有工具时每轮都打，下一轮前面的全按缓存读）。"""
    turns = body.get("messages") or []
    if not turns:
        return
    last = turns[-1]
    content = last.get("content")
    blocks = [{"type": "text", "text": content}] if isinstance(content, str) else list(content or [])
    if blocks and isinstance(blocks[-1], dict):
        blocks[-1] = {**blocks[-1], "cache_control": {"type": "ephemeral"}}
        last["content"] = blocks


def _anthropic(messages, cancel, *, model, base_url, api_key, candidates, tools=None, tool_choice=None) -> Iterator[Event]:
    url = model_wire.anthropic_messages_url(base_url or ANTHROPIC_DEFAULT_BASE_URL)
    headers = model_wire.anthropic_headers(api_key)
    candidates = _with_summarized_thinking(candidates)
    prefix, suffix = _split_tool_turns(messages)
    response = None
    for index, fields in enumerate(candidates):
        body = model_wire.anthropic_body(model=model, messages=prefix, temperature=None, response_format=None, thinking_fields=fields)
        _effort_max_tokens(body, fields)
        body["stream"] = True
        _mark_history_cache(body)
        if tools:
            body["messages"] += _anthropic_tool_turns(suffix)
            body["tools"] = [{"name": tool["name"], "description": tool["description"], "input_schema": tool["parameters"]} for tool in tools]
            body["tool_choice"] = {"type": tool_choice or "auto"}
            _mark_last_message(body)
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
    blocks: dict[int, dict[str, Any]] = {}
    partial_json: dict[int, str] = {}
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
            elif event == "content_block_start":
                block = data.get("content_block")
                if isinstance(block, dict):
                    blocks[int(data.get("index") or 0)] = dict(block)
            elif event == "content_block_delta":
                index = int(data.get("index") or 0)
                block = blocks.setdefault(index, {})
                delta = data.get("delta") or {}
                if delta.get("type") == "thinking_delta" and delta.get("thinking"):
                    block["thinking"] = str(block.get("thinking") or "") + delta["thinking"]
                    yield "thought", delta["thinking"]
                elif delta.get("type") == "text_delta" and delta.get("text"):
                    block["text"] = str(block.get("text") or "") + delta["text"]
                    yield "text", delta["text"]
                elif delta.get("type") == "signature_delta":
                    block["signature"] = str(block.get("signature") or "") + str(delta.get("signature") or "")
                elif delta.get("type") == "input_json_delta":
                    partial_json[index] = partial_json.get(index, "") + str(delta.get("partial_json") or "")
            elif event == "content_block_stop":
                index = int(data.get("index") or 0)
                block = blocks.get(index) or {}
                if block.get("type") == "tool_use":
                    raw_input = partial_json.get(index, "")
                    try:
                        block["input"] = json.loads(raw_input) if raw_input.strip() else (block.get("input") or {})
                    except ValueError:
                        block["input"] = {}
                        yield "tool_call", {"id": block.get("id"), "name": block.get("name"), "arguments": raw_input}
                        continue
                    yield "tool_call", {"id": block.get("id"), "name": block.get("name"), "arguments": block["input"]}
            elif event == "message_delta":
                raw = data.get("usage") or {}
                if raw.get("output_tokens") is not None:
                    usage["output_tokens"] = int(raw["output_tokens"])
                reason = (data.get("delta") or {}).get("stop_reason")
                if reason:
                    yield "stop", _stop_reason(reason)
            elif event == "error":
                raise RuntimeError(f"模型服务报错：{str((data.get('error') or {}).get('message') or data)[:ERROR_BODY_CHARS]}")
    if tools and blocks:
        content = [_clean_block(blocks[index]) for index in sorted(blocks)]
        # 空的文字块 Anthropic 不收
        yield "native", {"protocol": "anthropic", "content": [block for block in content if block.get("type") != "text" or block.get("text")]}
    if usage:
        yield "usage", usage


def _clean_block(block: dict[str, Any]) -> dict[str, Any]:
    """带回去的块只留请求里认的字段（流里的 text 块可能带空的 citations）。"""
    kind = block.get("type")
    keep = {"thinking": ("type", "thinking", "signature"), "redacted_thinking": ("type", "data"), "text": ("type", "text"),
            "tool_use": ("type", "id", "name", "input")}.get(str(kind))
    return {key: block[key] for key in keep if key in block} if keep else block


def _openai_tool_specs(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [{"type": "function", "function": {"name": tool["name"], "description": tool["description"], "parameters": tool["parameters"]}}
            for tool in tools]


def _chat_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """中性消息 → Chat Completions：工具结果只能是文字，这一轮取回的图另起一条用户消息跟在结果后面。"""
    out: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []

    def flush() -> None:
        if images:
            out.append({"role": "user", "content": [{"type": "text", "text": IMAGES_NOTE},
                                                    *({"type": "image_url", "image_url": {"url": _data_url(image)}} for image in images)]})
            images.clear()

    for message in model_wire.merge_system_messages(messages):
        role = message.get("role")
        if role == "tool":
            out.append({"role": "tool", "tool_call_id": message.get("tool_call_id"), "content": str(message.get("content") or "（空）")})
            images.extend(message.get("images") or [])
            continue
        flush()
        if role == "assistant" and message.get("tool_calls") is not None:
            turn: dict[str, Any] = {"role": "assistant", "content": message.get("content") or "", "tool_calls": [
                {"id": call["id"], "type": "function",
                 "function": {"name": call["name"], "arguments": json.dumps(_arguments(call), ensure_ascii=False)}}
                for call in message["tool_calls"]]}
            native = message.get("native")
            if isinstance(native, dict) and native.get("reasoning_content"):
                turn["reasoning_content"] = native["reasoning_content"]
            out.append(turn)
        else:
            out.append({key: value for key, value in message.items() if key in ("role", "content")})
    flush()
    return out


def _parse_arguments(raw: str) -> Any:
    try:
        return json.loads(raw) if raw.strip() else {}
    except ValueError:
        return raw  # 核心认出不是对象，回给模型说参数不对


def _post_first_accepted(url: str, headers: dict[str, str], bodies: list[dict[str, Any]]) -> requests.Response:
    """按思考字段的候选依次发：服务商回 400（多半是不认这种思考写法）就换下一个，最后一个（不加思考字段）的错误照常报。"""
    response = None
    for index, body in enumerate(bodies):
        response = requests.post(url, headers=headers, json=body, stream=True, timeout=(CONNECT_TIMEOUT_SECS, READ_TIMEOUT_SECS))
        if response.status_code == 400 and index < len(bodies) - 1:
            response.close()
            continue
        break
    assert response is not None
    return response


def _openai_chat(messages, cancel, *, model, base_url, api_key, candidates, tools=None, tool_choice=None) -> Iterator[Event]:
    base_url = base_url or DEFAULT_BASE_URL
    url = chat_completions_url(base_url)
    headers = build_headers(api_key, base_url)
    base = {"model": model, "messages": _chat_messages(messages), "stream": True, "stream_options": {"include_usage": True}}
    if tools:
        base["tools"] = _openai_tool_specs(tools)
        base["tool_choice"] = tool_choice or "auto"
    response = _post_first_accepted(url, headers, [{**base, **fields} for fields in candidates])
    if response.status_code >= 400:
        raise _http_error(response)
    usage: dict[str, int] = {}
    calls: dict[int, dict[str, str]] = {}
    reasoning: list[str] = []
    with response:
        for _, data in _sse_events(response, cancel):
            for choice in data.get("choices") or []:
                delta = choice.get("delta") or {}
                if delta.get("reasoning_content"):
                    reasoning.append(delta["reasoning_content"])
                    yield "thought", delta["reasoning_content"]
                if delta.get("content"):
                    yield "text", delta["content"]
                for fragment in delta.get("tool_calls") or []:
                    if not isinstance(fragment, dict):
                        continue
                    call = calls.setdefault(int(fragment.get("index") or 0), {"id": "", "name": "", "arguments": ""})
                    function = fragment.get("function") or {}
                    call["id"] = call["id"] or str(fragment.get("id") or "")
                    call["name"] += str(function.get("name") or "")
                    call["arguments"] += str(function.get("arguments") or "")
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
    if not cancel.is_set():
        for index in sorted(calls):
            call = calls[index]
            yield "tool_call", {"id": call["id"] or f"call_{uuid.uuid4().hex[:12]}", "name": call["name"],
                                "arguments": _parse_arguments(call["arguments"])}
        if calls:
            yield "native", {"protocol": "openai", "reasoning_content": "".join(reasoning)}
    if usage:
        yield "usage", usage


def _responses_tool_turns(suffix: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    images: list[dict[str, Any]] = []

    def flush() -> None:
        if images:
            items.append({"role": "user", "content": [{"type": "input_text", "text": IMAGES_NOTE},
                                                      *({"type": "input_image", "image_url": _data_url(image)} for image in images)]})
            images.clear()

    for message in suffix:
        if message.get("role") == "tool":
            items.append({"type": "function_call_output", "call_id": message.get("tool_call_id"), "output": str(message.get("content") or "（空）")})
            images.extend(message.get("images") or [])
            continue
        flush()
        if message.get("content"):
            items.append({"role": "assistant", "content": message["content"]})
        for call in message.get("tool_calls") or []:
            items.append({"type": "function_call", "call_id": call["id"], "name": call["name"],
                          "arguments": json.dumps(_arguments(call), ensure_ascii=False)})
    flush()
    return items


def _openai_responses(messages, cancel, *, model, base_url, api_key, candidates, tools=None, tool_choice=None) -> Iterator[Event]:
    base_url = base_url or DEFAULT_BASE_URL
    url = model_wire.responses_url(base_url)
    headers = build_headers(api_key, base_url)
    prefix, suffix = _split_tool_turns(messages)
    bodies = []
    for fields in candidates:
        body = model_wire.responses_body(model=model, messages=model_wire.merge_system_messages(prefix), temperature=None,
                                         response_format=None, thinking_fields=copy.deepcopy(fields))
        body["stream"] = True
        if isinstance(body.get("reasoning"), dict) and body["reasoning"].get("effort") not in (None, "none"):
            body["reasoning"]["summary"] = "auto"
        if tools:
            body["input"] += _responses_tool_turns(suffix)
            # strict 默认是真，要所有参数都必填；我们的参数有可选的
            body["tools"] = [{"type": "function", "name": tool["name"], "description": tool["description"],
                              "parameters": tool["parameters"], "strict": False} for tool in tools]
            body["tool_choice"] = tool_choice or "auto"
        bodies.append(body)
    response = _post_first_accepted(url, headers, bodies)
    if response.status_code >= 400:
        raise _http_error(response)
    called = False
    with response:
        for event, data in _sse_events(response, cancel):
            kind = event or str(data.get("type") or "")
            if kind == "response.reasoning_summary_text.delta" and data.get("delta"):
                yield "thought", data["delta"]
            elif kind == "response.output_text.delta" and data.get("delta"):
                yield "text", data["delta"]
            elif kind == "response.output_item.done" and (data.get("item") or {}).get("type") == "function_call":
                item = data["item"]
                called = True
                yield "tool_call", {"id": item.get("call_id") or f"call_{uuid.uuid4().hex[:12]}", "name": item.get("name"),
                                    "arguments": _parse_arguments(str(item.get("arguments") or ""))}
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
    if called:
        yield "native", {"protocol": "openai_responses"}


def _profile(*, model: str, base_url: str, protocol: str, thinking: str) -> model_wire.ConnectionProfile:
    return model_wire.resolve_profile(base_url=base_url or DEFAULT_BASE_URL, model=model, protocol=protocol or None, thinking=thinking or None)


def _wire_base_url(protocol: str, base_url: str) -> str:
    """换思考字段时按哪个地址认服务商：OpenAI 两种协议没填地址时用默认的（DeepSeek），和真发请求的地址一样。"""
    return base_url if protocol == model_wire.PROTOCOL_ANTHROPIC else (base_url or DEFAULT_BASE_URL)


# 每档给用户看的名字和一句说明（2026-11-27 用户：「只有开和关……太诡异了」，要看得懂快 / 准 / 费钱的差别，不要 effort 术语）。
# 值照旧是模型那边的档位名（``session/set_config_option`` 用它）。
THINKING_LABELS: dict[str, tuple[str, str]] = {
    "off": ("不思考", "直接回答：最快、最省"),
    "none": ("不思考", "直接回答：最快、最省"),
    "on": ("思考", "先想再答：难题更准，慢一些、多花一些"),
    "minimal": ("极浅", "几乎不想：很快、很省"),
    "low": ("浅", "稍微想一下：快、省"),
    "medium": ("中", "想得适中：速度和准确折中"),
    "high": ("深", "想得久一些：难题更准，慢、费"),
    "xhigh": ("很深", "想得更久：更慢、更费"),
    "max": ("最深", "想到最透：最准，也最慢、最费"),
}
THINKING_DESCRIPTION = "想得越深，难题答得越准，但越慢、越费钱"
GUESSED_DESCRIPTION = "这个模型认不出来，开关不一定起作用；回答完会告诉你它有没有真的思考"
# 不思考的那几档：开了「猜的」开关却没见思考才提醒，这几档不提醒
NO_THINKING_LEVELS = ("off", "none")


_DEFAULT_MENU: Any = object()


def resolve_menu(*, model: str, base_url: str, protocol: str = "", thinking: str = "", api_key: str = "",
                 cache_file: str = "") -> model_wire.ThinkingMenu | None:
    """这个连接的思考档位表（2026-11-27）：先问服务商的接口（``thinking_probe``，Anthropic、OpenRouter、Ollama 能报），
    问不到再查我们维护的表和代码里的规则（``model_wire.thinking_menu``）。接口明说不思考的是 None。
    接口报的档位，设置「自动」时按代码里实测过的那档（还在接口报的档位里的话），不然按接口的默认。"""
    from retainpdf_ask_agent_engine import thinking_probe

    profile = _profile(model=model, base_url=base_url, protocol=protocol, thinking=thinking)
    wire_base_url = _wire_base_url(profile.protocol, base_url)
    known = model_wire.thinking_menu(protocol=profile.protocol, model=model, base_url=wire_base_url)
    if not api_key:
        return known
    asked, says_none = thinking_probe.provider_menu(protocol=profile.protocol, base_url=wire_base_url, model=model,
                                                     api_key=api_key, cache_file=cache_file)
    if says_none:
        return None
    if asked is None:
        return known
    if known is not None and known.level_for("auto") in asked.values():
        mapping = tuple((setting, known.level_for("auto") if setting == "auto" else level) for setting, level in asked.by_setting)
        asked = dataclasses.replace(asked, by_setting=mapping)
    return asked


def thinking_options(*, model: str, base_url: str, protocol: str = "", thinking: str = "", remembered: str = "",
                     menu: Any = _DEFAULT_MENU) -> dict[str, Any] | None:
    """给核心的思考档位（档位表见 ``model_wire.thinking_menu``）。认不出的模型是 None（不报这一项）::

        {"options": [{"value", "name", "description"}], "current": 当前档, "description": 这一项的说明,
         "guessed": 档位是不是猜的, "no_thinking": [不思考的那几档]}

    当前档：``remembered``（用户在提问窗里上次选的，2026-11-27 用户定「记住上次选的」）还在这个模型的档位里就用它，
    否则是握手的思考深度对应的那一档。``menu`` 是 ``resolve_menu`` 查好的（不给就只查表和代码里的规则，不问接口）。"""
    profile = _profile(model=model, base_url=base_url, protocol=protocol, thinking=thinking)
    if menu is _DEFAULT_MENU:
        menu = model_wire.thinking_menu(protocol=profile.protocol, model=model, base_url=_wire_base_url(profile.protocol, base_url))
    if menu is None:
        return None
    values = menu.values()
    options = []
    for value in values:
        name, description = THINKING_LABELS.get(value, (value, ""))
        options.append({"value": value, "name": name, **({"description": description} if description else {})})
    current = remembered if remembered in values else menu.level_for(profile.thinking)
    return {
        "options": options,
        "current": current,
        "description": GUESSED_DESCRIPTION if menu.guessed else THINKING_DESCRIPTION,
        "guessed": menu.guessed,
        "source": menu.source,
        "no_thinking": [value for value in values if value in NO_THINKING_LEVELS],
    }


def make_stream_fn(*, model: str, base_url: str, api_key: str, protocol: str = "", thinking: str = "", remembered: str = "",
                   menu: Any = _DEFAULT_MENU):
    """按连接配置给核心一个 ``stream_fn(messages, cancel, *, tools=None, tool_choice=None, thinking_level=None)``。

    ``thinking_level`` 是会话里用 ``session/set_config_option`` 改过的档位（``thinking_options`` 报的值之一）：给了就按档位表发那一档的字段；
    没给按握手的思考深度发（和翻译同一套换法，``auto`` 对没实测过的模型什么都不加）；``remembered``（上次选的，``thinking_options`` 报成了当前档）
    还在档位表里就发那一档；档位表是问接口问到的或我们维护的表里的（``menu.source`` 不是 code），没改过也按报的当前档发那一档的字段
    （报的和发的一致；代码里的规则照旧按设置换字段，和翻译一样）。"""
    profile = _profile(model=model, base_url=base_url, protocol=protocol, thinking=thinking)
    wire_base_url = _wire_base_url(profile.protocol, base_url)
    if menu is _DEFAULT_MENU:
        menu = model_wire.thinking_menu(protocol=profile.protocol, model=model, base_url=wire_base_url)
    if menu is not None and remembered in menu.values():
        initial = menu.candidates(remembered)
    elif menu is not None and menu.source != "code":
        initial = menu.candidates(menu.level_for(profile.thinking))
    else:
        initial = model_wire.setting_thinking_candidates(protocol=profile.protocol, model=model, base_url=wire_base_url, thinking=profile.thinking)
    options = {"model": model, "base_url": base_url, "api_key": api_key}
    if profile.protocol == model_wire.PROTOCOL_ANTHROPIC:
        target = _anthropic
    elif profile.protocol == model_wire.PROTOCOL_OPENAI_RESPONSES:
        target = _openai_responses
    else:
        target = _openai_chat

    def stream(messages: list[dict[str, Any]], cancel: threading.Event, *, tools: list[dict[str, Any]] | None = None,
               tool_choice: str | None = None, thinking_level: str | None = None) -> Iterator[Event]:
        if thinking_level and menu is not None:
            candidates = menu.candidates(thinking_level)
        else:
            candidates = copy.deepcopy(initial)
        return target(messages, cancel, tools=tools, tool_choice=tool_choice, candidates=candidates, **options)

    return stream


__all__ = ["THINKING_LABELS", "make_stream_fn", "resolve_menu", "thinking_options"]

"""Loopback adapter from fx's Gateway wire to OpenAI Chat Completions.

fx 0.0.5 can use a host-trusted loopback ``FX_GATEWAY_CHAT_URL`` but does not
yet ship a direct OpenAI-compatible transport.  This bridge keeps fx as the
agent harness while allowing the backend host to select an OpenAI-compatible
model endpoint.  The bridge also owns fx's model-catalog route so ACP startup
does not retain a hidden dependency on the public Vercel Gateway.  Upstream
calls are deliberately non-streaming; the bridge emits the small
LanguageModelV2 SSE surface consumed by fx.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Mapping
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Self
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import ProxyHandler, Request, build_opener

from .usage_ledger import record_assistant_usage

_MAX_REQUEST_BYTES = 4 * 1024 * 1024
_MAX_RESPONSE_BYTES = 8 * 1024 * 1024
_DUMMY_GATEWAY_KEY = "retainpdf-loopback-bridge"


class FxOpenAIChatBridge:
    """Serve one private loopback Gateway-compatible endpoint for fx."""

    gateway_api_key = _DUMMY_GATEWAY_KEY

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str = "",
        timeout_s: float = 120.0,
        extra_body: Mapping[str, Any] | None = None,
        reasoning_efforts: tuple[str, ...] = (),
        usage_data_root: Path | str | None = None,
    ) -> None:
        self._base_url = _validated_base_url(base_url)
        # 每次上游返回记一行助手用量（usage_ledger）；不给就不记（测试、独立运行）。
        self._usage_data_root = usage_data_root
        self._model = model.strip()
        if not self._model:
            raise ValueError("FX OpenAI-compatible model is required")
        self._api_key = api_key.strip()
        self._timeout_s = max(1.0, float(timeout_s))
        self._extra_body = merge_safe_extra_body({}, extra_body)
        self._reasoning_efforts = tuple(
            str(value).strip() for value in reasoning_efforts if str(value).strip()
        )
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    @property
    def gateway_base_url(self) -> str:
        if self._server is None:
            raise RuntimeError("FX OpenAI bridge is not running")
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}"

    @property
    def chat_url(self) -> str:
        return f"{self.gateway_base_url}/v1/ai/chat"

    def start(self) -> Self:
        if self._server is not None:
            return self
        bridge = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                bridge._handle_get(self)

            def do_POST(self) -> None:
                bridge._handle_post(self)

            def log_message(self, _format: str, *args: object) -> None:
                del args

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        server.daemon_threads = True
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        self._server = server
        self._thread = thread
        thread.start()
        return self

    def close(self) -> None:
        server = self._server
        thread = self._thread
        self._server = None
        self._thread = None
        if server is None:
            return
        server.shutdown()
        server.server_close()
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=2.0)

    def __enter__(self) -> Self:
        return self.start()

    def __exit__(self, *_args: object) -> None:
        self.close()

    def _handle_get(self, handler: BaseHTTPRequestHandler) -> None:
        if handler.path != "/coding-agent/v1/models":
            _write_json(handler, 404, {"error": {"message": "not found"}})
            return
        _write_json(handler, 200, {"object": "list", "data": [self._catalog_entry()]})

    def _catalog_entry(self) -> dict[str, Any]:
        """桥对 fx 声明这个模型有什么能力。

        格式取自 fx 自己的解析器（src/builtins/gateway.zig，v0.0.10）：
        `reasoning_options` 是带 type 的对象数组，**不是** reasoning_efforts
        那样的字符串列表。写错键名 fx 不报错，只是「思考强度」那个选项不出现 ——
        我照着字段名猜了两轮才从源码里找到真的格式。

        声明 effort 档位不等于上游一定支持：fx 只据此决定给不给用户这个选择器，
        真正生效与否取决于 provider。不声明的话用户连选都选不了。

        **用户在 TUI 里怎么用到它**：输入 `/model <模型id> `（注意尾部空格），
        档位列表 default/low/high/max 就出来了。不是 ctrl+p —— 那个选择器只负责
        选模型，选完就关，从来不进 effort 阶段。我在 ctrl+p 上试了三种进法都没
        找到，最后是从 fx 源码 src/ui/input/runtime.zig 的测试
        （`"/model openai/gpt-5 "` + `.effort`）里看出来的。
        """
        entry: dict[str, Any] = {
            "id": self._model,
            "type": "language",
            "tags": ["tool-use"],
        }
        if self._reasoning_efforts:
            entry["tags"] = ["tool-use", "reasoning"]
            entry["reasoning_options"] = [
                {"type": "effort", "values": list(self._reasoning_efforts)}
            ]
        return entry

    def _handle_post(self, handler: BaseHTTPRequestHandler) -> None:
        if handler.path != "/v1/ai/chat":
            _write_json(handler, 404, {"error": {"message": "not found"}})
            return
        try:
            length = int(handler.headers.get("content-length", "0"))
        except ValueError:
            length = -1
        if length < 1 or length > _MAX_REQUEST_BYTES:
            _write_json(handler, 413, {"error": {"message": "invalid request size"}})
            return
        try:
            payload = json.loads(handler.rfile.read(length))
            if not isinstance(payload, dict):
                raise TypeError("request must be an object")
            upstream_payload = translate_gateway_request(
                payload, model=self._model, extra_body=self._extra_body
            )
            completion = self._request_upstream(upstream_payload)
            events = gateway_events_from_openai(completion)
        except (TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
            _write_json(handler, 400, {"error": {"message": str(exc)[:1000]}})
            return
        except RuntimeError as exc:
            _write_json(handler, 502, {"error": {"message": str(exc)[:1000]}})
            return
        body = (
            "".join(
                f"data: {json.dumps(event, ensure_ascii=False, separators=(',', ':'))}\n\n"
                for event in events
            )
            + "data: [DONE]\n\n"
        )
        encoded = body.encode("utf-8")
        handler.send_response(200)
        handler.send_header("content-type", "text/event-stream")
        handler.send_header("cache-control", "no-cache")
        handler.send_header("content-length", str(len(encoded)))
        handler.end_headers()
        handler.wfile.write(encoded)

    def _request_upstream(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}/chat/completions"
        headers = {"content-type": "application/json", "accept": "application/json"}
        if self._api_key:
            headers["authorization"] = f"Bearer {self._api_key}"
        request = Request(
            url,
            data=json.dumps(
                payload, ensure_ascii=False, separators=(",", ":")
            ).encode(),
            headers=headers,
            method="POST",
        )
        opener = build_opener(ProxyHandler({}))
        try:
            with opener.open(request, timeout=self._timeout_s) as response:
                raw = response.read(_MAX_RESPONSE_BYTES + 1)
        except HTTPError as exc:
            raw = exc.read(4096)
            detail = _safe_upstream_error(raw)
            raise RuntimeError(
                f"OpenAI-compatible endpoint returned HTTP {exc.code}: {detail}"
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise RuntimeError(
                f"OpenAI-compatible endpoint request failed: {type(exc).__name__}"
            ) from exc
        if len(raw) > _MAX_RESPONSE_BYTES:
            raise RuntimeError("OpenAI-compatible endpoint response exceeded limit")
        try:
            value = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                "OpenAI-compatible endpoint returned invalid JSON"
            ) from exc
        if not isinstance(value, dict):
            raise RuntimeError(  # noqa: TRY004 - upstream protocol failure
                "OpenAI-compatible endpoint returned a non-object response"
            )
        record_assistant_usage(
            self._usage_data_root,
            value.get("usage") if isinstance(value.get("usage"), dict) else None,
            stage="assistant_terminal",
            model=str(payload.get("model") or self._model),
            base_url=self._base_url,
        )
        return value


# 桥自己负责的三个字段。extra_body 不许碰它们 —— 那是桥对 fx 的协议契约，
# 被外部配置改掉会让「fx 收到的和它以为的」对不上，而且不报错。
_BRIDGE_OWNED_FIELDS = frozenset({"model", "messages", "stream"})


def merge_safe_extra_body(
    base: dict[str, Any], extra: Mapping[str, Any] | None
) -> dict[str, Any]:
    """把用户配的额外字段并进上游请求体，但保护桥自己的三个字段。

    为什么是「透传任意字段」而不是一个叫 thinking 的旋钮：不同 provider 的
    开关长得完全不一样，而且有的根本没有。实测 DeepSeek 认
    `{"thinking":{"type":"disabled"}}`，但 `reasoning_effort` 和
    `thinking.budget_tokens` 它一概忽略 —— 给一个叫「思考强度」的参数会让人
    以为能调档，实际只有开关。所以不翻译语义，只搬运。
    """
    merged = dict(base)
    if not isinstance(extra, Mapping):
        return merged
    for key, value in extra.items():
        name = str(key)
        if name in _BRIDGE_OWNED_FIELDS:
            continue
        merged[name] = value
    return merged


def translate_gateway_request(
    payload: Mapping[str, Any], *, model: str, extra_body: Mapping[str, Any] | None = None
) -> dict[str, Any]:
    prompt = payload.get("prompt")
    if not isinstance(prompt, list):
        raise TypeError("fx Gateway request is missing prompt")
    messages: list[dict[str, Any]] = []
    for message in prompt:
        if not isinstance(message, Mapping):
            raise TypeError("fx prompt message must be an object")
        role = str(message.get("role") or "")
        content = message.get("content")
        if role in {"system", "user"}:
            messages.append({"role": role, "content": _text_content(content)})
        elif role == "assistant":
            messages.append(_assistant_message(content))
        elif role == "tool":
            messages.extend(_tool_messages(content))
        else:
            raise ValueError(f"unsupported fx prompt role: {role or 'missing'}")

    result: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": False,
    }
    tools = payload.get("tools")
    if tools:
        if not isinstance(tools, list):
            raise TypeError("fx tools must be an array")
        translated_tools = [
            _openai_tool(tool)
            for tool in tools
            if isinstance(tool, Mapping) and tool.get("type") == "function"
        ]
        if translated_tools:
            result["tools"] = translated_tools
    tool_choice = _tool_choice(payload.get("toolChoice"))
    if tool_choice is not None:
        result["tool_choice"] = tool_choice
    # fx 0.0.10 起会带 maxOutputTokens。丢掉它不是"少一个可选参数"——fx 是按这个
    # 上限规划上下文的，上游不受限就可能回一段超出 fx 预期的内容。
    # 0.0.5 不发这个字段，所以这段在旧版上是死代码，不是行为变更。
    max_output = payload.get("maxOutputTokens")
    if isinstance(max_output, int) and max_output > 0:
        result["max_tokens"] = max_output
    return merge_safe_extra_body(result, extra_body)


def gateway_events_from_openai(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    choices = payload.get("choices")
    if (
        not isinstance(choices, list)
        or not choices
        or not isinstance(choices[0], Mapping)
    ):
        raise ValueError("OpenAI-compatible response has no choice")
    choice = choices[0]
    message = choice.get("message")
    if not isinstance(message, Mapping):
        raise TypeError("OpenAI-compatible response has no assistant message")
    events: list[dict[str, Any]] = [{"type": "stream-start", "warnings": []}]
    content = message.get("content")
    if content is not None and str(content):
        events.extend(
            [
                {"type": "text-start", "id": "text-1"},
                {"type": "text-delta", "id": "text-1", "delta": str(content)},
                {"type": "text-end", "id": "text-1"},
            ]
        )
    tool_calls = message.get("tool_calls") or []
    if not isinstance(tool_calls, list):
        raise TypeError("OpenAI-compatible tool_calls must be an array")
    for call in tool_calls:
        if not isinstance(call, Mapping):
            raise TypeError("OpenAI-compatible tool call must be an object")
        function = call.get("function")
        if not isinstance(function, Mapping):
            raise TypeError("OpenAI-compatible tool call is missing function")
        call_id = str(call.get("id") or "").strip()
        name = str(function.get("name") or "").strip()
        arguments = function.get("arguments", "{}")
        if not call_id or not name:
            raise ValueError("OpenAI-compatible tool call is missing id or name")
        if not isinstance(arguments, str):
            arguments = json.dumps(arguments, ensure_ascii=False, separators=(",", ":"))
        events.append(
            {
                "type": "tool-call",
                "toolCallId": call_id,
                "toolName": name,
                "input": arguments,
            }
        )

    raw_reason = str(choice.get("finish_reason") or "stop")
    unified = _finish_reason(raw_reason, has_tool_calls=bool(tool_calls))
    usage = payload.get("usage") if isinstance(payload.get("usage"), Mapping) else {}
    input_tokens = _int_or_zero(usage.get("prompt_tokens"))
    output_tokens = _int_or_zero(usage.get("completion_tokens"))
    total_tokens = (
        _int_or_zero(usage.get("total_tokens")) or input_tokens + output_tokens
    )
    events.append(
        {
            "type": "finish",
            "finishReason": {"unified": unified, "raw": raw_reason},
            "usage": {
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "totalTokens": total_tokens,
            },
        }
    )
    return events


def _validated_base_url(value: str) -> str:
    raw = value.strip().rstrip("/")
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("FX OpenAI-compatible base URL must be absolute http(s)")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(
            "FX OpenAI-compatible base URL must not contain credentials or query data"
        )
    return raw


def _text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        raise TypeError("fx message content must be text or an array")
    parts: list[str] = []
    for part in content:
        if not isinstance(part, Mapping) or part.get("type") != "text":
            raise ValueError(
                "FX OpenAI bridge currently supports text prompt parts only"
            )
        parts.append(str(part.get("text") or ""))
    return "".join(parts)


def _assistant_message(content: Any) -> dict[str, Any]:
    if isinstance(content, str):
        return {"role": "assistant", "content": content}
    if not isinstance(content, list):
        raise TypeError("fx assistant content must be text or an array")
    texts: list[str] = []
    calls: list[dict[str, Any]] = []
    for part in content:
        if not isinstance(part, Mapping):
            raise TypeError("fx assistant part must be an object")
        kind = part.get("type")
        if kind == "text":
            texts.append(str(part.get("text") or ""))
        elif kind == "tool-call":
            call_id = str(part.get("toolCallId") or "")
            name = str(part.get("toolName") or "")
            arguments = part.get("input", {})
            calls.append(
                {
                    "id": call_id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": json.dumps(
                            arguments, ensure_ascii=False, separators=(",", ":")
                        ),
                    },
                }
            )
        else:
            raise ValueError(f"unsupported fx assistant part: {kind}")
    message: dict[str, Any] = {"role": "assistant", "content": "".join(texts) or None}
    if calls:
        message["tool_calls"] = calls
    return message


def _tool_messages(content: Any) -> list[dict[str, Any]]:
    if not isinstance(content, list):
        raise TypeError("fx tool content must be an array")
    messages: list[dict[str, Any]] = []
    for part in content:
        if not isinstance(part, Mapping) or part.get("type") != "tool-result":
            raise ValueError("unsupported fx tool result")
        output = part.get("output")
        if isinstance(output, Mapping):
            value = output.get("value", "")
            if output.get("type") in {"json", "error-json"} and not isinstance(
                value, str
            ):
                value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        else:
            value = output
        if not isinstance(value, str):
            value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        messages.append(
            {
                "role": "tool",
                "tool_call_id": str(part.get("toolCallId") or ""),
                "content": value,
            }
        )
    return messages


def _openai_tool(tool: Any) -> dict[str, Any]:
    if not isinstance(tool, Mapping) or tool.get("type") != "function":
        raise ValueError("FX OpenAI bridge supports function tools only")
    return {
        "type": "function",
        "function": {
            "name": str(tool.get("name") or ""),
            "description": str(tool.get("description") or ""),
            "parameters": tool.get("inputSchema") or {"type": "object"},
        },
    }


def _tool_choice(value: Any) -> Any:
    if not isinstance(value, Mapping):
        return None
    kind = str(value.get("type") or "")
    if kind in {"auto", "none", "required"}:
        return kind
    if kind == "tool":
        name = str(value.get("toolName") or "")
        return {"type": "function", "function": {"name": name}}
    return None


def _finish_reason(raw: str, *, has_tool_calls: bool) -> str:
    if has_tool_calls or raw in {"tool_calls", "function_call"}:
        return "tool-calls"
    return {
        "stop": "stop",
        "length": "length",
        "content_filter": "content-filter",
        "error": "error",
    }.get(raw, "other")


def _int_or_zero(value: Any) -> int:
    return int(value) if isinstance(value, (int, float)) and value >= 0 else 0


def _safe_upstream_error(raw: bytes) -> str:
    try:
        value = json.loads(raw)
        if isinstance(value, Mapping):
            error = value.get("error")
            if isinstance(error, Mapping):
                return str(error.get("message") or "request rejected")[:1000]
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass
    return "request rejected"


def _write_json(
    handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]
) -> None:
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json")
    handler.send_header("content-length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)

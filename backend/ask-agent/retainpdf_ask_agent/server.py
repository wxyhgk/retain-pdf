"""自带 agent 的 ACP 服务端：stdio，每行一条 JSON-RPC 2.0（后端的 ACP 桥起它、两头转）。

实现的方法：`initialize`、`session/new`、`session/prompt`、`session/cancel`（通知）；别的请求回 -32601，不认识的通知不理。
`session/prompt` 在后台线程里跑：边收模型的流边发 `session/update`——思考 `agent_thought_chunk`、正文 `agent_message_chunk`，
最后 `usage_update`（ACP 只有 `used`、`size`，输入 / 输出 / 缓存命中放 `_meta.retainpdf.usage`），再回 `{stopReason}`。
被 `session/cancel` 叫停的回 `cancelled`，不当错误。

模型调用由调用方给（`stream_fn(messages, cancel)`，产出 `("thought", 文字)`、`("text", 文字)`、`("usage", dict)`、
`("stop", 原因)`），核心不认识哪家模型；真实的在接线包 `retainpdf_ask_agent_engine`。
"""
from __future__ import annotations

import json
import sys
import threading
import time
import uuid
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable, Iterable, Iterator, TextIO

from retainpdf_ask_agent.convert import prompt_to_content
from retainpdf_ask_agent.convert import text_only
from retainpdf_ask_agent.prompts import load_prompt

PROTOCOL_VERSION = 1
AGENT_VERSION = "1"
SYSTEM_PROMPT = "ask_system.txt"
# 带进下一轮的历史最多几条消息（一问一答两条）；之前的图不带，只带文字
MAX_HISTORY_MESSAGES = 20
STOP_REASONS = ("end_turn", "max_tokens", "max_turn_requests", "refusal", "cancelled")

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
PARSE_ERROR = -32700
RESOURCE_NOT_FOUND = -32002

StreamFn = Callable[[list[dict[str, Any]], threading.Event], Iterator[tuple[str, Any]]]


@dataclass
class Session:
    id: str
    history: list[dict[str, Any]] = field(default_factory=list)
    cancel: threading.Event = field(default_factory=threading.Event)
    busy: bool = False


class AskAgent:
    def __init__(self, stream_fn: StreamFn, *, model: str = "", context_size: int = 0, out: TextIO | None = None):
        self.stream_fn = stream_fn
        self.model = model
        self.context_size = int(context_size or 0)
        self.out = out or sys.stdout
        self.sessions: dict[str, Session] = {}
        self._lock = threading.Lock()
        self._threads: list[threading.Thread] = []

    # 输出 ---------------------------------------------------------------

    def _send(self, message: dict[str, Any]) -> None:
        line = json.dumps({"jsonrpc": "2.0", **message}, ensure_ascii=False, separators=(",", ":"))
        with self._lock:
            self.out.write(line + "\n")
            self.out.flush()

    def _result(self, request_id: Any, result: dict[str, Any]) -> None:
        self._send({"id": request_id, "result": result})

    def _error(self, request_id: Any, code: int, message: str) -> None:
        self._send({"id": request_id, "error": {"code": code, "message": message}})

    def _update(self, session_id: str, update: dict[str, Any]) -> None:
        self._send({"method": "session/update", "params": {"sessionId": session_id, "update": update}})

    # 入口 ---------------------------------------------------------------

    def serve(self, lines: Iterable[str]) -> None:
        for raw in lines:
            raw = raw.strip()
            if not raw:
                continue
            try:
                message = json.loads(raw)
            except ValueError:
                self._error(None, PARSE_ERROR, "parse error")
                continue
            if isinstance(message, dict):
                self.handle(message)
        # 输入关了（桥断开）：等还在答的问题收尾
        for thread in list(self._threads):
            thread.join(timeout=5)

    def handle(self, message: dict[str, Any]) -> None:
        method = message.get("method")
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        if not isinstance(method, str):
            return  # 客户端对我们请求的回复：自带 agent 不发请求，不会有
        if method == "initialize":
            self._result(request_id, {
                "protocolVersion": PROTOCOL_VERSION,
                "agentCapabilities": {
                    "loadSession": False,
                    "promptCapabilities": {"image": True, "audio": False, "embeddedContext": True},
                    "mcpCapabilities": {"http": False, "sse": False},
                },
                "agentInfo": {"name": "retainpdf", "title": "RetainPDF 自带模型", "version": AGENT_VERSION},
                "authMethods": [],
            })
        elif method == "session/new":
            session = Session(id=f"ask-{uuid.uuid4().hex[:16]}")
            self.sessions[session.id] = session
            self._result(request_id, {"sessionId": session.id})
        elif method == "session/prompt":
            self._prompt(request_id, params)
        elif method == "session/cancel":
            session = self.sessions.get(str(params.get("sessionId") or ""))
            if session is not None:
                session.cancel.set()
        elif request_id is not None:
            self._error(request_id, METHOD_NOT_FOUND, f"method not found: {method}")

    # 一问 ---------------------------------------------------------------

    def _prompt(self, request_id: Any, params: dict[str, Any]) -> None:
        session = self.sessions.get(str(params.get("sessionId") or ""))
        if session is None:
            self._error(request_id, RESOURCE_NOT_FOUND, "unknown session")
            return
        parts = prompt_to_content(params.get("prompt") if isinstance(params.get("prompt"), list) else [])
        if not parts:
            self._error(request_id, INVALID_PARAMS, "prompt is empty")
            return
        if session.busy:
            self._error(request_id, INVALID_PARAMS, "this session is still answering; cancel it first")
            return
        session.busy = True
        session.cancel.clear()
        thread = threading.Thread(target=self._answer, args=(request_id, session, parts), daemon=True)
        self._threads = [t for t in self._threads if t.is_alive()] + [thread]
        thread.start()

    def _answer(self, request_id: Any, session: Session, parts: list[dict[str, Any]]) -> None:
        messages = [{"role": "system", "content": load_prompt(SYSTEM_PROMPT)}, *session.history, {"role": "user", "content": parts}]
        answer: list[str] = []
        usage: dict[str, Any] = {}
        stop_reason = "end_turn"
        started = time.monotonic()
        first_token_ms: int | None = None
        try:
            for kind, value in self.stream_fn(messages, session.cancel):
                if session.cancel.is_set():
                    break
                if kind in ("thought", "text") and value:
                    if first_token_ms is None:
                        first_token_ms = int((time.monotonic() - started) * 1000)
                    update = "agent_thought_chunk" if kind == "thought" else "agent_message_chunk"
                    self._update(session.id, {"sessionUpdate": update, "content": {"type": "text", "text": value}})
                    if kind == "text":
                        answer.append(value)
                elif kind == "usage" and isinstance(value, dict):
                    usage.update(value)
                elif kind == "stop" and value in STOP_REASONS:
                    stop_reason = value
        except Exception as error:  # noqa: BLE001 - 模型出错回 JSON-RPC 错误，会话照常能接着问
            session.busy = False
            if session.cancel.is_set():
                self._result(request_id, {"stopReason": "cancelled"})
            else:
                self._error(request_id, INTERNAL_ERROR, f"{type(error).__name__}: {error}"[:1000])
            return
        if session.cancel.is_set():
            stop_reason = "cancelled"
        session.history.extend([
            {"role": "user", "content": text_only(parts) or "（图片）"},
            *([{"role": "assistant", "content": "".join(answer)}] if answer else []),
        ])
        del session.history[:-MAX_HISTORY_MESSAGES]
        meta = {
            "model": self.model,
            "elapsed_ms": int((time.monotonic() - started) * 1000),
            **({"first_token_ms": first_token_ms} if first_token_ms is not None else {}),
            **usage,
        }
        if usage:
            used = int(usage.get("input_tokens") or 0) + int(usage.get("output_tokens") or 0)
            self._update(session.id, {
                "sessionUpdate": "usage_update",
                "used": used,
                "size": self.context_size,
                "_meta": {"retainpdf": {"usage": meta}},
            })
        session.busy = False
        self._result(request_id, {"stopReason": stop_reason, "_meta": {"retainpdf": {"usage": meta}}})


__all__ = ["AskAgent", "PROTOCOL_VERSION", "Session", "StreamFn"]

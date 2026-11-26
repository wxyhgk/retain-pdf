"""自带 agent 的 ACP 服务端：stdio，每行一条 JSON-RPC 2.0（后端的 ACP 桥起它、两头转）。

实现的方法：`initialize`、`session/new`、`session/prompt`、`session/cancel`（通知）；别的请求回 -32601，不认识的通知不理。
`session/prompt` 在后台线程里跑：边收模型的流边发 `session/update`——思考 `agent_thought_chunk`、正文 `agent_message_chunk`，
最后 `usage_update`（ACP 只有 `used`、`size`，输入 / 输出 / 缓存命中放 `_meta.retainpdf.usage`），再回 `{stopReason}`。
被 `session/cancel` 叫停的回 `cancelled`，不当错误。

模型调用由调用方给（`stream_fn(messages, cancel, **options)`，产出 `("thought", 文字)`、`("text", 文字)`、`("usage", dict)`、
`("stop", 原因)`；给了工具时还有 `("tool_call", {id, name, arguments})` 和 `("native", 这一轮要原样带回的东西)`），
核心不认识哪家模型；真实的在接线包 `retainpdf_ask_agent_engine`。

读书（2026-11-25 起，握手带了书时有 `tools`，见 `tools.py`）。**材料先给，工具一直在，模型自己定**（2026-11-26 用户：
「你规定死了也不好这样」——不按问题的样子在代码里删工具）：

- 第一次问模型之前，代码把材料放进这一问最前面：带字的问题（选中的字、前端附的那一块原文译文）补所在的节、同页前后几块；
  不带字的（点在空白处、扫描页、问整本书）取那一页，没有文字层就附页图；问题里写了「第 N 页」也取那一页。系统提示词带页数和目录。
- 每一问都给同一套工具（`read_pages`、`search_book`、`view_page`），什么时候用只靠提示词引导：材料里有就直接答，答案明显在别处才调，
  找过就答。效果靠实测看（见方案的「实测」），不对就改提示词或材料，不加代码规则。
- 只留一个防失控的上限：最多 `MAX_TOOL_ROUNDS` 轮、每轮 `MAX_TOOL_CALLS_PER_ROUND` 个；到了下一轮 `tool_choice = none`，
  让它照已有的回答。

互动块（2026-11-26，见 `openui.py`）：有说明文件就开（不管有没有书），系统提示词在 `ask_system.txt` 后面接 L0（`intro`），
工具多 `openui_spec`、`openui_check`，和读书的工具并列。上限分开算（[`TurnBudget`]）：读书照旧最多 `MAX_TOOL_ROUNDS` 轮
（一轮里调了读书的工具算一轮）；取说明最多 `SPEC_CALLS_PER_TURN` 次、检查最多 `CHECK_CALLS_PER_TURN` 次（按次数算）；
超了的那一个不执行、回一句话。三样都用完、或者总轮数到了 `MAX_TOTAL_ROUNDS`，下一轮 `tool_choice = none`。

给了工具时 `options` 是 `{"tools": 工具说明, "tool_choice": "auto" | "none"}`。模型这一轮调了工具，就逐个跑（ACP `tool_call` →
`tool_call_update`），把结果接在对话后面再问。工具出错、超了上限回给模型（tool 结果），不是 JSON-RPC 错误。

一问之内的消息（中性写法，接线按协议换）：
- `{"role": "assistant", "content": 文字, "tool_calls": [{"id", "name", "arguments"}], "native": …}`
- `{"role": "tool", "tool_call_id", "name", "content": 文字, "images": [{"mime_type", "data"}], "is_error": bool}`
带进下一问的历史只留问和最后的回答文字，工具来回不带。
"""
from __future__ import annotations

import json
import sys
import threading
import time
import uuid
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable, Iterable, Iterator, Protocol, TextIO

from retainpdf_ask_agent.convert import prompt_to_content
from retainpdf_ask_agent.convert import text_only
from retainpdf_ask_agent.openui import CHECK_CALLS_PER_TURN
from retainpdf_ask_agent.openui import CHECK_TOOL
from retainpdf_ask_agent.openui import SPEC_CALLS_PER_TURN
from retainpdf_ask_agent.openui import SPEC_TOOL
from retainpdf_ask_agent.openui import OpenUiTools
from retainpdf_ask_agent.prompts import load_prompt
from retainpdf_ask_agent.tools import ToolResult

PROTOCOL_VERSION = 1
AGENT_VERSION = "1"
SYSTEM_PROMPT = "ask_system.txt"
# 有书时接在系统提示词后面的那段（工具怎么用）
TOOLS_PROMPT = "ask_tools.txt"
# 防失控的上限（不是规则）：最多几轮调工具、一轮最多几个，到了就照已有的回答
MAX_TOOL_ROUNDS = 4
MAX_TOOL_CALLS_PER_ROUND = 4
# 一问最多几轮调工具（读书的轮数 + 取说明、检查的次数；每一样各有各的上限，这是总的兜底）
MAX_TOTAL_ROUNDS = MAX_TOOL_ROUNDS + SPEC_CALLS_PER_TURN + CHECK_CALLS_PER_TURN
# 工具额度用完、下一轮不许再调时，接在最后一个工具结果后面的话
FINAL_ROUND_NOTE = ("（RetainPDF：这一问调工具的额度用完了，不能再调工具。现在直接给出最后的回答：照已有的内容回答；"
                    "互动块没通过检查就不要放进回答，用文字讲清楚。）")
# 带进下一轮的历史最多几条消息（一问一答两条）；之前的图不带，只带文字
MAX_HISTORY_MESSAGES = 20
STOP_REASONS = ("end_turn", "max_tokens", "max_turn_requests", "refusal", "cancelled")

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
PARSE_ERROR = -32700
RESOURCE_NOT_FOUND = -32002

StreamFn = Callable[..., Iterator[tuple[str, Any]]]


class Tools(Protocol):
    """读书的工具（`tools.BookTools`）：说明、给用户看的标题和种类、执行。
    另外可以有（`BookTools` 都有，测试里的假工具可以没有）：`warm()` 会话开始时在后台先取书；`overview()` 系统提示词里的目录；
    `prefetch(texts, meta)` 不带字的问题先取好的材料；`background(texts, meta)` 带字的问题补的材料；
    `carries_text(texts, meta)` 这一问带没带字（只用来挑取哪种材料，不管工具）。"""

    def specs(self) -> list[dict[str, Any]]: ...

    def describe(self, name: str, arguments: dict[str, Any]) -> tuple[str, str]: ...

    def run(self, name: str, arguments: dict[str, Any]) -> ToolResult: ...


@dataclass
class TurnBudget:
    """一问之内的工具上限：读书按轮（一轮里调了读书的工具算一轮），取说明、检查按次。"""

    book_rounds: int = MAX_TOOL_ROUNDS
    spec_calls: int = SPEC_CALLS_PER_TURN
    check_calls: int = CHECK_CALLS_PER_TURN
    has_book: bool = True
    has_openui: bool = True

    def any_left(self) -> bool:
        return (self.has_book and self.book_rounds > 0) or (self.has_openui and (self.spec_calls > 0 or self.check_calls > 0))

    def admit(self, calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """这一轮的调用：用得上额度的照常，用完了的标 `_refused`（不执行，回给模型一句话）。"""
        admitted: list[dict[str, Any]] = []
        book_in_round = any(call.get("name") not in (SPEC_TOOL, CHECK_TOOL) and not call.get("_refused") for call in calls)
        book_ok = self.book_rounds > 0
        if book_in_round and book_ok:
            self.book_rounds -= 1
        for call in calls:
            name = call.get("name")
            if call.get("_refused"):
                admitted.append(call)
            elif name == SPEC_TOOL:
                if self.spec_calls > 0:
                    self.spec_calls -= 1
                    admitted.append(call)
                else:
                    admitted.append({**call, "_refused": f"这一问已经取了 {SPEC_CALLS_PER_TURN} 次说明，这次没有执行：用已经取到的说明写，"
                                                         "或者不写互动块、用文字回答。"})
            elif name == CHECK_TOOL:
                if self.check_calls > 0:
                    self.check_calls -= 1
                    admitted.append(call)
                else:
                    admitted.append({**call, "_refused": f"这一问已经检查了 {CHECK_CALLS_PER_TURN} 次，这次没有执行：还有错就把互动块改简单，"
                                                         "或者不放互动块、用文字回答。"})
            elif book_ok:
                admitted.append(call)
            else:
                admitted.append({**call, "_refused": f"读书的工具这一问已经用了 {MAX_TOOL_ROUNDS} 轮，这次没有执行：照已有的内容回答。"})
        return admitted


@dataclass
class Session:
    id: str
    history: list[dict[str, Any]] = field(default_factory=list)
    cancel: threading.Event = field(default_factory=threading.Event)
    busy: bool = False


class AskAgent:
    def __init__(self, stream_fn: StreamFn, *, model: str = "", context_size: int = 0, out: TextIO | None = None,
                 tools: Tools | None = None, openui: OpenUiTools | None = None):
        self.stream_fn = stream_fn
        self.tools = tools
        self.openui = openui
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
            warm = getattr(self.tools, "warm", None)
            if callable(warm):
                # 用户打字的时候把书的块取好，第一问不用等
                threading.Thread(target=warm, daemon=True).start()
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
        meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else None
        thread = threading.Thread(target=self._answer, args=(request_id, session, parts, meta), daemon=True)
        self._threads = [t for t in self._threads if t.is_alive()] + [thread]
        thread.start()

    def _system_prompt(self) -> str:
        """系统提示词：`ask_system.txt`，有互动块接 L0，有书再接读书工具那段。每个会话一样（走缓存）。"""
        prompt = load_prompt(SYSTEM_PROMPT)
        if self.openui is not None:
            prompt = f"{prompt}\n\n{self.openui.intro}"
        if self.tools is not None:
            prompt = f"{prompt}\n\n{load_prompt(TOOLS_PROMPT)}"
        return prompt

    def _tool_specs(self) -> list[dict[str, Any]]:
        return [*(self.tools.specs() if self.tools is not None else []), *(self.openui.specs() if self.openui is not None else [])]

    def _owner(self, name: str) -> Any:
        """哪一套工具管这个名字：互动块的归 openui，别的归读书的（没有书时就没人管）。"""
        if self.openui is not None and self.openui.handles(name):
            return self.openui
        return self.tools

    def _plan(self, parts: list[dict[str, Any]], meta: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
        """这一问的系统消息、用户消息（最前面是代码取好的材料），和记进用量的说明（取了什么）。工具不在这里挑：有书就全给。"""
        system = [{"role": "system", "content": self._system_prompt()}]
        if self.tools is None:
            return system, parts, {}
        texts = [str(part.get("text") or "") for part in parts if part.get("type") == "text"]
        carries_text = getattr(self.tools, "carries_text", None)
        # 带字的问题那段字已经在了，补节和前后几块；不带字的取那一页（没有文字层附图）
        name = "background" if callable(carries_text) and carries_text(texts, meta) else "prefetch"
        fetch = getattr(self.tools, name, None)
        started = time.monotonic()
        context = None
        if callable(fetch):
            try:
                context = fetch(texts, meta)
            except Exception:  # noqa: BLE001 - 取不到材料就照常回答
                context = None
        info: dict[str, Any] = {}
        if context is not None and getattr(context, "text", ""):
            info["context"] = {"kind": name, **getattr(context, "info", {}), "ms": int((time.monotonic() - started) * 1000)}
            images = [{"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}} for mime, data in context.images]
            parts = [{"type": "text", "text": context.text}, *images, *parts]
        overview = getattr(self.tools, "overview", None)
        book = overview() if callable(overview) else ""
        if book:
            system.append({"role": "system", "content": book})
        return system, parts, info

    def _answer(self, request_id: Any, session: Session, parts: list[dict[str, Any]], meta: Any = None) -> None:
        started = time.monotonic()
        system, parts, plan_info = self._plan(parts, meta)
        messages: list[dict[str, Any]] = [*system, *session.history, {"role": "user", "content": parts}]
        answer: list[str] = []
        totals: dict[str, Any] = {}
        last_round: dict[str, Any] = {}
        stop_reason = "end_turn"
        first_token_ms: int | None = None
        rounds = 0
        tool_count = 0
        specs = self._tool_specs()
        budget = TurnBudget(has_book=self.tools is not None, has_openui=self.openui is not None)
        openui_info: dict[str, Any] = {}
        try:
            while not session.cancel.is_set():
                rounds += 1
                # 到了上限就不许再调（tool_choice=none）：读到的就是全部，照这些回答。工具说明照旧带着（对话里有工具来回）
                options: dict[str, Any] = {}
                if specs:
                    more = rounds <= MAX_TOTAL_ROUNDS and budget.any_left()
                    options = {"tools": specs, "tool_choice": "auto" if more else "none"}
                    if not more and messages[-1].get("role") == "tool":
                        # 额度用完、不许再调：在最后一个工具结果后面说一句，让它直接答（实测 qwen3.8-flash 不说就在正文里反复想调工具）
                        messages[-1] = {**messages[-1], "content": f"{messages[-1].get('content') or ''}\n\n{FINAL_ROUND_NOTE}"}
                texts: list[str] = []
                calls: list[dict[str, Any]] = []
                native: Any = None
                usage: dict[str, Any] = {}
                for kind, value in self.stream_fn(messages, session.cancel, **options):
                    if session.cancel.is_set():
                        break
                    if kind in ("thought", "text") and value:
                        if first_token_ms is None:
                            first_token_ms = int((time.monotonic() - started) * 1000)
                        update = "agent_thought_chunk" if kind == "thought" else "agent_message_chunk"
                        self._update(session.id, {"sessionUpdate": update, "content": {"type": "text", "text": value}})
                        if kind == "text":
                            texts.append(value)
                    elif kind == "tool_call" and isinstance(value, dict) and value.get("name"):
                        calls.append(value)
                    elif kind == "native":
                        native = value
                    elif kind == "usage" and isinstance(value, dict):
                        usage.update(value)
                    elif kind == "stop" and value in STOP_REASONS:
                        stop_reason = value
                _add_usage(totals, usage)
                last_round = usage or last_round
                answer.extend(texts)
                if session.cancel.is_set() or not calls or not options or options["tool_choice"] == "none":
                    break
                # 一轮里调了工具：记下这一轮（各家要原样带回的东西在 native 里），逐个跑工具，结果接在后面再问
                if answer and not answer[-1].endswith("\n"):
                    # 调工具前说的话和之后的回答之间空一行（前端按正文拼起来）
                    self._update(session.id, {"sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "\n\n"}})
                    answer.append("\n\n")
                # 一轮太多的不执行，回给模型一句话（防失控）
                calls = calls[:MAX_TOOL_CALLS_PER_ROUND] + [
                    {**call, "_refused": f"一轮最多调 {MAX_TOOL_CALLS_PER_ROUND} 个工具，这个没有执行；照已有的内容回答，或者下一轮再调。"}
                    for call in calls[MAX_TOOL_CALLS_PER_ROUND:]]
                # 读书、取说明、检查各有各的额度，用完的不执行
                calls = budget.admit(calls)
                messages.append({"role": "assistant", "content": "".join(texts),
                                 "tool_calls": [{key: call[key] for key in ("id", "name", "arguments") if key in call} for call in calls],
                                 "native": native})
                for call in calls:
                    if session.cancel.is_set():
                        break
                    tool_count += 0 if call.get("_refused") else 1
                    tool_message = self._run_tool(session, call, rounds)
                    messages.append(tool_message)
                    if call.get("name") in (SPEC_TOOL, CHECK_TOOL):
                        _note_openui(openui_info, call, tool_message)
            if session.cancel.is_set():
                stop_reason = "cancelled"
        except Exception as error:  # noqa: BLE001 - 模型出错回 JSON-RPC 错误，会话照常能接着问
            session.busy = False
            if session.cancel.is_set():
                self._result(request_id, {"stopReason": "cancelled"})
            else:
                self._error(request_id, INTERNAL_ERROR, f"{type(error).__name__}: {error}"[:1000])
            return
        text = "".join(answer).strip()
        session.history.extend([
            {"role": "user", "content": text_only(parts) or "（图片）"},
            *([{"role": "assistant", "content": text}] if text else []),
        ])
        del session.history[:-MAX_HISTORY_MESSAGES]
        meta = {
            "model": self.model,
            "elapsed_ms": int((time.monotonic() - started) * 1000),
            **({"first_token_ms": first_token_ms} if first_token_ms is not None else {}),
            **totals,
            **({"rounds": rounds, "tool_calls": tool_count, **plan_info} if specs else {}),
            **({"openui": openui_info} if openui_info else {}),
        }
        if totals:
            # used 是上下文占了多少：最后一轮的输入加输出（各轮加起来的是花了多少，在 _meta 里）
            used = int(last_round.get("input_tokens") or 0) + int(last_round.get("output_tokens") or 0)
            self._update(session.id, {
                "sessionUpdate": "usage_update",
                "used": used,
                "size": self.context_size,
                "_meta": {"retainpdf": {"usage": meta}},
            })
        session.busy = False
        self._result(request_id, {"stopReason": stop_reason, "_meta": {"retainpdf": {"usage": meta}}})

    def _run_tool(self, session: Session, call: dict[str, Any], round_number: int) -> dict[str, Any]:
        """跑一个工具，前后各发一条 ACP 更新（`tool_call` 进行中 → `tool_call_update` 完成 / 失败），返回给模型的 tool 消息。
        工具在旁边的线程里跑，叫停时不等它（后端慢的时候取消也立刻生效）。"""
        call_id = str(call.get("id") or f"call-{uuid.uuid4().hex[:12]}")
        name = str(call.get("name") or "")
        arguments = call.get("arguments")
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments or "{}")
            except ValueError:
                arguments = None
        if not isinstance(arguments, dict):
            title, kind = name, "other"
            result = ToolResult(text="参数不是一个 JSON 对象，没有执行。按工具说明重新给参数。", is_error=True, summary="参数不对")
        else:
            owner = self._owner(name)
            title, kind = owner.describe(name, arguments) if owner is not None else (name, "other")
            result = None
        self._update(session.id, {"sessionUpdate": "tool_call", "toolCallId": call_id, "title": title, "kind": kind,
                                  "status": "in_progress", "rawInput": arguments if isinstance(arguments, dict) else {}})
        if result is None and call.get("_refused"):
            # 卡片上的一句：第一个句号前（「这一问已经检查了 3 次，这次没有执行」「一轮最多调 4 个工具，这个没有执行」……）
            refused = str(call["_refused"])
            result = ToolResult(text=refused, is_error=True, summary=refused.split("：")[0].split("；")[0][:200])
        if result is None:
            result = self._call_tool(session, name, arguments)
        if result is None:  # 叫停了
            self._update(session.id, {"sessionUpdate": "tool_call_update", "toolCallId": call_id, "status": "failed",
                                      "content": [_text_content("取消了")]})
            result = ToolResult(text="用户取消了。", is_error=True)
        else:
            self._update(session.id, {"sessionUpdate": "tool_call_update", "toolCallId": call_id,
                                      "status": "failed" if result.is_error else "completed",
                                      "content": [_text_content(result.summary or result.text[:200])],
                                      "_meta": {"retainpdf": {"round": round_number}}})
        return {"role": "tool", "tool_call_id": call_id, "name": name, "content": result.text,
                "images": [{"mime_type": mime, "data": data} for mime, data in result.images], "is_error": result.is_error}

    def _call_tool(self, session: Session, name: str, arguments: dict[str, Any]) -> ToolResult | None:
        owner = self._owner(name)
        if owner is None:
            names = "、".join(str(spec.get("name")) for spec in self._tool_specs())
            return ToolResult(text=f"没有工具 {name}；能用的是 {names}。", is_error=True, summary=f"没有工具 {name}"[:200])
        box: list[ToolResult] = []

        def work() -> None:
            try:
                box.append(owner.run(name, arguments))
            except Exception as error:  # noqa: BLE001 - 工具出错回给模型，不当 JSON-RPC 错误
                box.append(ToolResult(text=f"工具出错：{type(error).__name__}: {error}"[:1000], is_error=True, summary="工具出错"))

        worker = threading.Thread(target=work, daemon=True)
        worker.start()
        while worker.is_alive():
            worker.join(timeout=0.1)
            if session.cancel.is_set():
                return None
        return box[0] if box else ToolResult(text="工具没有结果", is_error=True)


def _note_openui(info: dict[str, Any], call: dict[str, Any], tool_message: dict[str, Any]) -> None:
    """记进用量：取了几次、哪几段，检查了几次、几次没过（实测看模型会不会先取说明、能不能改对）。"""
    arguments = call.get("arguments")
    if isinstance(arguments, str):
        try:
            arguments = json.loads(arguments or "{}")
        except ValueError:
            arguments = {}
    arguments = arguments if isinstance(arguments, dict) else {}
    refused = bool(call.get("_refused"))
    if call.get("name") == SPEC_TOOL:
        info["spec_calls"] = info.get("spec_calls", 0) + (0 if refused else 1)
        sections = arguments.get("sections")
        sections = [sections] if isinstance(sections, str) else sections if isinstance(sections, list) else []
        if not refused:
            info["sections"] = [*info.get("sections", []), *[str(item) for item in sections]]
    else:
        info["check_calls"] = info.get("check_calls", 0) + (0 if refused else 1)
        content = str(tool_message.get("content") or "")
        if not refused and not content.startswith("没问题"):
            info["check_problems"] = info.get("check_problems", 0) + 1
    if refused:
        info["refused"] = info.get("refused", 0) + 1


def _text_content(text: str) -> dict[str, Any]:
    return {"type": "content", "content": {"type": "text", "text": text}}


def _add_usage(totals: dict[str, Any], usage: dict[str, Any]) -> None:
    """各轮的 token 加起来（数字的加，别的取最后一次）。"""
    for key, value in usage.items():
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            totals[key] = totals.get(key, 0) + value
        else:
            totals[key] = value


__all__ = ["AskAgent", "MAX_TOOL_ROUNDS", "MAX_TOTAL_ROUNDS", "PROTOCOL_VERSION", "Session", "StreamFn", "Tools", "TurnBudget"]

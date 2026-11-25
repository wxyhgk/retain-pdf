"""一问之内调工具：跑工具、发 ACP 工具卡片、结果接在后面再问、轮数上限、工具出错、叫停。模型和工具都是假的。"""
from __future__ import annotations

import io
import json
import threading

from retainpdf_ask_agent import AskAgent
from retainpdf_ask_agent.server import MAX_TOOL_CALLS_PER_ROUND
from retainpdf_ask_agent.server import MAX_TOOL_ROUNDS
from retainpdf_ask_agent.tools import BookTools
from retainpdf_ask_agent.tools import ToolResult


class FakeTools:
    def __init__(self, run=None):
        self.calls = []
        self._run = run

    def specs(self):
        return [{"name": "read_page", "description": "读一页", "parameters": {"type": "object", "properties": {}}}]

    def describe(self, name, arguments):
        return f"读第 {arguments.get('page')} 页", "read"

    def run(self, name, arguments):
        self.calls.append((name, arguments))
        if self._run:
            return self._run(name, arguments)
        return ToolResult(text=f"第 {arguments.get('page')} 页的内容", images=[("image/jpeg", "QUJD")], summary="3 块")


def _lines(out: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]


def _updates(out: io.StringIO) -> list[dict]:
    return [line["params"]["update"] for line in _lines(out) if line.get("method") == "session/update"]


def _run(stream_fn, tools, text="问"):
    out = io.StringIO()
    agent = AskAgent(stream_fn, model="m", context_size=1000, out=out, tools=tools)
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "/books", "mcpServers": []}})
    session = next(iter(agent.sessions))
    agent.handle({"jsonrpc": "2.0", "id": 2, "method": "session/prompt",
                  "params": {"sessionId": session, "prompt": [{"type": "text", "text": text}]}})
    return agent, session, out


def _wait(agent: AskAgent) -> None:
    for thread in list(agent._threads):
        thread.join(timeout=5)


def test_tool_round_runs_the_tool_and_asks_again_with_the_result() -> None:
    requests = []

    def stream(messages, cancel, **options):
        requests.append((list(messages), options))
        if len(requests) == 1:
            yield "thought", "要读第 5 页"
            yield "text", "我先读一下。"
            yield "tool_call", {"id": "t1", "name": "read_page", "arguments": {"page": 5}}
            yield "native", {"protocol": "fake", "blocks": ["签名"]}
            yield "usage", {"input_tokens": 100, "output_tokens": 20, "cache_write_tokens": 90}
        else:
            yield "text", "第 5 页讲的是哈密顿量（第 5 页）。"
            yield "usage", {"input_tokens": 300, "output_tokens": 40, "cache_read_tokens": 90}
            yield "stop", "end_turn"

    tools = FakeTools()
    agent, session, out = _run(stream, tools, "第 5 页讲了什么")
    _wait(agent)
    assert tools.calls == [("read_page", {"page": 5})]
    first_messages, first_options = requests[0]
    assert first_options["tool_choice"] == "auto" and first_options["tools"][0]["name"] == "read_page"
    assert "找过一次就照结果回答" in first_messages[0]["content"]  # 有工具时系统提示词带工具那段
    second = requests[1][0]
    assert second[-2] == {"role": "assistant", "content": "我先读一下。", "tool_calls": [{"id": "t1", "name": "read_page", "arguments": {"page": 5}}],
                          "native": {"protocol": "fake", "blocks": ["签名"]}}
    assert second[-1] == {"role": "tool", "tool_call_id": "t1", "name": "read_page", "content": "第 5 页的内容",
                          "images": [{"mime_type": "image/jpeg", "data": "QUJD"}], "is_error": False}
    updates = _updates(out)
    assert [update["sessionUpdate"] for update in updates] == [
        "agent_thought_chunk", "agent_message_chunk", "agent_message_chunk", "tool_call", "tool_call_update",
        "agent_message_chunk", "usage_update"]
    assert updates[3] == {"sessionUpdate": "tool_call", "toolCallId": "t1", "title": "读第 5 页", "kind": "read",
                          "status": "in_progress", "rawInput": {"page": 5}}
    assert updates[4]["status"] == "completed"
    assert updates[4]["content"] == [{"type": "content", "content": {"type": "text", "text": "3 块"}}]
    usage = updates[-1]
    # used 是最后一轮占的上下文；_meta 是各轮加起来
    assert usage["used"] == 340
    meta = usage["_meta"]["retainpdf"]["usage"]
    assert (meta["input_tokens"], meta["output_tokens"], meta["cache_read_tokens"], meta["cache_write_tokens"]) == (400, 60, 90, 90)
    assert (meta["rounds"], meta["tool_calls"]) == (2, 1)
    assert _lines(out)[-1]["result"]["stopReason"] == "end_turn"
    # 带进下一问的只有问和整段回答
    assert agent.sessions[session].history == [
        {"role": "user", "content": "第 5 页讲了什么"},
        {"role": "assistant", "content": "我先读一下。\n\n第 5 页讲的是哈密顿量（第 5 页）。"},
    ]


def test_tool_rounds_are_capped_then_the_model_must_answer() -> None:
    choices = []

    def stream(messages, cancel, **options):
        choices.append(options["tool_choice"])
        if options["tool_choice"] == "none":
            yield "text", "照读到的回答"
            return
        yield "tool_call", {"id": f"t{len(choices)}", "name": "read_page", "arguments": {"page": len(choices)}}

    tools = FakeTools()
    agent, _, out = _run(stream, tools, "全书讲什么")
    _wait(agent)
    assert choices == ["auto"] * MAX_TOOL_ROUNDS + ["none"]
    assert len(tools.calls) == MAX_TOOL_ROUNDS
    assert _lines(out)[-1]["result"]["stopReason"] == "end_turn"


def test_tool_errors_and_bad_arguments_go_back_to_the_model() -> None:
    seen = []

    def stream(messages, cancel, **options):
        seen.append(messages)
        if len(seen) == 1:
            yield "tool_call", {"id": "a", "name": "read_page", "arguments": {"page": 99}}
            yield "tool_call", {"id": "b", "name": "read_page", "arguments": "{not json"}
        else:
            yield "text", "没有第 99 页"

    def run(name, arguments):
        raise RuntimeError("backend exploded")

    agent, _, out = _run(stream, FakeTools(run), "第 99 页")
    _wait(agent)
    results = [message for message in seen[1] if message["role"] == "tool"]
    assert results[0]["is_error"] and "backend exploded" in results[0]["content"]
    assert results[1]["is_error"] and "参数不是一个 JSON 对象" in results[1]["content"]
    assert [u["status"] for u in _updates(out) if u["sessionUpdate"] == "tool_call_update"] == ["failed", "failed"]
    # 不是 JSON-RPC 错误：照常答完
    assert _lines(out)[-1]["result"]["stopReason"] == "end_turn"


def test_cancel_while_a_tool_runs_stops_without_waiting_for_it() -> None:
    started = threading.Event()
    release = threading.Event()
    rounds = []

    def stream(messages, cancel, **options):
        rounds.append(1)
        yield "tool_call", {"id": "slow", "name": "read_page", "arguments": {"page": 1}}

    def run(name, arguments):
        started.set()
        release.wait(10)
        return ToolResult(text="迟到的结果")

    agent, session, out = _run(stream, FakeTools(run))
    assert started.wait(5)
    agent.handle({"jsonrpc": "2.0", "method": "session/cancel", "params": {"sessionId": session}})
    _wait(agent)
    release.set()
    assert _lines(out)[-1]["result"]["stopReason"] == "cancelled" and rounds == [1]
    last = _updates(out)[-1]
    assert last["sessionUpdate"] == "tool_call_update" and last["status"] == "failed"


def test_without_tools_the_stream_gets_no_tool_options() -> None:
    def stream(messages, cancel, **options):
        assert options == {}
        assert "read_page" not in messages[0]["content"]
        yield "text", "好"

    agent, _, out = _run(stream, None)
    _wait(agent)
    assert _lines(out)[-1]["result"]["stopReason"] == "end_turn"


# 硬规则：问题带着字就不给模型工具 ---------------------------------------------------

REGIONS = [
    {"item_id": "p002-b0000", "source": {"page": 2, "text": "1 Operators"}, "translated": {"page": 2, "text": "1 算符"},
     "sub_type": "heading", "heading_level": 1},
    {"item_id": "p002-b0001", "source": {"page": 2, "text": "The Hamiltonian operator is Hermitian."},
     "translated": {"page": 2, "text": "哈密顿算符是厄米的。"}, "sub_type": "body"},
    {"item_id": "p002-b0002", "source": {"page": 2, "text": "It has real eigenvalues."}, "translated": {"page": 2, "text": "它的本征值是实数。"},
     "sub_type": "body"},
    {"item_id": "p005-b0000", "source": {"page": 5, "text": "Last words."}, "translated": {"page": 5, "text": "结语。"}, "sub_type": "body"},
]


def _book():
    body = json.dumps({"data": {"items": REGIONS}}).encode()
    return BookTools(job_id="job-1", http_get=lambda path, timeout: (200, "application/json", body))


def _ask(agent, session, request_id, *texts):
    agent.handle({"jsonrpc": "2.0", "id": request_id, "method": "session/prompt",
                  "params": {"sessionId": session, "prompt": [{"type": "text", "text": text} for text in texts]}})
    _wait(agent)


def _tool_names(options):
    return [tool["name"] for tool in options.get("tools") or []]


ANCHOR = "我在读一本书，第 2 页（译文栏）。\n\n这一块的原文：\nThe Hamiltonian operator is Hermitian.\n\n（RetainPDF 任务 job-1，块 p002-b0001，第 2 页）"


def test_tools_are_always_offered_and_the_material_comes_first() -> None:
    seen = []

    def stream(messages, cancel, **options):
        seen.append((messages, options))
        yield "text", "答"

    out = io.StringIO()
    agent = AskAgent(stream, model="m", context_size=1000, out=out, tools=_book())
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}})
    session = next(iter(agent.sessions))
    # 带字的问题：工具照样全给（用不用由模型定），材料是所在的节和同页前后的块，放在第一条用户消息最前面
    _ask(agent, session, 2, ANCHOR, "这句译得对吗？")
    messages, options = seen[-1]
    assert _tool_names(options) == ["read_pages", "search_book", "view_page"] and options["tool_choice"] == "auto"
    assert "找过一次就照结果回答" in messages[0]["content"] and messages[1]["content"].startswith("用户正在读的书共 5 页")
    material = messages[-1]["content"][0]["text"]
    assert material.startswith("【RetainPDF 从书里取的背景") and "所在的节：1 Operators" in material and "它的本征值是实数。" in material
    assert messages[-1]["content"][1]["text"] == ANCHOR
    usage = [json.loads(line) for line in out.getvalue().splitlines() if '"id":2' in line][0]["result"]["_meta"]["retainpdf"]["usage"]
    assert usage["context"]["kind"] == "background" and usage["context"]["item_id"] == "p002-b0001" and usage["tool_calls"] == 0
    # 追问也照样给工具
    _ask(agent, session, 3, "书里别处怎么用这个词？")
    assert _tool_names(seen[-1][1]) == ["read_pages", "search_book", "view_page"]

    # 不带字：同一套工具；材料是问到的那一页
    agent.handle({"jsonrpc": "2.0", "id": 4, "method": "session/new", "params": {}})
    other = [key for key in agent.sessions if key != session][0]
    _ask(agent, other, 5, "第 5 页讲了什么？")
    messages, options = seen[-1]
    assert _tool_names(options) == ["read_pages", "search_book", "view_page"]
    assert "第 5 页（问题里说到的）" in messages[-1]["content"][0]["text"]


def test_too_many_calls_in_one_round_are_refused_not_run() -> None:
    seen = []

    def stream(messages, cancel, **options):
        seen.append(options["tool_choice"])
        if len(seen) == 1:
            for index in range(MAX_TOOL_CALLS_PER_ROUND + 1):
                yield "tool_call", {"id": f"s{index}", "name": "search_book", "arguments": {"query": "Hermitian"}}
        else:
            yield "text", "第 2 页说它是厄米的。"

    out = io.StringIO()
    agent = AskAgent(stream, model="m", context_size=1000, out=out, tools=_book())
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}})
    _ask(agent, next(iter(agent.sessions)), 2, "书里哪里讲到厄米？")
    lines = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
    cards = [line["params"]["update"] for line in lines if line.get("method") == "session/update"
             and line["params"]["update"]["sessionUpdate"] == "tool_call_update"]
    assert [card["status"] for card in cards] == ["completed"] * MAX_TOOL_CALLS_PER_ROUND + ["failed"]
    assert lines[-1]["result"]["_meta"]["retainpdf"]["usage"]["tool_calls"] == MAX_TOOL_CALLS_PER_ROUND

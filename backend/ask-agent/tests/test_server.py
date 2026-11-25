"""ACP 服务端：握手、新会话、流式回答（思考、正文、用量）、历史、取消、出错。模型是假的。"""
from __future__ import annotations

import io
import json
import threading

from retainpdf_ask_agent import AskAgent
from retainpdf_ask_agent.convert import prompt_to_content


def _lines(out: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]


def _wait(agent: AskAgent) -> None:
    for thread in list(agent._threads):
        thread.join(timeout=5)


def _agent(stream_fn) -> tuple[AskAgent, io.StringIO]:
    out = io.StringIO()
    return AskAgent(stream_fn, model="m", context_size=1000, out=out), out


def _start(agent: AskAgent) -> str:
    agent.handle({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": 1}})
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "/books", "mcpServers": []}})
    return agent.sessions and next(iter(agent.sessions))


def _ask(agent: AskAgent, session_id: str, request_id: int, text: str, **extra) -> None:
    agent.handle({"jsonrpc": "2.0", "id": request_id, "method": "session/prompt",
                  "params": {"sessionId": session_id, "prompt": [{"type": "text", "text": text}], **extra}})


def test_handshake_and_a_streamed_answer_with_usage() -> None:
    seen = []

    def stream(messages, cancel):
        seen.append(messages)
        yield "thought", "想一想"
        yield "text", "答"
        yield "text", "案"
        yield "usage", {"input_tokens": 120, "output_tokens": 30, "cache_read_tokens": 100}
        yield "stop", "end_turn"

    agent, out = _agent(stream)
    session = _start(agent)
    _ask(agent, session, 2, "这句译得对吗？")
    _wait(agent)
    lines = _lines(out)
    init = lines[0]["result"]
    assert init["protocolVersion"] == 1 and init["agentCapabilities"]["promptCapabilities"]["image"] is True
    assert lines[1]["result"]["sessionId"] == session
    updates = [line["params"]["update"] for line in lines if line.get("method") == "session/update"]
    assert [u["sessionUpdate"] for u in updates] == ["agent_thought_chunk", "agent_message_chunk", "agent_message_chunk", "usage_update"]
    assert updates[1]["content"] == {"type": "text", "text": "答"}
    usage = updates[-1]
    assert usage["used"] == 150 and usage["size"] == 1000
    assert usage["_meta"]["retainpdf"]["usage"]["cache_read_tokens"] == 100
    assert usage["_meta"]["retainpdf"]["usage"]["model"] == "m"
    result = lines[-1]
    assert result["id"] == 2 and result["result"]["stopReason"] == "end_turn"
    assert seen[0][0]["role"] == "system" and seen[0][-1] == {"role": "user", "content": [{"type": "text", "text": "这句译得对吗？"}]}


def test_follow_up_questions_carry_the_previous_turns_as_text() -> None:
    calls = []

    def stream(messages, cancel):
        calls.append(messages)
        yield "text", f"回答{len(calls)}"

    agent, _ = _agent(stream)
    session = _start(agent)
    agent.handle({"jsonrpc": "2.0", "id": 2, "method": "session/prompt", "params": {"sessionId": session, "prompt": [
        {"type": "text", "text": "这张图里是什么？"}, {"type": "image", "data": "AAAA", "mimeType": "image/png"}]}})
    _wait(agent)
    _ask(agent, session, 3, "再说细一点")
    _wait(agent)
    second = calls[1]
    assert second[1:3] == [{"role": "user", "content": "这张图里是什么？"}, {"role": "assistant", "content": "回答1"}]
    assert calls[0][-1]["content"][1]["type"] == "image_url"


def test_cancel_stops_the_answer_and_reports_cancelled() -> None:
    started = threading.Event()

    def stream(messages, cancel):
        yield "text", "开头"
        started.set()
        cancel.wait(5)
        yield "text", "不该发出去"

    agent, out = _agent(stream)
    session = _start(agent)
    _ask(agent, session, 2, "长问题")
    assert started.wait(5)
    agent.handle({"jsonrpc": "2.0", "method": "session/cancel", "params": {"sessionId": session}})
    _wait(agent)
    lines = _lines(out)
    texts = [line["params"]["update"]["content"]["text"] for line in lines if line.get("method") == "session/update"]
    assert texts == ["开头"]
    assert lines[-1]["result"]["stopReason"] == "cancelled"


def test_model_errors_become_json_rpc_errors_and_the_session_keeps_working() -> None:
    attempts = []

    def stream(messages, cancel):
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("模型服务返回 HTTP 401：invalid key")
        yield "text", "好了"

    agent, out = _agent(stream)
    session = _start(agent)
    _ask(agent, session, 2, "问")
    _wait(agent)
    _ask(agent, session, 3, "再问")
    _wait(agent)
    lines = _lines(out)
    error = next(line for line in lines if line.get("id") == 2)
    assert error["error"]["code"] == -32603 and "401" in error["error"]["message"]
    assert next(line for line in lines if line.get("id") == 3)["result"]["stopReason"] == "end_turn"


def test_protocol_errors() -> None:
    agent, out = _agent(lambda messages, cancel: iter(()))
    agent.serve(["not json", json.dumps({"jsonrpc": "2.0", "id": 9, "method": "session/load", "params": {}}),
                 json.dumps({"jsonrpc": "2.0", "method": "unknown/notification"}),
                 json.dumps({"jsonrpc": "2.0", "id": 10, "method": "session/prompt", "params": {"sessionId": "nope", "prompt": []}})])
    lines = _lines(out)
    assert lines[0]["error"]["code"] == -32700
    assert lines[1] == {"jsonrpc": "2.0", "id": 9, "error": {"code": -32601, "message": "method not found: session/load"}}
    assert lines[2]["error"]["code"] == -32002 and len(lines) == 3


def test_prompt_blocks_become_model_parts() -> None:
    parts = prompt_to_content([
        {"type": "text", "text": "问"},
        {"type": "image", "data": "QUJD", "mimeType": "image/jpeg"},
        {"type": "image", "data": "QUJD", "mimeType": "image/svg+xml"},
        {"type": "resource", "resource": {"uri": "retainpdf://p12-b3", "text": "原文一段"}},
        {"type": "resource_link", "uri": "file:///books/a.md", "name": "a.md"},
        {"type": "audio", "data": "x", "mimeType": "audio/wav"},
    ])
    assert parts == [
        {"type": "text", "text": "问"},
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,QUJD"}},
        {"type": "text", "text": "【附：retainpdf://p12-b3】\n原文一段"},
        {"type": "text", "text": "【引用：a.md file:///books/a.md】"},
    ]

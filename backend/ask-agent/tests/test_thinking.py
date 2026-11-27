"""思考强度（2026-11-26）：`session/new` 报 `configOptions`、`session/set_config_option` 改下一问的档位；接线按档位表发字段。HTTP 是假的。"""
from __future__ import annotations

import io
import json
import subprocess
import sys
import threading
from http.server import ThreadingHTTPServer

from retainpdf_ask_agent import AskAgent
from retainpdf_ask_agent_engine import stream as engine
from test_entrypoint import FakeModel
from test_entrypoint import _env
from test_stream import FakeResponse
from test_stream import MESSAGES
from test_stream import posts  # noqa: F401 - fixture
from test_stream import sse

THINKING = {"options": [{"value": "off", "name": "off"}, {"value": "on", "name": "on"}], "current": "off"}


def _lines(out: io.StringIO) -> list[dict]:
    return [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]


def _wait(agent: AskAgent) -> None:
    for thread in list(agent._threads):
        thread.join(timeout=5)


def _new(agent: AskAgent) -> dict:
    agent.handle({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {"cwd": "/books", "mcpServers": []}})
    return _lines(agent.out)[-1]["result"]


def _set(agent: AskAgent, session: str, value, request_id: int = 2, config_id: str = "thought_level") -> dict:
    agent.handle({"jsonrpc": "2.0", "id": request_id, "method": "session/set_config_option",
                  "params": {"sessionId": session, "configId": config_id, "value": value}})
    return _lines(agent.out)[-1]


def test_session_new_reports_the_thought_level_and_set_config_option_changes_the_next_question() -> None:
    seen: list[dict] = []

    def stream(messages, cancel, **options):
        seen.append(options)
        yield "text", "答"
        yield "stop", "end_turn"

    agent = AskAgent(stream, model="qwen3.8-flash", out=io.StringIO(), thinking=THINKING)
    result = _new(agent)
    session = result["sessionId"]
    assert result["configOptions"] == [{
        "id": "thought_level", "name": "思考", "category": "thought_level", "type": "select", "currentValue": "off",
        "options": [{"value": "off", "name": "off"}, {"value": "on", "name": "on"}],
    }]
    # 没改过：不传 thinking_level（接线按握手的思考深度发）
    agent.handle({"jsonrpc": "2.0", "id": 3, "method": "session/prompt", "params": {"sessionId": session, "prompt": [{"type": "text", "text": "问"}]}})
    _wait(agent)
    assert "thinking_level" not in seen[-1]
    assert _lines(agent.out)[-1]["result"]["_meta"]["retainpdf"]["usage"]["thinking_level"] == "off"

    reply = _set(agent, session, "on")
    assert reply["id"] == 2 and reply["result"]["configOptions"][0]["currentValue"] == "on"
    agent.handle({"jsonrpc": "2.0", "id": 4, "method": "session/prompt", "params": {"sessionId": session, "prompt": [{"type": "text", "text": "再问"}]}})
    _wait(agent)
    assert seen[-1]["thinking_level"] == "on"
    assert _lines(agent.out)[-1]["result"]["_meta"]["retainpdf"]["usage"]["thinking_level"] == "on"
    # 别的会话不受影响
    other = _new(agent)
    assert other["configOptions"][0]["currentValue"] == "off"


def test_bad_values_unknown_options_and_sessions_are_acp_errors() -> None:
    agent = AskAgent(lambda messages, cancel, **options: iter(()), out=io.StringIO(), thinking=THINKING)
    session = _new(agent)["sessionId"]
    for value in ("max", "", None, True):
        assert _set(agent, session, value)["error"]["code"] == -32602
    assert _set(agent, session, "on", config_id="model")["error"]["code"] == -32602
    assert _set(agent, "nope", "on")["error"]["code"] == -32002
    # 改不成功档位不变
    assert agent.sessions[session].thinking_level is None


def test_models_without_a_level_table_report_nothing() -> None:
    agent = AskAgent(lambda messages, cancel, **options: iter(()), out=io.StringIO(), thinking=None)
    result = _new(agent)
    assert "configOptions" not in result
    assert _set(agent, result["sessionId"], "on")["error"]["code"] == -32602


# ---- 接线：档位表、请求体 ----

DASHSCOPE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
CHAT_OK = sse((None, {"choices": [{"delta": {"content": "好"}, "finish_reason": "stop"}]}), (None, "[DONE]"))


def test_engine_options_follow_the_model() -> None:
    qwen = engine.thinking_options(model="qwen3.8-flash", base_url=DASHSCOPE, protocol="openai", thinking="auto")
    assert qwen == {"options": [{"value": "off", "name": "off"}, {"value": "on", "name": "on"}], "current": "off"}
    claude = engine.thinking_options(model="claude-haiku-5-5", base_url="", protocol="anthropic", thinking="")
    assert [option["value"] for option in claude["options"]] == ["low", "medium", "high", "xhigh", "max"] and claude["current"] == "low"
    # OpenAI 协议没填地址按 DeepSeek（和真发请求一样）
    deepseek = engine.thinking_options(model="deepseek-chat", base_url="", protocol="openai", thinking="high")
    assert deepseek["current"] == "on"
    gpt = engine.thinking_options(model="gpt-5-mini", base_url="https://api.openai.com/v1", protocol="openai_responses", thinking="off")
    assert [option["value"] for option in gpt["options"]] == ["minimal", "low", "medium", "high"] and gpt["current"] == "minimal"
    # 认不出的模型（2026-11-27 起）：OpenAI Chat、不是 api.openai.com 的给通用开关；api.openai.com 上不推理的 gpt-4o 仍然不报
    mystery = engine.thinking_options(model="mystery", base_url="https://llm.example.com/v1", protocol="openai", thinking="")
    assert mystery == {"options": [{"value": "off", "name": "off"}, {"value": "on", "name": "on"}], "current": "on"}
    assert engine.thinking_options(model="gpt-4o", base_url="https://api.openai.com/v1", protocol="openai", thinking="") is None


def test_generic_switch_falls_back_on_400(posts) -> None:  # noqa: F811
    """通用开关先几种写法一起发；服务回 400 就少发几样再试。"""
    calls, replies = posts
    fn = engine.make_stream_fn(model="mystery", base_url="https://llm.example.com/v1", api_key="sk-test", protocol="openai", thinking="")
    replies.append(FakeResponse([], status=400, payload={"error": {"message": "unknown parameter: reasoning_effort"}}))
    replies.append(FakeResponse(CHAT_OK))
    list(fn(MESSAGES, threading.Event(), thinking_level="off"))
    assert calls[-2]["body"]["reasoning_effort"] == "none"
    assert "reasoning_effort" not in calls[-1]["body"]
    assert calls[-1]["body"]["chat_template_kwargs"] == {"enable_thinking": False, "thinking": False}


def test_qwen_level_changes_the_request_body(posts) -> None:  # noqa: F811
    calls, replies = posts
    fn = engine.make_stream_fn(model="qwen3.8-flash", base_url=DASHSCOPE, api_key="sk-test", protocol="openai", thinking="auto")
    replies.append(FakeResponse(CHAT_OK))
    list(fn(MESSAGES, threading.Event()))
    assert calls[-1]["body"]["enable_thinking"] is False
    replies.append(FakeResponse(CHAT_OK))
    list(fn(MESSAGES, threading.Event(), thinking_level="on"))
    assert calls[-1]["body"]["enable_thinking"] is True and "thinking_budget" not in calls[-1]["body"]


def test_claude_level_changes_effort_and_falls_back_on_400(posts) -> None:  # noqa: F811
    calls, replies = posts
    fn = engine.make_stream_fn(model="claude-haiku-5-5", base_url="", api_key="sk-test", protocol="anthropic", thinking="auto")
    replies.append(FakeResponse(sse(("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"output_tokens": 1}}))))
    list(fn(MESSAGES, threading.Event(), thinking_level="xhigh"))
    assert calls[-1]["body"]["output_config"] == {"effort": "xhigh"}
    assert calls[-1]["body"]["thinking"] == {"type": "adaptive", "display": "summarized"}
    replies.append(FakeResponse(sse(("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"output_tokens": 1}}))))
    list(fn(MESSAGES, threading.Event()))
    assert calls[-1]["body"]["output_config"] == {"effort": "low"}


def test_openai_levels_fall_back_when_the_provider_refuses(posts) -> None:  # noqa: F811
    """Chat、Responses 以前只发第一种思考写法；现在和 Anthropic 一样，400 就换下一种，最后不带思考字段。"""
    calls, replies = posts
    fn = engine.make_stream_fn(model="glm-5.3-flash", base_url="https://open.bigmodel.cn/api/paas/v4", api_key="sk-test", protocol="openai")
    replies.extend([FakeResponse([], status=400, payload={"error": {"message": "该模型始终思考，不支持关闭思考"}}), FakeResponse(CHAT_OK)])
    assert ("text", "好") in list(fn(MESSAGES, threading.Event(), thinking_level="off"))
    assert calls[-2]["body"]["thinking"] == {"type": "disabled"} and calls[-1]["body"]["reasoning_effort"] == "low"
    responses = engine.make_stream_fn(model="gpt-5-mini", base_url="https://api.openai.com/v1", api_key="sk-test", protocol="openai_responses")
    done = sse(("response.completed", {"type": "response.completed", "response": {"usage": {}}}))
    replies.append(FakeResponse(done))
    list(responses(MESSAGES, threading.Event(), thinking_level="minimal"))
    assert calls[-1]["body"]["reasoning"] == {"effort": "minimal", "summary": "auto"}


def test_set_config_option_end_to_end_over_stdio() -> None:
    """真起 `python -m retainpdf_ask_agent`：GPT-5 报 minimal…high，改成 high 后下一问的请求体带 reasoning_effort=high。"""
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeModel)
    server.bodies = []  # type: ignore[attr-defined]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    env = _env(f"http://127.0.0.1:{server.server_address[1]}/v1")
    env.update({"RETAIN_ASK_MODEL": "gpt-5-mini", "RETAIN_ASK_THINKING": "auto"})
    try:
        process = subprocess.Popen([sys.executable, "-m", "retainpdf_ask_agent"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, encoding="utf-8", env=env)

        def call(message: dict) -> dict:
            process.stdin.write(json.dumps(message) + "\n")
            process.stdin.flush()
            while True:
                line = json.loads(process.stdout.readline())
                if line.get("id") == message["id"]:
                    return line

        new = call({"jsonrpc": "2.0", "id": 1, "method": "session/new", "params": {}})["result"]
        option = new["configOptions"][0]
        assert [item["value"] for item in option["options"]] == ["minimal", "low", "medium", "high"] and option["currentValue"] == "medium"
        prompt = {"jsonrpc": "2.0", "method": "session/prompt", "params": {"sessionId": new["sessionId"], "prompt": [{"type": "text", "text": "嗨"}]}}
        call({**prompt, "id": 2})
        changed = call({"jsonrpc": "2.0", "id": 3, "method": "session/set_config_option",
                        "params": {"sessionId": new["sessionId"], "configId": "thought_level", "value": "high"}})
        assert changed["result"]["configOptions"][0]["currentValue"] == "high"
        call({**prompt, "id": 4})
        process.stdin.close()
        process.wait(timeout=30)
    finally:
        server.shutdown()
    first, second = server.bodies  # type: ignore[attr-defined]
    # 握手是 auto：第一问不带思考字段（服务商默认 medium）；改成 high 后带上
    assert "reasoning_effort" not in first and second["reasoning_effort"] == "high"

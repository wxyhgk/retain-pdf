import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import pytest
import retainpdf_ai.app as app_module
from fastapi.testclient import TestClient
from retainpdf_ai.agent import (
    RetrievalAgent,
    assemble_streaming_message,
    build_deepseek_chat_fn,
)
from retainpdf_ai.app import build_app
from retainpdf_ai.config import Settings
from retainpdf_ai.request_control import AIRequestTimeout
from retainpdf_ai.tools import ToolRegistry


def _sse(obj) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False)


def test_assemble_streaming_pure_content_emits_each_delta():
    lines = [
        _sse({"choices": [{"delta": {"content": "选择"}}]}),
        _sse({"choices": [{"delta": {"content": "性来自"}}]}),
        _sse({"choices": [{"delta": {"content": "共轭 [1]"}}]}),
        _sse({"choices": [{"delta": {}, "finish_reason": "stop"}]}),
        "data: [DONE]",
        _sse({"choices": [{"delta": {"content": "被忽略"}}]}),  # [DONE] 之后不再处理
    ]
    deltas: list[str] = []
    message = assemble_streaming_message(iter(lines), deltas.append)

    # 审计 A3 后的新契约:前 64 字符先缓冲定性(防工具轮前言泄漏),
    # 短纯回答在流结束时合并补发——总文本不变,分片方式不再逐 piece 锁死
    assert "".join(deltas) == "选择性来自共轭 [1]"
    assert message["content"] == "选择性来自共轭 [1]"
    assert "tool_calls" not in message


def test_assemble_streaming_tool_calls_do_not_emit_deltas():
    lines = [
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": "call-1",
                                    "type": "function",
                                    "function": {"name": "search_", "arguments": '{"que'},
                                }
                            ]
                        }
                    }
                ]
            }
        ),
        _sse(
            {
                "choices": [
                    {
                        "delta": {
                            "tool_calls": [
                                {"index": 0, "function": {"name": "fulltext", "arguments": 'ry":"x"}'}}
                            ]
                        }
                    }
                ]
            }
        ),
        "data: [DONE]",
    ]
    deltas: list[str] = []
    lines.insert(-1, _sse({"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}))
    message = assemble_streaming_message(iter(lines), deltas.append)

    assert deltas == []  # 工具调用轮绝不 emit answer_delta
    assert message["content"] == ""
    call = message["tool_calls"][0]
    assert call["id"] == "call-1"
    assert call["function"]["name"] == "search_fulltext"
    assert json.loads(call["function"]["arguments"]) == {"query": "x"}


def test_provider_timeout_uses_stable_public_timeout_error():
    class TimeoutClient:
        def post(self, *_args, **_kwargs):
            raise httpx.ReadTimeout("provider stalled")

    chat = build_deepseek_chat_fn(
        Settings(llm_api_key="test-key"),
        client=TimeoutClient(),  # type: ignore[arg-type]
    )

    with pytest.raises(AIRequestTimeout, match="AI 响应超时"):
        chat([{"role": "user", "content": "q"}], [])


@pytest.mark.parametrize("stage", ["connect", "headers", "body"])
def test_stream_timeouts_have_the_same_public_code(stage):
    from contextlib import contextmanager
    from retainpdf_ai.request_control import public_error_event

    class Response:
        status_code = 200

        def close(self):
            pass

        def iter_lines(self):
            raise httpx.ReadTimeout("private provider detail")

    class Client:
        @contextmanager
        def stream(self, *_args, **_kwargs):
            if stage == "connect":
                raise httpx.ConnectTimeout("private provider detail")
            if stage == "headers":
                raise httpx.ReadTimeout("private provider detail")
            yield Response()

    chat = build_deepseek_chat_fn(
        Settings(llm_api_key="synthetic-key"),
        client=Client(),
        on_delta=lambda _: None,
    )
    with pytest.raises(AIRequestTimeout) as error:
        chat([{"role": "user", "content": "q"}], [])
    event = public_error_event(error.value)
    assert event["code"] == "AI_RESPONSE_TIMEOUT"
    assert "private provider" not in event["message"]


def test_ask_endpoint_streams_answer_deltas(monkeypatch):
    pieces = ["选择", "性来自", "共轭 [1]"]
    full = "".join(pieces)

    def fake_build(settings, client=None, *, on_delta=None):
        def chat(messages, tools):  # 2 参契约:与非流式一致
            for piece in pieces:
                if on_delta is not None:
                    on_delta(piece)
            return {"role": "assistant", "content": full, "tool_calls": []}

        return chat

    monkeypatch.setattr(app_module, "build_deepseek_chat_fn", fake_build)

    agent = RetrievalAgent(ToolRegistry([]), lambda m, t: {"content": "", "tool_calls": []})
    settings = Settings(api_keys=frozenset({"test-key"}), llm_api_key="env-llm-key")
    client = TestClient(build_app(settings, agent=agent))

    with client.stream(
        "POST",
        "/v1/ask",
        json={"question": "为什么有选择性?", "stream": True},
        headers={"X-API-Key": "test-key"},
    ) as response:
        assert response.status_code == 200
        events = []
        for line in response.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))

    deltas = [event for event in events if event["type"] == "answer_delta"]
    assert [event["text"] for event in deltas] == pieces
    assert events[-1]["type"] == "done"
    assert events[-1]["answer"] == full
    assert "".join(event["text"] for event in deltas) == events[-1]["answer"]

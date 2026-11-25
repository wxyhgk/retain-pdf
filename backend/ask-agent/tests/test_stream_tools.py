"""接线的工具调用：三种协议流里的工具调用拼成完整的 (id, 名字, 参数)，下一轮按各家写法带回（思考签名、工具结果、页图、缓存断点）。HTTP 是假的。"""
from __future__ import annotations

import json
import threading

import pytest

from retainpdf_ask_agent_engine import stream as engine

TOOLS = [{"name": "read_page", "description": "读一页", "parameters": {"type": "object", "properties": {"page": {"type": "integer"}}}}]


class FakeResponse:
    def __init__(self, lines, status=200):
        self.lines = lines
        self.status_code = status
        self.encoding = None

    def iter_lines(self, decode_unicode=True):
        yield from self.lines

    def json(self):
        return {}

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def sse(*events):
    lines = []
    for name, data in events:
        if name:
            lines.append(f"event: {name}")
        lines.append("data: " + (data if isinstance(data, str) else json.dumps(data)))
        lines.append("")
    return lines


@pytest.fixture
def posts(monkeypatch):
    calls = []
    replies = []

    def fake_post(url, headers=None, json=None, stream=False, timeout=None):
        calls.append(json)
        return replies.pop(0)

    monkeypatch.setattr(engine.requests, "post", fake_post)
    return calls, replies


QUESTION = [{"role": "system", "content": "规则"}, {"role": "user", "content": "第 5 页讲了什么"}]


def _tool_turns(native, *, images=True):
    return [
        *QUESTION,
        {"role": "assistant", "content": "我先读一下。", "tool_calls": [{"id": "t1", "name": "read_page", "arguments": {"page": 5}}], "native": native},
        {"role": "tool", "tool_call_id": "t1", "name": "read_page", "content": "第 5 页的内容",
         "images": [{"mime_type": "image/jpeg", "data": "QUJD"}] if images else [], "is_error": False},
    ]


def test_anthropic_tool_use_deltas_and_replay_with_thinking_signature(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        ("message_start", {"type": "message_start", "message": {"usage": {"input_tokens": 30}}}),
        ("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "thinking", "thinking": "", "signature": ""}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "thinking_delta", "thinking": "读第 5 页"}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "signature_delta", "signature": "SIG"}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 0}),
        ("content_block_start", {"type": "content_block_start", "index": 1, "content_block": {"type": "text", "text": ""}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 1, "delta": {"type": "text_delta", "text": "我先读一下。"}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 1}),
        ("content_block_start", {"type": "content_block_start", "index": 2, "content_block": {"type": "tool_use", "id": "toolu_1", "name": "read_page", "input": {}}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 2, "delta": {"type": "input_json_delta", "partial_json": "{\"pa"}}),
        ("content_block_delta", {"type": "content_block_delta", "index": 2, "delta": {"type": "input_json_delta", "partial_json": "ge\": 5}"}}),
        ("content_block_stop", {"type": "content_block_stop", "index": 2}),
        ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "tool_use"}, "usage": {"output_tokens": 12}}),
    )))
    fn = engine.make_stream_fn(model="claude-haiku-5-5", base_url="", api_key="sk-test", protocol="anthropic", thinking="low")
    events = list(fn(QUESTION, threading.Event(), tools=TOOLS, tool_choice="auto"))
    assert ("tool_call", {"id": "toolu_1", "name": "read_page", "arguments": {"page": 5}}) in events
    native = next(value for kind, value in events if kind == "native")
    assert native == {"protocol": "anthropic", "content": [
        {"type": "thinking", "thinking": "读第 5 页", "signature": "SIG"},
        {"type": "text", "text": "我先读一下。"},
        {"type": "tool_use", "id": "toolu_1", "name": "read_page", "input": {"page": 5}},
    ]}
    body = calls[0]
    assert body["tools"] == [{"name": "read_page", "description": "读一页", "input_schema": TOOLS[0]["parameters"]}]
    assert body["tool_choice"] == {"type": "auto"}
    # 有工具时最后一条消息打缓存断点
    assert body["messages"][-1]["content"][-1]["cache_control"] == {"type": "ephemeral"}

    # 下一轮：思考块原样带回，工具结果和页图在用户消息的 tool_result 里
    replies.append(FakeResponse(sse(("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"output_tokens": 3}}))))
    list(fn(_tool_turns(native), threading.Event(), tools=TOOLS, tool_choice="none"))
    body = calls[1]
    assert body["tool_choice"] == {"type": "none"}
    assistant, result = body["messages"][-2], body["messages"][-1]
    assert assistant == {"role": "assistant", "content": native["content"]}
    block = result["content"][0]
    assert result["role"] == "user" and block["type"] == "tool_result" and block["tool_use_id"] == "t1"
    assert block["content"][0] == {"type": "text", "text": "第 5 页的内容"}
    assert block["content"][1] == {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "QUJD"}}
    assert block["cache_control"] == {"type": "ephemeral"}
    # 没有 native（换了协议、旧会话）时按中性写法拼
    replies.append(FakeResponse([]))
    list(fn(_tool_turns(None, images=False), threading.Event(), tools=TOOLS, tool_choice="auto"))
    assert calls[2]["messages"][-2]["content"] == [{"type": "text", "text": "我先读一下。"},
                                                    {"type": "tool_use", "id": "t1", "name": "read_page", "input": {"page": 5}}]


def test_openai_chat_tool_call_fragments_and_replay(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        (None, {"choices": [{"delta": {"reasoning_content": "要读"}}]}),
        (None, {"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "call_a", "type": "function", "function": {"name": "read_page", "arguments": ""}}]}}]}),
        (None, {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\"page\""}}]}}]}),
        (None, {"choices": [{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": ": 5}"}}]}}]}),
        (None, {"choices": [{"delta": {"tool_calls": [{"index": 1, "id": "", "function": {"name": "outline", "arguments": "{}"}}]}}]}),
        (None, {"choices": [{"delta": {}, "finish_reason": "tool_calls"}]}),
        (None, {"choices": [], "usage": {"prompt_tokens": 50, "completion_tokens": 9}}),
        (None, "[DONE]"),
    )))
    fn = engine.make_stream_fn(model="qwen3.8-flash", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", api_key="sk-test", protocol="openai")
    events = list(fn(QUESTION, threading.Event(), tools=TOOLS, tool_choice="auto"))
    tool_calls = [value for kind, value in events if kind == "tool_call"]
    assert tool_calls[0] == {"id": "call_a", "name": "read_page", "arguments": {"page": 5}}
    assert tool_calls[1]["name"] == "outline" and tool_calls[1]["id"].startswith("call_") and tool_calls[1]["arguments"] == {}
    assert ("native", {"protocol": "openai", "reasoning_content": "要读"}) in events
    assert calls[0]["tools"] == [{"type": "function", "function": {"name": "read_page", "description": "读一页", "parameters": TOOLS[0]["parameters"]}}]
    assert calls[0]["tool_choice"] == "auto"

    replies.append(FakeResponse(sse((None, {"choices": [{"delta": {"content": "答"}, "finish_reason": "stop"}]}))))
    list(fn(_tool_turns({"protocol": "openai", "reasoning_content": "要读"}), threading.Event(), tools=TOOLS, tool_choice="none"))
    messages = calls[1]["messages"]
    assert messages[-3] == {"role": "assistant", "content": "我先读一下。", "reasoning_content": "要读", "tool_calls": [
        {"id": "t1", "type": "function", "function": {"name": "read_page", "arguments": "{\"page\": 5}"}}]}
    assert messages[-2] == {"role": "tool", "tool_call_id": "t1", "content": "第 5 页的内容"}
    # 工具结果只能是文字：页图另起一条用户消息
    assert messages[-1]["role"] == "user" and messages[-1]["content"][1] == {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,QUJD"}}
    assert calls[1]["tool_choice"] == "none"


def test_openai_responses_function_calls_and_replay(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        ("response.output_item.added", {"type": "response.output_item.added", "item": {"type": "function_call", "id": "fc_1", "call_id": "call_r", "name": "read_page", "arguments": ""}}),
        ("response.function_call_arguments.delta", {"type": "response.function_call_arguments.delta", "delta": "{\"page\":5}"}),
        ("response.output_item.done", {"type": "response.output_item.done", "item": {"type": "function_call", "id": "fc_1", "call_id": "call_r", "name": "read_page", "arguments": "{\"page\":5}"}}),
        ("response.completed", {"type": "response.completed", "response": {"usage": {"input_tokens": 40, "output_tokens": 8}}}),
    )))
    fn = engine.make_stream_fn(model="gpt-5.5-mini", base_url="https://api.openai.com/v1", api_key="sk-test", protocol="openai_responses", thinking="low")
    events = list(fn(QUESTION, threading.Event(), tools=TOOLS, tool_choice="auto"))
    assert ("tool_call", {"id": "call_r", "name": "read_page", "arguments": {"page": 5}}) in events
    assert calls[0]["tools"] == [{"type": "function", "name": "read_page", "description": "读一页", "parameters": TOOLS[0]["parameters"], "strict": False}]

    replies.append(FakeResponse([]))
    list(fn(_tool_turns({"protocol": "openai_responses"}), threading.Event(), tools=TOOLS, tool_choice="none"))
    items = calls[1]["input"]
    assert items[-4:] == [
        {"role": "assistant", "content": "我先读一下。"},
        {"type": "function_call", "call_id": "t1", "name": "read_page", "arguments": "{\"page\": 5}"},
        {"type": "function_call_output", "call_id": "t1", "output": "第 5 页的内容"},
        {"role": "user", "content": [{"type": "input_text", "text": engine.IMAGES_NOTE}, {"type": "input_image", "image_url": "data:image/jpeg;base64,QUJD"}]},
    ]
    assert calls[1]["tool_choice"] == "none"


def test_bad_tool_arguments_are_passed_on_as_text(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        (None, {"choices": [{"delta": {"tool_calls": [{"index": 0, "id": "c", "function": {"name": "read_page", "arguments": "{page: 5"}}]}}]}),
    )))
    fn = engine.make_stream_fn(model="m", base_url="https://api.example.com/v1", api_key="k", protocol="openai")
    events = list(fn(QUESTION, threading.Event(), tools=TOOLS, tool_choice="auto"))
    assert ("tool_call", {"id": "c", "name": "read_page", "arguments": "{page: 5"}) in events

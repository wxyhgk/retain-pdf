"""接线：三种协议的流式解析（思考、正文、用量、缓存命中、停的原因）、Anthropic 的缓存断点和思考写法回退。HTTP 是假的。"""
from __future__ import annotations

import json
import threading

import pytest

from retainpdf_ask_agent_engine import stream as engine


class FakeResponse:
    def __init__(self, lines, status=200, payload=None):
        self.lines = lines
        self.status_code = status
        self.payload = payload or {}
        self.text = json.dumps(self.payload)
        self.encoding = None

    def iter_lines(self, decode_unicode=True):
        yield from self.lines

    def json(self):
        return self.payload

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
        calls.append({"url": url, "headers": headers, "body": json})
        return replies.pop(0)

    monkeypatch.setattr(engine.requests, "post", fake_post)
    return calls, replies


MESSAGES = [{"role": "system", "content": "规则"}, {"role": "user", "content": "问"}]


def run(fn, messages=MESSAGES):
    return list(fn(messages, threading.Event()))


def test_anthropic_thinking_text_usage_and_stop(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        ("message_start", {"type": "message_start", "message": {"usage": {"input_tokens": 20, "cache_read_input_tokens": 900, "cache_creation_input_tokens": 0}}}),
        ("content_block_delta", {"type": "content_block_delta", "delta": {"type": "thinking_delta", "thinking": "嗯"}}),
        ("content_block_delta", {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "答案"}}),
        ("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"output_tokens": 42}}),
        ("message_stop", {"type": "message_stop"}),
    )))
    fn = engine.make_stream_fn(model="claude-haiku-5-5", base_url="", api_key="sk-test", protocol="anthropic", thinking="low")
    events = run(fn)
    assert events == [("thought", "嗯"), ("text", "答案"), ("stop", "end_turn"),
                      ("usage", {"input_tokens": 920, "cache_read_tokens": 900, "cache_write_tokens": 0, "output_tokens": 42})]
    call = calls[0]
    assert call["url"].startswith("https://api.anthropic.com/v1/messages")
    assert call["body"]["stream"] is True and call["body"]["thinking"]["type"] == "adaptive"


def test_anthropic_marks_the_previous_answer_for_caching_and_falls_back_on_400(posts):
    calls, replies = posts
    replies.append(FakeResponse([], status=400, payload={"error": {"message": "adaptive thinking not supported"}}))
    replies.append(FakeResponse(sse(("message_delta", {"type": "message_delta", "delta": {"stop_reason": "max_tokens"}, "usage": {"output_tokens": 1}}))))
    history = [*MESSAGES, {"role": "assistant", "content": "上一轮的回答"}, {"role": "user", "content": "追问"}]
    fn = engine.make_stream_fn(model="claude-haiku-5-5", base_url="", api_key="sk-test", protocol="anthropic", thinking="high")
    assert ("stop", "max_tokens") in run(fn, history)
    assert len(calls) == 2 and calls[0]["body"]["thinking"] != calls[1]["body"].get("thinking")
    previous = calls[1]["body"]["messages"][-2]
    assert previous["role"] == "assistant" and previous["content"][-1]["cache_control"] == {"type": "ephemeral"}


def test_openai_chat_reasoning_content_and_cached_tokens(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        (None, {"choices": [{"delta": {"reasoning_content": "思考"}}]}),
        (None, {"choices": [{"delta": {"content": "回"}}]}),
        (None, {"choices": [{"delta": {"content": "答"}, "finish_reason": "stop"}]}),
        (None, {"choices": [], "usage": {"prompt_tokens": 300, "completion_tokens": 20, "prompt_tokens_details": {"cached_tokens": 256}}}),
        (None, "[DONE]"),
    )))
    fn = engine.make_stream_fn(model="qwen3.8-flash", base_url="https://dashscope.aliyuncs.com/compatible-mode/v1", api_key="sk-test", protocol="openai")
    events = run(fn)
    assert events[:4] == [("thought", "思考"), ("text", "回"), ("text", "答"), ("stop", "end_turn")]
    assert events[-1] == ("usage", {"input_tokens": 300, "output_tokens": 20, "cache_read_tokens": 256, "reasoning_tokens": 0})
    body = calls[0]["body"]
    assert body["stream"] is True and body["stream_options"] == {"include_usage": True}
    assert body["messages"][0] == {"role": "system", "content": "规则"}


def test_openai_responses_summary_and_completed_usage(posts):
    calls, replies = posts
    replies.append(FakeResponse(sse(
        ("response.reasoning_summary_text.delta", {"type": "response.reasoning_summary_text.delta", "delta": "概要"}),
        ("response.output_text.delta", {"type": "response.output_text.delta", "delta": "正文"}),
        ("response.completed", {"type": "response.completed", "response": {"usage": {
            "input_tokens": 50, "output_tokens": 10, "input_tokens_details": {"cached_tokens": 32}, "output_tokens_details": {"reasoning_tokens": 4}}}}),
    )))
    fn = engine.make_stream_fn(model="gpt-5.5-mini", base_url="https://api.openai.com/v1", api_key="sk-test", protocol="openai_responses", thinking="low")
    events = run(fn)
    assert events == [("thought", "概要"), ("text", "正文"),
                      ("usage", {"input_tokens": 50, "output_tokens": 10, "cache_read_tokens": 32, "reasoning_tokens": 4}),
                      ("stop", "end_turn")]
    assert calls[0]["body"]["reasoning"]["summary"] == "auto" and calls[0]["body"]["stream"] is True


def test_http_errors_and_cancel(posts):
    calls, replies = posts
    replies.append(FakeResponse([], status=401, payload={"error": {"message": "invalid x-api-key"}}))
    fn = engine.make_stream_fn(model="m", base_url="https://api.example.com/v1", api_key="sk-secret-value", protocol="openai")
    with pytest.raises(RuntimeError) as raised:
        run(fn)
    assert "401" in str(raised.value) and "sk-secret-value" not in str(raised.value)
    replies.append(FakeResponse(sse((None, {"choices": [{"delta": {"content": "一"}}]}), (None, {"choices": [{"delta": {"content": "二"}}]}))))
    cancel = threading.Event()
    events = []
    for event in fn(MESSAGES, cancel):
        events.append(event)
        cancel.set()
    assert events == [("text", "一")]

"""翻译 agent 接 OpenAI 协议（retainpdf_translation_agent_engine/agent_openai.py）：Anthropic 请求体 ↔ 共用请求层，不发网络请求。

- 通读、审校（强制用工具）→ 按工具的 schema 要 JSON，回答包成 tool_use；初译、重翻（纯文本）→ 原样包成 text；
- Anthropic 专有字段不往下传，请求标签分出通读、审校，token 换成 Anthropic 的字段名；
- Key 被拒、额度用完、一直限流 → agent 的 StopRun（保存进度停下）；别的错误原样抛；
- 任务登记成 OpenAI 协议时整条跑通：不走 Anthropic 的 transport，用量台账不重记。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import requests

from retainpdf_translation.artifacts.aggregator import get_active_translation_run_diagnostics
from retainpdf_translation.llm.shared import model_wire
from retainpdf_translation_agent_engine import agent_flow
from retainpdf_translation_agent_engine import agent_openai
from retainpdf_translation_agent_engine.agent_openai import make_openai_transport
from retainpdf_translation.workflow.execution import execute_translation_request
from retainpdf_translation_agent import AuthFailed
from retainpdf_translation_agent import QuotaExhausted
from retainpdf_translation_agent import RateLimited
from retainpdf_translation_agent import format_answer

import test_agent_flow as flow_tests

READING_TOOL = {
    "name": "submit_reading",
    "description": "交回通读结果",
    "input_schema": {"type": "object", "properties": {"genre": {"type": "string"}}, "additionalProperties": False},
}


def _body(*, tool: dict | None = None) -> dict:
    body = {
        "model": "gpt-test",
        "max_tokens": 16000,
        "system": [{"type": "text", "text": "你是译者。", "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": '{"blocks": []}'}],
    }
    if tool is not None:
        body.update(tools=[{**tool, "strict": True}], tool_choice={"type": "tool", "name": tool["name"]})
    else:
        body.update(thinking={"type": "adaptive"}, output_config={"effort": "low"})
    return body


class Chat:
    """假的 request_chat_content：记下参数，按顺序交回 `answers`，往当前诊断里记一份 OpenAI 的 usage。"""

    def __init__(self, *answers: str | BaseException) -> None:
        self.answers = list(answers)
        self.calls: list[dict] = []

    def __call__(self, messages, **kwargs):  # noqa: ANN001, ANN003
        self.calls.append({"messages": messages, **kwargs})
        answer = self.answers.pop(0) if self.answers else ""
        if isinstance(answer, BaseException):
            raise answer
        diagnostics = get_active_translation_run_diagnostics()
        assert diagnostics is not None, "each request runs inside its own diagnostics scope"
        diagnostics.record_token_usage({"prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150,
                                        "prompt_tokens_details": {"cached_tokens": 100}})
        return answer


def _transport(chat: Chat, protocol: str = "openai_responses"):
    return make_openai_transport(api_key="sk-job", model="gpt-test", base_url="https://api.openai.com/v1",
                                 protocol=protocol, chat=chat)


def test_a_tool_request_asks_for_json_and_comes_back_as_tool_use() -> None:
    chat = Chat('```json\n{"genre": "science_paper"}\n```')
    response = _transport(chat)(_body(tool=READING_TOOL))

    call = chat.calls[0]
    assert call["response_format"] == {
        "type": "json_schema",
        "json_schema": {
            "name": "submit_reading",
            # 可选字段换成必填、可为 null（OpenAI strict 的写法，#163）
            "schema": {"type": "object", "properties": {"genre": {"type": ["string", "null"]}},
                       "additionalProperties": False, "required": ["genre"]},
            "strict": True,
        },
    }
    assert call["request_label"] == "agent-read" and call["protocol"] == "openai_responses"
    assert call["api_key"] == "sk-job" and call["model"] == "gpt-test"
    system = call["messages"][0]
    assert system["role"] == "system" and system["content"].startswith("你是译者。")
    assert "submit_reading" in system["content"] and '"genre"' in system["content"], "the schema is in the prompt for json_object fallbacks"
    assert call["messages"][1] == {"role": "user", "content": '{"blocks": []}'}
    assert response["content"] == [{"type": "tool_use", "name": "submit_reading", "input": {"genre": "science_paper"}}]
    assert response["usage"] == {"input_tokens": 20, "cache_read_input_tokens": 100, "output_tokens": 30}


def test_a_plain_request_comes_back_as_text_without_anthropic_only_fields() -> None:
    chat = Chat("@@ p001-b001\n译文")
    response = _transport(chat, protocol="openai")(_body())
    call = chat.calls[0]
    assert call["response_format"] is None and call["request_label"] == "agent-translate"
    assert set(call) == {"messages", "api_key", "model", "base_url", "temperature", "response_format", "timeout",
                         "request_label", "protocol", "thinking"}
    assert all("cache_control" not in json.dumps(m) for m in call["messages"])
    assert response["content"] == [{"type": "text", "text": "@@ p001-b001\n译文"}]


def test_nulls_for_optional_fields_come_back_as_missing_fields() -> None:
    """strict 下可选字段交回 null：去掉这个键，agent 看到的和以前「没写」一样（#163）。"""
    answer = json.dumps({"genre": "book", "domain": None,
                         "terms": [{"source": "field", "target": "田野", "category": "term", "chapters": None, "note": None}]})
    response = _transport(Chat(answer))(_body(tool=READING_TOOL))
    assert response["content"][0]["input"] == {"genre": "book", "terms": [{"source": "field", "target": "田野", "category": "term"}]}


def test_a_tool_answer_that_is_not_json_is_not_a_tool_call() -> None:
    response = _transport(Chat("我不会"))(_body(tool=dict(READING_TOOL, name="submit_review")))
    assert response["content"] == [{"type": "text", "text": "我不会"}]
    assert agent_openai.openai_request(_body(tool=dict(READING_TOOL, name="submit_review")))[2] == "agent-review"


def _http_error(status: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status
    return requests.HTTPError(f"{status} error", response=response)


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (_http_error(401), AuthFailed),
        (_http_error(403), AuthFailed),
        (_http_error(402), QuotaExhausted),
        (_http_error(429), RateLimited),
        (_http_error(503), RateLimited),
        (requests.ConnectionError("reset"), RateLimited),
    ],
)
def test_upstream_failures_stop_the_run_so_progress_is_kept(error: BaseException, expected: type) -> None:
    with pytest.raises(expected):
        _transport(Chat(error))(_body())


def test_other_errors_are_raised_as_they_are() -> None:
    with pytest.raises(requests.HTTPError):
        _transport(Chat(_http_error(400)))(_body())
    with pytest.raises(AuthFailed):
        make_openai_transport(api_key="", model="m", base_url="u", protocol="openai")


def test_an_openai_job_runs_the_whole_agent_through_the_shared_request_layer(tmp_path: Path, monkeypatch) -> None:
    """任务登记成 openai_responses：不走 Anthropic 的 transport，假模型（同 test_agent_flow）经换算整条跑通。"""

    def no_anthropic(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("an OpenAI job must not use the Anthropic transport")

    model = flow_tests.FakeModel()

    def chat(messages, *, response_format, request_label, **kwargs):  # noqa: ANN001, ANN003
        # 把换算后的请求还原成 FakeModel 认的 Anthropic 请求体，看回答能不能原样换回来
        body = {"messages": [m for m in messages if m["role"] == "user"]}
        if response_format is not None:
            body["tools"] = [{"name": response_format["json_schema"]["name"]}]
        answer = model(body)
        part = answer["content"][0]
        return json.dumps(part["input"], ensure_ascii=False) if part["type"] == "tool_use" else part["text"]

    ledger = tmp_path / "usage.jsonl"
    monkeypatch.setenv("RETAIN_USAGE_LEDGER", str(ledger))
    monkeypatch.setattr(agent_flow, "make_http_transport", no_anthropic)
    monkeypatch.setattr(agent_openai, "request_chat_content", chat)
    base_url = "https://api.openai.com/v1"
    model_wire.register_connection(base_url=base_url, model="gpt-test", protocol="openai_responses", thinking="auto")
    try:
        execute_translation_request(flow_tests._request(tmp_path, model="gpt-test", base_url=base_url))
    finally:
        model_wire.clear_registered_connections()

    tools = [b["tools"][0]["name"] if "tools" in b else "plain_text" for b in model.bodies]
    assert tools[0] == "submit_reading" and tools.count("submit_review") == 2, tools
    items = flow_tests._pages(tmp_path / "translated")
    assert items["p001-b001"]["translated_text"].startswith("译文：") and "$ ^{12} $" in items["p001-b001"]["translated_text"]
    assert items["p002-b001"]["final_status"] == "translated"
    assert not ledger.exists() or not ledger.read_text(encoding="utf-8").strip(), "the shared layer records usage, agent_flow must not"


def test_the_read_only_tool_loop_is_refused_instead_of_forced_into_json() -> None:
    """初译的多轮只读工具（tool_choice auto）共用请求层还不支持：报错，不能被当成强制交卷的 JSON 请求。"""
    body = _body()
    body.update(tools=[{**READING_TOOL, "name": "search_book"}, {**READING_TOOL, "name": "lookup_term"}], tool_choice={"type": "auto"})
    with pytest.raises(ValueError, match="not supported over the OpenAI protocol"):
        agent_openai.openai_request(body)

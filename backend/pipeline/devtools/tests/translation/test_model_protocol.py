"""接口协议（OpenAI Chat / OpenAI Responses / Anthropic）与思考深度：请求长什么样、服务商不认时怎么退。"""
from unittest import mock

import pytest
import requests

from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.llm.shared import model_wire


def _response(status=200, payload=None, text=""):
    response = mock.Mock()
    response.status_code = status
    response.reason = "Bad Request" if status == 400 else "OK"
    response.url = "https://example.test"
    response.text = text
    response.json.return_value = payload or {}
    return response


def _call(responses, **kwargs):
    session = mock.Mock()
    session.post.side_effect = list(responses)
    diagnostics = kwargs.pop("diagnostics", None)
    with mock.patch.object(client, "get_session", return_value=session), \
         mock.patch.object(client, "get_active_translation_run_diagnostics", return_value=diagnostics), \
         mock.patch.object(client, "_prewarm_dns"), \
         mock.patch.object(client, "should_use_stream_responses", return_value=False):
        content = client.request_chat_content(**kwargs)
    return content, session


@pytest.fixture(autouse=True)
def _clean_registry():
    model_wire.clear_registered_connections()
    yield
    model_wire.clear_registered_connections()


ANTHROPIC_OK = {
    "content": [{"type": "thinking", "thinking": "…"}, {"type": "text", "text": "译文"}],
    "stop_reason": "end_turn",
    "usage": {"input_tokens": 100, "output_tokens": 20, "cache_read_input_tokens": 40},
}


def test_anthropic_protocol_uses_messages_api():
    content, session = _call(
        [_response(payload=ANTHROPIC_OK)],
        messages=[
            {"role": "system", "content": "你是译者。"},
            {"role": "user", "content": "Translate A"},
            {"role": "user", "content": "Translate B"},
        ],
        api_key="k",
        model="claude-sonnet-5",
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        thinking="off",
    )
    assert content == "译文"
    call = session.post.call_args
    assert call.args[0] == "https://api.anthropic.com/v1/messages"
    assert call.kwargs["headers"]["x-api-key"] == "k"
    assert call.kwargs["headers"]["anthropic-version"] == model_wire.ANTHROPIC_VERSION
    assert "Authorization" not in call.kwargs["headers"]
    body = call.kwargs["json"]
    assert body["system"] == "你是译者。"
    # 相邻的 user 消息合并成一条，Messages API 要求角色交替。
    assert body["messages"] == [{"role": "user", "content": "Translate A\n\nTranslate B"}]
    assert body["max_tokens"] == model_wire.ANTHROPIC_DEFAULT_MAX_TOKENS
    # "关思考"发最低档：新模型（Haiku 5.5 等）不发思考字段会按默认 effort（medium）思考；disabled 会让短标题不翻（2026-10-31）
    assert body["thinking"] == {"type": "adaptive"} and body["output_config"] == {"effort": "low"}
    assert "temperature" not in body


# claude-opus-5-5 原话（真实请求拿到的）：思考深度为「默认 / 关闭」时会带 temperature，被拒 400。
# 文档写明不收 temperature 的模型（opus-5-5 也在内）现在一开始就不带；"挨一次 400 再记住"用一个没登记的模型名测。
LEARNING_MODEL = "claude-next-unlisted"
ANTHROPIC_TEMPERATURE_REJECTED = (
    '{"type":"error","error":{"type":"invalid_request_error",'
    '"message":"`temperature` is deprecated for this model."}}'
)


def _anthropic_call(responses, *, thinking="auto", base_url="https://api.anthropic.com/v1"):
    return _call(
        responses,
        messages=[{"role": "user", "content": "Translate A"}],
        api_key="k",
        model=LEARNING_MODEL,
        base_url=base_url,
        protocol="anthropic",
        thinking=thinking,
    )


@pytest.mark.parametrize("thinking", ["auto"])
def test_anthropic_temperature_rejection_retries_without_it_and_remembers(thinking):
    rejected = _response(400, text=ANTHROPIC_TEMPERATURE_REJECTED)
    content, session = _anthropic_call([rejected, _response(payload=ANTHROPIC_OK)], thinking=thinking)
    assert content == "译文"
    first, second = (call.kwargs["json"] for call in session.post.call_args_list)
    assert first["temperature"] == 0.2
    assert "temperature" not in second
    # 记住了：同一个模型的下一次请求一开始就不带，不再先挨一次 400。
    content, session = _anthropic_call([_response(payload=ANTHROPIC_OK)], thinking=thinking)
    assert content == "译文"
    assert session.post.call_count == 1
    assert "temperature" not in session.post.call_args.kwargs["json"]


def test_a_400_that_merely_mentions_temperature_is_not_a_rejection():
    # 比如网关把支持的参数列一遍：不是在拒 temperature，不重试、也不能记住——否则这个模型就永远不带了。
    other = _response(400, text='{"error":{"message":"max_tokens too large; allowed: temperature, top_p, max_tokens"}}')
    with pytest.raises(requests.HTTPError):
        _anthropic_call([other], thinking="auto")
    assert not model_wire.temperature_rejected(base_url="https://api.anthropic.com/v1", model=LEARNING_MODEL)


def test_temperature_is_remembered_only_after_the_retry_succeeds():
    rejected = _response(400, text=ANTHROPIC_TEMPERATURE_REJECTED)
    still_bad = _response(400, text='{"error":{"message":"messages: at least one message is required"}}')
    with pytest.raises(requests.HTTPError):
        _anthropic_call([rejected, still_bad], thinking="auto")
    assert not model_wire.temperature_rejected(base_url="https://api.anthropic.com/v1", model=LEARNING_MODEL)


def test_temperature_memo_is_per_model():
    _anthropic_call([_response(400, text=ANTHROPIC_TEMPERATURE_REJECTED), _response(payload=ANTHROPIC_OK)])
    _, session = _call(
        [_response(payload=ANTHROPIC_OK)],
        messages=[{"role": "user", "content": "Translate A"}],
        api_key="k",
        model="claude-sonnet-5",
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        thinking="auto",
    )
    assert session.post.call_args.kwargs["json"]["temperature"] == 0.2


@pytest.mark.parametrize("model", ["claude-haiku-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-opus-4-7"])
def test_documented_no_temperature_models_never_get_it_even_on_the_first_request(model):
    # 2026-10-30：一本书开头几路请求同时发，每个任务都有 4—9 个请求先挨 400 再重发
    _, session = _call(
        [_response(payload=ANTHROPIC_OK)],
        messages=[{"role": "user", "content": "Translate A"}],
        api_key="k",
        model=model,
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        thinking="off",
    )
    assert session.post.call_count == 1
    assert "temperature" not in session.post.call_args.kwargs["json"]


@pytest.mark.parametrize("thinking", ["low", "high"])
def test_anthropic_never_sends_temperature_with_thinking(thinking):
    _, session = _anthropic_call([_response(payload=ANTHROPIC_OK)], thinking=thinking)
    body = session.post.call_args.kwargs["json"]
    assert "thinking" in body or "output_config" in body
    assert "temperature" not in body


@pytest.mark.parametrize(
    "base",
    [
        "https://api.anthropic.com",
        "https://api.anthropic.com/",
        "https://api.anthropic.com/v1",
        "https://api.anthropic.com/v1/messages",
        "   ",
    ],
)
def test_anthropic_accepts_the_sdk_style_base_url(base):
    # 官方 SDK 的地址不带 /v1；以前会请求到 https://api.anthropic.com/messages，回 404。
    _, session = _anthropic_call([_response(payload=ANTHROPIC_OK)], base_url=base)
    assert session.post.call_args.args[0] == "https://api.anthropic.com/v1/messages"


def test_anthropic_compatible_proxy_follows_the_sdk_convention():
    assert (
        model_wire.anthropic_messages_url("https://proxy.example.com/anthropic")
        == "https://proxy.example.com/anthropic/v1/messages"
    )


def test_anthropic_usage_is_recorded_in_openai_shape():
    diagnostics = mock.Mock()
    diagnostics.record_request_start.return_value = 1
    _call(
        [_response(payload=ANTHROPIC_OK)],
        messages=[{"role": "user", "content": "x"}],
        model="claude-sonnet-5",
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        diagnostics=diagnostics,
    )
    diagnostics.record_token_usage.assert_called_once_with({
        "prompt_tokens": 140,
        "completion_tokens": 20,
        "total_tokens": 160,
        "prompt_cache_hit_tokens": 40,
        "prompt_cache_miss_tokens": 100,
        "prompt_cache_write_tokens": 0,
    })


def test_anthropic_thinking_falls_back_from_adaptive_to_budget():
    rejected = _response(400, text='{"error":{"message":"thinking.type: adaptive is not supported"}}')
    content, session = _call(
        [rejected, _response(payload=ANTHROPIC_OK)],
        messages=[{"role": "user", "content": "x"}],
        model="claude-sonnet-4",
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        thinking="high",
    )
    assert content == "译文"
    first = session.post.call_args_list[0].kwargs["json"]
    second = session.post.call_args_list[1].kwargs["json"]
    assert first["thinking"] == {"type": "adaptive"}
    assert first["output_config"] == {"effort": "high"}
    assert "temperature" not in first
    assert second["thinking"] == {"type": "enabled", "budget_tokens": 16384}
    assert second["max_tokens"] == model_wire.ANTHROPIC_DEFAULT_MAX_TOKENS + 16384
    assert "output_config" not in second


def test_anthropic_json_schema_becomes_a_system_instruction():
    schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}}
    _, session = _call(
        [_response(payload=ANTHROPIC_OK)],
        messages=[{"role": "system", "content": "s"}, {"role": "user", "content": "x"}],
        model="claude-sonnet-5",
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        response_format={"type": "json_schema", "json_schema": {"name": "r", "schema": schema}},
    )
    body = session.post.call_args.kwargs["json"]
    assert "response_format" not in body
    assert body["system"].startswith("s\n\n只输出一个 JSON 对象")
    assert '"ok"' in body["system"]


def test_registered_connection_is_used_without_explicit_arguments():
    model_wire.register_connection(
        base_url="https://proxy.example.com/v1/", model="Claude-X", protocol="anthropic", thinking="low"
    )
    _, session = _call(
        [_response(payload=ANTHROPIC_OK)],
        messages=[{"role": "user", "content": "x"}],
        model="claude-x",
        base_url="https://proxy.example.com/v1",
    )
    assert session.post.call_args.args[0] == "https://proxy.example.com/v1/messages"
    assert session.post.call_args.kwargs["json"]["output_config"] == {"effort": "low"}


def test_explicit_arguments_override_the_registry():
    model_wire.register_connection(base_url="https://x.test/v1", model="m", protocol="anthropic", thinking="high")
    _, session = _call(
        [_response(payload={"choices": [{"message": {"content": "ok"}}]})],
        messages=[{"role": "user", "content": "x"}],
        model="m",
        base_url="https://x.test/v1",
        protocol="openai",
        thinking="off",
    )
    assert session.post.call_args.args[0] == "https://x.test/v1/chat/completions"
    assert session.post.call_args.kwargs["json"]["reasoning_effort"] == "none"


OPENAI_OK = {"choices": [{"message": {"content": "ok"}}]}


def test_openai_protocol_drops_temperature_for_documented_no_temperature_models():
    # 经 OpenAI 兼容地址调 claude-haiku-5-5：以前 /chat/completions 照样带 temperature，直接 400
    _, session = _call(
        [_response(payload=OPENAI_OK)],
        messages=[{"role": "user", "content": "x"}],
        api_key="k",
        model="claude-haiku-5-5",
        base_url="https://api.anthropic.com/v1",
    )
    assert "temperature" not in session.post.call_args.kwargs["json"]


def test_openai_protocol_keeps_temperature_for_other_models():
    _, session = _call(
        [_response(payload=OPENAI_OK)],
        messages=[{"role": "user", "content": "x"}],
        api_key="k",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        temperature=0.2,
    )
    assert session.post.call_args.kwargs["json"]["temperature"] == 0.2


@pytest.mark.parametrize("base,model,thinking,expected", [
    ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen3.8-flash", "off", {"enable_thinking": False}),
    ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen3.8-flash", "medium",
     {"enable_thinking": True, "thinking_budget": 8192}),
    ("https://open.bigmodel.cn/api/paas/v4", "glm-5.3-flash", "max", {"reasoning_effort": "max"}),
    ("https://open.bigmodel.cn/api/paas/v4", "glm-5.3-flash", "off", {"thinking": {"type": "disabled"}}),
    ("https://api.openai.com/v1", "gpt-5.6-luna", "max", {"reasoning_effort": "xhigh"}),
    ("https://api.openai.com/v1", "gpt-5.6-luna", "off", {"reasoning_effort": "none"}),
    ("https://llm.example.com/v1", "m", "high", {"reasoning_effort": "high"}),
    ("https://llm.example.com/v1", "m", "auto", {}),
])
def test_openai_thinking_fields(base, model, thinking, expected):
    _, session = _call(
        [_response(payload=OPENAI_OK)],
        messages=[{"role": "user", "content": "x"}],
        model=model,
        base_url=base,
        thinking=thinking,
    )
    body = session.post.call_args.kwargs["json"]
    for field in ("enable_thinking", "thinking_budget", "reasoning_effort", "thinking"):
        if field in expected:
            assert body[field] == expected[field], field
        else:
            assert field not in body, field


def test_openai_thinking_rejection_falls_back_to_no_fields():
    rejected = _response(400, text='{"error":{"message":"Unrecognized request argument: reasoning_effort"}}')
    content, session = _call(
        [rejected, _response(payload=OPENAI_OK)],
        messages=[{"role": "user", "content": "x"}],
        model="m",
        base_url="https://llm.example.com/v1",
        thinking="high",
    )
    assert content == "ok"
    assert session.post.call_args_list[0].kwargs["json"]["reasoning_effort"] == "high"
    assert "reasoning_effort" not in session.post.call_args_list[1].kwargs["json"]


def test_unrelated_400_still_uses_the_schema_fallback_first():
    rejected = _response(400, text='{"error":{"message":"response_format json_schema unsupported"}}')
    _, session = _call(
        [rejected, _response(payload=OPENAI_OK)],
        messages=[{"role": "user", "content": "x"}],
        model="m",
        base_url="https://llm.example.com/v1",
        thinking="high",
        response_format={"type": "json_schema", "json_schema": {"name": "r", "schema": {"type": "object"}}},
    )
    second = session.post.call_args_list[1].kwargs["json"]
    assert second["response_format"] == {"type": "json_object"}
    assert second["reasoning_effort"] == "high"


RESPONSES_OK = {
    "status": "completed",
    "output": [
        {"type": "reasoning", "summary": []},
        {"type": "message", "role": "assistant", "content": [
            {"type": "output_text", "text": "译", "annotations": []},
            {"type": "output_text", "text": "文", "annotations": []},
        ]},
    ],
    "usage": {
        "input_tokens": 120,
        "input_tokens_details": {"cached_tokens": 100},
        "output_tokens": 30,
        "output_tokens_details": {"reasoning_tokens": 12},
        "total_tokens": 150,
    },
}


def _responses_call(responses, **kwargs):
    kwargs.setdefault("messages", [{"role": "user", "content": "x"}])
    kwargs.setdefault("api_key", "k")
    kwargs.setdefault("model", "gpt-5.6-luna")
    kwargs.setdefault("base_url", "https://api.openai.com/v1")
    kwargs.setdefault("protocol", "openai_responses")
    return _call(responses, **kwargs)


def test_responses_protocol_uses_the_responses_api():
    content, session = _responses_call(
        [_response(payload=RESPONSES_OK)],
        messages=[
            {"role": "system", "content": "你是译者。"},
            {"role": "system", "content": "术语表：……"},
            {"role": "user", "content": "Translate A"},
            {"role": "assistant", "content": "译 A"},
            {"role": "user", "content": "Translate B"},
        ],
        thinking="auto",
    )
    assert content == "译文"
    call = session.post.call_args
    assert call.args[0] == "https://api.openai.com/v1/responses"
    assert call.kwargs["headers"]["Authorization"] == "Bearer k"
    assert call.kwargs["stream"] is False
    body = call.kwargs["json"]
    assert body["instructions"] == "你是译者。\n\n术语表：……"
    assert body["input"] == [
        {"role": "user", "content": "Translate A"},
        {"role": "assistant", "content": "译 A"},
        {"role": "user", "content": "Translate B"},
    ]
    assert body["store"] is False
    assert body["temperature"] == 0.2
    assert "messages" not in body and "reasoning" not in body and "max_output_tokens" not in body


@pytest.mark.parametrize("base", [
    "https://api.openai.com/v1/",
    "https://api.openai.com/v1/responses",
    "https://api.openai.com/v1/chat/completions",
])
def test_responses_url_accepts_a_full_endpoint(base):
    assert model_wire.responses_url(base) == "https://api.openai.com/v1/responses"


def test_responses_usage_is_recorded_in_openai_shape():
    diagnostics = mock.Mock()
    diagnostics.record_request_start.return_value = 1
    _responses_call([_response(payload=RESPONSES_OK)], diagnostics=diagnostics)
    diagnostics.record_token_usage.assert_called_once_with({
        "prompt_tokens": 120,
        "completion_tokens": 30,
        "total_tokens": 150,
        "prompt_cache_hit_tokens": 100,
        "prompt_cache_miss_tokens": 20,
        "completion_tokens_details": {"reasoning_tokens": 12},
    })


@pytest.mark.parametrize("thinking,first_effort", [
    ("off", "none"), ("low", "low"), ("medium", "medium"), ("high", "high"), ("max", "xhigh"),
])
def test_responses_thinking_maps_to_reasoning_effort(thinking, first_effort):
    _, session = _responses_call([_response(payload=RESPONSES_OK)], thinking=thinking)
    body = session.post.call_args.kwargs["json"]
    assert body["reasoning"] == {"effort": first_effort}
    # 推理模型只在不思考（effort=none）时接受 temperature。
    assert ("temperature" in body) == (first_effort == "none")


@pytest.mark.parametrize("base,model,expected", [
    ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen3.8-flash", {"effort": "none"}),
    ("https://open.bigmodel.cn/api/paas/v4", "glm-5.3-flash", {"effort": "low"}),
    ("https://api.openai.com/v1", "gpt-5.6-luna", None),
])
def test_responses_auto_thinking_reuses_the_tested_chat_rules(base, model, expected):
    _, session = _responses_call([_response(payload=RESPONSES_OK)], base_url=base, model=model, thinking="auto")
    assert session.post.call_args.kwargs["json"].get("reasoning") == expected


def test_responses_thinking_rejection_steps_down_then_drops_the_field():
    rejected = _response(400, text='{"error":{"message":"Unsupported value: \'reasoning.effort\' does not support \'xhigh\'"}}')
    content, session = _responses_call(
        [rejected, rejected, _response(payload=RESPONSES_OK)],
        thinking="max",
    )
    assert content == "译文"
    sent = [call.kwargs["json"].get("reasoning") for call in session.post.call_args_list]
    assert sent == [{"effort": "xhigh"}, {"effort": "high"}, None]


def test_responses_temperature_rejection_retries_without_it():
    rejected = _response(400, text='{"error":{"message":"Unsupported parameter: \'temperature\' is not supported with this model."}}')
    content, session = _responses_call([rejected, _response(payload=RESPONSES_OK)], thinking="auto")
    assert content == "译文"
    first, second = (call.kwargs["json"] for call in session.post.call_args_list)
    assert first["temperature"] == 0.2
    assert "temperature" not in second


def test_responses_structured_output_goes_to_text_format_and_falls_back():
    schema = {"type": "object", "properties": {"t": {"type": "string"}}}
    rejected = _response(400, text='{"error":{"message":"Invalid schema for response_format"}}')
    _, session = _responses_call(
        [rejected, _response(payload=RESPONSES_OK)],
        response_format={"type": "json_schema", "json_schema": {"name": "batch", "schema": schema, "strict": True}},
    )
    first, second = (call.kwargs["json"] for call in session.post.call_args_list)
    assert first["text"] == {"format": {"type": "json_schema", "name": "batch", "schema": schema, "strict": True}}
    assert second["text"] == {"format": {"type": "json_object"}}
    assert "response_format" not in first


@pytest.mark.parametrize("payload,needle", [
    ({"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"},
      "output": [{"type": "reasoning", "summary": []}]}, "max_output_tokens"),
    ({"status": "completed", "output": [{"type": "message", "content": [
        {"type": "refusal", "refusal": "I can't help with that."}]}]}, "refused"),
    ({"status": "failed", "error": {"code": "server_error", "message": "boom"}, "output": []}, "server_error"),
])
def test_responses_without_text_raise(payload, needle):
    with pytest.raises(ValueError, match=needle):
        model_wire.responses_content(payload)


def test_registered_responses_connection_is_used_without_explicit_arguments():
    model_wire.register_connection(base_url="https://api.openai.com/v1", model="gpt-5.6-luna",
                                   protocol="openai_responses", thinking="low")
    _, session = _call(
        [_response(payload=RESPONSES_OK)],
        messages=[{"role": "user", "content": "x"}],
        api_key="k", model="gpt-5.6-luna", base_url="https://api.openai.com/v1",
    )
    assert session.post.call_args.args[0].endswith("/responses")
    assert session.post.call_args.kwargs["json"]["reasoning"] == {"effort": "low"}


def test_normalizers_fall_back_to_defaults():
    assert model_wire.normalize_protocol("Anthropic") == "anthropic"
    assert model_wire.normalize_protocol("OpenAI_Responses") == "openai_responses"
    assert model_wire.normalize_protocol("gemini") == "openai"
    assert model_wire.normalize_thinking("HIGH") == "high"
    assert model_wire.normalize_thinking("") == "auto"


def test_stage_registration_keeps_translation_thinking_when_reviewer_shares_the_model():
    model_wire.register_stage_connections(
        model="m", base_url="https://x.test/v1", api_protocol="openai", thinking="off",
        reviewer_thinking="high",
    )
    assert model_wire.resolve_profile(base_url="https://x.test/v1", model="m").thinking == "off"


def test_stage_registration_registers_a_separate_reviewer():
    model_wire.register_stage_connections(
        model="m", base_url="https://x.test/v1", api_protocol="openai", thinking="off",
        reviewer_model="claude-x", reviewer_base_url="https://api.anthropic.com/v1",
        reviewer_api_protocol="anthropic", reviewer_thinking="",
    )
    reviewer = model_wire.resolve_profile(base_url="https://api.anthropic.com/v1", model="claude-x")
    assert (reviewer.protocol, reviewer.thinking) == ("anthropic", "off")


def test_translate_entrypoint_registers_the_spec_connection(tmp_path):
    from types import SimpleNamespace

    from retainpdf_pipeline.translate.entrypoints import translate_only_pipeline

    params = SimpleNamespace(
        model="claude-x", base_url="https://api.anthropic.com/v1", api_protocol="anthropic", thinking="low",
        reviewer_model="", reviewer_base_url="", reviewer_api_protocol="", reviewer_thinking="",
    )
    spec = SimpleNamespace(params=params, job_dirs=None)
    try:
        translate_only_pipeline._args_from_spec(spec)
    except AttributeError:
        pass  # 只关心登记发生在组装参数之前
    profile = model_wire.resolve_profile(base_url="https://api.anthropic.com/v1", model="claude-x")
    assert (profile.protocol, profile.thinking) == ("anthropic", "low")


# ---- 提示词缓存与真关思考（2026-10-31）----

LONG_RULES = "规则。" * 700  # 第一段 system：全书不变的规则，够长才打缓存断点


def _anthropic_with_system(parts, *, thinking="off", model="claude-haiku-5-5", responses=None):
    messages = [{"role": "system", "content": part} for part in parts] + [{"role": "user", "content": "Translate A"}]
    return _call(
        responses or [_response(payload=ANTHROPIC_OK)],
        messages=messages,
        api_key="k",
        model=model,
        base_url="https://api.anthropic.com/v1",
        protocol="anthropic",
        thinking=thinking,
    )


def test_the_stable_system_part_gets_a_cache_breakpoint_and_the_guidance_follows_uncached():
    _, session = _anthropic_with_system([LONG_RULES, "Document-specific translation guidance:\n计算化学"])
    system = session.post.call_args.kwargs["json"]["system"]
    assert system == [
        {"type": "text", "text": LONG_RULES, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": "Document-specific translation guidance:\n计算化学"},
    ]


def test_a_short_system_prompt_is_not_worth_caching_and_stays_a_string():
    _, session = _anthropic_with_system(["你是译者。", "指导"])
    assert session.post.call_args.kwargs["json"]["system"] == "你是译者。\n\n指导"


def test_prompt_cache_can_be_turned_off(monkeypatch):
    monkeypatch.setenv(model_wire.PROMPT_CACHE_ENV, "off")
    _, session = _anthropic_with_system([LONG_RULES, "指导"])
    assert session.post.call_args.kwargs["json"]["system"] == f"{LONG_RULES}\n\n指导"


def test_openai_style_protocols_get_one_system_message_with_the_stable_part_first():
    _, session = _call(
        [_response(payload={"choices": [{"message": {"content": "译文"}}]})],
        messages=[{"role": "system", "content": "规则"}, {"role": "system", "content": "指导"}, {"role": "user", "content": "A"}],
        api_key="k",
        model="qwen3.8-flash",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        thinking="off",
    )
    body = session.post.call_args.kwargs["json"]
    assert body["messages"] == [{"role": "system", "content": "规则\n\n指导"}, {"role": "user", "content": "A"}]
    assert body["enable_thinking"] is False


ADAPTIVE_REJECTED = (
    '{"type":"error","error":{"type":"invalid_request_error","message":"adaptive thinking is not supported on this model"}}'
)
LOW = {"thinking": {"type": "adaptive"}, "output_config": {"effort": "low"}}


def test_off_asks_new_models_for_the_lowest_effort():
    _, session = _anthropic_with_system(["你是译者。"])
    body = session.post.call_args.kwargs["json"]
    assert {k: body[k] for k in LOW} == LOW


def test_an_old_model_that_rejects_adaptive_thinking_is_remembered_after_one_400():
    rejected = _response(400, text=ADAPTIVE_REJECTED)
    content, session = _anthropic_with_system(["你是译者。"], model="claude-sonnet-4", responses=[rejected, _response(payload=ANTHROPIC_OK)])
    assert content == "译文"
    first, second = (call.kwargs["json"] for call in session.post.call_args_list)
    assert first["thinking"] == {"type": "adaptive"} and "thinking" not in second and "output_config" not in second
    _, session = _anthropic_with_system(["你是译者。"], model="claude-sonnet-4")
    assert session.post.call_count == 1 and "thinking" not in session.post.call_args.kwargs["json"]


def test_an_unrelated_400_does_not_stop_us_asking_for_low_effort_later():
    other = _response(400, text='{"error":{"message":"messages: text content blocks must be non-empty"}}')
    with pytest.raises(requests.HTTPError):
        _anthropic_with_system(["你是译者。"], responses=[other, other])
    _, session = _anthropic_with_system(["你是译者。"])
    assert session.post.call_args.kwargs["json"]["thinking"] == {"type": "adaptive"}


def test_auto_gives_haiku_5_5_the_low_effort_it_was_tested_with_and_leaves_others_alone():
    assert model_wire.anthropic_thinking_candidates("auto", model="claude-haiku-5-5")[0] == LOW
    assert model_wire.anthropic_thinking_candidates("auto", model="claude-sonnet-5") == [{}]

"""回答不完整、单次请求太长（2026-11-23，``llm/shared/output_limits.py``）。

- HTTP 200 但译文没写完（Chat ``finish_reason`` = length / content_filter、Responses ``status=incomplete``、Anthropic
  ``stop_reason`` = max_tokens / model_context_window_exceeded / refusal）：以前半截译文当完整译文收下，现在请求层抛
  ``ModelOutputIncomplete``，这一块按没翻成走（重试、批量拆单块、最终保留原文）。
- 单次请求太长（Anthropic prompt_too_long / 413 request_too_large、OpenAI context_length_exceeded、智谱 1261、千问
  InternalError.Algo.InvalidParameter）：不换思考字段、不退 json_object 重发，批量拆成单块，单块还太长保留原文记死信；
  不记凭据，不让整份停下。
- Rust 执行器这条路照旧 fail-closed，但报错写明原因（回执的 ``finish_reason`` / ``upstream_code``）。
"""
from __future__ import annotations

import io
import json
from dataclasses import replace
from unittest import mock

import pytest
import requests

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_translation.artifacts import TranslationDiagnosticsCollector
from retainpdf_translation.artifacts.aggregator import TranslationRunDiagnostics, translation_run_diagnostics_scope
from retainpdf_translation.artifacts.status import is_blocking_untranslated
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.llm.providers.deepseek import transport
from retainpdf_translation.llm.shared import model_wire
from retainpdf_translation.llm.shared import output_limits as limits
from retainpdf_translation.llm.shared import upstream_resilience as resilience
from retainpdf_translation.llm.shared.control_context import build_translation_control_context
from retainpdf_translation.llm.shared.rust_executor import ExecutorOutputIncomplete
from retainpdf_translation.llm.shared.rust_executor import ExecutorRequestTooLong
from retainpdf_translation.llm.shared.rust_executor import RustModelExecutorClient
from retainpdf_translation.llm.validation.errors import PartialBatchTranslationError
from retainpdf_translation_classic.llm.providers.deepseek import translation_client
from retainpdf_translation_classic.llm.shared.orchestration import fallbacks
from retainpdf_translation_classic.llm.shared.orchestration.batched_plain import translate_items_plain_text
from retainpdf_translation_agent.agent import parse_answer
from retainpdf_translation_agent.agent import TRUNCATED_STOP_REASONS
from retainpdf_translation_agent_engine.agent_openai import make_openai_transport

OPENAI = "https://api.openai.com/v1"
ANTHROPIC = "https://api.anthropic.com/v1"
ZHIPU = "https://open.bigmodel.cn/api/paas/v4"
QWEN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEEPSEEK = "https://api.deepseek.com/v1"


def _response(url: str, status: int, body, *, stream: bytes | None = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = {400: "Bad Request", 413: "Payload Too Large"}.get(status, "OK")
    response.url = url
    if stream is not None:
        response.raw = io.BytesIO(stream)
        response.encoding = "utf-8"
    else:
        response._content = (body if isinstance(body, str) else json.dumps(body)).encode()
    return response


class _Session:
    def __init__(self, *replies) -> None:
        self.replies = list(replies)
        self.sent: list[dict] = []

    def post(self, url, **kwargs):
        self.sent.append({"url": url, **kwargs})
        reply = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        return reply(url) if callable(reply) else _response(url, *reply)


@pytest.fixture
def fake(monkeypatch):
    sleeps: list[float] = []

    def install(*replies, stream: bool = False) -> _Session:
        session = _Session(*replies)
        monkeypatch.setattr(client, "get_session", lambda: session)
        monkeypatch.setattr(client, "should_use_stream_responses", lambda: stream)
        return session

    monkeypatch.setattr(client, "_prewarm_dns", lambda *args, **kwargs: None)
    monkeypatch.setattr(client.time, "sleep", sleeps.append)
    monkeypatch.delenv("RETAIN_TRANSLATION_TRANSPORT", raising=False)
    model_wire.clear_registered_connections()
    install.sleeps = sleeps
    yield install
    model_wire.clear_registered_connections()


def _ask(base_url: str, *, protocol: str = "openai", thinking: str | None = None, response_format=None, model="m"):
    return client.request_chat_content(
        [{"role": "user", "content": "translate"}], api_key="sk-test", model=model, base_url=base_url,
        max_attempts=4, response_format=response_format, protocol=protocol, thinking=thinking,
    )


def _chat(content, finish_reason):
    return {"choices": [{"message": {"content": content}, "finish_reason": finish_reason}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}


# ---- 回答不完整 ----


@pytest.mark.parametrize("finish_reason,kind", [
    ("length", limits.TRUNCATED),
    ("content_filter", limits.CONTENT_FILTER),
    ("sensitive", limits.CONTENT_FILTER),
    ("model_context_window_exceeded", limits.TRUNCATED),
    ("insufficient_system_resource", limits.INTERRUPTED),
])
def test_chat_completion_cut_short_is_not_taken_as_a_translation(fake, finish_reason, kind) -> None:
    session = fake((200, _chat("半截译", finish_reason)))
    with pytest.raises(limits.ModelOutputIncomplete) as caught:
        _ask(OPENAI)
    assert caught.value.kind == kind and caught.value.reason == finish_reason
    assert caught.value.partial_content == "半截译"
    assert f"finish_reason={finish_reason}" in str(caught.value)
    assert len(session.sent) == 1, "请求层不自己重发，交给这一块的重试"
    assert not transport.is_transport_error(caught.value)


def test_filtered_chat_completion_without_content_is_named_not_a_key_error(fake) -> None:
    fake((200, {"choices": [{"message": {"role": "assistant"}, "finish_reason": "content_filter"}]}))
    with pytest.raises(limits.ModelOutputIncomplete) as caught:
        _ask(OPENAI)
    assert caught.value.kind == limits.CONTENT_FILTER and caught.value.partial_content == ""


def test_chat_completion_that_stopped_normally_is_kept(fake) -> None:
    fake((200, _chat("完整译文", "stop")))
    assert _ask(OPENAI) == "完整译文"


def test_streamed_answer_cut_at_the_limit_raises(fake) -> None:
    events = (
        'data: {"choices":[{"delta":{"content":"半截"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":"译文"},"finish_reason":"length"}]}\n\n'
        'data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}}\n\n'
        "data: [DONE]\n\n"
    ).encode()
    fake(lambda url: _response(url, 200, None, stream=events), stream=True)
    with pytest.raises(limits.ModelOutputIncomplete) as caught:
        _ask(DEEPSEEK)
    assert caught.value.kind == limits.TRUNCATED and caught.value.partial_content == "半截译文"


def test_streamed_answer_that_stopped_normally_is_kept(fake) -> None:
    events = b'data: {"choices":[{"delta":{"content":"\xe8\xaf\x91\xe6\x96\x87"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'
    fake(lambda url: _response(url, 200, None, stream=events), stream=True)
    assert _ask(DEEPSEEK) == "译文"


def _responses(status, reason, text="半截"):
    payload = {"status": status, "output": [{"type": "message", "content": [{"type": "output_text", "text": text}]}],
               "usage": {"input_tokens": 3, "output_tokens": 4, "total_tokens": 7}}
    if reason:
        payload["incomplete_details"] = {"reason": reason}
    return payload


@pytest.mark.parametrize("reason,kind", [
    ("max_output_tokens", limits.TRUNCATED),
    ("content_filter", limits.CONTENT_FILTER),
    ("max_messages", limits.INCOMPLETE),
    ("steered", limits.INCOMPLETE),
])
def test_incomplete_responses_answer_with_text_is_not_taken(fake, reason, kind) -> None:
    fake((200, _responses("incomplete", reason)))
    with pytest.raises(limits.ModelOutputIncomplete) as caught:
        _ask(OPENAI, protocol="openai_responses", model="gpt-5.6-luna")
    assert caught.value.kind == kind and caught.value.partial_content == "半截"
    assert f"incomplete_details.reason={reason}" in str(caught.value)


def test_completed_responses_answer_is_kept(fake) -> None:
    fake((200, _responses("completed", None, text="完整")))
    assert _ask(OPENAI, protocol="openai_responses", model="gpt-5.6-luna") == "完整"


@pytest.mark.parametrize("stop_reason,kind", [
    ("max_tokens", limits.TRUNCATED),
    ("model_context_window_exceeded", limits.TRUNCATED),
    ("refusal", limits.CONTENT_FILTER),
])
def test_anthropic_answer_cut_short_is_not_taken(fake, stop_reason, kind) -> None:
    session = fake((200, {"content": [{"type": "text", "text": "半截"}], "stop_reason": stop_reason,
                          "usage": {"input_tokens": 3, "output_tokens": 4}}))
    with pytest.raises(limits.ModelOutputIncomplete) as caught:
        _ask(ANTHROPIC, protocol="anthropic", model="claude-haiku-5-5")
    assert caught.value.kind == kind and caught.value.partial_content == "半截"
    assert len(session.sent) == 1


def test_anthropic_end_turn_is_kept(fake) -> None:
    fake((200, {"content": [{"type": "text", "text": "完整"}], "stop_reason": "end_turn", "usage": {}}))
    assert _ask(ANTHROPIC, protocol="anthropic", model="claude-haiku-5-5") == "完整"


# ---- 单次请求太长 ----

TOO_LONG = [
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error",
                                                  "message": "prompt is too long: 210000 tokens > 200000 maximum"}},
     "anthropic", "prompt_too_long"),
    (ANTHROPIC, 413, {"type": "error", "error": {"type": "request_too_large", "message": "Request exceeds the maximum size"}},
     "anthropic", "request_too_large"),
    (OPENAI, 400, {"error": {"message": "This model's maximum context length is 128000 tokens.",
                             "type": "invalid_request_error", "code": "context_length_exceeded"}},
     "openai", "context_length_exceeded"),
    (DEEPSEEK, 400, {"error": {"message": "This model's maximum context length is 65536 tokens. However, you requested 70000 tokens",
                               "type": "invalid_request_error"}}, "openai", "context_length_exceeded"),
    (ZHIPU, 400, {"error": {"code": "1261", "message": "Prompt 超长"}}, "openai", "1261"),
    (QWEN, 400, {"error": {"code": "InternalError.Algo.InvalidParameter", "message": "Range of input length should be [1, 30720]"}},
     "openai", "InternalError.Algo.InvalidParameter"),
]


@pytest.mark.parametrize("base_url,status,body,protocol,code", TOO_LONG)
def test_request_too_long_is_sent_once_and_named(fake, base_url, status, body, protocol, code) -> None:
    session = fake((status, body))
    run = TranslationRunDiagnostics(provider_family="other", model="m", base_url=base_url, configured_workers=4,
                                    configured_batch_size=8, configured_classify_batch_size=12)
    with translation_run_diagnostics_scope(run):
        with pytest.raises(limits.UpstreamRequestTooLong) as caught:
            # Anthropic 带思考字段、OpenAI 要 json_schema：这些 400 的退路都不走，同样长的请求再发也一样
            _ask(base_url, protocol=protocol, thinking="high",
                 response_format={"type": "json_schema", "json_schema": {"name": "x", "schema": {}}})
        assert len(session.sent) == 1
        assert fake.sleeps == []
        assert caught.value.status_code == status and caught.value.provider_code == code
        assert "单次请求太长" in str(caught.value) and "sk-test" not in str(caught.value)
        # 不是 Key 的问题：凭据不记、后面的请求照发
        assert run.credential_rejection(base_url=base_url, api_key="sk-test") is None
    assert isinstance(caught.value, requests.HTTPError)
    assert not transport.is_transport_error(caught.value)
    assert not resilience.is_transient_upstream_error(caught.value)
    assert not resilience.is_credential_rejection(caught.value)


def test_an_unrelated_400_is_still_a_plain_bad_request(fake) -> None:
    fake((400, {"error": {"message": "Invalid value for 'top_p'", "type": "invalid_request_error"}}))
    with pytest.raises(requests.HTTPError) as caught:
        _ask(OPENAI)
    assert not isinstance(caught.value, limits.UpstreamRequestTooLong)


def test_request_too_long_rules() -> None:
    assert limits.request_too_long_code(413, "<html>too large</html>") == "http_413"
    assert limits.request_too_long_code(400, "") is None
    assert limits.request_too_long_code(429, json.dumps({"error": {"code": "context_length_exceeded"}})) is None
    assert limits.request_too_long_code(
        400, json.dumps({"error": {"message": "input length and `max_tokens` exceed context limit: 188240 + 21333 > 200000"}})
    ) == "prompt_too_long"


# ---- 经典翻译：批量拆单块、单块收口 ----


def _item(item_id: str, text: str) -> dict:
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "source_text": text,
        "protected_source_text": text,
        "translation_unit_protected_source_text": text,
        "should_translate": True,
        "_batched_plain_candidate": True,
    }


BATCH = [
    _item("p001-b001", "The first paragraph describes the measurement setup in detail."),
    _item("p001-b002", "The second paragraph explains why the calibration matters here."),
]


def test_truncated_batch_keeps_fully_closed_items_and_retries_the_cut_one() -> None:
    partial = (
        "<<<ITEM item_id=p001-b001>>>\n第一段详细描述了测量装置的设置。\n<<<END>>>\n"
        "<<<ITEM item_id=p001-b002>>>\n第二段解释了"
    )
    error = limits.ModelOutputIncomplete(kind=limits.TRUNCATED, field="finish_reason", reason="length",
                                         partial_content=partial)
    with mock.patch.object(translation_client, "request_chat_content", side_effect=error):
        with pytest.raises(PartialBatchTranslationError) as caught:
            translation_client.translate_batch_once(BATCH, request_label="t")
    assert set(caught.value.result) == {"p001-b001"}
    assert [item["item_id"] for item in caught.value.retry_items] == ["p001-b002"]


@pytest.mark.parametrize("kind,partial", [
    (limits.TRUNCATED, "<<<ITEM item_id=p001-b001>>>\n第一段"),
    (limits.CONTENT_FILTER, "<<<ITEM item_id=p001-b001>>>\n第一段详细描述了测量装置的设置。\n<<<END>>>\n"),
])
def test_batch_without_salvageable_items_raises_the_incomplete_error(kind, partial) -> None:
    error = limits.ModelOutputIncomplete(kind=kind, field="finish_reason", reason="x", partial_content=partial)
    with mock.patch.object(translation_client, "request_chat_content", side_effect=error):
        with pytest.raises(limits.ModelOutputIncomplete):
            translation_client.translate_batch_once(BATCH, request_label="t")


def _too_long(status: int = 400) -> limits.UpstreamRequestTooLong:
    response = requests.Response()
    response.status_code = status
    return limits.UpstreamRequestTooLong("400 Client Error | 单次请求太长", response=response, provider_code="prompt_too_long")


@pytest.mark.parametrize("error", [
    _too_long(),
    limits.ModelOutputIncomplete(kind=limits.TRUNCATED, field="finish_reason", reason="length"),
])
def test_batch_too_long_or_incomplete_is_split_into_single_items(monkeypatch, error) -> None:
    monkeypatch.setenv("RETAIN_TRANSLATION_INLINE_BATCH_FALLBACK", "1")
    calls: list[str] = []
    diagnostics = TranslationDiagnosticsCollector()

    def _single(item, **_kwargs):
        calls.append(item["item_id"])
        return {item["item_id"]: {"decision": "translate", "translated_text": "译文", "final_status": "translated"}}

    result = translate_items_plain_text(
        BATCH, api_key="sk-test", model="m", base_url=OPENAI, request_label="t",
        context=build_translation_control_context(), diagnostics=diagnostics, single_item_translator=_single,
        split_cached_batch_fn=lambda batch_arg, **_kwargs: ({}, batch_arg),
        store_cached_batch_fn=lambda *_args, **_kwargs: None,
        translate_batch_once_fn=lambda *_args, **_kwargs: (_ for _ in ()).throw(error),
    )
    assert sorted(calls) == ["p001-b001", "p001-b002"]
    assert set(result) == {"p001-b001", "p001-b002"}
    kinds = {d.kind for d in diagnostics.diagnostics}
    expected = "batch_request_too_long_split" if isinstance(error, limits.UpstreamRequestTooLong) else "batch_output_incomplete_split"
    assert expected in kinds


def _single_item(error: Exception):
    item = BATCH[0]
    context = build_translation_control_context(mode="sci")
    context = replace(context, fallback_policy=replace(context.fallback_policy, plain_text_attempts=2,
                                                       allow_tagged_placeholder_retry=False))
    calls = []

    def _raise(*_args, **_kwargs):
        calls.append(1)
        raise error

    diagnostics = TranslationDiagnosticsCollector()
    with mock.patch.object(fallbacks, "translate_single_item_plain_text", side_effect=_raise), \
         mock.patch.object(fallbacks, "translate_single_item_plain_text_unstructured", side_effect=_raise), \
         mock.patch("time.sleep"):
        result = fallbacks.translate_single_item_plain_text_with_retries(
            dict(item), api_key="", model="m", base_url=OPENAI, request_label="t", context=context, diagnostics=diagnostics,
        )
    return result[item["item_id"]], calls, diagnostics


def test_single_item_still_too_long_keeps_origin_as_dead_letter_without_retry() -> None:
    payload, calls, diagnostics = _single_item(_too_long())
    assert len(calls) == 1, "单块再发也一样长，不重试"
    assert payload["final_status"] == "failed" and payload["translated_text"] == ""
    info = payload["translation_diagnostics"]
    assert info["degradation_reason"] == "request_too_long"
    assert info["fallback_to"] == "dead_letter_queue" and info["dead_letter"] is True
    assert info["error_trace"][0]["code"] == "REQUEST_TOO_LONG"
    # 死信不挡导出（保留原文），用户在完成提示里看得到
    assert not is_blocking_untranslated(payload, info)
    assert "request_too_long_kept_origin" in {d.kind for d in diagnostics.diagnostics}


@pytest.mark.parametrize("kind,taxonomy", [(limits.TRUNCATED, "protocol"), (limits.CONTENT_FILTER, "refusal")])
def test_single_item_incomplete_answer_is_retried_then_marked_failed(kind, taxonomy) -> None:
    error = limits.ModelOutputIncomplete(kind=kind, field="finish_reason", reason="length", partial_content="半截")
    payload, calls, diagnostics = _single_item(error)
    assert len(calls) == 2, "和回答解析不了一样重试一次"
    assert payload["final_status"] == "failed" and payload["translated_text"] == ""
    info = payload["translation_diagnostics"]
    assert info["degradation_reason"] == f"model_output_{kind}"
    assert info["fallback_to"] == "retry_required", "等收尾补救再试，补救也不成才保留原文"
    assert payload["error_taxonomy"] == taxonomy
    assert info["error_trace"][0]["code"] == "MODEL_OUTPUT_INCOMPLETE"
    assert "finish_reason=length" in info["error_trace"][0]["reason"]
    assert "model_output_incomplete" in {d.kind for d in diagnostics.diagnostics}


# ---- Rust 执行器：fail-closed，但写明原因 ----


def _executor_reply(error_code: str, result: dict):
    reply = mock.Mock(status_code=200)
    reply.json.return_value = {"operation_id": "op", "unit_id": "unit", "status": "failed", "error_code": error_code,
                               "result": result}
    return reply


def _executor_error(error_code: str, result: dict) -> BaseException:
    executor = RustModelExecutorClient("http://127.0.0.1:41000", "job", "a" * 64)
    session = mock.Mock()
    session.request.return_value = _executor_reply(error_code, result)
    with mock.patch.object(executor, "_session", return_value=session), pytest.raises(Exception) as caught:
        executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "s"}])
    assert session.request.call_count == 1
    return caught.value


@pytest.mark.parametrize("finish_reason,needle", [("length", "截断"), ("content_filter", "内容过滤")])
def test_executor_incomplete_answer_names_the_finish_reason(finish_reason, needle) -> None:
    error = _executor_error("output_incomplete", {"finish_reason": finish_reason, "input_tokens": 3})
    assert isinstance(error, ExecutorOutputIncomplete)
    assert f"finish_reason={finish_reason}" in str(error) and needle in str(error)
    try:
        raise error
    except Exception as exc:  # noqa: BLE001
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert "模型回答不完整" in failure["summary"]


def test_executor_request_too_long_names_the_upstream_code() -> None:
    error = _executor_error("request_too_long", {"upstream_status": 400, "upstream_code": "1261", "upstream_provider": "zhipu"})
    assert isinstance(error, ExecutorRequestTooLong)
    assert "HTTP 400，1261" in str(error) and "单次请求太长" in str(error)
    assert error.status_code == 400 and error.provider_code == "1261"
    try:
        raise error
    except Exception as exc:  # noqa: BLE001
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert failure["summary"].startswith("单次请求太长")
    assert failure["upstream"]["code"] == "1261" and failure["upstream"]["http_status"] == 400


# ---- 翻译 agent ----


def _agent_body() -> dict:
    return {
        "model": "gpt-test",
        "max_tokens": 16000,
        "system": [{"type": "text", "text": "你是译者。"}],
        "messages": [{"role": "user", "content": '{"blocks": []}'}],
    }


def test_agent_over_openai_sees_a_cut_answer_as_max_tokens() -> None:
    partial = "@@ p001-b001\n完整的一块\n\n@@ p001-b002\n半截"
    error = limits.ModelOutputIncomplete(kind=limits.TRUNCATED, field="finish_reason", reason="length",
                                         partial_content=partial)
    transport_fn = make_openai_transport(api_key="sk-job", model="gpt-test", base_url=OPENAI, protocol="openai",
                                         chat=mock.Mock(side_effect=error))
    response = transport_fn(_agent_body())
    assert response["stop_reason"] == "max_tokens"
    assert response["content"] == [{"type": "text", "text": partial}]
    parsed = parse_answer(partial, truncated=response["stop_reason"] in TRUNCATED_STOP_REASONS)
    assert set(parsed["translations"]) == {"p001-b001"}, "最后写了一半的块当没交"


def test_agent_treats_context_window_stop_like_max_tokens() -> None:
    assert "model_context_window_exceeded" in TRUNCATED_STOP_REASONS

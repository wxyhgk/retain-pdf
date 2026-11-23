"""翻译请求层剩下的几类「重试没用」（2026-11-23）：模型不可用、地区不支持、内容审核没过、其它 4xx、千问时段额度。

- 模型不存在 / 没开通（OpenAI ``model_not_found``、Anthropic ``not_found_error``、千问 ``ModelNotFound`` 等、智谱 1211、
  任何 404）：和 401/403 一样第一次就整份停下，归 ``upstream_model_unavailable``，改好模型后从翻译续跑。只记这个模型，
  同一个 Key 的别的模型（审校角色）照常用。
- 地区不支持（OpenAI 403 ``unsupported_country_region_territory``）：整份停下，归 ``auth_failed``，但说「换网络或换服务商」。
- 内容审核没过（智谱 1301、千问 ``DataInspectionFailed`` / ``FaqRuleBlocked``、OpenAI ``invalid_prompt`` 等）：不重试，
  只这一块保留原文（死信），翻译诊断记「内容审核未过」，任务不停。
- 409 / 413 / 422：归 ``upstream_bad_request``，summary 带状态码和服务商原话（只取 ``error.message``）。
- 千问 Coding Plan ``usage allocated quota exceeded``、``Throttling.AllocationQuota`` 里说免费额度用完的：按额度停。

三处规则（Python 请求层、翻译 agent、Rust 模型执行器）都测；Rust 的表在 ``model_executor/upstream_codes.rs`` 的单测里。
"""
from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from email.message import Message
from importlib import import_module
from unittest import mock

import pytest
import requests

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_translation.artifacts import TranslationDiagnosticsCollector
from retainpdf_translation.artifacts.aggregator import TranslationRunDiagnostics, translation_run_diagnostics_scope
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.llm.providers.deepseek import transport
from retainpdf_translation.llm.shared import upstream_error_codes as codes
from retainpdf_translation.llm.shared import upstream_resilience as resilience
from retainpdf_translation.llm.shared.control_context import build_translation_control_context
from retainpdf_translation.llm.shared.rust_executor import ExecutorAccessDenied
from retainpdf_translation.llm.shared.rust_executor import ExecutorError
from retainpdf_translation.llm.shared.rust_executor import ExecutorModelUnavailable
from retainpdf_translation.llm.shared.rust_executor import ExecutorRegionUnsupported
from retainpdf_translation.llm.shared.rust_executor import RustModelExecutorClient
from retainpdf_translation_agent import ModelUnavailable
from retainpdf_translation_agent import RegionUnsupported
from retainpdf_translation_agent import RequestRejected
from retainpdf_translation_agent.agent import make_http_transport
from retainpdf_translation_agent_engine import agent_flow
from retainpdf_translation_agent_engine import agent_openai

OPENAI = "https://api.openai.com/v1"
ANTHROPIC = "https://api.anthropic.com/v1"
ZHIPU = "https://open.bigmodel.cn/api/paas/v4"
QWEN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEEPSEEK = "https://api.deepseek.com/v1"
RELAY = "https://relay.example.com/v1"


def _err(code="", *, type_="", message="x") -> dict:
    error: dict = {"message": message}
    if code:
        error["code"] = code
    if type_:
        error["type"] = type_
    return {"error": error}


def _failure(exc: BaseException) -> dict:
    try:
        raise exc
    except BaseException as raised:  # noqa: BLE001
        return json.loads(classify_exception(raised, default_stage="translation", provider="translation").to_json())


# (地址, 状态码, 响应体, 期望种类, 期望的码)
CASES = [
    # 模型不可用：各家的码
    (OPENAI, 404, _err("model_not_found", type_="invalid_request_error", message="The model `gpt-x` does not exist or you do not have access to it."), "model", "model_not_found"),
    (ANTHROPIC, 404, {"type": "error", "error": {"type": "not_found_error", "message": "model: claude-x"}}, "model", "not_found_error"),
    *[(QWEN, 404, _err(code), "model", code) for code in ("ModelNotFound", "model_not_found", "model_not_supported", "WorkSpaceNotFound")],
    (QWEN, 404, _err("NotFound", message="Not found"), "model", "http_404"),
    (QWEN, 403, _err("Endpoint.AccessDenied", message="Endpoint access denied"), "model", "Endpoint.AccessDenied"),
    (QWEN, 400, _err("invalid_parameter_error", message="Model not exist."), "model", "invalid_parameter_error"),
    (QWEN, 400, _err("invalid_parameter_error", message="The model `qwen-x` is not activated, please activate it first."), "model", "invalid_parameter_error"),
    (QWEN, 400, _err("invalid_parameter_error", message="Range of temperature should be [0, 2)"), None, None),
    (ZHIPU, 400, _err("1211", message="模型不存在，请检查模型代码。"), "model", "1211"),
    (RELAY, 400, _err("1211", message="x"), None, None),
    # 任何 404：模型名或接口地址写错
    (RELAY, 404, "<html>404 page not found</html>", "model", "http_404"),
    (DEEPSEEK, 404, _err("", message="Not Found"), "model", "http_404"),
    # 地区
    (OPENAI, 403, _err("unsupported_country_region_territory", type_="request_forbidden", message="Country, region, or territory not supported"), "region", "unsupported_country_region_territory"),
    (OPENAI, 403, _err("", message="Country, region, or territory not supported"), "region", "unsupported_region"),
    (OPENAI, 403, _err("", message="You are not allowed to sample from this model"), None, None),
    # 内容审核
    (ZHIPU, 400, _err("1301", message="系统检测到输入或生成内容可能包含不安全或敏感内容"), "content", "1301"),
    *[(QWEN, 400, _err(code, message="Input data may contain inappropriate content."), "content", code) for code in ("DataInspectionFailed", "data_inspection_failed", "FaqRuleBlocked")],
    *[(OPENAI, 400, _err(code, message="flagged"), "content", code) for code in ("invalid_prompt", "bio_policy", "misalignment_policy_violation")],
    # 千问时段额度、免费额度
    (QWEN, 429, _err("", message="usage allocated quota exceeded"), "quota", "usage allocated quota exceeded"),
    (QWEN, 429, _err("", message="hour allocated quota exceeded"), "quota", "hour allocated quota exceeded"),
    (QWEN, 429, {"code": "Throttling.AllocationQuota", "message": "Free allocated quota exceeded."}, "quota", "Throttling.AllocationQuota"),
    (QWEN, 429, _err("Throttling.AllocationQuota", message="The free tier quota exhausted for this model"), "quota", "Throttling.AllocationQuota"),
    (QWEN, 429, {"code": "Throttling.AllocationQuota", "message": "Allocated quota exceeded, please increase your quota limit."}, None, None),
    # Anthropic 自设上限、预付余额（今天早些时候已处理，这里钉住）
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error", "message": "You have reached your specified workspace API usage limits."}}, "quota", "spend_limit_reached"),
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error", "message": "Your credit balance is too low to access the Anthropic API."}}, "quota", "credit_balance_too_low"),
    # 其它 4xx 不归这几类（落 upstream_bad_request，见下面）
    (OPENAI, 409, _err("", message="conflict"), None, None),
    (ANTHROPIC, 413, {"type": "error", "error": {"type": "request_too_large", "message": "Request exceeds the maximum allowed number of bytes."}}, None, None),
    (DEEPSEEK, 422, _err("", message="Invalid Parameters"), None, None),
]


@pytest.mark.parametrize("url,status,body,kind,code", CASES)
def test_rejection_kinds(url, status, body, kind, code) -> None:
    text = body if isinstance(body, str) else json.dumps(body)
    found = codes.classify_rejection(status, text, url=f"{url}/chat/completions")
    assert (found.kind if found else None) == kind
    if found is not None:
        assert found.code == code
        assert found.stops_run is (kind != "content")
    # agent 的 Anthropic 请求拿到同一个判断
    agent = codes.agent_http_classifier(status, text, {}, f"{url}/messages")
    expected_agent = {"model": "model", "region": "region", "content": "content", "quota": "quota", None: None}[kind]
    assert (agent[0] if agent else None) == expected_agent


# ---- 共用请求层 ----


def _response(url: str, status: int, body, headers: dict | None = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = "Error"
    response.url = url
    response._content = (body if isinstance(body, str) else json.dumps(body)).encode()
    response.headers.update(headers or {})
    return response


class _Session:
    def __init__(self, replies) -> None:
        self.replies = list(replies)
        self.sent: list[dict] = []

    def post(self, url, **kwargs):
        self.sent.append(kwargs.get("json") or {})
        status, body = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        return _response(url, status, body)


@pytest.fixture
def fake(monkeypatch):
    sleeps: list[float] = []

    def install(*replies) -> _Session:
        session = _Session(replies)
        monkeypatch.setattr(client, "get_session", lambda: session)
        return session

    monkeypatch.setattr(client, "_prewarm_dns", lambda *args, **kwargs: None)
    monkeypatch.setattr(client, "should_use_stream_responses", lambda: False)
    monkeypatch.setattr(client.time, "sleep", sleeps.append)
    monkeypatch.delenv("RETAIN_TRANSLATION_TRANSPORT", raising=False)
    install.sleeps = sleeps
    return install


def _run(base_url: str) -> TranslationRunDiagnostics:
    return TranslationRunDiagnostics(
        provider_family="other", model="m", base_url=base_url, configured_workers=4,
        configured_batch_size=8, configured_classify_batch_size=12,
    )


def _ask(base_url: str, *, model: str = "m") -> str:
    return client.request_chat_content(
        [{"role": "user", "content": "SECRET SOURCE TEXT"}], api_key="sk-test", model=model, base_url=base_url,
        max_attempts=4, response_format={"type": "json_schema", "json_schema": {"name": "x", "schema": {}}}, protocol="openai",
    )


MODEL_REPLIES = [
    (OPENAI, 404, _err("model_not_found", message="The model `m` does not exist or you do not have access to it."), "model_not_found"),
    (QWEN, 400, _err("invalid_parameter_error", message="Model not exist."), "invalid_parameter_error"),
    (ZHIPU, 400, _err("1211", message="模型不存在"), "1211"),
    (RELAY, 404, "404 page not found", "http_404"),
]


@pytest.mark.parametrize("base_url,status,body,code", MODEL_REPLIES)
def test_model_unavailable_stops_the_whole_translation_at_first(fake, base_url, status, body, code) -> None:
    session = fake((status, body), (200, {"choices": [{"message": {"content": "ok"}}]}))
    run = _run(base_url)
    with translation_run_diagnostics_scope(run):
        with pytest.raises(resilience.UpstreamModelUnavailable) as first:
            _ask(base_url)
        assert len(session.sent) == 1, "不换思考字段、不退 json_object、不退避"
        assert fake.sleeps == []
        assert first.value.provider_code == code and "sk-test" not in str(first.value)
        assert not transport.is_transport_error(first.value)
        with pytest.raises(resilience.UpstreamModelUnavailable) as skipped:
            _ask(base_url)
        assert len(session.sent) == 1 and "没有再发请求" in str(skipped.value)
        # 同一个 Key 的别的模型（审校角色）照常发
        assert _ask(base_url, model="other-model") == "ok"
        assert len(session.sent) == 2

    resilience.raise_if_credential_rejected(run, base_url=base_url, api_key="sk-test", model="other-model")
    with pytest.raises(requests.HTTPError) as stopped:
        resilience.raise_if_credential_rejected(run, base_url=base_url, api_key="sk-test", model="m")
    failure = _failure(stopped.value)
    assert failure["failure_code"] == "upstream_model_unavailable"
    assert failure["failure_category"] == "auth", "前端按 auth 给「去设置」入口"
    assert failure["retryable"] is False
    assert failure["summary"] == f"翻译模型不可用（HTTP {status}）：模型名写错、这个 Key 没开通该模型，或接口地址写错"
    assert "base_url" in failure["suggestion"] and "续跑" in failure["suggestion"]
    assert failure["raw_excerpt"].startswith(f"翻译模型不可用（HTTP {status}，")
    assert code in failure["raw_excerpt"][:200]


def test_region_unsupported_stops_with_its_own_wording(fake) -> None:
    body = _err("unsupported_country_region_territory", type_="request_forbidden", message="Country, region, or territory not supported")
    session = fake((403, body))
    run = _run(OPENAI)
    with translation_run_diagnostics_scope(run):
        with pytest.raises(resilience.UpstreamRegionUnsupported):
            _ask(OPENAI)
    assert len(session.sent) == 1
    with pytest.raises(requests.HTTPError) as stopped:
        resilience.raise_if_credential_rejected(run, base_url=OPENAI, api_key="sk-test")
    failure = _failure(stopped.value)
    assert failure["failure_code"] == "auth_failed" and failure["retryable"] is False
    assert failure["summary"] == "所在地区不支持这个翻译服务商"
    assert "换网络" in failure["suggestion"] and "换 API Key 没用" in failure["suggestion"]
    assert failure["raw_excerpt"].startswith("翻译服务商不支持当前所在地区（HTTP 403，")


def test_content_rejection_is_not_retried_and_does_not_stop_the_run(fake) -> None:
    session = fake((400, _err("DataInspectionFailed", message="Input data may contain inappropriate content.")),
                   (200, {"choices": [{"message": {"content": "ok"}}]}))
    run = _run(QWEN)
    with translation_run_diagnostics_scope(run):
        with pytest.raises(resilience.UpstreamContentRejected) as caught:
            _ask(QWEN)
        assert len(session.sent) == 1 and fake.sleeps == []
        assert caught.value.provider_code == "DataInspectionFailed"
        assert not resilience.is_credential_rejection(caught.value)
        assert resilience.is_content_rejection(caught.value)
        # 下一块照常发
        assert _ask(QWEN) == "ok"
    resilience.raise_if_credential_rejected(run, base_url=QWEN, api_key="sk-test", model="m")


@pytest.mark.parametrize("base_url,status,body,message", [
    (OPENAI, 409, _err("", message="Conflict: another request is modifying this resource"), "Conflict: another request is modifying this resource"),
    (OPENAI, 415, _err("", message="Unsupported media type"), "Unsupported media type"),
    (OPENAI, 422, _err("", message="Unprocessable"), "Unprocessable"),
    (DEEPSEEK, 422, _err("", message="Invalid Parameters " + "x" * 400), "Invalid Parameters " + "x" * 140),
])
def test_other_4xx_are_bad_requests_with_status_and_provider_words(fake, base_url, status, body, message) -> None:
    fake((status, body))
    with translation_run_diagnostics_scope(_run(base_url)):
        with pytest.raises(requests.HTTPError) as caught:
            _ask(base_url)
    failure = _failure(caught.value)
    assert failure["failure_code"] == "upstream_bad_request"
    assert failure["failure_category"] == "input" and failure["retryable"] is False
    assert failure["summary"].startswith(f"上游服务拒绝请求（{status}）：{message}")
    assert len(failure["summary"]) <= len(f"上游服务拒绝请求（{status}）：") + resilience_max_message()
    assert "SECRET SOURCE TEXT" not in failure["summary"] and "sk-test" not in failure["summary"]


def test_anthropic_413_is_request_too_long_not_a_generic_rejection(fake) -> None:
    """413 是「单次请求太长」（fix/llm-truncation：批量拆单块，单块仍太长保留原文），不是通用的「上游服务拒绝请求」；
    真走到任务失败时 summary 写明太长。"""
    from retainpdf_translation.llm.shared.output_limits import UpstreamRequestTooLong

    fake((413, {"type": "error", "error": {"type": "request_too_large", "message": "Request exceeds the maximum allowed number of bytes."}}))
    with translation_run_diagnostics_scope(_run(ANTHROPIC)):
        with pytest.raises(UpstreamRequestTooLong) as caught:
            _ask(ANTHROPIC)
    failure = _failure(caught.value)
    assert failure["failure_code"] == "upstream_bad_request" and failure["retryable"] is False
    assert failure["summary"].startswith("单次请求太长")


def resilience_max_message() -> int:
    from retainpdf_pipeline.foundation.shared.structured_errors import PROVIDER_MESSAGE_MAX_CHARS

    return PROVIDER_MESSAGE_MAX_CHARS


def test_bare_400_summary_is_unchanged_without_a_provider_message() -> None:
    error = requests.HTTPError("400 Client Error", response=_response(f"{RELAY}/chat/completions", 400, "bad"))
    assert _failure(error)["summary"] == "上游服务拒绝请求（400）"


# ---- 普通翻译：内容审核没过的块保留原文，不重试 ----


def _item(item_id: str, **extra) -> dict:
    text = "The advancement of complex computer programs with faster computing power remains important."
    return {
        "item_id": item_id,
        "page_idx": 0,
        "block_type": "text",
        "metadata": {"structure_role": "body"},
        "protected_source_text": text,
        "translation_unit_protected_source_text": text,
        **extra,
    }


@pytest.mark.parametrize("extra", [{}, {"math_mode": "direct_typst"}])
def test_classic_single_item_keeps_source_when_content_is_rejected(extra) -> None:
    fallbacks = import_module("retainpdf_translation_classic.llm.shared.orchestration.fallbacks")
    item = _item("p001-b001", **extra)
    calls: list[str] = []
    rejection = codes.classify_rejection(400, json.dumps(_err("1301", message="敏感")), url=f"{ZHIPU}/chat/completions")

    def rejected(*_args, **_kwargs):
        calls.append("plain")
        raise resilience.rejection_error("400 Client Error", response=None, rejection=rejection)

    diagnostics = TranslationDiagnosticsCollector()
    with mock.patch.object(fallbacks, "translate_single_item_plain_text", side_effect=rejected), \
            mock.patch.object(fallbacks, "translate_single_item_plain_text_unstructured", side_effect=rejected), \
            mock.patch.object(fallbacks, "_sentence_level_fallback") as sentence_fallback:
        result = fallbacks.translate_single_item_plain_text_with_retries(
            item, api_key="sk-test", model="glm", base_url=ZHIPU, request_label="t",
            context=build_translation_control_context(), diagnostics=diagnostics,
        )
    assert calls == ["plain"], "内容审核没过：不换路径再发"
    sentence_fallback.assert_not_called()
    payload = result["p001-b001"]
    assert payload["final_status"] == "failed" and payload["translated_text"] == ""
    assert payload["error_taxonomy"] == "content_policy"
    trace = payload["translation_diagnostics"]
    assert trace["degradation_reason"] == "upstream_content_rejected"
    assert trace["fallback_to"] == "dead_letter_queue" and trace["dead_letter"] is True
    assert trace["route_path"][-2:] == ["content_rejected", "dlq"]
    assert trace["error_trace"][0]["code"] == "1301" and "内容审核未过" in trace["error_trace"][0]["message"]
    events = [event for event in diagnostics.diagnostics if event.kind == "upstream_content_rejected"]
    assert len(events) == 1 and "内容审核未过" in events[0].message

    # 死信不阻断导出，也不进收尾的补翻
    from retainpdf_translation.artifacts.status import is_blocking_untranslated

    assert not is_blocking_untranslated({**item, **payload}, trace)


# ---- 翻译 agent ----


def _http_error(url: str, status: int, body: dict) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(url, status, "error", Message(), io.BytesIO(json.dumps(body).encode()))


@pytest.mark.parametrize("status,body,expected", [
    (404, {"type": "error", "error": {"type": "not_found_error", "message": "model: claude-x"}}, ModelUnavailable),
    (403, _err("unsupported_country_region_territory", message="Country, region, or territory not supported"), RegionUnsupported),
    (400, _err("DataInspectionFailed", message="inappropriate"), RequestRejected),
    (422, _err("", message="Unprocessable"), RequestRejected),
])
def test_agent_anthropic_transport_stops_without_retry(monkeypatch, status, body, expected) -> None:
    url = f"{ANTHROPIC}/messages" if status != 403 else f"{OPENAI}/messages"
    sent: list[int] = []

    def urlopen(request, timeout):
        sent.append(1)
        raise _http_error(url, status, body)

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    waits: list[float] = []
    send = make_http_transport("k", url=url, sleep=waits.append, classify=codes.agent_http_classifier)
    with pytest.raises(expected) as caught:
        send({"model": "m"})
    assert sent == [1] and waits == []
    if expected is RequestRejected:
        assert caught.value.status_code == status
        assert caught.value.content_rejected is (status == 400)
        failure = _failure(caught.value)
        assert failure["failure_code"] == "upstream_bad_request"
        if status == 400:
            assert failure["summary"] == "翻译服务商的内容审核没通过（HTTP 400）"


def test_agent_without_classifier_still_stops_on_404(monkeypatch) -> None:
    monkeypatch.setattr(urllib.request, "urlopen", lambda request, timeout: (_ for _ in ()).throw(_http_error("u", 404, {})))
    with pytest.raises(ModelUnavailable):
        make_http_transport("k", url="https://relay.example.com/v1/messages", sleep=lambda _s: None)({"model": "m"})


def test_agent_openai_maps_model_and_region() -> None:
    def raising(status, body, url):
        def chat(*_args, **_kwargs):
            rejection = codes.classify_rejection(status, json.dumps(body), url=url)
            raise resilience.rejection_error(f"{status} Client Error", response=_response(url, status, body), rejection=rejection)

        return agent_openai.make_openai_transport(api_key="k", model="m", base_url=OPENAI, protocol="openai", chat=chat)

    with pytest.raises(ModelUnavailable):
        raising(404, _err("model_not_found"), f"{OPENAI}/responses")({"messages": [{"role": "user", "content": "hi"}]})
    with pytest.raises(RegionUnsupported):
        raising(403, _err("unsupported_country_region_territory"), f"{OPENAI}/responses")({"messages": [{"role": "user", "content": "hi"}]})


@pytest.mark.parametrize("reason,failure_code,summary", [
    ("model_unavailable", "upstream_model_unavailable", None),
    ("region_unsupported", "auth_failed", "所在地区不支持这个翻译服务商"),
])
def test_agent_stops_are_classified(reason, failure_code, summary) -> None:
    class Outcome:
        stop_reason = reason
        pages_done, pages_total = 1, 4
        stop_message = "model API HTTP 404: HTTP 404，Anthropic 业务码 not_found_error：请求的模型或接口不存在"

    failure = _failure(agent_flow._stopped_error(Outcome()))
    assert failure["failure_code"] == failure_code and failure["retryable"] is False
    if summary:
        assert failure["summary"] == summary


# ---- Rust 执行器：操作的 error_code 交回给 Python ----


def _executor(error_code: str, result: dict):
    executor = RustModelExecutorClient("http://127.0.0.1:41000", "job", "a" * 64)
    reply = mock.Mock(status_code=200)
    reply.json.return_value = {"operation_id": "op", "unit_id": "unit", "status": "failed", "error_code": error_code, "result": result}
    session = mock.Mock()
    session.request.return_value = reply
    return executor, session


@pytest.mark.parametrize("error_code,result,error_class,failure_code", [
    ("model_unavailable", {"upstream_status": 404, "upstream_code": "model_not_found", "upstream_provider": "openai"}, ExecutorModelUnavailable, "upstream_model_unavailable"),
    ("region_unsupported", {"upstream_status": 403, "upstream_code": "unsupported_country_region_territory", "upstream_provider": "openai"}, ExecutorRegionUnsupported, "auth_failed"),
])
def test_executor_stop_codes(error_code, result, error_class, failure_code) -> None:
    executor, session = _executor(error_code, result)
    with mock.patch.object(executor, "_session", return_value=session), pytest.raises(error_class) as caught:
        executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "s"}])
    assert isinstance(caught.value, ExecutorError)
    failure = _failure(caught.value)
    assert failure["failure_code"] == failure_code and failure["retryable"] is False
    assert failure["upstream"]["http_status"] == result["upstream_status"]
    if error_class is ExecutorRegionUnsupported:
        assert issubclass(error_class, ExecutorAccessDenied)
        assert failure["summary"] == "所在地区不支持这个翻译服务商"


def test_executor_content_rejection_is_a_block_level_error_not_an_executor_failure() -> None:
    executor, session = _executor("content_rejected", {"upstream_status": 400, "upstream_code": "1301", "upstream_provider": "zhipu"})
    with mock.patch.object(executor, "_session", return_value=session), pytest.raises(resilience.UpstreamContentRejected) as caught:
        executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "s"}])
    assert not isinstance(caught.value, ExecutorError), "不能让执行器整份停下"
    assert resilience.is_content_rejection(caught.value) and not resilience.is_credential_rejection(caught.value)
    assert caught.value.provider_code == "1301"


def test_executor_other_rejection_is_a_bad_request() -> None:
    executor, session = _executor("provider_rejected_request", {"upstream_status": 422, "upstream_provider": "deepseek"})
    with mock.patch.object(executor, "_session", return_value=session), pytest.raises(ExecutorError) as caught:
        executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "s"}])
    failure = _failure(caught.value)
    assert failure["failure_code"] == "upstream_bad_request"
    assert failure["summary"] == "上游服务拒绝请求（422）"

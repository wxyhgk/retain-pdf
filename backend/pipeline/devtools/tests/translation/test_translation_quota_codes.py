"""429 不全是限流：额度、余额、预算用完的业务码第一次就停，整份翻译停下，归 upstream_quota_exhausted（2026-11-23 用户定）。

以前 OpenAI insufficient_quota、Anthropic 消费封顶、智谱 1113、千问欠费、OpenCode 预算用完都当限流：每个请求退避到 300 秒
才放弃，最后告诉用户「稍后重试即可」。现在请求层读响应体的业务码（``upstream_error_codes``）：认出额度用完的和 402 一样
记下这组凭据、不再发请求、整份停下；真限流照旧退避、认 Retry-After。报错里带 HTTP 状态和服务商的码，不带 Key。
"""
from __future__ import annotations

import io
import json
import urllib.error
import urllib.request
from email.message import Message

import pytest
import requests

from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_translation.artifacts.aggregator import TranslationRunDiagnostics, translation_run_diagnostics_scope
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.llm.providers.deepseek import transport
from retainpdf_translation.llm.shared import upstream_error_codes as codes
from retainpdf_translation.llm.shared import upstream_resilience as resilience
from retainpdf_translation.llm.shared.rust_executor import ExecutorAccessDenied
from retainpdf_translation.llm.shared.rust_executor import ExecutorQuotaExhausted
from retainpdf_translation.llm.shared.rust_executor import RustModelExecutorClient
from retainpdf_translation.services.continuation import review as continuation_review
from retainpdf_translation_agent import QuotaExhausted
from retainpdf_translation_agent import RateLimited
from retainpdf_translation_agent.agent import make_http_transport
from retainpdf_translation_agent_engine import agent_flow
from retainpdf_translation_agent_engine import agent_openai

OPENAI = "https://api.openai.com/v1"
ANTHROPIC = "https://api.anthropic.com/v1"
ZHIPU = "https://open.bigmodel.cn/api/paas/v4"
QWEN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENCODE = "https://opencode.ai/zen/v1"
RELAY = "https://relay.example.com/v1"


def _err(code="", *, type_="", message="x", details=None) -> dict:
    error = {"message": message}
    if code:
        error["code"] = code
    if type_:
        error["type"] = type_
    if details:
        error["details"] = details
    return {"error": error}


# (地址, 状态码, 响应体, 有没有 retry-after, 期望：quota / access / None)
CASES = [
    # OpenAI：计费类的码（code 或 type）是额度；没码、rate_limit_exceeded、slow_down 是限流
    *[(OPENAI, 429, _err(code, type_="insufficient_quota"), True, "quota") for code in codes.OPENAI_QUOTA_CODES],
    (OPENAI, 429, _err("", type_="insufficient_quota", message="You exceeded your current quota"), False, "quota"),
    (OPENAI, 429, _err("rate_limit_exceeded", type_="requests"), True, None),
    (OPENAI, 429, _err("slow_down", type_="rate_limit_error"), True, None),
    (OPENAI, 429, {"error": {"message": "Rate limit reached for requests", "type": "requests", "code": None}}, True, None),
    (RELAY, 429, _err("insufficient_quota", type_="insufficient_quota"), False, "quota"),
    # Anthropic：details.error_code；官方地址的 429 没有 retry-after；400 的 message
    (ANTHROPIC, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "x",
                                                 "details": {"error_code": "enforced_spend_limit_reached"}}}, False, "quota"),
    (ANTHROPIC, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "rate limit"}}, False, "quota"),
    (ANTHROPIC, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "rate limit"}}, True, None),
    (ANTHROPIC, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "x",
                                                 "details": {"error_code": "ramp_limit_exceeded"}}}, False, None),
    (RELAY, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "rate limit"}}, False, None),
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error",
                                                 "message": "Your credit balance is too low to access the Anthropic API."}}, False, "quota"),
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error",
                                                 "message": "You have reached your specified API usage limits. You will regain access on 2026-12-01"}}, False, "quota"),
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error", "message": "max_tokens: too large"}}, False, None),
    # 智谱：1113、1308–1321 停；1311/1315 当 Key 被拒；1302/1305 限流；也认 Z.ai 的顶层 code
    *[(ZHIPU, 429, _err(code), False, "quota") for code in ("1113", "1308", "1309", "1310", "1313", "1314", "1316", "1317", "1318", "1319", "1320", "1321")],
    (ZHIPU, 429, _err("1311"), False, "access"),
    (ZHIPU, 429, _err("1315"), False, "access"),
    (ZHIPU, 429, _err("1302"), False, None),
    (ZHIPU, 429, _err("1305"), False, None),
    ("https://api.z.ai/api/paas/v4", 429, {"code": 1113, "message": "Insufficient balance"}, False, "quota"),
    (RELAY, 429, _err("1113"), False, None),
    # 千问：计费码停；百炼的 insufficient_quota 是 TPM 限流
    *[(QWEN, 429, _err(code), False, "quota") for code in ("CommodityNotPurchased", "PrepaidBillOverdue", "PostpaidBillOverdue", "BudgetLimitExceeded")],
    (QWEN, 400, _err("Arrearage", type_="Arrearage", message="Access denied, please make sure your account is in good standing."), False, "quota"),
    (QWEN, 403, _err("Arrearage", type_="Arrearage"), False, "quota"),
    (QWEN, 403, _err("AllocationQuota.FreeTierOnly"), False, "quota"),
    (QWEN, 429, _err("insufficient_quota", type_="insufficient_quota", message="You exceeded your current quota"), False, None),
    (QWEN, 429, _err("insufficient_quota", message="The free tier of the model has been exhausted."), False, "quota"),
    (QWEN, 429, _err("Throttling.RateQuota", message="Requests rate limit exceeded"), False, None),
    (QWEN, 429, _err("", message="month allocated quota exceeded"), False, "quota"),
    # OpenCode：工作区预算
    (OPENCODE, 429, _err("", message="Upstream request failed: Policy budget exceeded"), False, "quota"),
    (OPENCODE, 429, _err("", message="Too many requests"), True, None),
    # 5xx 不看码
    (OPENAI, 503, _err("insufficient_quota"), False, None),
]


@pytest.mark.parametrize("url,status,body,retry_after,expected", CASES)
def test_business_codes_tell_quota_from_rate_limit(url, status, body, retry_after, expected) -> None:
    headers = {"Retry-After": "3"} if retry_after else {}
    found = codes.classify_rejection(status, json.dumps(body), headers=headers, url=f"{url}/chat/completions")
    assert (found.kind if found else None) == expected
    if found is not None:
        assert found.http_status == status
        assert f"HTTP {status}" in found.describe()


# ---- 共用请求层：额度用完第一次就停、整份停下；限流照旧退避 ----


def _response(url: str, status: int, body: dict, headers: dict | None = None) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = {429: "Too Many Requests", 400: "Bad Request", 403: "Forbidden"}.get(status, "OK")
    response.url = url
    response._content = json.dumps(body).encode()
    response.headers.update(headers or {})
    return response


class _Session:
    def __init__(self, replies) -> None:
        self.replies = list(replies)
        self.sent: list[str] = []

    def post(self, url, **kwargs):
        self.sent.append(url)
        status, body, headers = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        return _response(url, status, body, headers)


@pytest.fixture
def fake(monkeypatch):
    holder: dict = {"sleeps": []}

    def install(*replies) -> _Session:
        session = _Session(replies)
        monkeypatch.setattr(client, "get_session", lambda: session)
        holder["session"] = session
        return session

    monkeypatch.setattr(client, "_prewarm_dns", lambda *args, **kwargs: None)
    monkeypatch.setattr(client, "should_use_stream_responses", lambda: False)
    monkeypatch.setattr(client.time, "sleep", holder["sleeps"].append)
    monkeypatch.delenv("RETAIN_TRANSLATION_TRANSPORT", raising=False)
    install.holder = holder
    return install


def _run(base_url: str) -> TranslationRunDiagnostics:
    return TranslationRunDiagnostics(
        provider_family="other", model="m", base_url=base_url, configured_workers=4,
        configured_batch_size=8, configured_classify_batch_size=12,
    )


def _ask(base_url: str, *, response_format=None, max_attempts=4) -> str:
    return client.request_chat_content(
        [{"role": "user", "content": "hello"}], api_key="sk-test", model="m", base_url=base_url,
        max_attempts=max_attempts, response_format=response_format, protocol="openai",
    )


QUOTA_REPLIES = [
    (OPENAI, 429, _err("insufficient_quota", type_="insufficient_quota", message="You exceeded your current quota"), {"Retry-After": "20"}, "insufficient_quota"),
    (ANTHROPIC, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "x", "details": {"error_code": "enforced_spend_limit_reached"}}}, {}, "enforced_spend_limit_reached"),
    (ANTHROPIC, 400, {"type": "error", "error": {"type": "invalid_request_error", "message": "Your credit balance is too low to access the Anthropic API."}}, {}, "credit_balance_too_low"),
    (ZHIPU, 429, _err("1113", message="余额不足或无可用资源包,请充值。"), {}, "1113"),
    (QWEN, 429, _err("BudgetLimitExceeded", message="budget"), {}, "BudgetLimitExceeded"),
    (QWEN, 400, _err("Arrearage", type_="Arrearage", message="Access denied, please make sure your account is in good standing."), {}, "Arrearage"),
    (OPENCODE, 429, _err("", message="Upstream request failed: Policy budget exceeded"), {}, "policy_budget_exceeded"),
]


@pytest.mark.parametrize("base_url,status,body,headers,code", QUOTA_REPLIES)
def test_quota_code_is_sent_once_then_whole_translation_stops(fake, base_url, status, body, headers, code) -> None:
    session = fake((status, body, headers))
    run = _run(base_url)
    with translation_run_diagnostics_scope(run):
        with pytest.raises(resilience.UpstreamQuotaExhausted) as first:
            # json_schema 退 json_object、换思考字段这些 400 的退路也不走
            _ask(base_url, response_format={"type": "json_schema", "json_schema": {"name": "x", "schema": {}}})
        assert len(session.sent) == 1, "额度用完不重试"
        assert fake.holder["sleeps"] == [], "不退避"
        assert first.value.status_code == status and first.value.provider_code == code
        assert f"HTTP {status}" in str(first.value) and code in str(first.value)
        assert "sk-test" not in str(first.value)

        with pytest.raises(resilience.UpstreamQuotaExhausted) as skipped:
            _ask(base_url)
        assert len(session.sent) == 1, "同一组凭据被拒过：不再发请求"
        assert "没有再发请求" in str(skipped.value)
        assert not transport.is_transport_error(skipped.value), "跳过的错误也不能被当成限流再重试"

    # 批量翻译结束、收尾修复前查一次：整份停下，归余额不足，不可重试
    try:
        resilience.raise_if_credential_rejected(run, base_url=base_url, api_key="sk-test")
    except requests.HTTPError as exc:
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    else:
        pytest.fail("被拒过的凭据应当让整份翻译停下")
    assert failure["failure_code"] == "upstream_quota_exhausted"
    assert failure["failure_category"] == "billing"
    assert failure["retryable"] is False
    assert failure["summary"] == f"上游账户余额或额度不足（HTTP {status}）"
    assert failure["raw_excerpt"].startswith(f"翻译 API 账户余额或额度不足（HTTP {status}，")
    assert code in failure["raw_excerpt"][:200]
    assert "稍后重试" not in failure["suggestion"]


def test_plan_without_the_model_stops_like_a_rejected_key(fake) -> None:
    """智谱 1311/1315：这个 Key 的套餐不能用这个模型，和 401/403 一样停下，归鉴权失败。"""
    session = fake((429, _err("1311", message="当前订阅套餐暂未开放该模型"), {}))
    run = _run(ZHIPU)
    with translation_run_diagnostics_scope(run):
        with pytest.raises(resilience.UpstreamAccessDenied) as caught:
            _ask(ZHIPU)
    assert len(session.sent) == 1 and fake.holder["sleeps"] == []
    assert caught.value.provider_code == "1311"
    with pytest.raises(requests.HTTPError) as stopped:
        resilience.raise_if_credential_rejected(run, base_url=ZHIPU, api_key="sk-test")
    try:
        raise stopped.value
    except requests.HTTPError as exc:
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert failure["failure_code"] == "auth_failed" and failure["retryable"] is False
    assert failure["raw_excerpt"].startswith("翻译 API Key 的套餐不能用这个模型（HTTP 429，智谱 业务码 1311")


RATE_LIMIT_REPLIES = [
    (OPENAI, _err("rate_limit_exceeded", type_="requests"), {"Retry-After": "2"}),
    (ANTHROPIC, {"type": "error", "error": {"type": "rate_limit_error", "message": "rate limit"}}, {"retry-after": "2"}),
    (ZHIPU, _err("1302", message="并发数过高"), {"Retry-After": "2"}),
    (QWEN, _err("insufficient_quota", type_="insufficient_quota", message="You exceeded your current quota"), {"Retry-After": "2"}),
]


@pytest.mark.parametrize("base_url,body,headers", RATE_LIMIT_REPLIES)
def test_real_rate_limit_still_backs_off_with_retry_after(fake, base_url, body, headers) -> None:
    session = fake((429, body, headers), (200, {"choices": [{"message": {"content": "ok"}}]}, {}))
    with translation_run_diagnostics_scope(_run(base_url)) :
        assert _ask(base_url) == "ok"
    assert len(session.sent) == 2
    assert fake.holder["sleeps"] == [2.0], "照 Retry-After 等"


def test_rate_limit_budget_error_is_still_rate_limited_not_quota() -> None:
    error = requests.HTTPError("429", response=_response(f"{OPENAI}/chat/completions", 429, _err("rate_limit_exceeded")))
    assert resilience.is_transient_upstream_error(error) and transport.is_transport_error(error)
    assert not resilience.is_quota_error(error) and not resilience.is_credential_rejection(error)
    quota = requests.HTTPError("429", response=_response(f"{OPENAI}/chat/completions", 429, _err("insufficient_quota")))
    assert not resilience.is_transient_upstream_error(quota) and not transport.is_transport_error(quota)
    assert resilience.is_quota_error(quota) and resilience.is_credential_rejection(quota)
    assert not resilience.is_auth_error(quota)
    # 千问欠费是 403：不是鉴权失败
    arrears = requests.HTTPError("403", response=_response(f"{QWEN}/chat/completions", 403, _err("Arrearage")))
    assert resilience.is_quota_error(arrears) and not resilience.is_auth_error(arrears)


def test_continuation_review_does_not_retry_quota() -> None:
    calls = {"n": 0}

    def quota(*_args, **_kwargs):
        calls["n"] += 1
        raise requests.HTTPError("429", response=_response(f"{OPENAI}/chat/completions", 429, _err("insufficient_quota")))

    with pytest.raises(resilience.UpstreamQuotaExhausted) as caught:
        continuation_review.review_candidate_pairs(
            [{"pair_id": "pair-001-001", "prev_item_id": "a", "next_item_id": "b"}],
            api_key="sk-test", model="m", base_url=OPENAI, request_label="t",
            request_chat_content_fn=quota, sleep_fn=lambda _s: pytest.fail("额度用完不该等"),
        )
    assert calls["n"] == 1
    assert "insufficient_quota" in str(caught.value)


# ---- 翻译 agent：OpenAI 协议（共用请求层）和 Anthropic 协议（agent 自己的请求） ----


def test_agent_openai_turns_quota_429_into_quota_exhausted() -> None:
    def chat(*_args, **_kwargs):
        raise resilience.rejection_error(
            "429 Client Error",
            response=_response(f"{OPENAI}/responses", 429, _err("insufficient_quota")),
            rejection=codes.classify_rejection(429, json.dumps(_err("insufficient_quota")), url=OPENAI),
        )

    send = agent_openai.make_openai_transport(api_key="k", model="m", base_url=OPENAI, protocol="openai", chat=chat)
    with pytest.raises(QuotaExhausted) as caught:
        send({"messages": [{"role": "user", "content": "hi"}]})
    assert "HTTP 429" in str(caught.value) and "insufficient_quota" in str(caught.value)

    def limited(*_args, **_kwargs):
        raise requests.HTTPError("429", response=_response(f"{OPENAI}/responses", 429, _err("rate_limit_exceeded")))

    send = agent_openai.make_openai_transport(api_key="k", model="m", base_url=OPENAI, protocol="openai", chat=limited)
    with pytest.raises(RateLimited):
        send({"messages": [{"role": "user", "content": "hi"}]})


def _http_error(url: str, status: int, body: dict, headers: dict) -> urllib.error.HTTPError:
    message = Message()
    for key, value in headers.items():
        message[key] = value
    return urllib.error.HTTPError(url, status, "error", message, io.BytesIO(json.dumps(body).encode()))


def test_agent_anthropic_transport_stops_on_spend_cap_without_retry(monkeypatch) -> None:
    url = f"{ANTHROPIC}/messages"
    sent: list[int] = []

    def urlopen(request, timeout):
        sent.append(1)
        raise _http_error(url, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "x",
                                                                "details": {"error_code": "enforced_spend_limit_reached"}}}, {})

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    waits: list[float] = []
    send = make_http_transport("k", url=url, sleep=waits.append, classify=codes.agent_http_classifier)
    with pytest.raises(QuotaExhausted) as caught:
        send({"model": "m"})
    assert sent == [1] and waits == []
    assert "HTTP 429，Anthropic 业务码 enforced_spend_limit_reached" in str(caught.value)


def test_agent_anthropic_transport_still_retries_rate_limit(monkeypatch) -> None:
    url = f"{ANTHROPIC}/messages"
    replies = [_http_error(url, 429, {"type": "error", "error": {"type": "rate_limit_error", "message": "slow"}}, {"retry-after": "3"})]

    class Reply(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    def urlopen(request, timeout):
        if replies:
            raise replies.pop(0)
        return Reply(b'{"content": [{"type": "text", "text": "ok"}]}')

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    waits: list[float] = []
    send = make_http_transport("k", url=url, sleep=waits.append, classify=codes.agent_http_classifier)
    assert send({"model": "m"})["content"][0]["text"] == "ok"
    assert waits == [3.0]


def test_agent_wires_the_shared_classifier_into_its_anthropic_transport(monkeypatch) -> None:
    seen: dict = {}
    monkeypatch.setattr(agent_flow, "make_http_transport", lambda api_key, **kwargs: seen.update(kwargs) or (lambda body: body))
    agent_flow._connection_transport(api_key="k", model="claude-haiku-5-5", base_url=ANTHROPIC)
    assert seen["classify"] is codes.agent_http_classifier


def test_agent_stop_for_quota_is_classified_as_quota_exhausted() -> None:
    class Outcome:
        stop_reason = "quota_exhausted"
        pages_done, pages_total = 2, 9
        stop_message = "model API HTTP 429: HTTP 429，Anthropic 业务码 enforced_spend_limit_reached：达到所在用量档位的月度消费封顶"

    try:
        raise agent_flow._stopped_error(Outcome())
    except agent_flow.AgentRunStopped as exc:
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert failure["failure_code"] == "upstream_quota_exhausted" and failure["retryable"] is False
    assert "enforced_spend_limit_reached" in failure["raw_excerpt"]

    Outcome.stop_reason = "auth_failed"
    try:
        raise agent_flow._stopped_error(Outcome())
    except agent_flow.AgentRunStopped as exc:
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert failure["failure_code"] == "auth_failed"


# ---- Rust 执行器：操作的 error_code 交回给 Python，照样整份停下、归类 ----


def _executor_reply(error_code: str, result: dict | None = None):
    from unittest import mock

    reply = mock.Mock(status_code=200)
    reply.json.return_value = {"operation_id": "op", "unit_id": "unit", "status": "failed", "error_code": error_code, "result": result}
    return reply


@pytest.mark.parametrize("error_code,error_class,failure_code", [
    ("quota_exhausted", ExecutorQuotaExhausted, "upstream_quota_exhausted"),
    ("payment_required", ExecutorQuotaExhausted, "upstream_quota_exhausted"),
    ("authentication_failed", ExecutorAccessDenied, "auth_failed"),
])
def test_executor_failure_codes_surface_as_typed_errors(error_code, error_class, failure_code) -> None:
    from unittest import mock

    executor = RustModelExecutorClient("http://127.0.0.1:41000", "job", "a" * 64)
    session = mock.Mock()
    session.request.return_value = _executor_reply(error_code, {"upstream_status": 429, "upstream_code": "1113"})
    with mock.patch.object(executor, "_session", return_value=session), pytest.raises(error_class) as caught:
        executor.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "s"}])
    assert session.request.call_count == 1
    assert "HTTP 429，业务码 1113" in str(caught.value)
    try:
        raise caught.value
    except Exception as exc:  # noqa: BLE001
        failure = json.loads(classify_exception(exc, default_stage="translation", provider="translation").to_json())
    assert failure["failure_code"] == failure_code and failure["retryable"] is False

from unittest import mock

import pytest
import requests

from retainpdf_translation.llm.shared.rust_executor import (
    AmbiguousModelRequest, ExecutorError, ExecutorUnavailable, RustModelExecutorClient,
)


def client():
    return RustModelExecutorClient("http://127.0.0.1:41000", "job", "a" * 64)


def response(state, *, http=200):
    result = mock.Mock(status_code=http)
    result.json.return_value = {"operation_id": "op", "unit_id": "unit", "status": state, "result": {"content": "译文", "reasoning_tokens": 3}}
    return result


def run(c):
    return c.request(operation_id="op", unit_id="unit", messages=[{"role": "user", "content": "source"}])


def test_submit_then_poll_never_sends_key_model_or_endpoint():
    c = client()
    session = mock.Mock()
    session.request.side_effect = [response("queued"), response("running"), response("succeeded")]
    with mock.patch.object(c, "_session", return_value=session), mock.patch("time.sleep"):
        receipt = run(c)
    assert receipt.content == "译文"
    assert receipt.metrics == {"reasoning_tokens": 3}
    assert [call.args[0] for call in session.request.call_args_list] == ["POST", "GET", "GET"]
    payload = session.request.call_args_list[0].kwargs["json"]
    assert not {"api_key", "model", "base_url"}.intersection(payload)
    assert all(call.kwargs["allow_redirects"] is False for call in session.request.call_args_list)


@pytest.mark.parametrize("state,error", [("ambiguous", AmbiguousModelRequest), ("failed", ExecutorError), ("cancelled", ExecutorError), ("unknown", ExecutorUnavailable)])
def test_terminal_errors_do_not_retry_or_fallback(state, error):
    c = client()
    session = mock.Mock()
    session.request.return_value = response(state)
    with mock.patch.object(c, "_session", return_value=session), pytest.raises(error):
        run(c)
    assert session.request.call_count == 1


def test_lost_submit_does_not_generate_a_new_paid_operation():
    c = client()
    session = mock.Mock()
    session.request.side_effect = requests.ReadTimeout("secret upstream body")
    with mock.patch.object(c, "_session", return_value=session), pytest.raises(ExecutorUnavailable) as error:
        run(c)
    assert "secret" not in str(error.value)
    assert session.request.call_count == 1


@pytest.mark.parametrize("url", ["http://example.com", "http://localhost:41000", "http://127.0.0.1:41000?token=secret", "http://user:secret@127.0.0.1", "file:///tmp/key", "http://127.0.0.1:99999"])
def test_origin_policy(url):
    with pytest.raises(ValueError):
        RustModelExecutorClient(url, "job", "a" * 64)


def test_local_http_error_does_not_leak_response_body():
    c = client()
    session = mock.Mock()
    session.request.return_value = response("failed", http=502)
    session.request.return_value.text = "secret response body"
    with mock.patch.object(c, "_session", return_value=session), pytest.raises(ExecutorUnavailable) as error:
        run(c)
    assert "secret" not in str(error.value)


def test_receipt_identity_is_checked():
    c = client()
    session = mock.Mock()
    wrong = response("succeeded")
    wrong.json.return_value["unit_id"] = "other"
    session.request.return_value = wrong
    with mock.patch.object(c, "_session", return_value=session), pytest.raises(ExecutorUnavailable, match="identity"):
        run(c)


def _terminal(state, result, *, error_code=None):
    reply = mock.Mock(status_code=200)
    body = {"operation_id": "op", "unit_id": "unit", "status": state, "result": result}
    if error_code:
        body["error_code"] = error_code
    reply.json.return_value = body
    return reply


@pytest.mark.parametrize(
    "state,error_code,result,expected",
    [
        # 按业务码停下：额度用完
        ("failed", "quota_exhausted", {"upstream_status": 429, "upstream_code": "insufficient_quota", "upstream_provider": "openai"},
         {"provider": "openai", "http_status": 429, "code": "insufficient_quota"}),
        # 认不出业务码的拒绝：只有状态码
        ("failed", "provider_rejected_request", {"upstream_status": 400, "upstream_provider": "qwen"},
         {"provider": "qwen", "http_status": 400, "code": None}),
        # 上游 5xx，结果不明
        ("ambiguous", "upstream_error", {"upstream_status": 503, "upstream_provider": "deepseek"},
         {"provider": "deepseek", "http_status": 503, "code": None}),
    ],
)
def test_executor_failure_carries_upstream_from_receipt(state, error_code, result, expected):
    """走 Rust 执行器的翻译失败：回执里的上游信息写到报错上，任务失败的 upstream 由它来。"""
    from retainpdf_base.upstream import upstream_info

    c = client()
    session = mock.Mock()
    session.request.return_value = _terminal(state, result, error_code=error_code)
    with mock.patch.object(c, "_session", return_value=session), pytest.raises(ExecutorError) as caught:
        run(c)
    assert upstream_info(caught.value) == expected


def test_executor_failure_without_upstream_response_has_no_upstream():
    """连不上、本地超时这类没收到上游回应的，不编造 upstream。"""
    from retainpdf_base.upstream import upstream_info

    c = client()
    session = mock.Mock()
    session.request.return_value = _terminal("failed", {"upstream_attempts": 1}, error_code="connect_failed")
    with mock.patch.object(c, "_session", return_value=session), pytest.raises(ExecutorError) as caught:
        run(c)
    assert upstream_info(caught.value) is None

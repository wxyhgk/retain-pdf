from unittest import mock

import pytest
import requests

from retainpdf_pipeline.translate.llm.shared.rust_executor import (
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

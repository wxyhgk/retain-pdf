"""Network error artifacts must not retain provider signed-URL credentials."""
from __future__ import annotations

import traceback
from unittest.mock import Mock

import pytest
import requests

from retainpdf_pipeline.ocr import retry
from retainpdf_pipeline.ocr.mineru import mineru_api
from retainpdf_pipeline.ocr.ocr_provider import paddle_api


SECRET = "SYNTHETIC_OCR_SECRET"
URL = f"https://example.invalid/result?token={SECRET}#{SECRET}"


def response(status, retry_after=None):
    result = requests.Response()
    result.status_code = status
    result.url = URL
    result.reason = f"provider message {SECRET}"
    if retry_after is not None:
        result.headers["Retry-After"] = retry_after
    return result


@pytest.mark.parametrize("case,expected,calls", [
    (503, retry.RetainNetworkError, 3),
    (429, retry.RetainRateLimitError, 3),
    (401, requests.HTTPError, 1),
    ("timeout", retry.RetainNetworkError, 3),
    ("connection", retry.RetainNetworkError, 3),
    ("invalid", requests.exceptions.InvalidURL, 1),
    ("budget", retry.RetainRateLimitError, 1),
])
def test_error_messages_and_chains_are_safe(monkeypatch, capsys, case, expected, calls):
    session = Mock()
    failures = {
        "timeout": requests.Timeout,
        "connection": requests.ConnectionError,
        "invalid": requests.exceptions.InvalidURL,
    }
    if case in failures:
        session.request.side_effect = failures[case](f"secret response from {URL}")
    else:
        session.request.return_value = response(429 if case == "budget" else case,
                                               "301" if case == "budget" else "1")
    sleeps = []
    monkeypatch.setattr(retry.time, "sleep", sleeps.append)
    with pytest.raises(expected) as caught:
        retry.request_with_retry(session, "get", URL, timeout=7, attempts=3,
                                 backoff_seconds=0.5, label="OCR test")
    assert session.request.call_count == calls
    assert len(sleeps) == calls - 1
    if case not in failures:
        assert sleeps == [1.0] * (calls - 1)
    assert SECRET not in capsys.readouterr().out
    assert SECRET not in "".join(traceback.format_exception(caught.value))
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None
    if case == 401:
        assert caught.value.response.status_code == 401


@pytest.mark.parametrize("module,entry,attempts_env", [
    (mineru_api, "request_mineru", mineru_api.MINERU_RETRY_ATTEMPTS_ENV),
    (paddle_api, "_request_with_retry", paddle_api.PADDLE_RETRY_ATTEMPTS_ENV),
])
def test_provider_wrapper_traceback_is_safe(monkeypatch, module, entry, attempts_env):
    session = Mock()
    session.request.return_value = response(503)
    monkeypatch.setattr(module, "_get_session", lambda: session)
    monkeypatch.setenv(attempts_env, "1")
    with pytest.raises(Exception) as caught:
        getattr(module, entry)("get", URL, timeout=1)
    assert SECRET not in "".join(traceback.format_exception(caught.value))
    assert caught.value.__cause__.__context__ is None


def test_success_after_retry_preserves_request_and_backoff(monkeypatch, capsys):
    session = Mock()
    successful = response(200)
    session.request.side_effect = [response(503), successful]
    sleeps = []
    monkeypatch.setattr(retry.time, "sleep", sleeps.append)
    monkeypatch.setattr(retry.random, "uniform", lambda *_: 0.0)
    assert retry.request_with_retry(session, "post", URL, timeout=7, attempts=3,
                                   backoff_seconds=0.5, label="OCR test", json={"x": 1}) is successful
    assert sleeps == [0.5]
    assert session.request.call_count == 2
    session.request.assert_called_with("post", URL, timeout=7, json={"x": 1})
    assert SECRET not in capsys.readouterr().out


@pytest.mark.parametrize("url", [f"https://user:{SECRET}@example.invalid/file", f"https://[{SECRET}?token={SECRET}"])
def test_url_sanitizer_does_not_expose_userinfo_or_invalid_input(url):
    assert SECRET not in retry.sanitize_url_for_log(url)

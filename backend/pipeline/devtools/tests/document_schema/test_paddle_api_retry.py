from __future__ import annotations


import pytest
import requests


from retainpdf_pipeline.ocr.ocr_provider import paddle_api
from retainpdf_pipeline.ocr.ocr_provider import paddle_markdown
from retainpdf_pipeline.ocr.mineru_provider import mineru_api
from retainpdf_pipeline.ocr import retry as network_retry


class _Response:
    def __init__(self, status_code: int, headers: dict[str, str] | None = None) -> None:
        self.status_code = status_code
        self.headers = headers or {}
        self.url = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
        self.reason = "error"

    def raise_for_status(self) -> None:
        raise requests.HTTPError(f"{self.status_code} Client Error", response=self)


class _Session:
    def __init__(self, response: _Response) -> None:
        self.response = response
        self.calls = 0

    def request(self, *_args, **_kwargs):
        self.calls += 1
        return self.response


def test_paddle_request_retries_429_and_raises_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))
    sleeps: list[float] = []

    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(paddle_api.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(paddle_api.PaddleRateLimitError):
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert session.calls == 2
    assert sleeps == [1.0]


def test_paddle_request_does_not_retry_auth_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(401))

    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    with pytest.raises(requests.HTTPError):
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert session.calls == 1


def test_paddle_optional_payload_sets_page_limit() -> None:
    payload = paddle_api.build_optional_payload("PaddleOCR-VL-1.5")
    assert payload["max_num_input_imgs"] == 999

    structure_payload = paddle_api.build_optional_payload("PP-StructureV3")
    assert structure_payload["max_num_input_imgs"] == 999


def test_paddle_model_defaults_and_aliases_use_shared_config() -> None:
    assert paddle_api.normalize_model_name("") == "PaddleOCR-VL-1.6"
    assert paddle_api.normalize_model_name("paddleocr-vl") == "PaddleOCR-VL-1.6"
    assert paddle_api.normalize_model_name("paddle-ocr-vl-1.6") == "PaddleOCR-VL-1.6"
    assert paddle_api.normalize_model_name("paddleocr-vl-1.5") == "PaddleOCR-VL-1.5"


def test_mineru_request_retries_429_and_raises_rate_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))
    sleeps: list[float] = []

    monkeypatch.setattr(mineru_api, "_get_session", lambda: session)
    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(mineru_api.time, "sleep", lambda seconds: sleeps.append(seconds))

    with pytest.raises(mineru_api.MinerURateLimitError):
        mineru_api.request_mineru("get", "https://mineru.net/api/v4/extract/task/test", timeout=1)

    assert session.calls == 2
    assert sleeps == [1.0]


def test_sanitize_url_for_log_strips_query_and_fragment() -> None:
    signed_url = "https://cdn.example.com/bundle.zip?X-Amz-Signature=super-secret&X-Amz-Expires=900#frag"
    sanitized = network_retry.sanitize_url_for_log(signed_url)
    assert sanitized.startswith("https://cdn.example.com/bundle.zip")
    assert "super-secret" not in sanitized
    assert "X-Amz-Signature" not in sanitized
    assert "frag" not in sanitized


def test_sanitize_url_for_log_leaves_url_without_query_untouched() -> None:
    plain_url = "https://cdn.example.com/bundle.zip"
    assert network_retry.sanitize_url_for_log(plain_url) == plain_url


def test_mineru_request_retry_print_redacts_query_string(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    session = _Session(_Response(429, headers={"Retry-After": "1"}))

    monkeypatch.setattr(mineru_api, "_get_session", lambda: session)
    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "2")
    monkeypatch.setattr(mineru_api.time, "sleep", lambda seconds: None)

    signed_url = "https://mineru.net/api/v4/extract/task/test?token=SUPER-SECRET-TOKEN"
    with pytest.raises(mineru_api.MinerURateLimitError):
        mineru_api.request_mineru("get", signed_url, timeout=1)

    captured = capsys.readouterr()
    assert "SUPER-SECRET-TOKEN" not in captured.out
    assert "redacted" in captured.out


def test_paddle_markdown_remote_image_uses_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    class Response:
        content = b"image-bytes"

    calls: list[tuple[str, str]] = []

    def fake_request_with_retry(_session, method, url, **_kwargs):
        calls.append((method, url))
        return Response()

    monkeypatch.setattr(paddle_markdown, "request_with_retry", fake_request_with_retry)

    assert paddle_markdown.decode_paddle_markdown_image("https://example.test/image.png") == b"image-bytes"
    assert calls == [("get", "https://example.test/image.png")]


class _JsonResponse(_Response):
    def __init__(self, status_code: int, body: dict) -> None:
        super().__init__(status_code)
        self._body = body

    def json(self) -> dict:
        return self._body


def _classify(exc: BaseException) -> dict:
    import json

    from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception

    try:
        raise exc
    except BaseException as caught:  # noqa: BLE001
        return json.loads(classify_exception(caught, default_stage="provider", provider="ocr").to_json())


def test_paddle_daily_quota_403_is_quota_not_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    # 官方异步接口：当日页数额度用完是 HTTP 403 + code=12001，以前按 403 归「鉴权失败」，用户会去换 Token
    session = _Session(_JsonResponse(403, {"traceId": "trace-q", "code": 12001, "msg": "今日解析页数额度已用完"}))
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    with pytest.raises(paddle_api.PaddleQuotaExhausted) as caught:
        paddle_api._request_with_retry("post", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs?sig=SECRET", timeout=1)

    assert session.calls == 1
    error = caught.value
    assert isinstance(error, requests.HTTPError)
    assert error.status_code == 403
    assert error.provider_code == "12001"
    assert "SECRET" not in str(error)
    assert "今日解析页数额度已用完" in str(error)

    payload = _classify(error)
    assert payload["failure_code"] == "upstream_quota_exhausted"
    assert payload["failure_code"] != "auth_failed"
    assert payload["retryable"] is False
    assert payload["provider_code"] == "12001"
    assert payload["summary"] == "PaddleOCR 今日解析页数额度已用完（12001）"
    assert "明天" in payload["suggestion"]


def test_paddle_403_with_legacy_error_fields_is_read_too(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_JsonResponse(403, {"logId": "trace-q", "errorCode": 12001, "errorMsg": "quota"}))
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)

    with pytest.raises(paddle_api.PaddleQuotaExhausted):
        paddle_api._request_with_retry("post", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)


def test_paddle_401_with_body_is_still_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _Session(_JsonResponse(401, {"traceId": "trace-a", "code": 401, "msg": "Token 无效"}))
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)

    with pytest.raises(paddle_api.PaddleRequestRejected) as caught:
        paddle_api._request_with_retry("get", "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs", timeout=1)

    assert not isinstance(caught.value, paddle_api.PaddleQuotaExhausted)
    assert _classify(caught.value)["failure_code"] == "auth_failed"


def test_paddle_envelope_reads_official_code_and_msg_fields() -> None:
    # 官方字段是 code/msg/traceId；以前只读 errorCode，code≠0 的包会被当成成功
    assert paddle_api._check_envelope({"code": 0, "msg": "Success", "data": {}}, stage="poll") == {
        "code": 0,
        "msg": "Success",
        "data": {},
    }
    assert paddle_api._check_envelope({"errorCode": 0, "data": {}}, stage="poll")["data"] == {}

    with pytest.raises(paddle_api.PaddleQuotaExhausted) as quota:
        paddle_api._check_envelope({"traceId": "t-1", "code": 12001, "msg": "额度已用完"}, stage="submit")
    assert quota.value.provider_code == "12001"
    assert _classify(quota.value)["failure_code"] == "upstream_quota_exhausted"

    with pytest.raises(paddle_api.PaddleRequestRejected) as rejected:
        paddle_api._check_envelope({"traceId": "t-2", "code": 10005, "msg": "文件内容无法解析"}, stage="submit")
    assert not isinstance(rejected.value, paddle_api.PaddleQuotaExhausted)
    assert "code=10005" in str(rejected.value)
    assert "文件内容无法解析" in str(rejected.value)
    assert "logId=t-2" in str(rejected.value)

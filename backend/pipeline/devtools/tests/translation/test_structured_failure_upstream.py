"""结构化失败的 ``upstream: {provider, http_status, code}`` 和 OCR 失败的 ``provider``（2026-11-23）。

前端拿 upstream 去错误码目录（``GET /api/v1/providers/error-codes``）查条目：翻译按接口地址认服务商，OCR 写
paddle / mineru / glm_ocr。只加信息，不改失败分类：每个用例都核对分类和不带上游信息时一样。
"""

from __future__ import annotations

import json

import pytest
import requests

from retainpdf_pipeline.foundation.shared import structured_errors
from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import _check_envelope
from retainpdf_pipeline.ocr.ocr_provider.paddle_api import PaddleRequestRejected
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.workflow.checkpoint import NothingTranslatedError

CLASSIFICATION_KEYS = ("failure_code", "failure_category", "failed_stage", "retryable", "summary", "provider_code")


@pytest.fixture(autouse=True)
def _no_registered_ocr_vendor():
    structured_errors.set_ocr_vendor("")
    yield
    structured_errors.set_ocr_vendor("")


def _response(status: int, payload: dict, url: str) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = "Too Many Requests" if status == 429 else "Error"
    response.url = url
    response._content = json.dumps(payload).encode()
    return response


def _classify(exc: BaseException, *, default_stage: str, provider: str) -> dict:
    try:
        raise exc
    except BaseException as caught:  # noqa: BLE001
        return json.loads(classify_exception(caught, default_stage=default_stage, provider=provider).to_json())


def _same_classification_as_plain(exc: BaseException, payload: dict, *, default_stage: str, provider: str) -> None:
    """同样文字、不带任何上游属性的异常分类结果一样：上游信息不影响分类。"""
    plain = _classify(RuntimeError(str(exc)), default_stage=default_stage, provider=provider)
    if type(exc).__name__ != "RuntimeError":
        # 类名会进分类器读的文字；换成同名的普通异常再比
        plain_type = type(type(exc).__name__, (RuntimeError,), {})
        plain = _classify(plain_type(str(exc)), default_stage=default_stage, provider=provider)
    for key in CLASSIFICATION_KEYS:
        assert payload[key] == plain[key], key


def test_translation_429_quota_reports_vendor_status_and_code() -> None:
    url = "https://api.openai.com/v1/chat/completions"
    error = requests.HTTPError(
        f"429 Client Error: Too Many Requests for url: {url}",
        response=_response(429, {"error": {"type": "insufficient_quota", "code": "insufficient_quota"}}, url),
    )
    payload = _classify(error, default_stage="translation", provider="translation")
    assert payload["upstream"] == {"provider": "openai", "http_status": 429, "code": "insufficient_quota"}
    assert payload["provider"] == "translation", "翻译失败的 provider 照旧"
    assert payload["failure_code"] == "upstream_rate_limited", "这里只加信息；429 额度怎么分类是另一件事"


def test_request_layer_tags_the_vendor_from_the_configured_base_url(monkeypatch) -> None:
    """响应里没有地址（或经代理）时，按配置的 base_url 认服务商：请求层失败时写在异常上。"""

    class _Session:
        def post(self, url, **kwargs):
            response = _response(401, {"error": {"code": "invalid_api_key"}}, "")
            response.url = ""
            return response

    monkeypatch.setattr(client, "get_session", lambda: _Session())
    monkeypatch.setattr(client, "_prewarm_dns", lambda *args, **kwargs: None)
    monkeypatch.setattr(client, "should_use_stream_responses", lambda: False)
    with pytest.raises(requests.HTTPError) as caught:
        client.request_chat_content(
            [{"role": "user", "content": "hi"}],
            api_key="k",
            model="deepseek-chat",
            base_url="https://api.deepseek.com/v1",
            max_attempts=1,
        )
    assert caught.value.upstream_provider == "deepseek"
    payload = _classify(caught.value, default_stage="translation", provider="translation")
    assert payload["upstream"] == {"provider": "deepseek", "http_status": 401, "code": "invalid_api_key"}
    assert payload["failure_code"] == "auth_failed"


def test_nothing_translated_reads_the_dominant_upstream_error_from_its_text() -> None:
    error = NothingTranslatedError(
        "Translation checkpoint cannot commit a document with zero translated items; most common upstream error: "
        "HTTPError: 429 Client Error: Too Many Requests for url: https://open.bigmodel.cn/api/paas/v4/chat/completions"
        ' | response_body={"error":{"code":"1113","message":"余额不足或无可用资源包,请充值。"}} (12/12 failed items)'
    )
    payload = _classify(error, default_stage="translation", provider="translation")
    assert payload["upstream"] == {"provider": "zhipu", "http_status": 429, "code": "1113"}
    _same_classification_as_plain(error, payload, default_stage="translation", provider="translation")


def test_glm_ocr_1113_reports_vendor_as_provider_and_upstream() -> None:
    structured_errors.set_ocr_vendor("glm_ocr")
    error = glm_ocr_api.GlmOcrQuotaExhausted(
        "GLM-OCR 调用额度不足，请检查当前智谱 API Key 对应账号的余额或资源包（HTTP 429，code=1113 message=余额不足）",
        status_code=429,
        provider_code="1113",
    )
    payload = _classify(error, default_stage="provider", provider="ocr")
    assert payload["provider"] == "glm_ocr", "不再是泛称 ocr"
    assert payload["upstream"] == {"provider": "glm_ocr", "http_status": 429, "code": "1113"}
    assert payload["failure_code"] == "upstream_quota_exhausted"


def test_glm_ocr_rejection_carries_status_and_code_without_changing_its_class(monkeypatch) -> None:
    class _Once:
        def request(self, *args, **kwargs):
            return _response(401, {"error": {"code": "1000", "message": "身份验证失败"}}, glm_ocr_api.GLM_OCR_API_URL)

    with pytest.raises(glm_ocr_api.GlmOcrRequestRejected) as caught:
        glm_ocr_api.parse_pdf(b"%PDF", api_key="secret", session=_Once())
    assert not hasattr(caught.value, "status_code"), "分类读 status_code；这里只写 upstream_* 属性"
    structured_errors.set_ocr_vendor("glm_ocr")
    payload = _classify(caught.value, default_stage="provider", provider="ocr")
    assert payload["upstream"] == {"provider": "glm_ocr", "http_status": 401, "code": "1000"}
    _same_classification_as_plain(caught.value, payload, default_stage="provider", provider="ocr")


def test_paddle_envelope_error_reports_the_error_code() -> None:
    structured_errors.set_ocr_vendor("paddle")
    # 返回包里的报错是 PaddleRequestRejected（fix/failure-fallback-classes 起，12001 等要单独归类），不再是 RuntimeError
    with pytest.raises(PaddleRequestRejected) as caught:
        _check_envelope({"errorCode": 10003, "errorMsg": "file error", "logId": "log-123456"}, stage="submit")
    payload = _classify(caught.value, default_stage="provider", provider="ocr")
    assert payload["provider"] == "paddle"
    assert payload["upstream"] == {"provider": "paddle", "http_status": None, "code": "10003"}
    _same_classification_as_plain(caught.value, payload, default_stage="provider", provider="ocr")


def test_paddle_http_rejection_reads_the_body() -> None:
    structured_errors.set_ocr_vendor("paddle")
    url = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
    error = requests.HTTPError(
        "HTTPError status=403 method=POST url=" + url,
        response=_response(403, {"traceId": "t", "code": 12001, "msg": "daily quota", "data": None}, url),
    )
    payload = _classify(error, default_stage="provider", provider="ocr")
    assert payload["upstream"] == {"provider": "paddle", "http_status": 403, "code": "12001"}, (
        "OCR 服务商的地址认不出翻译服务商时，用登记的 OCR 服务商"
    )


def test_ocr_failure_without_upstream_still_names_the_vendor() -> None:
    structured_errors.set_ocr_vendor("mineru")
    payload = _classify(TimeoutError("Timed out waiting for MinerU task t-1"), default_stage="provider", provider="ocr")
    assert payload["provider"] == "mineru"
    assert payload["upstream"] is None, "读不出 HTTP 状态和错误码时是 null"


def test_translation_stage_failure_in_the_full_workflow_keeps_its_provider() -> None:
    """provider-case 一个进程跑 OCR 加翻译：翻译阶段的失败不写 OCR 服务商。"""
    structured_errors.set_ocr_vendor("paddle")
    payload = _classify(
        RuntimeError("PlaceholderInventoryError: placeholder inventory mismatch"),
        default_stage="translation",
        provider="ocr",
    )
    assert payload["provider"] == "ocr"
    assert payload["upstream"] is None


def test_without_a_registered_vendor_the_generic_provider_stays() -> None:
    payload = _classify(RuntimeError("boom"), default_stage="provider", provider="ocr")
    assert payload["provider"] == "ocr"
    assert "upstream" in payload and payload["upstream"] is None


def test_mineru_api_error_reports_the_business_code(monkeypatch) -> None:
    from retainpdf_pipeline.ocr.mineru_provider import mineru_api

    url = "https://mineru.net/api/v4/extract/task"
    monkeypatch.setattr(
        mineru_api,
        "request_mineru",
        lambda *args, **kwargs: _response(200, {"code": -60018, "msg": "每日解析额度已用完", "data": None}, url),
    )
    with pytest.raises(RuntimeError, match="MinerU API error") as caught:
        mineru_api.post_json(url, {}, {})
    structured_errors.set_ocr_vendor("mineru")
    payload = _classify(caught.value, default_stage="provider", provider="ocr")
    assert payload["upstream"] == {"provider": "mineru", "http_status": 200, "code": "-60018"}
    _same_classification_as_plain(caught.value, payload, default_stage="provider", provider="ocr")

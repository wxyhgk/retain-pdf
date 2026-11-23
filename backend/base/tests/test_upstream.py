"""任务失败的上游信息（``retainpdf_base.upstream``）：服务商编号、HTTP 状态、服务商自己的错误码。"""

from __future__ import annotations

import json

import pytest

from retainpdf_base import ocr_stream
from retainpdf_base.upstream import llm_vendor_for_url
from retainpdf_base.upstream import provider_error_code
from retainpdf_base.upstream import response_body_code
from retainpdf_base.upstream import tag_upstream
from retainpdf_base.upstream import upstream_info


class _Response:
    """只有 requests.Response 里用到的几样：状态码、地址、JSON 响应体。"""

    def __init__(self, status: int, body, url: str = "") -> None:
        self.status_code = status
        self.url = url
        self._body = body

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class _HttpError(RuntimeError):
    def __init__(self, message: str, response: _Response | None) -> None:
        super().__init__(message)
        self.response = response


@pytest.mark.parametrize(
    ("url", "vendor"),
    [
        ("https://api.openai.com/v1", "openai"),
        ("https://api.anthropic.com", "anthropic"),
        ("https://api.deepseek.com/v1/chat/completions", "deepseek"),
        ("https://open.bigmodel.cn/api/paas/v4", "zhipu"),
        ("https://api.z.ai/api/paas/v4", "zhipu"),
        ("https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen"),
        ("https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "qwen"),
        ("https://opencode.ai/zen/v1", "opencode"),
        ("https://my-proxy.example/v1", "custom"),
        ("api.openai.com", "openai"),
        ("", ""),
    ],
)
def test_llm_vendor_follows_the_error_code_catalogue_hosts(url: str, vendor: str) -> None:
    assert llm_vendor_for_url(url) == vendor


def test_lookalike_host_is_not_the_vendor() -> None:
    assert llm_vendor_for_url("https://api.openai.com.evil.example/v1") == "custom"
    assert llm_vendor_for_url("https://notapi.openai.com/v1") == "custom"


@pytest.mark.parametrize(
    ("body", "code"),
    [
        # OpenAI：先 error.code，没有再 error.type
        ({"error": {"type": "insufficient_quota", "code": "insufficient_quota"}}, "insufficient_quota"),
        ({"error": {"type": "rate_limit_error", "code": None}}, "rate_limit_error"),
        # Anthropic：error.details.error_code 优先，没有时 error.type
        (
            {"type": "error", "error": {"type": "rate_limit_error", "details": {"error_code": "enforced_spend_limit_reached"}}},
            "enforced_spend_limit_reached",
        ),
        ({"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}, "overloaded_error"),
        # 智谱业务码（数字也写成字符串）
        ({"error": {"code": "1113", "message": "余额不足"}}, "1113"),
        ({"error": {"code": 1302}}, "1302"),
        # DashScope 原生、GLM-OCR 顶层、MinerU、Paddle
        ({"code": "Arrearage", "message": "Access denied"}, "Arrearage"),
        ({"code": -60018, "msg": "quota", "data": None}, "-60018"),
        ({"errorCode": 10003, "errorMsg": "bad file", "logId": "x"}, "10003"),
        # 成功码、空值不算错误码
        ({"code": 0, "msg": "ok"}, ""),
        ({"errorCode": 0}, ""),
        ({"error": {"code": "", "type": ""}}, ""),
        ([], ""),
        (None, ""),
    ],
)
def test_provider_error_code_reads_each_vendor_shape(body, code: str) -> None:
    assert provider_error_code(body) == code


def test_upstream_info_reads_response_status_body_and_host() -> None:
    error = _HttpError(
        "429 Client Error",
        _Response(429, {"error": {"code": "insufficient_quota"}}, "https://api.openai.com/v1/chat/completions"),
    )
    assert upstream_info(error) == {"provider": "openai", "http_status": 429, "code": "insufficient_quota"}


def test_explicit_tags_win_over_the_response() -> None:
    error = _HttpError("x", _Response(500, {"error": {"code": "a"}}, "https://my-proxy.example/v1/chat/completions"))
    tag_upstream(error, provider="deepseek", http_status=503, code="b")
    assert upstream_info(error) == {"provider": "deepseek", "http_status": 503, "code": "b"}
    # 只补没写过的
    tag_upstream(error, provider="openai", http_status=400, code="c")
    assert upstream_info(error) == {"provider": "deepseek", "http_status": 503, "code": "b"}


def test_status_code_and_provider_code_attributes_are_read() -> None:
    class QuotaExhausted(RuntimeError):
        status_code = 429
        provider_code = "1113"

    assert upstream_info(QuotaExhausted("x"), context_provider="glm_ocr") == {
        "provider": "glm_ocr",
        "http_status": 429,
        "code": "1113",
    }


def test_explicit_cause_is_followed_but_implicit_context_is_not() -> None:
    inner = _HttpError("401", _Response(401, {"error": {"code": "invalid_api_key"}}, "https://api.deepseek.com/v1"))
    try:
        try:
            raise inner
        except _HttpError as caught:
            raise RuntimeError("wrapped") from caught
    except RuntimeError as outer:
        assert upstream_info(outer) == {"provider": "deepseek", "http_status": 401, "code": "invalid_api_key"}

    try:
        try:
            raise inner
        except _HttpError:
            raise RuntimeError("unrelated failure while handling")  # noqa: B904 - 就是要测隐式的 __context__
    except RuntimeError as outer:
        assert upstream_info(outer) is None, "隐式的 __context__ 可能和这次失败无关，不安上去"


def test_upstream_error_attribute_is_followed() -> None:
    error = RuntimeError("nothing translated")
    error.upstream_error = _HttpError("402", _Response(402, {"error": {"type": "unknown_error"}}, "https://api.deepseek.com"))
    assert upstream_info(error) == {"provider": "deepseek", "http_status": 402, "code": "unknown_error"}


def test_without_status_or_code_there_is_no_upstream() -> None:
    assert upstream_info(RuntimeError("timed out")) is None
    timeout = tag_upstream(RuntimeError("timed out"), provider="openai")
    assert upstream_info(timeout, context_provider="paddle") is None, "只知道服务商查不了目录"


def test_unreadable_body_still_gives_the_status() -> None:
    error = _HttpError("502", _Response(502, ValueError("not json"), "https://api.anthropic.com/v1/messages"))
    assert upstream_info(error) == {"provider": "anthropic", "http_status": 502, "code": None}


def test_response_body_code_reads_the_json_after_the_marker() -> None:
    text = (
        'HTTPError: 429 Client Error: Too Many Requests for url: https://open.bigmodel.cn/api/paas/v4/chat/completions'
        ' | response_body={"error":{"code":"1113","message":"余额不足 | 请充值"}} (3/3 failed items)'
    )
    assert response_body_code(text) == "1113"
    assert response_body_code("response_body=<empty>") == ""
    assert response_body_code('response_body={"error":{"code":"1113"...<truncated>') == ""
    assert response_body_code("no body here") == ""


def test_ocr_stream_failure_carries_the_upstream(tmp_path) -> None:
    writer = ocr_stream.OcrStreamWriter(tmp_path, provider="glm_ocr", total_pages=10)
    writer.fail("GlmOcrQuotaExhausted: 额度不足", upstream={"provider": "glm_ocr", "http_status": 429, "code": "1113"})
    manifest = json.loads(ocr_stream.manifest_path(tmp_path).read_text(encoding="utf-8"))
    assert manifest["upstream"] == {"provider": "glm_ocr", "http_status": 429, "code": "1113"}

    with pytest.raises(ocr_stream.OcrStreamFailed) as caught:
        ocr_stream.wait_for_ocr_stream(tmp_path, sleep=lambda _: None)
    assert upstream_info(caught.value) == {"provider": "glm_ocr", "http_status": 429, "code": "1113"}


def test_ocr_stream_failure_without_upstream_keeps_the_old_manifest(tmp_path) -> None:
    writer = ocr_stream.OcrStreamWriter(tmp_path, provider="paddle", total_pages=3)
    writer.fail("TimeoutError: timed out")
    manifest = json.loads(ocr_stream.manifest_path(tmp_path).read_text(encoding="utf-8"))
    assert "upstream" not in manifest
    with pytest.raises(ocr_stream.OcrStreamFailed) as caught:
        ocr_stream.wait_for_ocr_stream(tmp_path, sleep=lambda _: None)
    assert upstream_info(caught.value) is None


def test_ocr_context_wins_over_the_host_guess() -> None:
    """GLM-OCR 的地址也是智谱的：OCR worker 里按 OCR 服务商记，不按地址认成翻译的 zhipu。"""
    error = _HttpError("429", _Response(429, {"error": {"code": "1302"}}, "https://open.bigmodel.cn/api/paas/v4/layout_parsing"))
    assert upstream_info(error, context_provider="glm_ocr")["provider"] == "glm_ocr"
    assert upstream_info(error)["provider"] == "zhipu"
    unknown_host = _HttpError("403", _Response(403, {"code": 12001}, "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"))
    assert upstream_info(unknown_host, context_provider="paddle")["provider"] == "paddle"
    assert upstream_info(unknown_host)["provider"] == "custom"

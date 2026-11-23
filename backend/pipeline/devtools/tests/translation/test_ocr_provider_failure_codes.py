"""OCR 服务商业务码 → 任务失败码（fix/ocr-provider-codes，2026-11-23）。

Python 这条路（OCR 和翻译并行、分片上传、GLM-OCR）按业务码在异常上写明归类（``ocr/provider_failures.py``），
结构化失败照它给 failure_code、summary（带服务商名、业务码和原话）、suggestion、retryable。
Rust 那条路（``retainpdf-core`` 的 ``job_failure_ocr_provider.rs``）按 OCR 诊断的分类给同样的失败码。
响应都是假的，不连真服务。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import requests

from retainpdf_pipeline.foundation.shared import structured_errors
from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_pipeline.ocr import provider_failures
from retainpdf_pipeline.ocr import retry as ocr_retry
from retainpdf_pipeline.ocr.mineru_provider import mineru_api
from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
from retainpdf_pipeline.ocr.ocr_provider import paddle_api

PADDLE_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
MINERU_URL = "https://mineru.net/api/v4/extract/task"


@pytest.fixture(autouse=True)
def _quiet(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    sleeps: list[float] = []
    for module in (ocr_retry.time, paddle_api.time, mineru_api.time):
        monkeypatch.setattr(module, "sleep", sleeps.append)
    monkeypatch.setattr(ocr_retry.random, "uniform", lambda *_: 0.0)
    structured_errors.set_ocr_vendor("")
    yield sleeps
    structured_errors.set_ocr_vendor("")


def _response(status: int, payload: dict, url: str) -> requests.Response:
    response = requests.Response()
    response.status_code = status
    response.reason = "Error"
    response.url = url
    response._content = json.dumps(payload).encode()
    return response


class _Replay:
    """按顺序回放响应（最后一个一直重复），记下请求了几次。"""

    def __init__(self, *responses: requests.Response) -> None:
        self.responses = list(responses)
        self.calls = 0

    def request(self, *_args, **_kwargs) -> requests.Response:
        self.calls += 1
        return self.responses[min(self.calls, len(self.responses)) - 1]


def _classify(exc: BaseException) -> dict:
    try:
        raise exc
    except BaseException as caught:  # noqa: BLE001
        return json.loads(classify_exception(caught, default_stage="provider", provider="ocr").to_json())


# ---- PaddleOCR ----


@pytest.mark.parametrize(
    ("code", "expected", "retryable"),
    [
        (10001, "ocr_file_rejected", False),
        (10003, "ocr_file_rejected", False),
        (10004, "ocr_file_rejected", False),
        (10005, "ocr_file_rejected", False),
        (10006, "ocr_file_rejected", False),
        (10002, "upstream_bad_request", False),
        (10007, "upstream_bad_request", False),
        (10008, "upstream_bad_request", False),
        (10009, "upstream_bad_request", False),
        (11002, "ocr_provider_failed", True),
    ],
)
def test_paddle_business_codes_map_to_failures(code: int, expected: str, retryable: bool) -> None:
    # HTTP 200 的返回包、HTTP 400 带返回体，两种都按业务码认
    with pytest.raises(paddle_api.PaddleRequestRejected) as enveloped:
        paddle_api._check_envelope({"traceId": "t-1", "code": code, "msg": "服务商原话"}, stage="submit")
    session = _Replay(_response(400, {"traceId": "t-2", "errorCode": code, "errorMsg": "服务商原话"}, PADDLE_URL))
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(paddle_api, "_get_session", lambda: session)
        with pytest.raises(paddle_api.PaddleRequestRejected) as http:
            paddle_api._request_with_retry("post", PADDLE_URL, timeout=1)
    assert session.calls == 1, "不重试的 4xx"
    for error in (enveloped.value, http.value):
        payload = _classify(error)
        assert payload["failure_code"] == expected
        assert payload["retryable"] is retryable
        assert payload["summary"].startswith("PaddleOCR ")
        assert f"（{code}）：服务商原话" in payload["summary"]
        assert payload["provider_code"] == str(code)


def test_paddle_expired_task_says_resubmit() -> None:
    with pytest.raises(paddle_api.PaddleRequestRejected) as caught:
        paddle_api._check_envelope({"code": 11002, "msg": "job expired"}, stage="poll")
    payload = _classify(caught.value)
    assert payload["failure_code"] == "ocr_provider_failed"
    assert "任务已过期" in payload["summary"]
    assert "重新提交" in payload["suggestion"]


def test_paddle_queue_full_submit_backs_off_and_resubmits(tmp_path: Path, monkeypatch, _quiet) -> None:
    pdf = tmp_path / "a.pdf"
    pdf.write_bytes(b"%PDF")
    queue_full = _response(200, {"traceId": "t", "code": 10010, "msg": "任务提交队列已满，请稍后重试"}, PADDLE_URL)
    accepted = _response(200, {"traceId": "t-ok", "code": 0, "msg": "Success", "data": {"jobId": "job-1"}}, PADDLE_URL)
    session = _Replay(queue_full, queue_full, accepted)
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    job_id, trace = paddle_api.submit_local_file(token="tok", file_path=pdf, model="PaddleOCR-VL-1.6", optional_payload={})

    assert (job_id, trace) == ("job-1", "t-ok")
    assert session.calls == 3
    assert _quiet == [10.0, 20.0], "退避基数 0.5s × 20 × 第几次"


def test_paddle_queue_full_to_the_end_is_a_retryable_rate_limit(tmp_path: Path, monkeypatch) -> None:
    queue_full = _response(400, {"traceId": "t", "code": 10010, "msg": "任务提交队列已满，请稍后重试"}, PADDLE_URL)
    session = _Replay(queue_full)
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    with pytest.raises(paddle_api.PaddleRequestRejected) as caught:
        paddle_api.submit_remote_url(token="tok", source_url="https://example.test/a.pdf", model="m", optional_payload={})

    assert session.calls == 3
    payload = _classify(caught.value)
    assert payload["failure_code"] == "upstream_rate_limited"
    assert payload["retryable"] is True
    assert payload["summary"] == "PaddleOCR 排队已满或请求太快（10010）：任务提交队列已满，请稍后重试"


def test_paddle_file_rejection_is_not_resubmitted(tmp_path: Path, monkeypatch) -> None:
    session = _Replay(_response(400, {"code": 10003, "msg": "file too large"}, PADDLE_URL))
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    with pytest.raises(paddle_api.PaddleRequestRejected):
        paddle_api.submit_remote_url(token="tok", source_url="https://example.test/a.pdf", model="m", optional_payload={})
    assert session.calls == 1


def test_paddle_server_error_to_the_end_says_try_later(monkeypatch) -> None:
    session = _Replay(_response(500, {"code": 500, "msg": "internal error"}, PADDLE_URL))
    monkeypatch.setattr(paddle_api, "_get_session", lambda: session)
    monkeypatch.setenv(paddle_api.PADDLE_RETRY_ATTEMPTS_ENV, "3")

    with pytest.raises(paddle_api.PaddleNetworkError) as caught:
        paddle_api.submit_remote_url(token="tok", source_url="https://example.test/a.pdf", model="m", optional_payload={})

    assert session.calls == 3, "500 在提交处重试（request_with_retry）"
    assert caught.value.status_code == 500
    payload = _classify(caught.value)
    assert payload["failure_code"] == "ocr_provider_failed"
    assert payload["retryable"] is True
    assert payload["summary"] == "PaddleOCR 服务暂时出错（HTTP 500），稍后再试"
    assert payload["upstream"]["http_status"] == 500


def test_paddle_failed_task_11003_is_a_task_failure_with_the_reason(monkeypatch) -> None:
    # 官方：任务失败时 GET 返回 HTTP 200、code=11003，原因在 data.errorMsg；以前整个查询被当成请求被拒
    failed = _response(
        200,
        {"traceId": "t", "code": 11003, "msg": "Job failed", "data": {"jobId": "j", "state": "failed", "errorMsg": "第 3 页解析出错"}},
        PADDLE_URL,
    )
    monkeypatch.setattr(paddle_api, "_get_session", lambda: _Replay(failed))

    data = paddle_api.query_job(token="tok", job_id="j")
    assert data["state"] == "failed" and data["errorMsg"] == "第 3 页解析出错"

    with pytest.raises(paddle_api.PaddleTaskFailed) as caught:
        paddle_api.poll_until_done(token="tok", job_id="j", poll_interval=1, poll_timeout=10)
    assert "第 3 页解析出错" in str(caught.value)
    payload = _classify(caught.value)
    assert payload["failure_code"] == "ocr_provider_failed"
    assert payload["retryable"] is True
    assert payload["summary"] == "PaddleOCR 解析这份文件失败（11003）：第 3 页解析出错"


def test_paddle_failed_state_without_code_still_carries_the_reason(monkeypatch) -> None:
    failed = _response(200, {"code": 0, "data": {"jobId": "j", "state": "failed", "errorMsg": "boom"}}, PADDLE_URL)
    monkeypatch.setattr(paddle_api, "_get_session", lambda: _Replay(failed))
    with pytest.raises(paddle_api.PaddleTaskFailed) as caught:
        paddle_api.poll_until_done(token="tok", job_id="j", poll_interval=1, poll_timeout=10)
    assert _classify(caught.value)["summary"] == "PaddleOCR 解析这份文件失败：boom"


# ---- MinerU ----


@pytest.mark.parametrize(
    ("code", "expected", "retryable"),
    [
        ("A0202", "auth_failed", False),
        ("A0211", "auth_failed", False),
        (-500, "upstream_bad_request", False),
        (-10002, "upstream_bad_request", False),
        (-60002, "ocr_file_rejected", False),
        (-60003, "ocr_file_rejected", False),
        (-60004, "ocr_file_rejected", False),
        (-60005, "ocr_file_rejected", False),
        (-60006, "ocr_file_rejected", False),
        (-60015, "ocr_file_rejected", False),
        (-60012, "upstream_bad_request", False),
        (-60013, "auth_failed", False),
        (-60014, "upstream_bad_request", False),
        (-60001, "ocr_provider_failed", True),
        (-60010, "ocr_provider_failed", True),
        (-60011, "ocr_provider_failed", True),
        (-60016, "ocr_provider_failed", True),
        (-60017, "ocr_provider_failed", False),
        (-60020, "ocr_provider_failed", True),
        (-60021, "ocr_provider_failed", True),
        (-60009, "upstream_rate_limited", True),
        (-60018, "upstream_quota_exhausted", False),
        (-60019, "upstream_quota_exhausted", False),
    ],
)
def test_mineru_business_codes_map_to_failures(monkeypatch, code, expected: str, retryable: bool) -> None:
    monkeypatch.setattr(
        mineru_api,
        "request_mineru",
        lambda *args, **kwargs: _response(200, {"code": code, "msg": "服务商原话", "trace_id": "t"}, MINERU_URL),
    )
    with pytest.raises(mineru_api.MinerUApiError, match="MinerU API error") as caught:
        mineru_api.post_json(MINERU_URL, {}, {})
    assert caught.value.provider_code == str(code)
    structured_errors.set_ocr_vendor("mineru")
    payload = _classify(caught.value)
    assert payload["failure_code"] == expected
    assert payload["retryable"] is retryable
    assert payload["summary"].startswith("MinerU ")
    assert f"（{code}）：服务商原话" in payload["summary"]
    assert payload["upstream"] == {"provider": "mineru", "http_status": 200, "code": str(code)}


def test_mineru_query_retries_codes_the_provider_says_to_retry(monkeypatch, _quiet) -> None:
    replies = iter(
        [
            _response(200, {"code": -60010, "msg": "解析失败"}, MINERU_URL),
            _response(200, {"code": -60020, "msg": "拆分失败"}, MINERU_URL),
            _response(200, {"code": 0, "msg": "ok", "data": {"state": "running"}}, MINERU_URL),
        ]
    )
    monkeypatch.setattr(mineru_api, "request_mineru", lambda *args, **kwargs: next(replies))
    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "3")

    assert mineru_api.get_json(MINERU_URL, {})["data"]["state"] == "running"
    assert _quiet == [10.0, 20.0]


def test_mineru_query_gives_up_after_the_attempts_and_does_not_retry_others(monkeypatch) -> None:
    calls: list[int] = []

    def always(code: int):
        def reply(*_args, **_kwargs):
            calls.append(code)
            return _response(200, {"code": code, "msg": "说明"}, MINERU_URL)

        return reply

    monkeypatch.setenv(mineru_api.MINERU_RETRY_ATTEMPTS_ENV, "3")
    monkeypatch.setattr(mineru_api, "request_mineru", always(-60010))
    with pytest.raises(mineru_api.MinerUApiError) as caught:
        mineru_api.get_json(MINERU_URL, {})
    assert calls == [-60010] * 3
    assert _classify(caught.value)["failure_code"] == "ocr_provider_failed"

    calls.clear()
    monkeypatch.setattr(mineru_api, "request_mineru", always(-60005))
    with pytest.raises(mineru_api.MinerUApiError):
        mineru_api.get_json(MINERU_URL, {})
    assert calls == [-60005], "换文件的码不重试"


def test_mineru_failed_task_state_is_a_provider_failure(monkeypatch) -> None:
    monkeypatch.setattr(
        mineru_api,
        "query_task",
        lambda *_args: {"code": 0, "data": {"state": "failed", "err_msg": "文件解析失败"}},
    )
    with pytest.raises(mineru_api.MinerUTaskFailed, match="MinerU task failed: 文件解析失败") as caught:
        mineru_api.poll_until_done(token="t", task_id="task", interval_seconds=1, timeout_seconds=10)
    payload = _classify(caught.value)
    assert payload["failure_code"] == "ocr_provider_failed"
    assert payload["summary"] == "MinerU 解析这份文件失败：文件解析失败"


def test_mineru_retryable_codes_match_the_rules() -> None:
    # 可重试的码都在码表里，且归类是「服务商处理失败」或「排队已满」（Rust 的 retryable_query 认同一批）
    for code in provider_failures.MINERU_RETRYABLE_CODES:
        rule = provider_failures.MINERU_RULES[code]
        assert rule.retryable, code
        assert rule.failure_code in {"ocr_provider_failed", "upstream_rate_limited"}, code


# ---- GLM-OCR ----


def _glm_reject(status: int, code: str, message: str, *, top_level: bool = False) -> glm_ocr_api.GlmOcrRequestRejected:
    body = {"code": int(code), "message": message} if top_level else {"error": {"code": code, "message": message}}
    session = _Replay(_response(status, body, glm_ocr_api.GLM_OCR_API_URL))
    with pytest.raises(glm_ocr_api.GlmOcrRequestRejected) as caught:
        glm_ocr_api.parse_pdf(b"%PDF", api_key="secret-key", session=session)
    assert session.calls == 1, "4xx 不重试"
    assert "secret-key" not in str(caught.value)
    return caught.value


@pytest.mark.parametrize(
    ("status", "code", "hint"),
    [
        (401, "1000", "填对"),
        (401, "1001", "补上"),
        (401, "1003", "过期"),
        (401, "1005", "二次认证"),
        (403, "1220", "无权调用 GLM-OCR"),
    ],
)
def test_glm_ocr_key_problems_are_auth_failures(status: int, code: str, hint: str) -> None:
    error = _glm_reject(status, code, "智谱的说明")
    assert error.status_code == status and error.provider_code == code
    structured_errors.set_ocr_vendor("glm_ocr")
    payload = _classify(error)
    assert payload["failure_code"] == "auth_failed"
    assert payload["retryable"] is False
    assert payload["summary"] == f"GLM-OCR 鉴权失败（{code}）：智谱的说明"
    assert hint in payload["suggestion"] and "智谱" in payload["suggestion"]
    assert payload["upstream"] == {"provider": "glm_ocr", "http_status": status, "code": code}


@pytest.mark.parametrize("code", ["1210", "1211", "1213", "1214", "1261"])
def test_glm_ocr_400_is_a_bad_request_with_the_business_code(code: str) -> None:
    payload = _classify(_glm_reject(400, code, "参数有误"))
    assert payload["failure_code"] == "upstream_bad_request"
    assert payload["retryable"] is False
    assert payload["summary"] == f"GLM-OCR 拒绝了请求（{code}）：参数有误"


def test_glm_ocr_content_filter_says_it_is_moderation() -> None:
    payload = _classify(_glm_reject(400, "1301", "系统检测到输入或生成内容可能包含不安全或敏感内容"))
    assert payload["failure_code"] == "upstream_bad_request"
    assert payload["summary"].startswith("GLM-OCR 内容审核拦截了这份文件（1301）")
    assert "内容安全审核" in payload["suggestion"]


def test_glm_ocr_top_level_code_is_read_too() -> None:
    # Z.ai 的 layout-parsing 文档写的是顶层 {code: int, message}
    error = _glm_reject(401, "1000", "身份验证失败", top_level=True)
    assert error.provider_code == "1000"
    assert _classify(error)["failure_code"] == "auth_failed"

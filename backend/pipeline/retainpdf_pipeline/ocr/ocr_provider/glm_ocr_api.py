"""智谱 GLM-OCR 接口：`POST /paas/v4/layout_parsing`，模型 `glm-ocr`。

同步接口：一次请求交一份 PDF（≤100 页、≤50MB），等它解析完直接返回整份结果（逐页 `layout_details`、整份 `md_results`）。
没有任务号、不用轮询。经验（外部 CLI，2026-10-16）：
- `file` 用 base64 时必须带 `data:application/pdf;base64,` 前缀，否则 400（code 1214）。
- 3 路并发 × 100 页必吃 429，串行加退避能过。
- 4xx（401 key 不对、400 参数不对）重试没用，直接失败；429、5xx、网络错误退避重试（`request_with_retry`，认 `Retry-After`）。
"""

from __future__ import annotations

import base64
import os

import fitz
import requests

from retainpdf_pipeline.ocr.retry import RetainNetworkError
from retainpdf_pipeline.ocr.retry import direct_session
from retainpdf_pipeline.ocr.retry import request_with_retry

GLM_OCR_API_URL = "https://open.bigmodel.cn/api/paas/v4/layout_parsing"
GLM_OCR_MODEL = "glm-ocr"
GLM_OCR_API_URL_ENV = "RETAIN_GLM_OCR_API_URL"
GLM_OCR_TIMEOUT_ENV = "RETAIN_GLM_OCR_TIMEOUT_SECONDS"
GLM_OCR_MAX_PAGES_PER_REQUEST = 100
# 单片请求等多久：按这片的页数算（10 页一片约 12 秒，2026-10-31 实测），10 页最多等 3 分钟。以前一律 900 秒，
# 加上 5 次重试，服务端不回时要一个多小时才报错，界面上一直停在 0 页（2026-11-02，620 页的书）。
TIMEOUT_BASE_SECONDS = 60
TIMEOUT_PER_PAGE_SECONDS = 12
DEFAULT_TIMEOUT_SECONDS = 900
# 429 时等得久一点：服务端限流按分钟算，0.5 秒起步的默认退避会把几次重试在几秒内用完。
RETRY_ATTEMPTS = 5
RETRY_BACKOFF_SECONDS = 15.0

_SESSION = direct_session(pool_connections=4, pool_maxsize=4)


class GlmOcrRequestRejected(RuntimeError):
    """服务端明确拒绝（4xx，429 除外）：key、参数、文件的问题，重试没用。"""


def api_url() -> str:
    return str(os.environ.get(GLM_OCR_API_URL_ENV, "") or "").strip() or GLM_OCR_API_URL


def timeout_seconds(pages: int | None = None) -> int:
    """一次请求最多等多久：`RETAIN_GLM_OCR_TIMEOUT_SECONDS` 写了就用它，否则按页数算；不知道页数时 900 秒。"""
    raw = str(os.environ.get(GLM_OCR_TIMEOUT_ENV, "") or "").strip()
    try:
        value = int(raw) if raw else 0
    except ValueError:
        value = 0
    if value > 0:
        return value
    if pages and pages > 0:
        return TIMEOUT_BASE_SECONDS + TIMEOUT_PER_PAGE_SECONDS * pages
    return DEFAULT_TIMEOUT_SECONDS


def pdf_page_count(pdf_bytes: bytes) -> int | None:
    try:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            return document.page_count
    except Exception:  # noqa: BLE001 - 读不出页数就按默认超时，交给服务端去判这份 PDF
        return None


def pdf_data_uri(pdf_bytes: bytes) -> str:
    return "data:application/pdf;base64," + base64.b64encode(pdf_bytes).decode("ascii")


def _error_detail(response: requests.Response | None) -> str:
    """服务端报错里的 code、message（不含 key），给用户看为什么被拒。"""
    if response is None:
        return ""
    try:
        body = response.json()
    except ValueError:
        return ""
    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict):
        return f"code={error.get('code', '')} message={str(error.get('message', ''))[:200]}"
    return ""


def parse_pdf(pdf_bytes: bytes, *, api_key: str, session: requests.Session | None = None) -> dict:
    """交一份 PDF，返回原始结果（dict）。`api_key` 只进请求头。"""
    if not api_key:
        raise GlmOcrRequestRejected("GLM-OCR 缺少 API key（智谱 bigmodel 的 key）")
    try:
        response = request_with_retry(
            session or _SESSION,
            "post",
            api_url(),
            timeout=timeout_seconds(pdf_page_count(pdf_bytes)),
            attempts=RETRY_ATTEMPTS,
            backoff_seconds=RETRY_BACKOFF_SECONDS,
            label="GLM-OCR",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GLM_OCR_MODEL, "file": pdf_data_uri(pdf_bytes)},
        )
    except requests.HTTPError as err:
        status = err.response.status_code if err.response is not None else ""
        raise GlmOcrRequestRejected(f"GLM-OCR 请求被拒绝 status={status} {_error_detail(err.response)}".strip()) from None
    except RetainNetworkError as err:
        raise RuntimeError(f"GLM-OCR 请求失败：{err}") from None
    try:
        payload = response.json()
    except ValueError:
        raise RuntimeError(f"GLM-OCR 返回的不是 JSON（status={response.status_code}）") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("layout_details"), list):
        raise RuntimeError(f"GLM-OCR 返回里没有 layout_details（{_error_detail(response) or 'status=' + str(response.status_code)}）")
    return payload


__all__ = [
    "GLM_OCR_API_URL",
    "GLM_OCR_MAX_PAGES_PER_REQUEST",
    "GLM_OCR_MODEL",
    "GlmOcrRequestRejected",
    "api_url",
    "parse_pdf",
    "pdf_data_uri",
]

"""智谱 GLM-OCR 接口：`POST /paas/v4/layout_parsing`，模型 `glm-ocr`。

同步接口：一次请求交一份 PDF（≤100 页、≤50MB），等它解析完直接返回整份结果（逐页 `layout_details`、整份 `md_results`）。
没有任务号、不用轮询。经验（外部 CLI，2026-10-16）：
- `file` 用 base64 时必须带 `data:application/pdf;base64,` 前缀，否则 400（code 1214）。
- 3 路并发 × 100 页必吃 429，串行加退避能过。
- 4xx（401 key 不对、400 参数不对）重试没用，直接失败；429、5xx、网络错误退避重试（`request_with_retry`，认 `Retry-After`）。
- 429 先看响应体里的业务码 `error.code`（2026-11-23，issue #164）：智谱的 429 不全是限流，`1113` 是余额不足或没有资源包，
  以前照限流退避 5 次（约 114 秒）才报「rate limited」。`FAIL_FAST_CODES` 里的码（余额、套餐、用量上限这类，
  按 https://docs.z.ai/api-reference/api-code 的码表）第一次就停，报中文原因、HTTP 状态和业务码；`1302` 请求频率限制、
  `1305` 服务繁忙和没有业务码的 429 照旧退避重试，最后失败时报 HTTP 状态和业务码。
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

_QUOTA_HINT = "请检查当前智谱 API Key 对应账号的余额或资源包"
_WINDOW_LIMIT = "GLM-OCR 调用已达到当前时段的用量上限，请到服务端说明的重置时间后再试，或检查当前智谱 API Key 对应账号的余额或套餐"
# 智谱业务码里重试没用的（https://docs.z.ai/api-reference/api-code，2026-11-23 查）：都随 HTTP 429 返回，
# 但不是“稍后再试”能好的。可恢复的 1302（请求频率限制）、1305（服务繁忙）不在这里，照旧退避重试。
FAIL_FAST_CODES: dict[str, str] = {
    "1113": "GLM-OCR 调用额度不足，" + _QUOTA_HINT,
    "1308": _WINDOW_LIMIT,
    "1309": "GLM-OCR 所用的智谱套餐已过期，请续费或换用有余额的智谱 API Key",
    "1310": _WINDOW_LIMIT,
    "1311": "当前智谱 API Key 的套餐不包含 GLM-OCR，请换用能调用 GLM-OCR 的智谱 API Key",
    "1313": "当前智谱账号因违反合理使用规则被限制调用，需联系智谱恢复后再试",
    "1314": "GLM-OCR 所用的智谱企业套餐已过期，请联系企业管理员",
    "1315": "当前智谱 API Key 只能用于企业编程套餐，请换用能调用 GLM-OCR 的智谱 API Key",
    **{str(code): _WINDOW_LIMIT for code in range(1316, 1322)},
}


class GlmOcrRequestRejected(RuntimeError):
    """服务端明确拒绝（4xx，429 除外；429 里余额不足这类见子类 `GlmOcrQuotaExhausted`）：key、参数、文件的问题，重试没用。"""


class GlmOcrQuotaExhausted(GlmOcrRequestRejected):
    """余额、资源包、套餐、用量上限的问题（智谱 429 + `FAIL_FAST_CODES`）：充值、续费或等额度恢复以前重试都会同样失败。
    类名带 QuotaExhausted，结构化失败归成 `upstream_quota_exhausted`（billing，不可重试）。"""

    def __init__(self, message: str, *, status_code: int | None = None, provider_code: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.provider_code = provider_code


class GlmOcrRateLimited(RuntimeError):
    """429 退避重试用完还被限流（业务码 1302、1305 或没有业务码）。"""

    def __init__(self, message: str, *, status_code: int | None = None, provider_code: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.provider_code = provider_code


class GlmOcrServerError(RuntimeError):
    """重试用完服务端还回 5xx：可能是这份文件里某一页让它出错（2026-11-04 一张超大图纸整页怎么发都 500），
    拆开再发可能能过（`glm_ocr_driver._page_by_page_chunk`）。超时、连不上不算这种。"""


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


def _error_code(response: requests.Response | None) -> str:
    """响应体里的智谱业务码 `error.code`（字符串；读不出时为空）。"""
    if response is None:
        return ""
    try:
        body = response.json()
    except ValueError:
        return ""
    error = body.get("error") if isinstance(body, dict) else None
    if isinstance(error, dict) and error.get("code") not in (None, ""):
        return str(error.get("code")).strip()
    return ""


def _gives_up(response: requests.Response) -> bool:
    """429、5xx 本来要重试；业务码说明重试没用（余额不足这类）时第一次就停。"""
    return _error_code(response) in FAIL_FAST_CODES


def _failure_suffix(status: int | str | None, response: requests.Response | None) -> str:
    """报错末尾的（HTTP 状态，业务码和服务端说明）。"""
    detail = _error_detail(response)
    return f"（HTTP {status or '?'}{'，' + detail if detail else ''}）"


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
            upstream_provider="glm_ocr",
            give_up=_gives_up,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": GLM_OCR_MODEL, "file": pdf_data_uri(pdf_bytes)},
        )
    except requests.HTTPError as err:
        status = err.response.status_code if err.response is not None else ""
        code = _error_code(err.response)
        if code in FAIL_FAST_CODES:
            raise GlmOcrQuotaExhausted(
                FAIL_FAST_CODES[code] + _failure_suffix(status, err.response),
                status_code=status or None,
                provider_code=code,
            ) from None
        raise GlmOcrRequestRejected(f"GLM-OCR 请求被拒绝 status={status} {_error_detail(err.response)}".strip()) from None
    except RetainNetworkError as err:
        suffix = _failure_suffix(err.status_code, err.last_response) if err.status_code else ""
        if err.status_code == 429:
            raise GlmOcrRateLimited(
                f"GLM-OCR 请求被限流，退避重试后仍失败{suffix}：{err}",
                status_code=429,
                provider_code=_error_code(err.last_response),
            ) from None
        if (err.status_code or 0) >= 500:
            raise GlmOcrServerError(f"GLM-OCR 请求失败{suffix}：{err}") from None
        raise RuntimeError(f"GLM-OCR 请求失败{suffix}：{err}") from None
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
    "FAIL_FAST_CODES",
    "GlmOcrQuotaExhausted",
    "GlmOcrRateLimited",
    "GlmOcrRequestRejected",
    "api_url",
    "parse_pdf",
    "pdf_data_uri",
]

"""任务失败的上游信息：哪家服务商（错误码目录里的编号）、HTTP 状态、服务商自己的错误码。

结构化失败（``structured failure json``）里的 ``upstream: {provider, http_status, code}`` 由这里算，前端拿它去
错误码目录（``GET /api/v1/providers/error-codes``，数据在 ``backend/packages/retainpdf-providers/error-codes``）查条目。
只用标准库，按属性名认异常（不 import requests），翻译包和流水线都能用。

异常怎么带上游信息（按顺序找，外层先于 ``__cause__``）：

- ``upstream_provider`` / ``upstream_http_status`` / ``upstream_code``：抛错的地方明确写上的（翻译请求层按接口地址写服务商；
  GLM-OCR 的「请求被拒」写状态和业务码）。只给上游信息用，失败分类不读它们。
- ``status_code`` / ``provider_code``：OCR 的 ``RetainNetworkError``、``GlmOcrQuotaExhausted`` 等本来就有的。
- ``response`` / ``last_response``：requests 的响应，读 ``status_code``、请求地址（认翻译服务商）和响应体（读错误码）。
- ``upstream_error``：另一个异常（例如「一个块都没译成」时最常见的那次上游错误），以上都找不到时再看它。
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlparse

# 错误码目录里各服务商的 hosts（feat/provider-error-codes 的 error-codes/llm/*.json）。子域名也算（``*.dashscope.aliyuncs.com``）。
LLM_VENDOR_HOSTS: dict[str, tuple[str, ...]] = {
    "openai": ("api.openai.com",),
    "anthropic": ("api.anthropic.com",),
    "deepseek": ("api.deepseek.com",),
    "zhipu": ("open.bigmodel.cn", "api.z.ai"),
    "qwen": ("dashscope.aliyuncs.com", "dashscope-intl.aliyuncs.com"),
    "opencode": ("opencode.ai",),
}
CUSTOM_VENDOR = "custom"
OCR_VENDORS = frozenset({"paddle", "mineru", "glm_ocr"})

_CHAIN_LIMIT = 8


def llm_vendor_for_url(url: str) -> str:
    """翻译接口地址 → 服务商编号；认不出的地址是 ``custom``，地址为空时返回空串。"""
    text = str(url or "").strip()
    if not text:
        return ""
    host = (urlparse(text if "://" in text else f"https://{text}").hostname or "").strip().lower()
    if not host:
        return ""
    for vendor, hosts in LLM_VENDOR_HOSTS.items():
        if any(host == item or host.endswith("." + item) for item in hosts):
            return vendor
    return CUSTOM_VENDOR


def _code_text(value: Any) -> str:
    if value is None or isinstance(value, bool) or isinstance(value, (dict, list)):
        return ""
    text = str(value).strip()
    # Paddle、MinerU 的 code=0 是成功
    return "" if text in {"", "0"} else text


def provider_error_code(body: Any) -> str:
    """响应体（已解析的 JSON）里服务商自己的错误码；没有时返回空串。

    - ``error`` 是对象：Anthropic ``error.details.error_code`` → ``error.code``（OpenAI、智谱业务码、DashScope 兼容模式）
      → ``error.type``（OpenAI 没有 code 时、Anthropic）。
    - 否则顶层：``code``（DashScope 原生、GLM-OCR、Paddle 异步接口、MinerU）→ ``errorCode``（Paddle 同步接口）→ ``error_code``。
    """
    if not isinstance(body, dict):
        return ""
    error = body.get("error")
    if isinstance(error, dict):
        details = error.get("details")
        if isinstance(details, dict):
            code = _code_text(details.get("error_code"))
            if code:
                return code
        for key in ("code", "type"):
            code = _code_text(error.get(key))
            if code:
                return code
    for key in ("code", "errorCode", "error_code"):
        code = _code_text(body.get(key))
        if code:
            return code
    return ""


def _response_body(response: Any) -> Any:
    try:
        return response.json()
    except Exception:  # noqa: BLE001 - 读不出 JSON 就当没有错误码
        return None


def _response_url(response: Any) -> str:
    url = getattr(response, "url", "") or ""
    if not url:
        request = getattr(response, "request", None)
        url = getattr(request, "url", "") or ""
    return str(url or "")


def _int_status(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        status = int(value)
    except (TypeError, ValueError):
        return None
    return status if 100 <= status <= 599 else None


def _exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    pending: list[BaseException] = [exc]
    while pending and len(chain) < _CHAIN_LIMIT:
        current = pending.pop(0)
        if any(current is seen for seen in chain):
            continue
        chain.append(current)
        # 只顺着明确接上的（``raise ... from err``、``upstream_error``）找；隐式的 ``__context__`` 可能是处理别的错误时
        # 顺带出的，安上去会张冠李戴。
        for linked in (current.__cause__, getattr(current, "upstream_error", None)):
            if isinstance(linked, BaseException):
                pending.append(linked)
    return chain


def tag_upstream(
    error: BaseException,
    *,
    provider: str = "",
    http_status: Any = None,
    code: Any = None,
) -> BaseException:
    """在异常上写明上游信息（只补没写过的），原样返回它，方便 ``raise tag_upstream(...)``。

    写的是 ``upstream_*`` 属性，失败分类不读它们，所以不会改变分类结果。"""
    if provider and not getattr(error, "upstream_provider", ""):
        error.upstream_provider = str(provider).strip()  # type: ignore[attr-defined]
    status = _int_status(http_status)
    if status is not None and getattr(error, "upstream_http_status", None) is None:
        error.upstream_http_status = status  # type: ignore[attr-defined]
    code_text = _code_text(code)
    if code_text and not getattr(error, "upstream_code", ""):
        error.upstream_code = code_text  # type: ignore[attr-defined]
    return error


def upstream_info(exc: BaseException, *, context_provider: str = "") -> dict[str, Any] | None:
    """异常里能读出的上游信息 ``{provider, http_status, code}``；HTTP 状态和错误码都读不出时返回 None。

    服务商按这个顺序定：异常上明确写的 ``upstream_provider`` → ``context_provider``（OCR worker 传当前 OCR 服务商：
    GLM-OCR 的地址也是智谱的，不能按地址认成 zhipu）→ 按响应的请求地址认（翻译服务商）→ 有地址但认不出是 ``custom``。
    """
    provider = ""
    url_vendor = ""
    http_status: int | None = None
    code = ""
    for item in _exception_chain(exc):
        provider = provider or str(getattr(item, "upstream_provider", "") or "").strip()
        if http_status is None:
            http_status = _int_status(getattr(item, "upstream_http_status", None))
        code = code or _code_text(getattr(item, "upstream_code", None))
        if http_status is None:
            http_status = _int_status(getattr(item, "status_code", None))
        code = code or _code_text(getattr(item, "provider_code", None))
        for attr in ("response", "last_response"):
            response = getattr(item, attr, None)
            if response is None:
                continue
            if http_status is None:
                http_status = _int_status(getattr(response, "status_code", None))
            code = code or provider_error_code(_response_body(response))
            url_vendor = url_vendor or llm_vendor_for_url(_response_url(response))
    if http_status is None and not code:
        return None
    return {
        "provider": provider or str(context_provider or "").strip() or url_vendor or None,
        "http_status": http_status,
        "code": code or None,
    }


def response_body_code(text: str) -> str:
    """一段文字里 ``response_body=`` 后面那份 JSON 的错误码（翻译请求层报错时把响应体写进文字里）。"""
    marker = "response_body="
    start = str(text or "").find(marker)
    if start == -1:
        return ""
    rest = text[start + len(marker) :].lstrip()
    if not rest.startswith("{"):
        return ""
    try:
        body, _end = json.JSONDecoder().raw_decode(rest)
    except ValueError:
        return ""
    return provider_error_code(body)


__all__ = [
    "CUSTOM_VENDOR",
    "LLM_VENDOR_HOSTS",
    "OCR_VENDORS",
    "llm_vendor_for_url",
    "provider_error_code",
    "response_body_code",
    "tag_upstream",
    "upstream_info",
]

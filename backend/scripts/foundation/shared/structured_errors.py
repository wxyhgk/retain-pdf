from __future__ import annotations

import json
import re
import sys
import traceback
from dataclasses import asdict
from dataclasses import dataclass
from typing import Any


STRUCTURED_FAILURE_LABEL = "structured failure json"


@dataclass
class StructuredFailure:
    stage: str
    error_type: str
    summary: str
    detail: str
    retryable: bool
    upstream_host: str
    provider: str
    raw_exception_type: str
    raw_exception_message: str
    traceback: str

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, separators=(",", ":"))


def _extract_upstream_host(text: str) -> str:
    for marker in ("host='", 'host="', "https://", "http://"):
        start = text.find(marker)
        if start == -1:
            continue
        rest = text[start + len(marker) :]
        host_chars: list[str] = []
        for char in rest:
            if char.isalnum() or char in ".-":
                host_chars.append(char)
                continue
            break
        host = "".join(host_chars).strip()
        if host:
            return host
    return ""


def infer_failure_stage(*, default_stage: str, trace_text: str, detail: str) -> str:
    combined = f"{trace_text}\n{detail}".lower()
    if any(token in combined for token in ("render_stage.py", "services.rendering", "typst", "render failed", "failed to render")):
        return "render"
    if "normaliz" in combined or "document_schema" in combined:
        return "normalization"
    if any(token in combined for token in ("translation", "deepseek", "placeholderinventoryerror", "unexpectedplaceholdererror")):
        return "translation"
    return default_stage


def _http_status_code(exc: BaseException, text: str) -> int | None:
    response = getattr(exc, "response", None)
    status_code = getattr(response, "status_code", None)
    if isinstance(status_code, int):
        return status_code
    match = re.search(r"\b([45]\d{2})\s+Client Error\b", text)
    if match:
        return int(match.group(1))
    return None


def classify_exception(exc: BaseException, *, default_stage: str, provider: str = "") -> StructuredFailure:
    raw_traceback = traceback.format_exc()
    exc_type = type(exc).__name__
    message = str(exc).strip()
    detail = message or exc_type
    lowered = f"{exc_type}\n{detail}\n{raw_traceback}".lower()
    stage = infer_failure_stage(default_stage=default_stage, trace_text=raw_traceback, detail=detail)
    upstream_host = _extract_upstream_host(f"{detail}\n{raw_traceback}")
    http_status_code = _http_status_code(exc, f"{detail}\n{raw_traceback}")

    error_type = "python_unhandled_exception"
    summary = "任务失败，但暂未识别出明确根因"
    retryable = True

    if any(token in lowered for token in ("failed to resolve", "temporary failure in name resolution", "nameresolutionerror", "socket.gaierror")):
        error_type = "dns_resolution_failed"
        summary = "外部服务域名解析失败"
    elif any(token in lowered for token in ("readtimeout", "connecttimeout", "timed out")):
        error_type = "upstream_timeout"
        summary = "外部服务请求超时"
    elif http_status_code in {401, 403} or any(
        token in lowered
        for token in (
            "unauthorized",
            "forbidden",
            "invalid api key",
            "token expired",
            "missing api key",
            "missing or invalid x-api-key",
        )
    ):
        error_type = "auth_failed"
        summary = "鉴权失败"
        retryable = False
    elif http_status_code == 400:
        error_type = "upstream_bad_request"
        summary = "上游服务拒绝请求（400）"
        retryable = False
    elif any(
        token in lowered
        for token in (
            "placeholderinventoryerror",
            "unexpectedplaceholdererror",
            "placeholder inventory mismatch",
            "placeholder instability",
        )
    ):
        error_type = "placeholder_unstable"
        summary = "公式占位符校验失败"
    elif any(token in lowered for token in ("failed to download package", "packages.typst.org", "downloading @preview/")):
        error_type = "typst_dependency_download_failed"
        summary = "Typst 渲染依赖下载失败"
    elif any(token in lowered for token in ("typst compile", "typst error", "render failed", "failed to render", "font not found", "missing bundled font")):
        error_type = "render_failed"
        summary = "排版或编译阶段失败"
        retryable = False
        stage = "render"
    elif any(token in lowered for token in ("jsondecodeerror", "expecting value", "extra data", "invalid control character")):
        error_type = "json_decode_failed"
        summary = "OCR 结果 JSON 解析失败"
        stage = "normalization"
        retryable = False
    elif any(token in lowered for token in ("validationerror", "normalized document schema validation failed")):
        error_type = "document_schema_validation_failed"
        summary = "标准化文档校验失败"
        stage = "normalization"
        retryable = False
    elif "source pdf not found" in lowered:
        error_type = "source_pdf_missing"
        summary = "源 PDF 缺失"
        stage = "normalization"
        retryable = False
    elif any(token in lowered for token in ("fitz.fitzerror", "pymupdf", "cannot open broken document", "file data error")):
        error_type = "source_pdf_open_failed"
        summary = "源 PDF 打开失败"
        stage = "normalization"
        retryable = False

    return StructuredFailure(
        stage=stage,
        error_type=error_type,
        summary=summary,
        detail=detail,
        retryable=retryable,
        upstream_host=upstream_host,
        provider=provider.strip(),
        raw_exception_type=exc_type,
        raw_exception_message=message,
        traceback=raw_traceback.strip(),
    )


def emit_structured_failure(exc: BaseException, *, default_stage: str, provider: str = "") -> None:
    failure = classify_exception(exc, default_stage=default_stage, provider=provider)
    traceback_text = failure.traceback.strip()
    if traceback_text:
        print(traceback_text, file=sys.stderr, flush=True)
    print(f"{STRUCTURED_FAILURE_LABEL}: {failure.to_json()}", file=sys.stderr, flush=True)


def run_with_structured_failure(main_fn: Any, *, default_stage: str, provider: str = "") -> None:
    try:
        main_fn()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        emit_structured_failure(exc, default_stage=default_stage, provider=provider)
        raise SystemExit(1) from None

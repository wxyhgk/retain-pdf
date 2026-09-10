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
    failed_stage: str
    failure_code: str
    failure_category: str
    provider_stage: str
    provider_code: str
    suggestion: str
    raw_excerpt: str
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
    if any(
        token in combined
        for token in (
            "retainpdf_pipeline.translate",
            "translate_only_pipeline",
            "translate_from_ocr",
            "direct_typst.py",
            "deepseek",
            "placeholderinventoryerror",
            "unexpectedplaceholdererror",
            "translationprotocolerror",
            "protocol/json shell",
        )
    ):
        return "translation"
    if any(token in combined for token in ("render_stage.py", "retainpdf_pipeline.render", "typst compile", "typst error", "render failed", "failed to render")):
        return "render"
    if "normaliz" in combined or "document_schema" in combined:
        return "normalization"
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


def _extract_provider_code(text: str) -> str:
    patterns = (
        r"\bcode\s*[=:]\s*([A-Z]\d{3,}|[A-Z]{1,10}-\d{2,}|\d{3,})\b",
        r"\berror[_\s-]*code\s*[=:]\s*([A-Z]\d{3,}|[A-Z]{1,10}-\d{2,}|\d{3,})\b",
        r"\blogId\s*[=:]\s*([A-Za-z0-9_-]{6,})\b",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def _extract_provider_stage(text: str) -> str:
    known_stages = (
        "mineru_upload",
        "mineru_processing",
        "paddle_processing",
        "paddle_running",
        "paddle_submit",
    )
    lowered = text.lower()
    for stage in known_stages:
        if stage in lowered:
            return stage
    return ""


def _failure_category_for(*, failure_code: str, failed_stage: str) -> str:
    if failure_code in {"auth_failed"}:
        return "auth"
    if failure_code in {"dns_resolution_failed"}:
        return "network"
    if failure_code in {"upstream_timeout"}:
        return "timeout"
    if failure_code in {"upstream_rate_limited"}:
        return "rate_limit"
    if failure_code in {
        "upstream_bad_request",
        "source_pdf_missing",
        "source_pdf_open_failed",
    }:
        return "input"
    if failed_stage == "normalization" or failure_code in {
        "json_decode_failed",
        "document_schema_validation_failed",
    }:
        return "normalization"
    if failed_stage == "render" or failure_code in {
        "typst_dependency_download_failed",
        "render_failed",
    }:
        return "render"
    if failed_stage == "translation" or failure_code in {"placeholder_unstable", "translation_protocol_shell"}:
        return "translation"
    return "internal"


def _suggestion_for(*, failure_code: str, failure_category: str, provider: str) -> str:
    provider_label = provider.strip() or "上游服务"
    suggestions = {
        "auth_failed": f"检查 {provider_label} 凭据、模型 API Key 或相关访问令牌是否有效。",
        "dns_resolution_failed": "检查当前机器的 DNS / 网络连通性，确认目标域名可解析后再重试。",
        "upstream_timeout": "检查网络质量、上游服务负载或适当增大超时后再重试。",
        "upstream_rate_limited": f"{provider_label} 当前限流，请稍后重试或降低并发。",
        "upstream_bad_request": "检查请求参数、输入文件和上游接口约束，修正后再重试。",
        "placeholder_unstable": "检查公式占位符保护链和当前批次输入，必要时缩小批次或切换保守模式。",
        "translation_protocol_shell": "检查翻译提示词与模型返回；该错误通常表示模型输出了 JSON/协议外壳而不是纯译文。",
        "typst_dependency_download_failed": "检查 Typst 依赖源网络连通性，必要时预热依赖或重试。",
        "render_failed": "检查渲染输入、字体和 Typst 编译日志，修正渲染问题后重试。",
        "json_decode_failed": "检查 OCR 原始结果是否完整有效，必要时重新拉取或重新生成。",
        "document_schema_validation_failed": "检查标准化输出是否满足 document.v1 契约，再重新执行后续阶段。",
        "source_pdf_missing": "检查任务工作目录和源 PDF 路径，确认文件存在且可访问。",
        "source_pdf_open_failed": "检查源 PDF 是否损坏或不可读，替换输入文件后重试。",
    }
    if failure_code in suggestions:
        return suggestions[failure_code]
    category_suggestions = {
        "auth": f"检查 {provider_label} 鉴权配置和权限范围。",
        "network": "检查网络、代理和 DNS 配置后再重试。",
        "timeout": "检查上游服务响应时间或增大超时后再试。",
        "rate_limit": "降低并发、等待限流窗口恢复后再重试。",
        "input": "检查输入内容、文件路径和请求参数。",
        "normalization": "检查 OCR 输出和标准化输入契约。",
        "translation": "检查翻译阶段输入、批次划分和模型返回。",
        "render": "检查渲染输入、字体和编译环境。",
        "provider": f"检查 {provider_label} 返回的错误码与原始响应。",
        "internal": "查看 traceback 与任务日志，定位未分类的内部异常。",
    }
    return category_suggestions.get(failure_category, "查看 traceback 与任务日志，定位失败根因。")


def _build_raw_excerpt(detail: str, raw_traceback: str) -> str:
    text = detail.strip()
    if not text:
        lines = [line.strip() for line in raw_traceback.splitlines() if line.strip()]
        text = lines[-1] if lines else ""
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= 280:
        return compact
    return compact[:277].rstrip() + "..."


def classify_exception(exc: BaseException, *, default_stage: str, provider: str = "") -> StructuredFailure:
    raw_traceback = traceback.format_exc()
    exc_type = type(exc).__name__
    message = str(exc).strip()
    detail = message or exc_type
    lowered = f"{exc_type}\n{detail}\n{raw_traceback}".lower()
    stage = infer_failure_stage(default_stage=default_stage, trace_text=raw_traceback, detail=detail)
    upstream_host = _extract_upstream_host(f"{detail}\n{raw_traceback}")
    http_status_code = _http_status_code(exc, f"{detail}\n{raw_traceback}")
    provider_code = _extract_provider_code(f"{detail}\n{raw_traceback}")
    provider_stage = _extract_provider_stage(f"{detail}\n{raw_traceback}")

    error_type = "python_unhandled_exception"
    summary = "任务失败，但暂未识别出明确根因"
    retryable = True

    if any(token in lowered for token in ("failed to resolve", "temporary failure in name resolution", "nameresolutionerror", "socket.gaierror")):
        error_type = "dns_resolution_failed"
        summary = "外部服务域名解析失败"
    elif any(token in lowered for token in ("readtimeout", "connecttimeout", "timed out")):
        error_type = "upstream_timeout"
        summary = "外部服务请求超时"
    elif stage == "render" and any(token in lowered for token in ("filenotfounderror", "no such file or directory")):
        error_type = "render_failed"
        summary = "排版或编译阶段失败"
        retryable = True
    elif http_status_code == 429 or any(token in lowered for token in ("rate limited", "rate limit", "too many requests", "retry-after")):
        error_type = "upstream_rate_limited"
        summary = "外部服务请求被限流"
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
    elif any(token in lowered for token in ("translationprotocolerror", "protocol/json shell")):
        error_type = "translation_protocol_shell"
        summary = "翻译模型返回了协议或 JSON 外壳"
        stage = "translation"
    elif any(token in lowered for token in ("failed to download package", "packages.typst.org", "downloading @preview/")):
        error_type = "typst_dependency_download_failed"
        summary = "Typst 渲染依赖下载失败"
    elif any(
        token in lowered
        for token in (
            "typst runtime failed to start",
            "winerror 193",
            "winerror 5",
        )
    ):
        error_type = "typst_runtime_failed"
        summary = "Typst 运行时启动失败"
        retryable = False
        stage = "render"
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

    failure_category = _failure_category_for(failure_code=error_type, failed_stage=stage)
    if provider.strip() and failure_category == "internal" and provider.strip() != "translation":
        failure_category = "provider"
    suggestion = _suggestion_for(
        failure_code=error_type,
        failure_category=failure_category,
        provider=provider,
    )
    raw_excerpt = _build_raw_excerpt(detail, raw_traceback)

    return StructuredFailure(
        failed_stage=stage,
        failure_code=error_type,
        failure_category=failure_category,
        provider_stage=provider_stage,
        provider_code=provider_code,
        suggestion=suggestion,
        raw_excerpt=raw_excerpt,
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

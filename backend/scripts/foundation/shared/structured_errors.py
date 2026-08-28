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
            "services.translation",
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
    if any(token in combined for token in ("render_stage.py", "services.rendering", "typst compile", "typst error", "render failed", "failed to render")):
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
    provider_label = provider.strip() or "dịch vụ thượng nguồn"
    suggestions = {
        "auth_failed": f"Kiểm tra thông tin xác thực của {provider_label}, API Key của mô hình hoặc mã truy cập liên quan còn hợp lệ.",
        "dns_resolution_failed": "Kiểm tra DNS / kết nối mạng của máy hiện tại, xác nhận tên miền đích phân giải được rồi thử lại.",
        "upstream_timeout": "Kiểm tra chất lượng mạng, tải của dịch vụ thượng nguồn hoặc tăng thời gian chờ rồi thử lại.",
        "upstream_rate_limited": f"{provider_label} đang bị giới hạn tần suất, hãy thử lại sau hoặc giảm độ đồng thời.",
        "upstream_bad_request": "Kiểm tra tham số yêu cầu, tệp đầu vào và ràng buộc giao diện thượng nguồn, sửa lại rồi thử lại.",
        "placeholder_unstable": "Kiểm tra chuỗi bảo vệ placeholder công thức và đầu vào lô hiện tại, nếu cần hãy thu nhỏ lô hoặc chuyển sang chế độ thận trọng.",
        "translation_protocol_shell": "Kiểm tra prompt dịch và phản hồi của mô hình; lỗi này thường cho thấy mô hình xuất ra vỏ JSON/giao thức thay vì bản dịch thuần.",
        "typst_dependency_download_failed": "Kiểm tra kết nối mạng của nguồn phụ thuộc Typst, nếu cần hãy làm nóng phụ thuộc hoặc thử lại.",
        "render_failed": "Kiểm tra đầu vào render, phông chữ và nhật ký biên dịch Typst, sửa lỗi render rồi thử lại.",
        "json_decode_failed": "Kiểm tra kết quả OCR gốc có đầy đủ và hợp lệ không, nếu cần hãy tải lại hoặc tạo lại.",
        "document_schema_validation_failed": "Kiểm tra đầu ra chuẩn hóa có đáp ứng hợp đồng document.v1 không, rồi thực hiện lại các giai đoạn sau.",
        "source_pdf_missing": "Kiểm tra thư mục làm việc của tác vụ và đường dẫn PDF nguồn, xác nhận tệp tồn tại và truy cập được.",
        "source_pdf_open_failed": "Kiểm tra PDF nguồn có bị hỏng hoặc không đọc được không, thay tệp đầu vào rồi thử lại.",
    }
    if failure_code in suggestions:
        return suggestions[failure_code]
    category_suggestions = {
        "auth": f"Kiểm tra cấu hình xác thực và phạm vi quyền của {provider_label}.",
        "network": "Kiểm tra mạng, proxy và cấu hình DNS rồi thử lại.",
        "timeout": "Kiểm tra thời gian phản hồi của dịch vụ thượng nguồn hoặc tăng thời gian chờ rồi thử lại.",
        "rate_limit": "Giảm độ đồng thời, chờ cửa sổ giới hạn tần suất phục hồi rồi thử lại.",
        "input": "Kiểm tra nội dung đầu vào, đường dẫn tệp và tham số yêu cầu.",
        "normalization": "Kiểm tra đầu ra OCR và hợp đồng đầu vào chuẩn hóa.",
        "translation": "Kiểm tra đầu vào giai đoạn dịch, phân chia lô và phản hồi mô hình.",
        "render": "Kiểm tra đầu vào render, phông chữ và môi trường biên dịch.",
        "provider": f"Kiểm tra mã lỗi và phản hồi gốc mà {provider_label} trả về.",
        "internal": "Xem traceback và nhật ký tác vụ để định vị ngoại lệ nội bộ chưa phân loại.",
    }
    return category_suggestions.get(failure_category, "Xem traceback và nhật ký tác vụ để định vị nguyên nhân thất bại.")


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
    summary = "Tác vụ thất bại, nhưng chưa nhận diện được nguyên nhân rõ ràng"
    retryable = True

    if any(token in lowered for token in ("failed to resolve", "temporary failure in name resolution", "nameresolutionerror", "socket.gaierror")):
        error_type = "dns_resolution_failed"
        summary = "Không phân giải được tên miền của dịch vụ bên ngoài"
    elif any(token in lowered for token in ("readtimeout", "connecttimeout", "timed out")):
        error_type = "upstream_timeout"
        summary = "Yêu cầu dịch vụ bên ngoài hết thời gian chờ"
    elif stage == "render" and any(token in lowered for token in ("filenotfounderror", "no such file or directory")):
        error_type = "render_failed"
        summary = "Thất bại ở giai đoạn sắp chữ hoặc biên dịch"
        retryable = True
    elif http_status_code == 429 or any(token in lowered for token in ("rate limited", "rate limit", "too many requests", "retry-after")):
        error_type = "upstream_rate_limited"
        summary = "Yêu cầu dịch vụ bên ngoài bị giới hạn tần suất"
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
        summary = "Thất bại xác thực"
        retryable = False
    elif http_status_code == 400:
        error_type = "upstream_bad_request"
        summary = "Dịch vụ thượng nguồn từ chối yêu cầu (400)"
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
        summary = "Kiểm tra placeholder công thức thất bại"
    elif any(token in lowered for token in ("translationprotocolerror", "protocol/json shell")):
        error_type = "translation_protocol_shell"
        summary = "Mô hình dịch trả về vỏ giao thức hoặc JSON"
        stage = "translation"
    elif any(token in lowered for token in ("failed to download package", "packages.typst.org", "downloading @preview/")):
        error_type = "typst_dependency_download_failed"
        summary = "Tải phụ thuộc render Typst thất bại"
    elif any(
        token in lowered
        for token in (
            "typst runtime failed to start",
            "winerror 193",
            "winerror 5",
        )
    ):
        error_type = "typst_runtime_failed"
        summary = "Khởi động runtime Typst thất bại"
        retryable = False
        stage = "render"
    elif any(token in lowered for token in ("typst compile", "typst error", "render failed", "failed to render", "font not found", "missing bundled font")):
        error_type = "render_failed"
        summary = "Thất bại ở giai đoạn sắp chữ hoặc biên dịch"
        retryable = False
        stage = "render"
    elif any(token in lowered for token in ("jsondecodeerror", "expecting value", "extra data", "invalid control character")):
        error_type = "json_decode_failed"
        summary = "Phân tích JSON kết quả OCR thất bại"
        stage = "normalization"
        retryable = False
    elif any(token in lowered for token in ("validationerror", "normalized document schema validation failed")):
        error_type = "document_schema_validation_failed"
        summary = "Kiểm tra hợp lệ tài liệu chuẩn hóa thất bại"
        stage = "normalization"
        retryable = False
    elif "source pdf not found" in lowered:
        error_type = "source_pdf_missing"
        summary = "Thiếu PDF nguồn"
        stage = "normalization"
        retryable = False
    elif any(token in lowered for token in ("fitz.fitzerror", "pymupdf", "cannot open broken document", "file data error")):
        error_type = "source_pdf_open_failed"
        summary = "Mở PDF nguồn thất bại"
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

from __future__ import annotations

import errno
import importlib
import json
import os
import re
import sys
import traceback
from dataclasses import asdict
from dataclasses import dataclass
from typing import Any

from retainpdf_base.upstream import llm_vendor_for_url
from retainpdf_base.upstream import response_body_code
from retainpdf_base.upstream import upstream_info


STRUCTURED_FAILURE_LABEL = "structured failure json"
# OCR worker 入口传的泛称。worker 读到 stage spec 后用 ``set_ocr_vendor`` 登记真正的服务商（paddle / mineru /
# glm_ocr …），失败时 ``provider`` 写服务商编号，前端不用再去读 request_payload.ocr.provider。
GENERIC_OCR_PROVIDER = "ocr"
_OCR_VENDOR = ""


def set_ocr_vendor(vendor: str) -> None:
    """登记这个 OCR worker 用的服务商（stage spec 里的 ``ocr.provider``）。"""
    global _OCR_VENDOR
    _OCR_VENDOR = str(vendor or "").strip().lower()

# Windows 的 MAX_PATH 是 260（含结尾的 NUL），建目录时还要再留 12 个字符给 8.3 文件名，
# 所以 248 个字符起就可能报「找不到文件」（issue #79 #81：渲染中间文件名带上了很长的论文标题）。
WINDOWS_LONG_PATH_CHARS = 248
_WINDOWS_PATH_RE = re.compile(r"^(?:[A-Za-z]:[\\/]|\\\\)")
# 本机环境类失败码：和上游服务、文档内容无关，failure_category 记成 environment。
LOCAL_ENVIRONMENT_FAILURE_CODES = frozenset(
    {"out_of_memory", "runtime_environment_broken", "path_too_long", "local_permission_denied"}
)
_MISSING_PATH_RE = re.compile(r"no such file or directory:\s*(['\"])(.+?)\1", re.IGNORECASE | re.DOTALL)
# 上游拒绝了请求、重试没用的 4xx（401/402/403/404/429 另有归类）：归 upstream_bad_request，summary 带状态码和服务商原话
BAD_REQUEST_STATUS_CODES = frozenset({400, 405, 409, 413, 415, 422})
# summary 里服务商原话最多多长（只取响应体的 error.message，不取请求、不取整个响应体）
PROVIDER_MESSAGE_MAX_CHARS = 160


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
    # 上游服务商回的是什么：{provider, http_status, code}，读不出 HTTP 状态和错误码时为 None（JSON 里是 null）。
    upstream: dict[str, Any] | None = None

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
    # 包过一层的错误（OCR 的 RetainNetworkError、GlmOcrQuotaExhausted 等）自己带着 status_code
    status_code = getattr(exc, "status_code", None)
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
    if failure_code in LOCAL_ENVIRONMENT_FAILURE_CODES:
        return "environment"
    if failure_code in {"auth_failed", "upstream_model_unavailable"}:
        # 模型不可用也是去设置里改（模型名、接口地址、开通），前端按 auth 给「去设置」入口
        return "auth"
    if failure_code in {"upstream_quota_exhausted"}:
        return "billing"
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
        "upstream_quota_exhausted": "上游账户余额不足或欠费，请充值或检查账户额度后重试。",
        "dns_resolution_failed": "检查当前机器的 DNS / 网络连通性，确认目标域名可解析后再重试。",
        "upstream_timeout": "检查网络质量、上游服务负载或适当增大超时后再重试。",
        "upstream_rate_limited": f"{provider_label} 当前限流，请稍后重试或降低并发。",
        "upstream_bad_request": "检查请求参数、输入文件和上游接口约束，修正后再重试。",
        "upstream_model_unavailable": (
            "模型名写错、这个 API Key 没开通该模型，或接口地址（base_url）写错：在设置里改好模型名"
            "（或去服务商控制台开通该模型）、核对接口地址后，从翻译阶段续跑。"
        ),
        "placeholder_unstable": "检查公式占位符保护链和当前批次输入，必要时缩小批次或切换保守模式。",
        "translation_protocol_shell": "检查翻译提示词与模型返回；该错误通常表示模型输出了 JSON/协议外壳而不是纯译文。",
        "typst_dependency_download_failed": "检查 Typst 依赖源网络连通性，必要时预热依赖或重试。",
        "render_failed": "检查渲染输入、字体和 Typst 编译日志，修正渲染问题后重试。",
        "json_decode_failed": "检查 OCR 原始结果是否完整有效，必要时重新拉取或重新生成。",
        "document_schema_validation_failed": "检查标准化输出是否满足 document.v1 契约，再重新执行后续阶段。",
        "source_pdf_missing": "检查任务工作目录和源 PDF 路径，确认文件存在且可访问。",
        "source_pdf_open_failed": "检查源 PDF 是否损坏或不可读，替换输入文件后重试。",
        "out_of_memory": "处理这份文档时内存不够用：关掉其他占内存的程序后重试，或把 PDF 拆成页数更少的几份分别翻译。",
        "runtime_environment_broken": "安装包缺文件或依赖库加载失败，重试不会好转：请升级到最新版或重新安装（Docker 请拉取最新镜像）。",
        "path_too_long": "文件路径超过了系统允许的长度：把 PDF 改个短一点的文件名、或放到层级浅的目录后重新上传；Windows 上也可以开启长路径支持（LongPathsEnabled）。",
        "local_permission_denied": "检查杀毒或安全软件是否拦截了 RetainPDF（可加入白名单）、文件是否被其他程序占用、安装目录和数据目录是否可写；Windows 上可以试试以管理员身份运行。",
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


def _provider_message(exc_chain: list[BaseException]) -> str:
    """异常链上响应体里服务商自己的说法（``error.message`` 或顶层 ``message``），压成一行、截到 160 字。
    只读 requests 响应：不取请求正文，也不取整个响应体（可能回显原文）。读不到交回空串。"""
    for item in exc_chain:
        response = getattr(item, "response", None)
        if response is None:
            continue
        try:
            body = json.loads(getattr(response, "text", "") or "")
        except (TypeError, ValueError):
            continue
        message: Any = None
        if isinstance(body, dict):
            error = body.get("error")
            if isinstance(error, dict):
                message = error.get("message")
            elif isinstance(error, str):
                message = error
            if not message:
                message = body.get("message")
        if isinstance(message, str) and message.strip():
            compact = re.sub(r"\s+", " ", message).strip()
            if len(compact) > PROVIDER_MESSAGE_MAX_CHARS:
                compact = compact[: PROVIDER_MESSAGE_MAX_CHARS - 1].rstrip() + "…"
            return compact
    return ""


def _build_raw_excerpt(detail: str, raw_traceback: str) -> str:
    text = detail.strip()
    if not text:
        lines = [line.strip() for line in raw_traceback.splitlines() if line.strip()]
        text = lines[-1] if lines else ""
    compact = re.sub(r"\s+", " ", text).strip()
    if len(compact) <= 280:
        return compact
    return compact[:277].rstrip() + "..."


# —— 本机环境类失败（内存、安装包、路径长度、权限）的判据 ——
# 这几类和上游服务无关，换 Key、等一会儿都没用；以前全落成「暂未识别出明确根因」，
# 或者被误认成渲染失败、鉴权失败（#38 #80 #81 #135）。判据优先看异常链里的类型和属性，
# 文字只认异常类型名和系统错误码这类不会出现在上游返回里的写法。


def _exception_chain(exc: BaseException) -> list[BaseException]:
    chain: list[BaseException] = []
    current: BaseException | None = exc
    while current is not None and current not in chain and len(chain) < 16:
        chain.append(current)
        current = current.__cause__ or current.__context__
    return chain


def _unescape_path(text: str) -> str:
    # 异常文字里的路径是 repr：Windows 反斜杠会被转义成两个，再经 JSON 一层又翻倍。
    while "\\\\" in text:
        text = text.replace("\\\\", "\\")
    return text.strip()


def _missing_paths(exc_chain: list[BaseException], text: str) -> list[str]:
    paths: list[str] = []
    for item in exc_chain:
        if isinstance(item, FileNotFoundError):
            for name in (item.filename, item.filename2):
                if isinstance(name, (str, os.PathLike)):
                    paths.append(os.fspath(name))
    paths.extend(_unescape_path(match.group(2)) for match in _MISSING_PATH_RE.finditer(text))
    return [path for path in paths if path]


def _is_out_of_memory(exc_chain: list[BaseException], lowered: str) -> bool:
    if any(isinstance(item, MemoryError) for item in exc_chain):
        return True
    return any(token in lowered for token in ("memoryerror", "cannot allocate memory"))


def _install_roots() -> list[str]:
    """本项目各 Python 包（retainpdf_*）的安装目录。这些目录里的文件缺了，只能是安装包不完整。"""
    roots: list[str] = []
    for name, module in list(sys.modules.items()):
        if "." in name or not name.startswith("retainpdf_"):
            continue
        module_file = getattr(module, "__file__", None)
        if module_file:
            roots.append(os.path.normcase(os.path.dirname(os.path.abspath(module_file))))
    return roots


def _is_installed_file(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()
    if "/site-packages/" in normalized or "/dist-packages/" in normalized:
        return True
    try:
        candidate = os.path.normcase(os.path.abspath(path))
    except (TypeError, ValueError):
        return False
    return any(candidate.startswith(root + os.sep) for root in _install_roots())


def _is_runtime_environment_broken(exc_chain: list[BaseException], lowered: str, missing_paths: list[str]) -> bool:
    """模块导入失败、动态库加载失败、安装包里的数据文件缺失（#7 #135 #143 #162）。"""
    if any(isinstance(item, ImportError) for item in exc_chain):
        return True
    if any(
        token in lowered
        for token in (
            "modulenotfounderror",
            "no module named",
            "undefined symbol",
            "dll load failed",
            "library not loaded",
        )
    ):
        return True
    return any(_is_installed_file(path) for path in missing_paths)


def _is_path_too_long(exc_chain: list[BaseException], lowered: str, missing_paths: list[str]) -> bool:
    """路径超长：WinError 206、ENAMETOOLONG，或 Windows 上「找不到文件」而路径已超过上限（#79 #81）。"""
    for item in exc_chain:
        if isinstance(item, OSError):
            if getattr(item, "winerror", None) == 206 or item.errno == errno.ENAMETOOLONG:
                return True
    if any(
        token in lowered
        for token in (
            "winerror 206",
            "file name too long",
            "filename or extension is too long",
            "文件名或扩展名太长",
        )
    ):
        return True
    return any(
        _WINDOWS_PATH_RE.match(path) and len(path) >= WINDOWS_LONG_PATH_CHARS for path in missing_paths
    )


def _is_local_permission_denied(exc_chain: list[BaseException], lowered: str) -> bool:
    """本机拒绝了文件或网络访问：权限不足、文件被别的程序占用、安全软件拦截（#38）。
    不认裸的「permission denied」——上游 403 的说明里也可能这么写。"""
    if any(isinstance(item, PermissionError) for item in exc_chain):
        return True
    return any(
        token in lowered
        for token in (
            "permissionerror",
            "winerror 32",
            "being used by another process",
            "另一个程序正在使用此文件",
        )
    )


def _failure_override(exc_chain: list[BaseException], name: str) -> str:
    """异常自己带的用户文案（例如 Paddle 当日额度用完），比按状态码拼出来的通用说法准。"""
    for item in exc_chain:
        value = getattr(item, name, "")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


_NON_OCR_STAGES = ("translat", "render")
_GENERIC_PROVIDERS = frozenset({"", GENERIC_OCR_PROVIDER, "translation", "rendering"})
_FAILED_URL_RE = re.compile(r"\b[45]\d{2} (?:Client|Server) Error\b[^|]*?\bfor url:\s*(\S+)")


def _is_ocr_failure_stage(stage: str) -> bool:
    lowered = str(stage or "").lower()
    return not any(token in lowered for token in _NON_OCR_STAGES)


def _effective_provider(provider: str, *, stage: str) -> str:
    """OCR worker 的泛称 ``ocr`` 换成登记的服务商编号；翻译、排版阶段的失败（provider-case 一个进程跑全流程时）照旧。"""
    provider = provider.strip()
    if provider == GENERIC_OCR_PROVIDER and _OCR_VENDOR and _is_ocr_failure_stage(stage):
        return _OCR_VENDOR
    return provider


def _upstream_for(
    exc: BaseException,
    *,
    text: str,
    http_status_code: int | None,
    provider: str,
    stage: str,
) -> dict[str, Any] | None:
    """失败的上游信息。先看异常本身（属性、响应、``raise ... from`` 接上的原因），再看报错文字
    （「一个块都没译成」时文字里带着最常见那次上游错误：``429 Client Error … for url: … | response_body={…}``）。"""
    # OCR 阶段用 OCR 服务商；翻译、排版的泛称（translation / rendering）不是服务商编号，按地址认
    fallback = provider if provider not in _GENERIC_PROVIDERS and _is_ocr_failure_stage(stage) else ""
    info = upstream_info(exc, context_provider=fallback)
    if info is not None:
        return info
    code = response_body_code(text)
    if http_status_code is None and not code:
        return None
    match = _FAILED_URL_RE.search(text)
    vendor = llm_vendor_for_url(match.group(1)) if match else ""
    return {
        "provider": fallback or vendor or None,
        "http_status": http_status_code,
        "code": code or None,
    }


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
    exc_chain = _exception_chain(exc)
    missing_paths = _missing_paths(exc_chain, f"{detail}\n{raw_traceback}")
    # 翻译请求层按业务码认出来的（429 里的余额、额度用完，智谱 1311/1315 套餐不能用这个模型，模型不可用）在错误类型上写明了归类
    declared = str(getattr(exc, "retain_failure_code", "") or "")

    error_type = "python_unhandled_exception"
    summary = "任务失败，但暂未识别出明确根因"
    retryable = True

    # 本机环境类排在最前：它们的证据是异常类型本身，比后面按文字、状态码猜的分支可靠；
    # 也免得 import 期崩溃因为 traceback 里有 typst 字样被认成渲染失败（#135）。
    if _is_out_of_memory(exc_chain, lowered):
        error_type = "out_of_memory"
        summary = "内存不足，处理中断"
        retryable = False
    elif _is_runtime_environment_broken(exc_chain, lowered, missing_paths):
        error_type = "runtime_environment_broken"
        summary = "运行环境不完整：缺少模块、依赖库或安装文件"
        retryable = False
    elif _is_path_too_long(exc_chain, lowered, missing_paths):
        error_type = "path_too_long"
        summary = "文件路径过长，超出系统限制"
        retryable = False
    elif any(token in lowered for token in ("failed to resolve", "temporary failure in name resolution", "nameresolutionerror", "socket.gaierror")):
        error_type = "dns_resolution_failed"
        summary = "外部服务域名解析失败"
    elif any(token in lowered for token in ("readtimeout", "connecttimeout", "timed out")):
        error_type = "upstream_timeout"
        summary = "外部服务请求超时"
    elif stage == "render" and any(token in lowered for token in ("filenotfounderror", "no such file or directory")):
        error_type = "render_failed"
        summary = "排版或编译阶段失败"
        retryable = True
    elif declared == "upstream_quota_exhausted" or http_status_code == 402 or "quotaexhausted" in lowered:
        # 402 / agent 引擎的 QuotaExhausted：账户余额不足，充值前每次重试都会同样失败
        # GLM-OCR 的余额不足是 HTTP 429 + 业务码 1113（GlmOcrQuotaExhausted），只有真是 402 才写 402
        error_type = "upstream_quota_exhausted"
        if http_status_code == 402:
            summary = "上游账户余额不足（402）"
        elif http_status_code is not None:
            summary = f"上游账户余额或额度不足（HTTP {http_status_code}）"
        else:
            summary = "上游账户余额或额度不足"
        retryable = False
    elif declared == "auth_failed":
        # 状态码可能是 429（智谱 1311/1315）：先于下面的限流判断
        error_type = "auth_failed"
        summary = "鉴权失败"
        retryable = False
    elif declared == "upstream_model_unavailable":
        # 模型不存在 / 没开通（404、智谱 1211 的 400、千问 Endpoint.AccessDenied 的 403……）：第一次就整份停下
        error_type = "upstream_model_unavailable"
        status_text = f"HTTP {http_status_code}" if http_status_code is not None else "上游"
        summary = f"翻译模型不可用（{status_text}）：模型名写错、这个 Key 没开通该模型，或接口地址写错"
        retryable = False
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
    elif http_status_code in BAD_REQUEST_STATUS_CODES:
        error_type = "upstream_bad_request"
        summary = f"上游服务拒绝请求（{http_status_code}）"
        provider_message = _provider_message(exc_chain)
        if provider_message:
            summary = f"{summary}：{provider_message}"
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
    elif "typst runtime failed to start" in lowered or (
        # WinError 5（拒绝访问）/ 193（不是有效程序）只有和 typst 一起出现才算 typst 起不来；
        # 别的文件被拒绝访问归下面的本机权限
        "typst" in lowered and any(token in lowered for token in ("winerror 193", "winerror 5]", "winerror 5)"))
    ):
        error_type = "typst_runtime_failed"
        summary = "Typst 运行时启动失败"
        retryable = False
        stage = "render"
    elif _is_local_permission_denied(exc_chain, lowered):
        error_type = "local_permission_denied"
        summary = "本机权限不足，文件或网络访问被拒绝"
        retryable = False
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

    summary = _failure_override(exc_chain, "failure_summary") or summary
    failure_category = _failure_category_for(failure_code=error_type, failed_stage=stage)
    if provider.strip() and failure_category == "internal" and provider.strip() != "translation":
        failure_category = "provider"
    suggestion = _failure_override(exc_chain, "failure_suggestion") or _suggestion_for(
        failure_code=error_type,
        failure_category=failure_category,
        provider=provider,
    )
    raw_excerpt = _build_raw_excerpt(detail, raw_traceback)
    reported_provider = _effective_provider(provider, stage=stage)
    upstream = _upstream_for(
        exc,
        text=f"{detail}\n{raw_traceback}",
        http_status_code=http_status_code,
        provider=reported_provider,
        stage=stage,
    )

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
        provider=reported_provider,
        raw_exception_type=exc_type,
        raw_exception_message=message,
        traceback=raw_traceback.strip(),
        upstream=upstream,
    )


def emit_structured_failure(exc: BaseException, *, default_stage: str, provider: str = "") -> None:
    failure = classify_exception(exc, default_stage=default_stage, provider=provider)
    traceback_text = failure.traceback.strip()
    if traceback_text:
        print(traceback_text, file=sys.stderr, flush=True)
    print(f"{STRUCTURED_FAILURE_LABEL}: {failure.to_json()}", file=sys.stderr, flush=True)


def run_with_structured_failure(main_fn: Any, *, default_stage: str, provider: str = "") -> None:
    """跑 worker 主函数，异常归类后打一行结构化失败再退出 1。

    worker 模块要在 `main_fn` 里面 import（见 `run_imported_main`）：import 期的崩溃（缺模块、
    动态库加载失败、安装包缺数据文件）也得有结构化失败，否则只能靠 Rust 按文字猜（#135 被猜成了渲染失败）。"""
    try:
        main_fn()
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        emit_structured_failure(exc, default_stage=default_stage, provider=provider)
        raise SystemExit(1) from None


def run_imported_main(module: str, *, default_stage: str, provider: str = "", attr: str = "main") -> None:
    """在结构化失败的包装里面 import `module` 再调它的 `attr`。"""

    def _main() -> Any:
        return getattr(importlib.import_module(module), attr)()

    run_with_structured_failure(_main, default_stage=default_stage, provider=provider)

"""OCR 服务商的业务码 → 任务失败码（2026-11-23，分支 fix/ocr-provider-codes）。

Python 这条路（OCR 和翻译并行、分片上传、GLM-OCR）抛错时按业务码在异常上写明归类，结构化失败
（``foundation/shared/structured_errors.py``）读这几个属性：

- ``retain_failure_code``：失败码（``ocr_file_rejected``、``ocr_provider_failed``、``upstream_bad_request``、
  ``upstream_rate_limited``、``auth_failed``、``upstream_quota_exhausted``）；
- ``failure_summary``：给用户看的一句话，带服务商名、业务码和服务商原话；
- ``failure_suggestion``：建议；
- ``failure_retryable``：可不可以原样重试（不写时按失败码的默认值）。

和 Rust 那条路（``backend/packages/retainpdf-core/src/job_failure_ocr_provider.rs``，按 OCR 诊断的分类认）给同样的失败码，
两边要一起改。码表来源：``backend/packages/retainpdf-providers/error-codes/ocr/{paddle,mineru}.json``。
"""

from __future__ import annotations

from dataclasses import dataclass


FILE_SUGGESTION = "OCR 服务商拒收了这份文件，原样重试没用：换一个文件，或把 PDF 压缩、拆分（指定页码范围）后再上传"
BAD_REQUEST_SUGGESTION = "OCR 服务商拒绝了这次请求的参数，原样重试没用；请升级到最新版，仍出现请反馈问题"
PROVIDER_FAILED_SUGGESTION = "OCR 服务商这次没处理成功，稍后重试；反复出现可以换用其他 OCR"
BUSY_SUGGESTION = "OCR 服务商当前排队已满或限流，稍后再试"
PARSE_FAILED_SUGGESTION = "可以重试一次；仍失败请换用其他 OCR，或检查 PDF 是否损坏"


@dataclass(frozen=True)
class OcrFailure:
    failure_code: str
    summary: str
    suggestion: str
    retryable: bool

    def apply(self, error: BaseException) -> BaseException:
        """把归类写到异常上，原样返回它，方便 ``raise failure.apply(...)``。"""
        error.retain_failure_code = self.failure_code  # type: ignore[attr-defined]
        error.failure_summary = self.summary  # type: ignore[attr-defined]
        error.failure_suggestion = self.suggestion  # type: ignore[attr-defined]
        error.failure_retryable = self.retryable  # type: ignore[attr-defined]
        return error


@dataclass(frozen=True)
class _Rule:
    failure_code: str
    what: str
    retryable: bool
    suggestion: str


def _file(what: str) -> _Rule:
    return _Rule("ocr_file_rejected", f"拒收了这份文件：{what}", False, FILE_SUGGESTION)


def _bad_request(what: str = "拒绝了请求参数", suggestion: str = BAD_REQUEST_SUGGESTION) -> _Rule:
    return _Rule("upstream_bad_request", what, False, suggestion)


def _provider_failed(what: str, suggestion: str = PROVIDER_FAILED_SUGGESTION, *, retryable: bool = True) -> _Rule:
    return _Rule("ocr_provider_failed", what, retryable, suggestion)


_BUSY = _Rule("upstream_rate_limited", "排队已满或请求太快", True, BUSY_SUGGESTION)

# PaddleOCR 官方异步接口（code / msg / traceId；旧写法 errorCode / errorMsg / logId）
PADDLE_RULES: dict[str, _Rule] = {
    "10001": _file("文件是空的"),
    "10002": _bad_request("无法识别提交的文件地址"),
    "10003": _file("文件太大"),
    "10004": _file("格式不支持"),
    "10005": _file("读不出文件内容（可能已损坏）"),
    "10006": _file("页数超过上限"),
    "10007": _bad_request(),
    "10008": _bad_request(),
    "10009": _bad_request(),
    "10010": _BUSY,
    "11001": _bad_request("找不到这个 OCR 任务", "OCR 任务号无效或已被删除：重新提交任务"),
    "11002": _provider_failed("任务已过期", "OCR 任务已过期：重新提交即可（重试会从头开始）"),
    "11003": _provider_failed("解析这份文件失败", PARSE_FAILED_SUGGESTION),
    "12002": _BUSY,
}

# MinerU 标准 API（code / msg / trace_id，HTTP 200）
MINERU_RULES: dict[str, _Rule] = {
    "A0202": _Rule("auth_failed", "鉴权失败：Token 不对", False, "检查 MinerU Token 是否正确（带不带 Bearer 前缀），或换一个新 Token"),
    "A0211": _Rule("auth_failed", "鉴权失败：Token 已过期", False, "MinerU Token 已过期，到 MinerU 官网重新生成 Token"),
    "-500": _bad_request(),
    "-10001": _provider_failed("服务暂时出错"),
    "-10002": _bad_request(),
    "-60001": _provider_failed("生成上传链接失败"),
    "-60002": _file("格式不支持或认不出文件类型"),
    "-60003": _file("读不出文件内容（可能已损坏）"),
    "-60004": _file("文件是空的"),
    "-60005": _file("文件太大"),
    "-60006": _file("页数超过上限"),
    "-60007": _provider_failed("服务暂时出错"),
    "-60008": _provider_failed("读取文件超时"),
    "-60009": _BUSY,
    "-60010": _provider_failed("解析这份文件失败", PARSE_FAILED_SUGGESTION),
    "-60011": _provider_failed("没拿到有效文件", "文件可能没有上传完整：重试一次；仍失败请检查网络后再试"),
    "-60012": _bad_request("找不到这个 OCR 任务", "OCR 任务号无效或已被删除：重新提交任务"),
    "-60013": _Rule("auth_failed", "拒绝访问：没有权限", False, "只能访问自己提交的 MinerU 任务：检查 MinerU Token 是否和提交时用的一致"),
    "-60014": _bad_request("不允许这个操作"),
    "-60015": _Rule("ocr_file_rejected", "转换这份文件失败", False, FILE_SUGGESTION),
    "-60016": _provider_failed("导出结果失败"),
    "-60017": _provider_failed(
        "多次解析这份文件都失败了，重试次数已用完",
        "服务商对这份文件的重试次数已用完，要等它的模型升级；先换用其他 OCR",
        retryable=False,
    ),
    "-60018": _Rule("upstream_quota_exhausted", "今日解析额度已用完", False, "MinerU 每天有解析额度，次日恢复：明天再试，或换一个 Token、换用其他 OCR"),
    "-60019": _Rule("upstream_quota_exhausted", "今日解析额度已用完", False, "MinerU 每天有解析额度，次日恢复：明天再试，或换一个 Token、换用其他 OCR"),
    "-60020": _provider_failed("拆分文件失败"),
    "-60021": _provider_failed("读取页数失败", "稍后重试；仍失败请检查 PDF 是否损坏，或换用其他 OCR"),
    "-60022": _provider_failed("读取文件失败"),
}

# MinerU 官方建议稍后重试的码（Rust 轮询的 retryable_query 同一份）：查询时退避重试，用完再报。
MINERU_RETRYABLE_CODES = frozenset(
    {"-10001", "-60001", "-60007", "-60008", "-60009", "-60010", "-60016", "-60020", "-60021", "-60022"}
)

_LABELS = {"paddle": "PaddleOCR", "mineru": "MinerU", "glm_ocr": "GLM-OCR"}


def _code_text(code: object) -> str:
    text = str(code if code is not None else "").strip()
    return "" if text in {"", "0"} else text


def _summary(provider: str, what: str, code: str, message: str) -> str:
    summary = f"{_LABELS.get(provider, provider)} {what}"
    if code:
        summary += f"（{code}）"
    message = str(message or "").strip()
    if message:
        summary += f"：{message[:120]}"
    return summary


def describe(provider: str, code: object, message: str = "") -> OcrFailure | None:
    """``provider``（paddle / mineru）的业务码 ``code`` 对应的归类；码表里没有时返回 None（交给按状态码的通用分类）。"""
    code_text = _code_text(code)
    rules = {"paddle": PADDLE_RULES, "mineru": MINERU_RULES}.get(provider, {})
    rule = rules.get(code_text)
    if rule is None:
        return None
    return OcrFailure(
        failure_code=rule.failure_code,
        summary=_summary(provider, rule.what, code_text, message),
        suggestion=rule.suggestion,
        retryable=rule.retryable,
    )


def task_failed(provider: str, message: str, *, code: object = None) -> OcrFailure:
    """轮询到 state=failed（Paddle 11003、MinerU 任务失败）：服务商解析这份文件失败，summary 带服务商原话。"""
    return OcrFailure(
        failure_code="ocr_provider_failed",
        summary=_summary(provider, "解析这份文件失败", _code_text(code), message),
        suggestion=PARSE_FAILED_SUGGESTION,
        retryable=True,
    )


# GLM-OCR（智谱通用码表，error.code）：401/403 是 Key 的问题，400 是参数或内容的问题（2026-11-23）
GLM_AUTH_HINTS: dict[str, str] = {
    "1000": "检查智谱 API Key 是否填对、是否已被删除或停用",
    "1001": "没有填写智谱 API Key：在设置里补上",
    "1003": "智谱鉴权 Token 已过期：重新生成 API Key",
    "1005": "智谱账号要求二次认证：先登录智谱控制台完成二次认证",
    "1220": "当前智谱 API Key 无权调用 GLM-OCR：换用有权限的 Key",
}
GLM_DEFAULT_AUTH_HINT = "检查智谱 API Key 是否有效、有没有调用 GLM-OCR 的权限"
GLM_CONTENT_FILTER_CODE = "1301"


def glm_rejection(status: int | None, code: object, message: str = "") -> OcrFailure | None:
    """GLM-OCR 不重试的 4xx：401/403 → 鉴权失败（建议按智谱 Key 说），400 → 请求被拒（1301 说明是内容审核）。
    别的状态返回 None（照旧按状态码归类）。"""
    code_text = _code_text(code)
    if status in {401, 403}:
        return OcrFailure(
            failure_code="auth_failed",
            summary=_summary("glm_ocr", "鉴权失败", code_text, message),
            suggestion=GLM_AUTH_HINTS.get(code_text, GLM_DEFAULT_AUTH_HINT),
            retryable=False,
        )
    if status == 400:
        if code_text == GLM_CONTENT_FILTER_CODE:
            return OcrFailure(
                failure_code="upstream_bad_request",
                summary=_summary("glm_ocr", "内容审核拦截了这份文件", code_text, message),
                suggestion="智谱的内容安全审核认为文件里有敏感内容、拒绝处理：换用其他 OCR，或去掉相关页后再试",
                retryable=False,
            )
        return OcrFailure(
            failure_code="upstream_bad_request",
            summary=_summary("glm_ocr", "拒绝了请求", code_text, message),
            suggestion=BAD_REQUEST_SUGGESTION,
            retryable=False,
        )
    return None


def server_error(provider: str, status: int | None) -> OcrFailure:
    """重试用完服务端还回 5xx。"""
    status_text = f"HTTP {status}" if status else ""
    summary = f"{_LABELS.get(provider, provider)} 服务暂时出错"
    if status_text:
        summary += f"（{status_text}）"
    return OcrFailure(
        failure_code="ocr_provider_failed",
        summary=summary + "，稍后再试",
        suggestion=PROVIDER_FAILED_SUGGESTION,
        retryable=True,
    )


__all__ = [
    "MINERU_RETRYABLE_CODES",
    "MINERU_RULES",
    "OcrFailure",
    "PADDLE_RULES",
    "describe",
    "glm_rejection",
    "server_error",
    "task_failed",
]

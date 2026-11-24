"""Job-capability client for the Rust executor (staged, not the default route).

The orchestration layer must supply stable unit/operation IDs. In particular,
do not derive a fresh operation ID after a local HTTP timeout. This client has
no upstream API key, provider URL, model policy, or fallback transport.
"""
from __future__ import annotations

import ipaddress
import re
import threading
import time
from dataclasses import dataclass
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter


from retainpdf_base.upstream import tag_upstream
from retainpdf_base.upstream_wait import begin_upstream_wait
from retainpdf_base.upstream_wait import build_wait_info
from retainpdf_base.upstream_wait import end_upstream_wait
from retainpdf_translation.core.execution_policy import ExecutorError
from retainpdf_translation.llm.shared.upstream_resilience import REGION_FAILURE_SUGGESTION
from retainpdf_translation.llm.shared.upstream_resilience import REGION_FAILURE_SUMMARY
from retainpdf_translation.llm.shared.upstream_resilience import content_rejected_error
from retainpdf_translation.llm.shared.output_limits import CHAT_FINISH_REASONS
from retainpdf_translation.llm.shared.output_limits import KIND_LABELS


class AmbiguousModelRequest(ExecutorError):
    """Stop new units, drain/checkpoint in-flight work, require manual recovery."""


class ExecutorUnavailable(ExecutorError):
    """Local receipt unavailable. Do not switch to a direct upstream request."""


class ExecutorQuotaExhausted(ExecutorError):
    """上游说余额、额度、预算用完（402，或 429 等 + 计费业务码，Rust 执行器判断）：整份停下，归 upstream_quota_exhausted。"""

    retain_failure_code = "upstream_quota_exhausted"


class ExecutorAccessDenied(ExecutorError):
    """上游拒绝这个 Key（401/403，或套餐不能用这个模型）：整份停下，归 auth_failed。"""

    retain_failure_code = "auth_failed"


class ExecutorModelUnavailable(ExecutorError):
    """模型不存在、没开通，或接口地址写错（404 等，Rust 执行器按状态码和业务码判断）：整份停下，归 upstream_model_unavailable。"""

    retain_failure_code = "upstream_model_unavailable"


class ExecutorRegionUnsupported(ExecutorAccessDenied):
    """所在地区不支持：整份停下，归 upstream_region_unsupported（2026-11-24 以前归 auth_failed），说法是换网络或换服务商（换 Key 没用）。"""

    retain_failure_code = "upstream_region_unsupported"
    failure_summary = REGION_FAILURE_SUMMARY
    failure_suggestion = REGION_FAILURE_SUGGESTION


# Rust 执行器记在操作上的 error_code（不含响应体、不含 Key）→ 抛哪种错
_FAILED_OPERATION_ERRORS = {
    "quota_exhausted": (ExecutorQuotaExhausted, "上游账户余额或额度不足（Rust 执行器按状态码和业务码判断）"),
    "payment_required": (ExecutorQuotaExhausted, "上游账户余额不足（HTTP 402）"),
    "authentication_failed": (ExecutorAccessDenied, "上游拒绝了这个 API Key（鉴权失败，或套餐不能用这个模型）"),
    "model_unavailable": (ExecutorModelUnavailable, "翻译模型不可用：模型名写错、这个 Key 没开通该模型，或接口地址写错"),
    "region_unsupported": (ExecutorRegionUnsupported, "翻译服务商不支持当前所在地区（换 Key 没用，请换网络或换服务商）"),
}
# 内容审核没过：不是执行器的错，也不停整份——抛请求层的 UpstreamContentRejected，单块入口保留原文
CONTENT_REJECTED_ERROR_CODE = "content_rejected"


class ExecutorOutputIncomplete(ExecutorError):
    """上游回了 200 但回答不完整（finish_reason 是 length / content_filter 等，Rust 执行器判断，回执带 ``finish_reason``）。

    执行器这条路照旧 fail-closed：不收半截译文、不另起请求重翻（同一个单元的 repair 只许跟在成功的 primary 后面），
    整份停下，报错写明是截断还是被内容过滤。"""

    failure_summary = "模型回答不完整（输出到上限被截断或被内容过滤），Rust 执行器没有收下半截译文"


class ExecutorRequestTooLong(ExecutorError):
    """单次请求太长（400 / 413，Rust 执行器按状态码和响应体认，回执的 ``upstream_code`` 是认出的码）。

    执行器这条路照旧 fail-closed（不在 Python 里拆批另起请求），整份停下，报错写明是请求太长、不是配置错误。"""

    failure_summary = "单次请求太长，超过了模型的上下文或请求体上限"
    failure_suggestion = "在设置里调小每批的块数，或换上下文更长的模型后重试。"


def _incomplete_operation_error(error_code: str, operation: dict) -> ExecutorError | None:
    """回答不完整 / 单次请求太长这两种失败（``output_limits`` 的规则，Rust 侧 ``model_executor/limits.rs``）。"""
    receipt = operation.get("result") if isinstance(operation.get("result"), dict) else {}
    if error_code == "output_incomplete":
        reason = str(receipt.get("finish_reason") or "")
        kind = CHAT_FINISH_REASONS.get(reason, "incomplete")
        error = ExecutorOutputIncomplete(
            f"模型回答不完整（finish_reason={reason or '?'}：{KIND_LABELS.get(kind, KIND_LABELS['incomplete'])}），"
            "半截译文不收；已停止，不再重试"
        )
        error.kind = kind
        error.finish_reason = reason
        return error
    if error_code == "request_too_long":
        status, code = receipt.get("upstream_status"), receipt.get("upstream_code")
        error = ExecutorRequestTooLong(
            f"单次请求太长（HTTP {status or '?'}，{code or 'request_too_long'}），超过模型上下文或请求体上限；"
            "不是配置错误，已停止，不再重试"
        )
        error.status_code = status if isinstance(status, int) else None
        error.provider_code = str(code or "")
        return error
    return None


def _tag_receipt_upstream(error: ExecutorError, operation: dict) -> ExecutorError:
    """执行器回执里有上游非 2xx（``upstream_provider`` / ``upstream_status`` / ``upstream_code``）时写到报错上，
    任务失败的 ``upstream`` 从这里来（这条路 Python 拿不到上游响应）。没有就原样返回。"""
    receipt = operation.get("result") if isinstance(operation.get("result"), dict) else {}
    status = receipt.get("upstream_status")
    status = status if isinstance(status, int) and not isinstance(status, bool) else None
    code = receipt.get("upstream_code")
    code = str(code) if isinstance(code, str) and code else None
    if status is None and code is None:
        return error
    provider = receipt.get("upstream_provider")
    return tag_upstream(error, provider=str(provider) if isinstance(provider, str) and provider else "custom", http_status=status, code=code)


@dataclass(frozen=True)
class ModelReceipt:
    content: str
    operation_id: str
    metrics: dict


def _identifier(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,160}", value):
        raise ValueError("invalid job/unit/operation ID")
    return value


class RustModelExecutorClient:
    def __init__(self, api_url: str, job_id: str, capability: str, *, deadline: float = 240):
        parsed = urlsplit(api_url)
        try:
            local = ipaddress.ip_address(parsed.hostname or "").is_loopback
            parsed.port  # Reject invalid/out-of-range ports before requests.
        except ValueError:
            local = False
        if parsed.scheme != "http" or not local or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {"", "/"}:
            raise ValueError("executor must use an explicit loopback HTTP origin")
        if not re.fullmatch(r"[a-f0-9]{64}", capability):
            raise ValueError("invalid worker capability")
        if not 1 <= deadline <= 3600:
            raise ValueError("invalid executor wait deadline")
        self._base = f"{api_url.rstrip('/')}/api/v1/internal/model/jobs/{_identifier(job_id)}/requests"
        self._capability = capability
        self._deadline = deadline
        self._local = threading.local()

    def _session(self):
        if not hasattr(self._local, "session"):
            session = requests.Session()
            session.trust_env = False
            session.mount("http://", HTTPAdapter(max_retries=0))
            session.headers["Authorization"] = f"Bearer {self._capability}"
            self._local.session = session
        return self._local.session

    def close(self):
        """Close this calling thread's local connection pool."""
        session = getattr(self._local, "session", None)
        if session is not None:
            session.close()
            del self._local.session

    def _call(self, method: str, suffix: str = "", *, payload=None):
        try:
            response = self._session().request(method, self._base + suffix, json=payload, timeout=(2, 5), allow_redirects=False)
        except requests.RequestException:
            raise ExecutorUnavailable("local executor response unavailable; retain the same operation ID") from None
        try:
            if response.status_code in {401, 403}:
                raise ExecutorError("worker capability expired or rejected")
            if response.status_code == 409:
                raise ExecutorError("executor conflict or paused job; manual recovery required")
            if not 200 <= response.status_code < 300:
                raise ExecutorUnavailable(f"local executor HTTP {response.status_code}")
            try:
                result = response.json()
            except ValueError:
                raise ExecutorUnavailable("invalid local executor receipt") from None
            if not isinstance(result, dict):
                raise ExecutorUnavailable("invalid local executor receipt")
            return result
        finally:
            response.close()

    def request(self, *, operation_id: str, unit_id: str, messages: list[dict[str, str]], purpose: str = "primary", temperature: float = 0.2, max_tokens: int | None = None, response_format: dict | None = None) -> ModelReceipt:
        operation_id = _identifier(operation_id)
        payload = dict(operation_id=operation_id, unit_id=_identifier(unit_id), messages=messages, purpose=purpose, temperature=temperature, max_tokens=max_tokens, response_format=response_format)
        started = time.monotonic()
        # A single local submit. Caller may explicitly repeat this SAME payload;
        # Rust idempotency protects it even if the first response was lost.
        operation = self._call("POST", payload=payload)
        return self._await_operation(operation, operation_id=operation_id, unit_id=unit_id, started=started, wait_state=[False])

    def _report_upstream_wait(self, operation: dict, wait_state: list[bool]) -> None:
        """执行器在等服务商限流时，操作状态里带 ``upstream_wait``：出现时报开始，消失时报结束（各报一次）。"""
        wait = operation.get("upstream_wait")
        if isinstance(wait, dict) and not wait_state[0]:
            try:
                info = build_wait_info(
                    provider=str(wait.get("provider") or "custom"),
                    http_status=int(wait.get("http_status") or 429),
                    wait_s=float(wait.get("retry_after_s") or 0.0),
                    attempt=wait.get("attempt"),
                    max_attempts=wait.get("max_attempts"),
                    code=str(wait.get("code") or ""),
                    wait_source=str(wait.get("wait_source") or ""),
                )
            except (TypeError, ValueError):
                return
            wait_state[0] = begin_upstream_wait(user_stage="translation", info=info)
        elif not isinstance(wait, dict) and wait_state[0]:
            wait_state[0] = False
            end_upstream_wait(user_stage="translation")

    def _await_operation(self, operation: dict, *, operation_id: str, unit_id: str, started: float, wait_state: list[bool]) -> ModelReceipt:
        try:
            while True:
                self._report_upstream_wait(operation, wait_state)
                if operation.get("operation_id") != operation_id or operation.get("unit_id") != unit_id:
                    raise ExecutorUnavailable("executor receipt identity mismatch")
                state = operation.get("status")
                if state == "succeeded":
                    receipt = operation.get("result") or {}
                    content = receipt.get("content")
                    if not isinstance(content, str) or not content.strip():
                        raise AmbiguousModelRequest("executor returned an empty completed response")
                    return ModelReceipt(content, operation_id, {key: value for key, value in receipt.items() if key != "content"})
                if state == "ambiguous":
                    raise _tag_receipt_upstream(
                        AmbiguousModelRequest("upstream result unknown; manual retry may incur duplicate billing"), operation
                    )
                if state == "failed":
                    error_code = str(operation.get("error_code") or "")
                    if error_code == CONTENT_REJECTED_ERROR_CODE:
                        receipt = operation.get("result") if isinstance(operation.get("result"), dict) else {}
                        status, code = receipt.get("upstream_status"), receipt.get("upstream_code")
                        raise _tag_receipt_upstream(
                            content_rejected_error(
                                f"内容审核未过（HTTP {status}，业务码 {code}，error_code={error_code}）；这一块保留原文，不再重试",
                                provider=str(receipt.get("upstream_provider") or ""),
                                code=str(code or ""),
                                http_status=status if isinstance(status, int) else None,
                            ),
                            operation,
                        )
                    limit_error = _incomplete_operation_error(error_code, operation)
                    if limit_error is not None:
                        raise _tag_receipt_upstream(limit_error, operation)
                    known = _FAILED_OPERATION_ERRORS.get(error_code)
                    if known is not None:
                        error_class, reason = known
                        receipt = operation.get("result") if isinstance(operation.get("result"), dict) else {}
                        status, code = receipt.get("upstream_status"), receipt.get("upstream_code")
                        upstream = f"HTTP {status}，业务码 {code}，" if status and code else ""
                        error = error_class(f"{reason}（{upstream}error_code={error_code}）；已停止，不再重试")
                        error.status_code = status if isinstance(status, int) else None
                        error.provider_code = str(code or "")
                        raise _tag_receipt_upstream(error, operation)
                if state in {"failed", "cancelled"}:
                    error = ExecutorError(f"model operation {state}; no automatic upstream retry")
                    receipt = operation.get("result") if isinstance(operation.get("result"), dict) else {}
                    status = receipt.get("upstream_status")
                    if state == "failed" and isinstance(status, int) and 400 <= status < 500:
                        # 上游拒了请求（400、409、413、422……）：带上状态码，结构化失败归 upstream_bad_request
                        error.status_code = status
                    raise _tag_receipt_upstream(error, operation)
                if state not in {"queued", "running"}:
                    raise ExecutorUnavailable("unknown executor operation state")
                if time.monotonic() - started >= self._deadline:
                    raise ExecutorUnavailable("local wait deadline reached; inspect the existing operation before retrying")
                time.sleep(0.15)
                operation = self._call("GET", f"/{operation_id}")
        finally:
            if wait_state[0]:
                wait_state[0] = False
                end_upstream_wait(user_stage="translation")

    def cancel(self, operation_id: str) -> bool:
        return self._call("POST", f"/{_identifier(operation_id)}/cancel").get("changed") is True

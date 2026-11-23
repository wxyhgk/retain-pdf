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


from retainpdf_base.upstream_wait import begin_upstream_wait
from retainpdf_base.upstream_wait import build_wait_info
from retainpdf_base.upstream_wait import end_upstream_wait
from retainpdf_translation.core.execution_policy import ExecutorError


class AmbiguousModelRequest(ExecutorError):
    """Stop new units, drain/checkpoint in-flight work, require manual recovery."""


class ExecutorUnavailable(ExecutorError):
    """Local receipt unavailable. Do not switch to a direct upstream request."""


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
                    raise AmbiguousModelRequest("upstream result unknown; manual retry may incur duplicate billing")
                if state in {"failed", "cancelled"}:
                    raise ExecutorError(f"model operation {state}; no automatic upstream retry")
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

"""网络类失败的结构化分类（2026-11-27 细分）。

用户报的桌面版 2026.11.23（macOS）：agent 翻译每次请求 CERTIFICATE_VERIFY_FAILED，重试 6 次后报成「限流」、分类落到「暂未识别出明确根因」。
现在证书、代理、域名解析、拒绝连接、断网、超时、握手、被断开各有自己的码和说法；判据和 Rust 兜底（job_failure_network.rs）逐字一样。
"""

from __future__ import annotations

import json
import re
import socket
import ssl
import urllib.error
from pathlib import Path

import pytest
import requests

from retainpdf_pipeline.foundation.shared import structured_errors
from retainpdf_pipeline.foundation.shared.structured_errors import classify_exception
from retainpdf_translation_agent_engine.agent_flow import AgentNetworkFailed
from retainpdf_translation_agent_engine.agent_flow import AgentQuotaExhausted

REPO = Path(__file__).resolve().parents[5]
RUST_NETWORK = REPO / "backend/packages/retainpdf-core/src/job_failure_network.rs"

DESKTOP_REPORT = (
    "translation agent stopped: reason=network_error pages_done=0/11 | model API TLS certificate verification failed: "
    "URLError: <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1006)>"
)


def _classify(exc: BaseException, *, default_stage: str = "translation") -> dict:
    try:
        raise exc
    except BaseException as raised:  # noqa: BLE001
        return json.loads(classify_exception(raised, default_stage=default_stage).to_json())


def _cert_error(reason: str) -> ssl.SSLCertVerificationError:
    return ssl.SSLCertVerificationError(1, f"[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: {reason} (_ssl.c:1006)")


CASES = [
    (AgentNetworkFailed(DESKTOP_REPORT), "tls_certificate_untrusted"),
    (urllib.error.URLError(_cert_error("unable to get local issuer certificate")), "tls_certificate_untrusted"),
    (requests.exceptions.SSLError("HTTPSConnectionPool(host='api.anthropic.com', port=443): Max retries exceeded (Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate')))"), "tls_certificate_untrusted"),
    (RuntimeError("error sending request for url (https://api.anthropic.com/v1/messages): invalid peer certificate: UnknownIssuer"), "tls_certificate_untrusted"),
    (requests.exceptions.ProxyError("HTTPSConnectionPool(host='api.deepseek.com', port=443): Max retries exceeded (Caused by ProxyError('Unable to connect to proxy', OSError('Tunnel connection failed: 407 Proxy Authentication Required')))"), "proxy_failed"),
    (urllib.error.URLError(socket.gaierror(8, "nodename nor servname provided, or not known")), "dns_resolution_failed"),
    (urllib.error.URLError(socket.gaierror(11001, "getaddrinfo failed")), "dns_resolution_failed"),
    (requests.exceptions.ConnectionError("HTTPSConnectionPool(host='api.deepseek.com', port=443): Max retries exceeded (Caused by NameResolutionError(\"Failed to resolve 'api.deepseek.com'\"))"), "dns_resolution_failed"),
    (urllib.error.URLError(ConnectionRefusedError(61, "Connection refused")), "connection_refused"),
    (requests.exceptions.ConnectionError("HTTPConnectionPool(host='127.0.0.1', port=11434): Max retries exceeded (Caused by NewConnectionError('Failed to establish a new connection: [Errno 111] Connection refused'))"), "connection_refused"),
    (OSError("[WinError 10061] 由于目标计算机积极拒绝，无法连接。"), "connection_refused"),
    (urllib.error.URLError(OSError(51, "Network is unreachable")), "network_unreachable"),
    (OSError(65, "No route to host"), "network_unreachable"),
    (TimeoutError("The read operation timed out"), "upstream_timeout"),
    (requests.exceptions.ReadTimeout("HTTPSConnectionPool(host='api.anthropic.com', port=443): Read timed out. (read timeout=300)"), "upstream_timeout"),
    (ssl.SSLError(1, "[SSL: WRONG_VERSION_NUMBER] wrong version number (_ssl.c:1006)"), "tls_handshake_failed"),
    (ssl.SSLEOFError(8, "EOF occurred in violation of protocol (_ssl.c:2427)"), "tls_handshake_failed"),
    (requests.exceptions.ConnectionError("('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))"), "connection_reset"),
    (ConnectionResetError(54, "Connection reset by peer"), "connection_reset"),
]


@pytest.mark.parametrize(("exc", "code"), CASES, ids=[f"{index}-{code}" for index, (_, code) in enumerate(CASES)])
def test_network_errors_get_their_own_codes(exc: BaseException, code: str) -> None:
    payload = _classify(exc)
    assert payload["failure_code"] == code, payload
    assert payload["failure_category"] == ("timeout" if code == "upstream_timeout" else "network")
    assert payload["summary"] != "任务失败，但暂未识别出明确根因"
    assert payload["suggestion"]
    assert payload["retryable"] is (code != "tls_certificate_untrusted")


def test_the_desktop_report_says_what_to_do() -> None:
    """用户报的那条：不再是「限流」「未识别」，建议里说代理 / VPN，也说老桌面版升级就好。"""
    payload = _classify(AgentNetworkFailed(DESKTOP_REPORT))
    assert payload["failure_code"] == "tls_certificate_untrusted"
    assert payload["retryable"] is False
    assert "代理" in payload["suggestion"] and "2026.11.23" in payload["suggestion"]


def test_certificate_suggestion_follows_the_reason() -> None:
    expired = _classify(urllib.error.URLError(_cert_error("certificate has expired")))
    assert "日期和时间" in expired["suggestion"]
    mismatch = _classify(RuntimeError("invalid peer certificate: NotValidForName"))
    assert "base_url" in mismatch["suggestion"]


def test_declared_failures_still_win_over_network_words() -> None:
    """服务商声明的归类排在网络判断前面：额度用完的报错链里夹着一次网络重试，照旧是额度。"""
    try:
        try:
            raise ConnectionResetError(54, "Connection reset by peer")
        except ConnectionResetError as first:
            raise AgentQuotaExhausted("translation agent stopped: reason=quota_exhausted pages_done=3/11 | model API HTTP 402") from first
    except AgentQuotaExhausted as exc:
        payload = json.loads(classify_exception(exc, default_stage="translation").to_json())
    assert payload["failure_code"] == "upstream_quota_exhausted"


def test_a_real_rate_limit_stop_is_still_rate_limited() -> None:
    """agent 一直被限流停下（reason=rate_limited，最后一次是 HTTP 429）照旧是限流，以前这条也落到「未识别」。"""
    payload = _classify(RuntimeError("translation agent stopped: reason=rate_limited pages_done=2/11 | model API still failing after 6 attempts: HTTP 429"))
    assert payload["failure_code"] == "upstream_rate_limited"


def _rust_tokens(name: str) -> list[str]:
    text = RUST_NETWORK.read_text(encoding="utf-8")
    match = re.search(rf"const {name}: &\[&str\] = &\[(.*?)\];", text, re.S)
    assert match, name
    return re.findall(r'"((?:[^"\\]|\\.)*)"', match.group(1))


@pytest.mark.parametrize(
    "name",
    [
        "TLS_CERTIFICATE_TOKENS",
        "PROXY_FAILURE_TOKENS",
        "DNS_FAILURE_TOKENS",
        "CONNECTION_REFUSED_TOKENS",
        "NETWORK_UNREACHABLE_TOKENS",
        "TIMEOUT_TOKENS",
        "TLS_HANDSHAKE_TOKENS",
        "CONNECTION_RESET_TOKENS",
    ],
)
def test_python_and_rust_use_the_same_tokens(name: str) -> None:
    """没有结构化失败时 Rust 兜底按同样的子串认，两边认出来的码一样（改一边两边都改）。"""
    assert list(getattr(structured_errors, name)) == _rust_tokens(name)


def test_the_shared_request_layer_does_not_retry_certificate_errors() -> None:
    """共用请求层（经典翻译、agent 的 OpenAI 协议）：证书验证不过不再当网络抖动重试；别的连接错误照旧重试。"""
    from retainpdf_translation.llm.shared import upstream_resilience

    wrapped = requests.exceptions.SSLError(
        "HTTPSConnectionPool(host='api.deepseek.com', port=443): Max retries exceeded "
        "(Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed')))"
    )
    assert not upstream_resilience.is_transient_upstream_error(wrapped)
    try:
        try:
            raise _cert_error("unable to get local issuer certificate")
        except ssl.SSLCertVerificationError as cause:
            raise requests.exceptions.SSLError("SSL failure") from cause
    except requests.exceptions.SSLError as chained:
        assert not upstream_resilience.is_transient_upstream_error(chained)
    assert upstream_resilience.is_transient_upstream_error(requests.exceptions.ConnectionError("Connection reset by peer"))
    assert upstream_resilience.is_transient_upstream_error(requests.exceptions.SSLError("[SSL: WRONG_VERSION_NUMBER] wrong version number"))


def test_a_local_permission_denial_is_not_a_network_failure() -> None:
    """#38：安全软件拦了联网，报错里有 Connection aborted，照旧归本机权限（以前就是），不是「连接被断开」。"""
    payload = _classify(requests.exceptions.ConnectionError("('Connection aborted.', PermissionError(13, 'Permission denied'))"))
    assert payload["failure_code"] == "local_permission_denied"

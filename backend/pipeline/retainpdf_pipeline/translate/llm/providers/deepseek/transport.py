from __future__ import annotations

import json
import os
import random
import socket
import threading
import time
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from retainpdf_pipeline.translate.artifacts import get_active_translation_run_diagnostics
from retainpdf_pipeline.translate.llm.shared import upstream_resilience as _resilience


DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
TRUST_ENV_PROXY_ENV = "PDF_TRANSLATOR_TRUST_ENV_PROXY"
HTTP_POOL_MAX_ENV = "RETAIN_TRANSLATION_HTTP_POOL_MAX"
HTTP_POOL_PER_THREAD_ENV = "RETAIN_TRANSLATION_HTTP_POOL_PER_THREAD"
DNS_PREWARM_TIMEOUT_ENV = "RETAIN_TRANSLATION_DNS_PREWARM_TIMEOUT_MS"
HTTP_RETRY_ATTEMPTS = 2
DNS_RETRY_MIN_ATTEMPTS = 3
HTTP_RETRY_BACKOFF_MAX_SECS = 20
HTTP_RATE_LIMIT_WAIT_MAX_SECS = 300
DNS_PREWARM_TIMEOUT_MS = 50
_THREAD_LOCAL = threading.local()
_TRANSPORT_RETRY_MARKERS = (
    "temporary failure in name resolution",
    "name resolution",
    "failed to resolve",
    "max retries exceeded",
    "connection aborted",
    "connection reset",
    "connection refused",
    "connect timeout",
    "read timeout",
    "timed out",
    "server disconnected",
    "remote end closed connection",
    "service unavailable",
    "bad gateway",
    "gateway timeout",
    "too many requests",
)
_TRANSPORT_STATUS_CODES = {408, 429, 500, 502, 503, 504}
# 400/401/402/403 must fail fast: 402 is quota-exhausted (recharge hint),
# 401/403 are auth errors, 400 is a bad request. None of them may burn retries.
_NON_RETRYABLE_STATUS_CODES = frozenset(_resilience.NON_RETRYABLE_STATUS_CODES)
_DNS_RETRY_MARKERS = (
    "temporary failure in name resolution",
    "name resolution",
    "failed to resolve",
    "nodename nor servname provided",
    "no address associated with hostname",
    "getaddrinfo failed",
)
_DNS_CACHE_TTL_SECS = 60
_DNS_CACHE_LOCK = threading.Lock()
_DNS_CACHE: dict[str, float] = {}
_DNS_INFLIGHT: set[str] = set()


def env_int(name: str, default: int, *, minimum: int = 1) -> int:
    value = os.environ.get(name, "")
    if not value.strip():
        return max(minimum, int(default))
    try:
        return max(minimum, int(value))
    except ValueError:
        return max(minimum, int(default))


def _mark_dns_prewarm_done(hostname: str, *, success: bool) -> None:
    with _DNS_CACHE_LOCK:
        _DNS_INFLIGHT.discard(hostname)
        if success:
            _DNS_CACHE[hostname] = time.time() + _DNS_CACHE_TTL_SECS


def _resolve_hostname(hostname: str, *, request_label: str = "") -> None:
    try:
        socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
    except OSError as exc:
        if request_label:
            print(f"{request_label}: dns prewarm skipped host={hostname}: {type(exc).__name__}: {exc}", flush=True)
        _mark_dns_prewarm_done(hostname, success=False)
        return
    _mark_dns_prewarm_done(hostname, success=True)


def normalize_base_url(base_url: str) -> str:
    normalized = (base_url or DEFAULT_BASE_URL).strip().rstrip("/")
    if normalized.endswith("/chat/completions"):
        normalized = normalized[: -len("/chat/completions")]
    return normalized


def hostname_from_base_url(base_url: str) -> str:
    parsed = urlparse(normalize_base_url(base_url))
    return str(parsed.hostname or "").strip().lower()


def chat_completions_url(base_url: str) -> str:
    return f"{normalize_base_url(base_url)}/chat/completions"


def build_headers(api_key: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    return headers


def is_dns_resolution_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(marker in text for marker in _DNS_RETRY_MARKERS)


def prewarm_dns(base_url: str, *, request_label: str = "") -> None:
    hostname = hostname_from_base_url(base_url)
    if not hostname:
        return
    now = time.time()
    with _DNS_CACHE_LOCK:
        cached_until = _DNS_CACHE.get(hostname, 0.0)
        if cached_until > now:
            return
        if hostname in _DNS_INFLIGHT:
            return
        _DNS_INFLIGHT.add(hostname)
    resolver = threading.Thread(
        target=_resolve_hostname,
        kwargs={"hostname": hostname, "request_label": request_label},
        daemon=True,
    )
    resolver.start()
    timeout_ms = env_int(DNS_PREWARM_TIMEOUT_ENV, DNS_PREWARM_TIMEOUT_MS, minimum=0)
    if timeout_ms > 0:
        resolver.join(timeout_ms / 1000.0)


def should_trust_env_proxy() -> bool:
    value = os.environ.get(TRUST_ENV_PROXY_ENV, "")
    return value.strip().lower() in {"1", "true", "yes", "on"}


def build_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = should_trust_env_proxy()
    if not session.trust_env:
        session.proxies.clear()
    diagnostics = get_active_translation_run_diagnostics()
    pool_size = 10
    if diagnostics is not None:
        pool_cap = env_int(HTTP_POOL_MAX_ENV, 1000, minimum=32)
        per_thread_cap = env_int(HTTP_POOL_PER_THREAD_ENV, 2, minimum=1)
        adaptive_limit = diagnostics.build_summary().get("adaptive_concurrency", {}).get("initial_limit", 1)
        pool_size = min(pool_cap, max(1, min(int(adaptive_limit or 1), per_thread_cap)))
        diagnostics.set_http_pool_settings(pool_size=pool_size, pool_cap=pool_cap)
    adapter = HTTPAdapter(
        pool_connections=pool_size,
        pool_maxsize=pool_size,
        pool_block=True,
        max_retries=Retry(
            total=0,
            connect=0,
            read=0,
            redirect=0,
            status=0,
            backoff_factor=0,
        ),
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


def request_session_key() -> str:
    return "session_trust_env" if should_trust_env_proxy() else "session_direct"


def get_session() -> requests.Session:
    session_key = request_session_key()
    session = getattr(_THREAD_LOCAL, session_key, None)
    if session is None:
        session = build_session()
        setattr(_THREAD_LOCAL, session_key, session)
    return session


def drop_session(session_key: str) -> None:
    session = getattr(_THREAD_LOCAL, session_key, None)
    if session is not None:
        try:
            session.close()
        except Exception:
            pass
        setattr(_THREAD_LOCAL, session_key, None)


def is_transport_error(exc: Exception) -> bool:
    if isinstance(exc, (ValueError, KeyError, json.JSONDecodeError)):
        return False
    status = _resilience.http_status_of(exc)
    if status is not None and status in _NON_RETRYABLE_STATUS_CODES:
        return False
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    text = str(exc).lower()
    if any(marker in text for marker in _TRANSPORT_RETRY_MARKERS):
        return status is None or status not in _NON_RETRYABLE_STATUS_CODES
    if isinstance(exc, requests.HTTPError):
        # HTTPError without a transport status code (incl. 400/401/402/403)
        # must not retry. Only 408/429/5xx are transient.
        return exc.response is not None and exc.response.status_code in _TRANSPORT_STATUS_CODES
    return isinstance(exc, requests.RequestException)


def should_drop_session_after_error(exc: Exception) -> bool:
    if isinstance(exc, requests.HTTPError):
        return False
    return isinstance(exc, (requests.ConnectionError, requests.Timeout, socket.gaierror)) or is_dns_resolution_error(exc)


def retry_delay(attempt: int) -> float:
    base_delay = min(float(HTTP_RETRY_BACKOFF_MAX_SECS), float(2 ** max(0, attempt - 1)))
    jitter_window = max(0.25, base_delay * 0.5)
    return min(float(HTTP_RETRY_BACKOFF_MAX_SECS), base_delay + random.uniform(0.0, jitter_window))


def retry_after_delay(exc: Exception, attempt: int) -> tuple[float, str]:
    if isinstance(exc, requests.HTTPError) and exc.response is not None and exc.response.status_code == 429:
        header = str(exc.response.headers.get("Retry-After", "") or "").strip()
        if header.isdigit():
            return float(max(1, int(header))), "retry_after"
    return retry_delay(attempt), "backoff"


def clear_dns_cache_for_base_url(base_url: str) -> None:
    with _DNS_CACHE_LOCK:
        _DNS_CACHE.pop(hostname_from_base_url(base_url), None)

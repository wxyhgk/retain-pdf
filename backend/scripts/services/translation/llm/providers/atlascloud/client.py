from __future__ import annotations

"""Atlas Cloud translation provider defaults and credential resolution.

Atlas Cloud (https://www.atlascloud.ai) exposes an OpenAI-compatible
``/v1/chat/completions`` endpoint, so this provider intentionally reuses the
shared OpenAI-compatible transport that already lives in the DeepSeek provider
client. The only Atlas-specific surface is the default base URL, default model,
the credential environment variable / local env file, and the matching API key
resolver.
"""

from typing import Any

import requests

from foundation.shared.local_env import get_secret

# The shared OpenAI-compatible HTTP transport is provider-neutral; reuse it so
# Atlas Cloud does not duplicate retry / streaming / diagnostics logic.
from services.translation.llm.providers.deepseek.client import build_headers
from services.translation.llm.providers.deepseek.client import chat_completions_url
from services.translation.llm.providers.deepseek.client import get_session
from services.translation.llm.providers.deepseek.client import is_transport_error
from services.translation.llm.providers.deepseek.client import normalize_base_url
from services.translation.llm.providers.deepseek.client import request_chat_content


DEFAULT_BASE_URL = "https://api.atlascloud.ai/v1"
# Atlas Cloud's recommended default chat model. ``deepseek-v4-pro`` is a
# reasoning model, so callers should give it enough ``max_tokens`` (>= 512),
# otherwise the token budget is spent on the reasoning trace and ``content``
# comes back empty with ``finish_reason=length``.
DEFAULT_MODEL = "deepseek-ai/deepseek-v4-pro"
DEFAULT_API_KEY_ENV = "ATLASCLOUD_API_KEY"
DEFAULT_API_KEY_FILE = "atlascloud.env"


def get_api_key(explicit_api_key: str = "", env_var: str = DEFAULT_API_KEY_ENV, required: bool = True) -> str:
    api_key = get_secret(
        explicit_value=explicit_api_key,
        env_var=env_var,
        env_file_name=DEFAULT_API_KEY_FILE,
    )
    if required and not api_key:
        raise RuntimeError(f"Missing API key. Set {env_var}, scripts/.env/{DEFAULT_API_KEY_FILE}, or pass --api-key.")
    return api_key


# ---------------------------------------------------------------------------
# Third-party API error-code handling (review item 1).
#
# The shared OpenAI-compatible transport (``request_chat_content``) already
# retries the transient status codes below with exponential backoff + jitter
# and honours ``Retry-After`` on 429 (see ``deepseek/client.py``). Atlas Cloud
# inherits that path verbatim. The helpers here make the contract explicit and
# give callers a small, transport-only way to classify a failed Atlas call into
# a stable, human-readable reason instead of parsing raw exception strings.
# ---------------------------------------------------------------------------

# Status codes the shared transport treats as transient and retries.
RETRYABLE_STATUS_CODES = (408, 429, 500, 502, 503, 504)

_STATUS_REASONS = {
    400: "bad request (check model id / payload)",
    401: "unauthorized (check ATLASCLOUD_API_KEY)",
    403: "forbidden (key lacks access to this model)",
    404: "not found (unknown route or model)",
    408: "request timeout (transient, retried)",
    422: "unprocessable request (invalid parameters)",
    429: "rate limited (transient, retried with backoff / Retry-After)",
    500: "internal server error (transient, retried)",
    502: "bad gateway (transient, retried)",
    503: "service unavailable (transient, retried)",
    504: "gateway timeout (transient, retried)",
}


def http_status_of(exc: Exception) -> int | None:
    """Return the HTTP status code carried by a failed request, if any."""
    response = getattr(exc, "response", None)
    if response is None:
        return None
    code = getattr(response, "status_code", None)
    return int(code) if code is not None else None


def is_rate_limited(exc: Exception) -> bool:
    """True when the failure is an Atlas Cloud 429 (rate limit)."""
    return http_status_of(exc) == 429


def describe_api_error(exc: Exception) -> str:
    """Human-readable, log-safe reason for an Atlas Cloud API failure.

    Never includes credentials. ``request_chat_content`` already attaches the
    response body excerpt to the raised ``HTTPError``; this only adds a stable
    category so callers/operators can branch on the failure class.
    """
    status = http_status_of(exc)
    if status is None:
        if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
            return f"network error ({type(exc).__name__}, transient, retried)"
        return f"{type(exc).__name__}"
    reason = _STATUS_REASONS.get(status, "unexpected status")
    retry_hint = "retryable" if status in RETRYABLE_STATUS_CODES else "non-retryable"
    return f"HTTP {status}: {reason} [{retry_hint}]"


# ---------------------------------------------------------------------------
# Usage accounting (review item 2).
#
# Atlas Cloud does not expose an OpenAI-style ``/dashboard/billing`` balance
# endpoint (those routes return 404); remaining credit is shown in the web
# console. Token *usage*, however, is returned inline on every OpenAI-compatible
# chat completion, so the backend can account for consumption per request.
# ---------------------------------------------------------------------------

def extract_usage(response_json: dict[str, Any]) -> dict[str, int]:
    """Extract token usage from an Atlas Cloud chat-completion response.

    Returns ``{prompt_tokens, completion_tokens, total_tokens}`` (zero-filled
    when the provider omits a field). Atlas Cloud is OpenAI-compatible, so the
    ``usage`` object is present on non-streaming completions.
    """
    usage = response_json.get("usage") if isinstance(response_json, dict) else None
    if not isinstance(usage, dict):
        return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    def _as_int(value: Any) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    prompt = _as_int(usage.get("prompt_tokens"))
    completion = _as_int(usage.get("completion_tokens"))
    total = _as_int(usage.get("total_tokens")) or (prompt + completion)
    return {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": total}


def fetch_usage(
    messages: list[dict[str, str]],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    timeout: int = 60,
) -> dict[str, int]:
    """Make a minimal Atlas Cloud chat call and report its token usage.

    A small backend probe for verifying connectivity and reading the live
    ``usage`` payload. Reuses the shared transport's session/headers; errors
    propagate as ``requests`` exceptions (classify with ``describe_api_error``).
    """
    body = {"model": model, "messages": messages, "max_tokens": 512, "temperature": 0}
    response = get_session().post(
        chat_completions_url(base_url),
        headers=build_headers(api_key),
        json=body,
        timeout=timeout,
    )
    response.raise_for_status()
    return extract_usage(response.json())


__all__ = [
    "DEFAULT_API_KEY_ENV",
    "DEFAULT_API_KEY_FILE",
    "DEFAULT_BASE_URL",
    "DEFAULT_MODEL",
    "RETRYABLE_STATUS_CODES",
    "build_headers",
    "chat_completions_url",
    "describe_api_error",
    "extract_usage",
    "fetch_usage",
    "get_api_key",
    "get_session",
    "http_status_of",
    "is_rate_limited",
    "is_transport_error",
    "normalize_base_url",
    "request_chat_content",
]

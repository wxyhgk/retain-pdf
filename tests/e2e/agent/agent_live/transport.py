from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

from .contracts import LiveE2EError

MAX_HTTP_BYTES = 4 * 1024 * 1024
LOCAL_HTTP = build_opener(ProxyHandler({}))


def read_response(response: Any) -> dict[str, Any]:
    raw = response.read(MAX_HTTP_BYTES + 1)
    if len(raw) > MAX_HTTP_BYTES:
        raise LiveE2EError("backend response exceeded the live E2E limit")
    try:
        payload = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise LiveE2EError("backend returned a non-JSON response") from exc
    if not isinstance(payload, dict):
        raise LiveE2EError("backend returned an invalid JSON envelope")
    return payload


def request_json(
    method: str,
    url: str,
    api_key: str,
    *,
    payload: dict[str, Any] | None = None,
    body: bytes | None = None,
    content_type: str = "application/json",
    timeout: float = 30.0,
) -> dict[str, Any]:
    encoded = body
    if payload is not None:
        encoded = json.dumps(
            payload, ensure_ascii=False, separators=(",", ":")
        ).encode()
    headers = {"Accept": "application/json", "X-API-Key": api_key}
    if encoded is not None:
        headers["Content-Type"] = content_type
    request = Request(url, data=encoded, headers=headers, method=method)
    try:
        with LOCAL_HTTP.open(request, timeout=timeout) as response:
            result = read_response(response)
    except HTTPError as error:
        try:
            detail = read_response(error)
            message = str(detail.get("message") or "request rejected")[:1000]
        except LiveE2EError:
            message = "request rejected"
        raise LiveE2EError(f"backend HTTP {error.code}: {message}") from error
    except (URLError, TimeoutError, OSError) as error:
        raise LiveE2EError(f"backend request failed: {type(error).__name__}") from error
    if result.get("code") != 0:
        raise LiveE2EError("backend returned a failed API envelope")
    return result

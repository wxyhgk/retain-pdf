"""Readiness checks for the optional fx custom Gateway bridge."""

from __future__ import annotations

import socket
from urllib.parse import urlsplit

from ..config import normalize_fx_gateway_base_url


def probe_fx_gateway_endpoint(base_url: str, *, timeout: float) -> None:
    """Prove that an fx 0.0.5 custom loopback bridge is accepting TCP.

    The official Gateway is intentionally not contacted here: that would turn
    startup/readiness into a billable or internet-dependent model operation.
    A custom endpoint is a local bridge by contract, so a bounded TCP connect
    is a useful no-credential readiness check.
    """

    normalized = normalize_fx_gateway_base_url(base_url)
    if not normalized:
        return
    parsed = urlsplit(normalized)
    host = parsed.hostname
    port = parsed.port
    if host is None or port is None:  # normalize already rejects this; defensive.
        raise RuntimeError("FX Gateway custom endpoint is invalid")
    try:
        with socket.create_connection((host, port), timeout=max(0.05, timeout)):
            pass
    except OSError as exc:
        raise RuntimeError(
            f"FX Gateway custom endpoint is unreachable at {host}:{port}"
        ) from exc

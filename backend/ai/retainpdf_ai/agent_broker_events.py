"""Safe public event projection for brokered document operations."""

from __future__ import annotations

import json
import re
from typing import Any

from .agent_broker_contracts import BrokerCommand, BrokerScope

MAX_BROKER_FRAME_BYTES = 1024 * 1024

_SAFE_OPERATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_OPERATION_STATUSES = {
    "draft",
    "awaiting_confirmation",
    "queued",
    "running",
    "validating",
    "result_ready",
    "committed",
    "failed",
    "cancelled",
    "ambiguous",
}


def safe_operation_event(
    command: BrokerCommand,
    stdout: str,
    scope: BrokerScope,
) -> dict[str, Any] | None:
    """Project a successful CLI response into the public SSE discovery shape."""
    if (
        not command.action.startswith("operation.")
        or len(stdout) > MAX_BROKER_FRAME_BYTES
    ):
        return None
    try:
        envelope = json.loads(stdout)
    except (TypeError, json.JSONDecodeError):
        return None
    if not isinstance(envelope, dict) or envelope.get("ok") is not True:
        return None
    response = envelope.get("response")
    if not isinstance(response, dict):
        return None
    view = response.get("data", response)
    if not isinstance(view, dict):
        return None
    operation_id = str(view.get("operation_id") or "").strip()
    status = str(view.get("status") or "").strip()
    if (
        not _SAFE_OPERATION_ID.fullmatch(operation_id)
        or status not in _OPERATION_STATUSES
    ):
        return None
    try:
        attempt = int(view.get("current_attempt") or 0)
    except (TypeError, ValueError):
        return None
    if attempt < 1:
        return None
    events = view.get("events")
    latest_event_seq = 0
    if isinstance(events, list):
        for item in events:
            if not isinstance(item, dict):
                continue
            try:
                latest_event_seq = max(latest_event_seq, int(item.get("seq") or 0))
            except (TypeError, ValueError):
                continue
    return {
        "type": "agent_operation",
        "event_id": f"{operation_id}:{attempt}:{latest_event_seq}:{status}",
        "operation_id": operation_id,
        "conversation_id": str(
            view.get("conversation_id") or scope.conversation_id
        ).strip(),
        "request_message_id": str(
            view.get("request_message_id") or scope.request_message_id
        ).strip(),
        "status": status,
        "current_attempt": attempt,
        "latest_event_seq": latest_event_seq,
    }

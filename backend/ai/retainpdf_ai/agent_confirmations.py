"""Model-independent confirmation projection for document operations."""

from __future__ import annotations

from typing import Any

_CONFIRMATION_ACTIONS: dict[str, tuple[str, bool]] = {
    "draft": ("run", False),
    "awaiting_confirmation": ("run", False),
    "result_ready": ("commit", False),
    "failed": ("retry", False),
    "ambiguous": ("retry", True),
}


def confirmation_requests(result: Any, confirmation_mode: str) -> list[dict[str, Any]]:
    """Project touched operation refs into a model-independent UI contract."""
    if confirmation_mode == "green_light":
        return []
    requests: list[dict[str, Any]] = []
    seen: set[tuple[str, str, int]] = set()
    for ref in list(getattr(result, "operation_refs", []) or []):
        if not isinstance(ref, dict):
            continue
        operation_id = str(ref.get("operation_id") or "").strip()
        status = str(ref.get("status") or "").strip()
        action_spec = _CONFIRMATION_ACTIONS.get(status)
        try:
            current_attempt = int(ref.get("current_attempt") or 0)
            latest_event_seq = int(ref.get("latest_event_seq") or 0)
        except (TypeError, ValueError):
            continue
        if not operation_id or current_attempt < 1 or action_spec is None:
            continue
        action, requires_risk_acceptance = action_spec
        key = (operation_id, action, current_attempt)
        if key in seen:
            continue
        seen.add(key)
        requests.append(
            {
                "schema": "retainpdf_agent_confirmation_v1",
                "operation_id": operation_id,
                "action": action,
                "status": status,
                "current_attempt": current_attempt,
                "latest_event_seq": max(0, latest_event_seq),
                "requires_risk_acceptance": requires_risk_acceptance,
            }
        )
    return requests

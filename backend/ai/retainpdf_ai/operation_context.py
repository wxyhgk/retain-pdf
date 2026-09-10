from __future__ import annotations

from typing import Any, Protocol


class OperationReader(Protocol):
    def list_agent_operations(
        self,
        conversation_id: str,
        *,
        limit: int = 20,
    ) -> list[dict[str, Any]]: ...


def load_operation_context(
    rust: OperationReader,
    *,
    conversation_id: str,
    document_id: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Load only operations belonging to the current durable document scope.

    This snapshot is advisory model context. Every later mutation still passes
    through the broker and Rust authorization/CAS checks.
    """
    if not conversation_id.strip() or not document_id.strip():
        return []
    try:
        operations = rust.list_agent_operations(conversation_id, limit=limit)
    except Exception:  # noqa: BLE001 - context enrichment must not fail a turn
        return []
    return [
        operation
        for operation in operations
        if str(operation.get("document_id") or "").strip() == document_id.strip()
    ][:limit]

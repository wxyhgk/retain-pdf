"""Pure message-tree reconstruction for AI conversation history."""

from __future__ import annotations

from typing import Any


def visible_path(
    messages: list[dict[str, Any]],
    head_id: str,
    *,
    stop_at: str = "",
) -> list[dict[str, Any]]:
    """Walk from a selected head to the root and return the visible branch.

    Legacy messages without tree identifiers are projected into a stable
    sequence-linked branch.
    """
    if not messages:
        return []
    ordered = sorted(
        messages,
        key=lambda message: (
            int(message.get("seq") or 0) if str(message.get("seq") or "").strip() else 0
        ),
    )
    by_id: dict[str, dict[str, Any]] = {}
    previous_id = ""
    for index, raw in enumerate(ordered):
        message_id = (
            str(raw.get("message_id") or "").strip() or f"__seq_{raw.get('seq', index)}"
        )
        parent_id = str(raw.get("parent_id") or "").strip()
        if not parent_id and previous_id:
            parent_id = previous_id
        node = {**raw, "message_id": message_id, "parent_id": parent_id}
        by_id[message_id] = node
        previous_id = message_id

    start_id = (stop_at or head_id or "").strip()
    if not start_id:
        start_id = previous_id
    current = by_id.get(start_id)
    if current is None and ordered:
        current = by_id.get(previous_id)
    chain: list[dict[str, Any]] = []
    guard = 0
    while current is not None and guard <= len(messages) + 2:
        chain.append(current)
        guard += 1
        parent_id = str(current.get("parent_id") or "").strip()
        current = by_id.get(parent_id) if parent_id else None
    chain.reverse()
    return chain


def transcript_from_detail(
    detail: dict[str, Any], *, stop_at: str = ""
) -> list[dict[str, Any]]:
    messages = list(detail.get("messages") or [])
    head_id = str(detail.get("head_id") or "").strip()
    transcript: list[dict[str, Any]] = []
    for message in visible_path(messages, head_id, stop_at=stop_at):
        role = str(message.get("role") or "")
        content = str(message.get("content") or "")
        if role not in {"user", "assistant"} or not content.strip():
            continue
        transcript.append(
            {
                "role": role,
                "content": content,
                "message_id": str(message.get("message_id") or ""),
                "parent_id": str(message.get("parent_id") or ""),
                "citations_json": message.get("citations_json") or "[]",
            }
        )
    return transcript

from __future__ import annotations

from collections.abc import Callable

from services.document_schema.compat import default_block_continuation_hint
from services.document_schema.compat import normalize_block_continuation_hint


def continuation_role_for(index: int, size: int) -> str:
    if size <= 1:
        return "single"
    if index == 0:
        return "head"
    if index == size - 1:
        return "tail"
    return "middle"


def continuation_scope_for_blocks(blocks: list[dict]) -> str:
    page_indexes = {int(block.get("page_index", 0) or 0) for block in blocks}
    return "cross_page" if len(page_indexes) > 1 else "intra_page"


def build_provider_continuation_hint(
    *,
    group_id: str,
    role: str,
    scope: str,
    reading_order: int = -1,
    confidence: float = 1.0,
) -> dict:
    group_id = str(group_id or "").strip()
    if not group_id:
        return default_block_continuation_hint()
    return normalize_block_continuation_hint(
        {
            "source": "provider",
            "group_id": group_id,
            "role": role,
            "scope": scope,
            "reading_order": reading_order,
            "confidence": confidence,
        }
    )


def assign_provider_group_continuation_hints(
    *,
    group_id: str,
    ordered_blocks: list[dict],
    confidence: float = 1.0,
    reading_order_resolver: Callable[[dict, int], int | None] | None = None,
) -> None:
    if not ordered_blocks:
        return
    scope = continuation_scope_for_blocks(ordered_blocks)
    for index, block in enumerate(ordered_blocks):
        reading_order = (
            reading_order_resolver(block, index) if reading_order_resolver is not None else index
        )
        block["continuation_hint"] = build_provider_continuation_hint(
            group_id=group_id,
            role=continuation_role_for(index, len(ordered_blocks)),
            scope=scope,
            reading_order=-1 if reading_order is None else reading_order,
            confidence=confidence,
        )


__all__ = [
    "assign_provider_group_continuation_hints",
    "build_provider_continuation_hint",
    "continuation_role_for",
    "continuation_scope_for_blocks",
]

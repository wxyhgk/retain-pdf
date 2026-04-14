from __future__ import annotations

import re

from services.document_schema.defaults import default_block_continuation_hint
from services.document_schema.provider_adapters.common import assign_provider_group_continuation_hints


_TOKEN_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _token(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    return _TOKEN_RE.sub("-", text).strip("-")


def _raw_order(block: dict) -> int | None:
    value = (block.get("metadata", {}) or {}).get("raw_block_order")
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if stripped and stripped.lstrip("-").isdigit():
            return int(stripped)
    return None


def _group_id(block: dict) -> str:
    metadata = block.get("metadata", {}) or {}
    global_group_id = _token(metadata.get("raw_global_group_id"))
    if global_group_id:
        return f"provider-paddle-global-{global_group_id}"
    local_group_id = _token(metadata.get("raw_group_id"))
    if local_group_id:
        page_index = int(block.get("page_index", 0) or 0)
        return f"provider-paddle-page-{page_index + 1:03d}-group-{local_group_id}"
    return ""

def assign_paddle_continuation_hints(pages: list[dict]) -> None:
    groups: dict[str, list[dict]] = {}
    for page in pages:
        for block in page.get("blocks", []) or []:
            block["continuation_hint"] = default_block_continuation_hint()
            group_id = _group_id(block)
            if not group_id:
                continue
            groups.setdefault(group_id, []).append(block)

    for group_id, blocks in groups.items():
        if len(blocks) > 1 and any(_raw_order(block) is None for block in blocks):
            continue
        ordered = sorted(
            blocks,
            key=lambda block: (
                int(block.get("page_index", 0) or 0),
                _raw_order(block) if _raw_order(block) is not None else -1,
                int(block.get("order", 0) or 0),
            ),
        )
        assign_provider_group_continuation_hints(
            group_id=group_id,
            ordered_blocks=ordered,
            confidence=0.98,
            reading_order_resolver=lambda block, _index: _raw_order(block),
        )


__all__ = ["assign_paddle_continuation_hints"]

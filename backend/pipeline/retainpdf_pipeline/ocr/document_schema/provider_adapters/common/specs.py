from __future__ import annotations

from typing import Any, TypedDict


class NormalizedBlockSpec(TypedDict, total=False):
    block_id: str
    page_index: int
    order: int
    reading_order: int
    content_kind: str
    # Transitional input alias. New adapters must use content_kind.
    block_type: str
    block_class: str
    sub_type: str
    bbox: list[float]
    geometry: dict[str, Any]
    content: dict[str, Any]
    text: str
    lines: list[dict[str, Any]]
    segments: list[dict[str, Any]]
    tags: list[str]
    layout_role: str
    semantic_role: str
    structure_role: str
    policy: dict[str, Any]
    provenance: dict[str, Any]
    derived: dict[str, Any]
    continuation_hint: dict[str, Any]
    metadata: dict[str, Any]
    source: dict[str, Any]


class NormalizedPageSpec(TypedDict, total=False):
    page_index: int
    page: int
    width: float
    height: float
    unit: str
    blocks: list[dict[str, Any]]
    metadata: dict[str, Any]

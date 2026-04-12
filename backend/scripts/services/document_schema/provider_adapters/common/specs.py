from __future__ import annotations

from typing import Any
from typing import TypedDict


class NormalizedBlockSpec(TypedDict, total=False):
    block_id: str
    page_index: int
    order: int
    block_type: str
    sub_type: str
    bbox: list[float]
    text: str
    lines: list[dict[str, Any]]
    segments: list[dict[str, Any]]
    tags: list[str]
    derived: dict[str, Any]
    continuation_hint: dict[str, Any]
    metadata: dict[str, Any]
    source: dict[str, Any]


class NormalizedPageSpec(TypedDict, total=False):
    page_index: int
    width: float
    height: float
    unit: str
    blocks: list[dict[str, Any]]
    metadata: dict[str, Any]

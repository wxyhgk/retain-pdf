from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def classify_with_previous_anchor(
    items: list[dict],
    *,
    label_getter: Callable[[dict], str],
    resolver: Callable[[dict, tuple[str, int] | None], T],
    anchor_getter: Callable[[T], tuple[str, str] | None],
) -> list[T]:
    resolved: list[T] = []
    previous_anchor: tuple[str, int] | None = None
    for index, item in enumerate(items):
        value = resolver(item, previous_anchor)
        resolved.append(value)
        anchor = anchor_getter(value)
        if anchor:
            anchor_type, anchor_sub_type = anchor
            if anchor_type in {"image", "table", "code", "formula"}:
                previous_anchor = (anchor_sub_type or anchor_type, index)
        _ = label_getter(item)
    return resolved

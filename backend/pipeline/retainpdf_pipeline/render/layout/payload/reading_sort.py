from __future__ import annotations

"""Reading-order-first sorting helpers for render layout (double-column fix).

Background: several payload orderings used a global ``sorted((y, x))`` over
``inner_bbox``. On double-column pages that interleaves the top of the right
column into the middle of the left column, so adjacency-based policies
(collision, smoothing, tight-gap inset, short-body expansion, suspicious-OCR
glue detection) pair boxes across columns.

These helpers sort primarily by ``reading_order`` / ``layout_zone_rank`` and
use bbox ``(y, x)`` only as an in-column fallback. When no entry carries an
explicit ``reading_order``, the helpers fall back to the legacy ``(y, x)``
order so behavior is unchanged (and never raise).

Same-column predicate: the canonical rule lives in
``geometry_adjustments._same_text_column``::

    overlap >= min_width * 0.55  or  left_delta <= max(18, page_w * 0.035)

``same_text_column`` here implements the identical rule; callers that only
know ``page_text_width_med`` may pass it as a width proxy (tolerance falls
back to ``max(18, proxy * 0.035)``). Cross-column deltas are hundreds of pt,
so the proxy only matters on very wide pages.
"""

from typing import Any

SAME_COLUMN_OVERLAP_RATIO = 0.55
SAME_COLUMN_LEFT_BASE_PT = 18.0
SAME_COLUMN_LEFT_PAGE_RATIO = 0.035

_MISSING_ORDER = 10**9


def _to_int_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


def item_reading_order(item: dict | None) -> int | None:
    """Explicit ``reading_order`` of an item, or ``None`` when absent.

    Only the ``reading_order`` key counts (``block_idx`` is input order, not
    reading order, and must not trigger re-sorting on its own).
    """
    if not isinstance(item, dict):
        return None
    if "reading_order" not in item:
        return None
    order = _to_int_or_none(item.get("reading_order"))
    if order is None:
        return None
    return max(0, order)


def item_layout_zone_rank(item: dict | None) -> int | None:
    """``layout_zone_rank`` of an item, or ``None`` when unset (``-1``/missing)."""
    if not isinstance(item, dict):
        return None
    if "layout_zone_rank" not in item:
        return None
    rank = _to_int_or_none(item.get("layout_zone_rank"))
    if rank is None or rank < 0:
        return None
    return rank


def item_page_idx(item: dict | None) -> int:
    if not isinstance(item, dict):
        return 0
    page_idx = _to_int_or_none(item.get("page_idx"))
    return page_idx if page_idx is not None else 0


def _entry_item(entry: dict) -> dict | None:
    inner = entry.get("item") if isinstance(entry, dict) else None
    return inner if isinstance(inner, dict) else (entry if isinstance(entry, dict) else None)


def _entry_bbox(entry: dict) -> list[float] | None:
    if not isinstance(entry, dict):
        return None
    for key in ("inner_bbox", "bbox"):
        bbox = entry.get(key)
        if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
            try:
                return [float(value) for value in bbox]
            except (TypeError, ValueError):
                continue
    item = _entry_item(entry)
    if isinstance(item, dict):
        for key in ("bbox",):
            bbox = item.get(key)
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4:
                try:
                    return [float(value) for value in bbox]
                except (TypeError, ValueError):
                    continue
    return None


def _entry_page_idx(entry: dict) -> int:
    item = _entry_item(entry)
    return item_page_idx(item)


def has_explicit_reading_order(entries: list[dict]) -> bool:
    for entry in entries:
        if item_reading_order(_entry_item(entry)) is not None:
            return True
    return False


def _bbox_yx(entry: dict) -> tuple[float, float]:
    bbox = _entry_bbox(entry)
    if bbox is None:
        return (0.0, 0.0)
    return (bbox[1], bbox[0])


def sort_entries_by_reading_order(entries: list[dict]) -> list[dict]:
    """Sort payload/item dicts reading-order-first, bbox ``(y, x)`` as fallback.

    Falls back to legacy ``sorted((y, x))`` when no entry has ``reading_order``.
    Never raises; entries with missing fields sort deterministically.
    """
    if not entries:
        return list(entries)
    if not has_explicit_reading_order(entries):
        return sorted(entries, key=_bbox_yx)
    # Page index dominates so cross-page continuation groups stay page-grouped
    # (reading_order restarts per page); zone rank breaks ties, bbox last.
    def _key(entry: dict) -> tuple[int, int, int, float, float]:
        item = _entry_item(entry)
        order = item_reading_order(item)
        rank = item_layout_zone_rank(item)
        y, x = _bbox_yx(entry)
        return (
            _entry_page_idx(entry),
            order if order is not None else _MISSING_ORDER,
            rank if rank is not None else _MISSING_ORDER,
            y,
            x,
        )

    return sorted(entries, key=_key)


def sort_payloads_by_reading_order(payloads: list[dict]) -> list[dict]:
    return sort_entries_by_reading_order(payloads)


def sort_items_by_reading_order(items: list[dict]) -> list[dict]:
    return sort_entries_by_reading_order(items)


def sort_indices_by_reading_order(
    indices: list[int],
    *,
    boxes: dict[int, list[float]],
    items: list[dict] | None = None,
) -> list[int]:
    """Sort ``effective``-style indices reading-order-first.

    ``boxes`` maps index -> bbox; ``items`` parallels the index space when
    available (translated_items). Falls back to legacy ``(y, x))`` order when
    no referenced item carries ``reading_order``.
    """
    if not indices:
        return list(indices)

    def _item_for(index: int) -> dict | None:
        if items is not None and 0 <= index < len(items) and isinstance(items[index], dict):
            return items[index]
        return None

    if not any(item_reading_order(_item_for(index)) is not None for index in indices):
        return sorted(
            indices,
            key=lambda index: (boxes[index][1], boxes[index][0]) if index in boxes and len(boxes[index]) == 4 else (0.0, 0.0),
        )

    def _key(index: int) -> tuple[int, int, int, float, float]:
        item = _item_for(index)
        order = item_reading_order(item)
        rank = item_layout_zone_rank(item)
        box = boxes.get(index)
        y, x = (box[1], box[0]) if isinstance(box, list) and len(box) == 4 else (0.0, 0.0)
        return (
            item_page_idx(item),
            order if order is not None else _MISSING_ORDER,
            rank if rank is not None else _MISSING_ORDER,
            y,
            x,
        )

    return sorted(indices, key=_key)


def same_text_column(
    first: list[float],
    second: list[float],
    *,
    page_width: float | None = None,
    page_text_width_med: float | None = None,
) -> bool:
    """Canonical same-column predicate (mirrors geometry_adjustments).

    ``overlap >= min_width * 0.55`` or ``left_delta <= max(18, ref * 0.035)``,
    where ``ref`` is ``page_width`` when available, else ``page_text_width_med``
    as a proxy (identical to ``page_width`` whenever the proportional term is
    below the 18pt floor, which covers normal pages).
    """
    if len(first) != 4 or len(second) != 4:
        return False
    first_width = max(1.0, first[2] - first[0])
    second_width = max(1.0, second[2] - second[0])
    overlap = max(0.0, min(first[2], second[2]) - max(first[0], second[0]))
    if overlap >= min(first_width, second_width) * SAME_COLUMN_OVERLAP_RATIO:
        return True
    ref = 0.0
    if page_width is not None and page_width > 0:
        ref = page_width
    elif page_text_width_med is not None and page_text_width_med > 0:
        ref = page_text_width_med
    tolerance = max(SAME_COLUMN_LEFT_BASE_PT, ref * SAME_COLUMN_LEFT_PAGE_RATIO)
    return abs(first[0] - second[0]) <= tolerance


__all__ = [
    "SAME_COLUMN_LEFT_BASE_PT",
    "SAME_COLUMN_LEFT_PAGE_RATIO",
    "SAME_COLUMN_OVERLAP_RATIO",
    "has_explicit_reading_order",
    "item_layout_zone_rank",
    "item_page_idx",
    "item_reading_order",
    "same_text_column",
    "sort_entries_by_reading_order",
    "sort_indices_by_reading_order",
    "sort_items_by_reading_order",
    "sort_payloads_by_reading_order",
]

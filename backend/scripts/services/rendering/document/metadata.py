from __future__ import annotations

import fitz

from services.rendering.document.page_map import RenderPageMap


def _normalize_toc_levels(toc: list[list]) -> list[list]:
    normalized: list[list] = []
    previous_level = 0
    for entry in toc:
        if len(entry) < 3:
            continue
        level = int(entry[0] or 1)
        if not normalized:
            level = 1
        else:
            level = max(1, min(level, previous_level + 1))
        normalized.append([level, entry[1], entry[2]])
        previous_level = level
    return normalized


def copy_toc(
    source_doc: fitz.Document,
    target_doc: fitz.Document,
    *,
    start_page: int = 0,
    end_page: int | None = None,
) -> int:
    try:
        source_toc = source_doc.get_toc()
    except Exception:
        return 0
    if not source_toc:
        return 0

    last_source_page = len(source_doc) - 1
    first = max(0, start_page)
    last = last_source_page if end_page is None or end_page < 0 else min(end_page, last_source_page)
    if first > last:
        return 0

    remapped: list[list] = []
    target_page_count = len(target_doc)
    for level, title, page, *_rest in source_toc:
        source_page = int(page or 0) - 1
        if not (first <= source_page <= last):
            continue
        target_page = source_page - first + 1
        if not (1 <= target_page <= target_page_count):
            continue
        remapped.append([level, title, target_page])

    remapped = _normalize_toc_levels(remapped)
    if not remapped:
        return 0
    try:
        target_doc.set_toc(remapped)
    except Exception:
        return 0
    return len(remapped)


def copy_toc_for_page_map(
    source_doc: fitz.Document,
    target_doc: fitz.Document,
    *,
    page_map: RenderPageMap | None = None,
    source_page_indices: list[int] | None = None,
) -> int:
    try:
        source_toc = source_doc.get_toc()
    except Exception:
        return 0
    if page_map is None and source_page_indices is not None:
        page_map = RenderPageMap(source_page_indices=list(source_page_indices))
    if not source_toc or page_map is None or not page_map.source_page_indices:
        return 0
    if page_map is None:
        return 0

    target_pages_by_source = {
        int(source_page_idx): output_idx + 1
        for output_idx, source_page_idx in enumerate(page_map.source_page_indices)
        if 0 <= int(source_page_idx) < len(source_doc)
    }
    if not target_pages_by_source:
        return 0

    target_page_count = len(target_doc)
    remapped: list[list] = []
    for level, title, page, *_rest in source_toc:
        source_page = int(page or 0) - 1
        target_page = target_pages_by_source.get(source_page)
        if target_page is None or not (1 <= target_page <= target_page_count):
            continue
        remapped.append([level, title, target_page])

    remapped = _normalize_toc_levels(remapped)
    if not remapped:
        return 0
    try:
        target_doc.set_toc(remapped)
    except Exception:
        return 0
    return len(remapped)

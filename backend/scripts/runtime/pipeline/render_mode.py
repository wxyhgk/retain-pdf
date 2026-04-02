from __future__ import annotations

from pathlib import Path

import fitz

from services.rendering.compress.analysis import source_pdf_has_vector_graphics
from services.rendering.redaction.redaction import item_has_removable_text
from services.rendering.redaction.shared import iter_valid_translated_items
from services.rendering.redaction.shared import normalize_words


AUTO_OVERLAY_MIN_ITEMS = 8
AUTO_OVERLAY_MIN_REMOVABLE_RATIO = 0.6
AUTO_OVERLAY_SMALL_SAMPLE_MIN_ITEMS = 5
AUTO_OVERLAY_SMALL_SAMPLE_MIN_REMOVABLE_RATIO = 0.9
AUTO_OVERLAY_MAX_SAMPLE_PAGES = 3
AUTO_OVERLAY_MAX_ITEMS_PER_PAGE = 24
AUTO_OVERLAY_MIN_WORDS = 7
AUTO_OVERLAY_MIN_CHARS = 40


def resolve_page_range(total_pages: int, start_page: int, end_page: int) -> tuple[int, int]:
    start = max(0, start_page)
    stop = total_pages - 1 if end_page < 0 else min(end_page, total_pages - 1)
    if start > stop:
        raise RuntimeError(f"Invalid page range: start_page={start}, end_page={stop}")
    return start, stop


def is_editable_pdf(doc: fitz.Document, start_page: int, end_page: int) -> bool:
    sample_pages = range(start_page, min(end_page, start_page + 2) + 1)
    words = 0
    for page_idx in sample_pages:
        if 0 <= page_idx < len(doc):
            words += len(doc[page_idx].get_text("words"))
    return words >= 20


def is_overlay_probe_candidate(item: dict) -> bool:
    source_text = (item.get("source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False
    word_count = len(normalize_words(source_text))
    if word_count >= AUTO_OVERLAY_MIN_WORDS:
        return True
    return len(source_text) >= AUTO_OVERLAY_MIN_CHARS


def should_use_overlay_for_probe_result(checked_items: int, removable_ratio: float) -> bool:
    if checked_items >= AUTO_OVERLAY_MIN_ITEMS:
        return removable_ratio >= AUTO_OVERLAY_MIN_REMOVABLE_RATIO
    if checked_items >= AUTO_OVERLAY_SMALL_SAMPLE_MIN_ITEMS:
        return removable_ratio >= AUTO_OVERLAY_SMALL_SAMPLE_MIN_REMOVABLE_RATIO
    return False


def resolve_effective_render_mode(
    *,
    render_mode: str,
    source_pdf_path: Path,
    start_page: int,
    end_page: int,
    translated_pages_map: dict[int, list[dict]] | None = None,
) -> str:
    if render_mode != "auto":
        return render_mode

    if not translated_pages_map:
        print("auto render mode selected: typst (no translated pages map)")
        return "typst"

    doc = fitz.open(source_pdf_path)
    try:
        total_pages = len(doc)
        sample_stop = total_pages - 1 if end_page < 0 else min(end_page, total_pages - 1)
        editable = is_editable_pdf(doc, start_page, sample_stop)
        vector_heavy = source_pdf_has_vector_graphics(
            source_pdf_path,
            start_page=start_page,
            end_page=sample_stop,
        )
        if not editable:
            print("auto render mode selected: overlay (non-editable PDF; white-cover/redaction route)")
            return "overlay"
        if vector_heavy:
            print("auto render mode selected: overlay (editable vector-heavy PDF; cover-only redaction)")
            return "overlay"

        checked_items = 0
        removable_items = 0
        sampled_pages = 0

        for page_idx in sorted(translated_pages_map):
            if sampled_pages >= AUTO_OVERLAY_MAX_SAMPLE_PAGES:
                break
            if page_idx < start_page or (end_page >= 0 and page_idx > end_page) or not (0 <= page_idx < len(doc)):
                continue
            page_items = iter_valid_translated_items(translated_pages_map.get(page_idx, []))
            if not page_items:
                continue
            sampled_pages += 1
            page = doc[page_idx]
            for rect, item, _translated_text in page_items[:AUTO_OVERLAY_MAX_ITEMS_PER_PAGE]:
                if not is_overlay_probe_candidate(item):
                    continue
                checked_items += 1
                if item_has_removable_text(page, item, rect):
                    removable_items += 1
    finally:
        doc.close()

    removable_ratio = (removable_items / checked_items) if checked_items else 0.0
    effective_render_mode = "overlay" if should_use_overlay_for_probe_result(checked_items, removable_ratio) else "typst"
    print(
        f"auto render mode selected: {effective_render_mode} "
        f"(removable_items={removable_items}, checked_items={checked_items}, removable_ratio={removable_ratio:.2f})"
    )
    return effective_render_mode

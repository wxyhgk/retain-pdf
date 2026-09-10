from __future__ import annotations

import fitz


def new_redaction_diagnostics(valid_items: list[tuple[fitz.Rect, dict, str]]) -> dict[str, object]:
    return {
        "items": len(valid_items),
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "fast_page_cover_only": False,
        "item_fast_cover_count": 0,
        "route": "",
        "uses_pymupdf_redaction": False,
        "legacy_pdf_write_reason": "",
    }

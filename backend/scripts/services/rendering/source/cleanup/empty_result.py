from __future__ import annotations


def new_empty_redaction_result(strategy: str | None = None) -> dict[str, object]:
    return {
        "items": 0,
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "fast_page_cover_only": False,
        "item_fast_cover_count": 0,
        "route": "empty",
        "strategy": strategy or "auto",
        "uses_pymupdf_redaction": False,
        "legacy_pdf_write_reason": "",
    }

from __future__ import annotations


def new_overlay_merge_diagnostics() -> dict[str, object]:
    return {
        "pages": [],
        "source_overlay_elapsed_seconds": 0.0,
        "overlay_merge_elapsed_seconds": 0.0,
        "raw_removable_rects": 0,
        "merged_removable_rects": 0,
        "cover_rects": 0,
        "item_fast_cover_count": 0,
        "fast_page_cover_pages": 0,
        "legacy_pymupdf_redaction_pages": 0,
        "legacy_pymupdf_overlay_pages": 0,
        "legacy_pdf_write_reasons": {},
        "page_compile_diagnostics": [],
    }


def apply_redaction_diagnostics(
    diagnostics: dict[str, object],
    page_diag: dict[str, object],
    redaction: dict[str, object],
) -> None:
    page_diag.update(redaction)
    diagnostics["source_overlay_elapsed_seconds"] = float(
        diagnostics.get("source_overlay_elapsed_seconds", 0.0) or 0.0
    ) + float(redaction.get("elapsed_seconds", 0.0) or 0.0)
    diagnostics["raw_removable_rects"] = int(diagnostics.get("raw_removable_rects", 0) or 0) + int(
        redaction.get("raw_removable_rects", 0) or 0
    )
    diagnostics["merged_removable_rects"] = int(diagnostics.get("merged_removable_rects", 0) or 0) + int(
        redaction.get("merged_removable_rects", 0) or 0
    )
    diagnostics["cover_rects"] = int(diagnostics.get("cover_rects", 0) or 0) + int(
        redaction.get("cover_rects", 0) or 0
    )
    diagnostics["item_fast_cover_count"] = int(diagnostics.get("item_fast_cover_count", 0) or 0) + int(
        redaction.get("item_fast_cover_count", 0) or 0
    )
    if bool(redaction.get("fast_page_cover_only")):
        diagnostics["fast_page_cover_pages"] = int(diagnostics.get("fast_page_cover_pages", 0) or 0) + 1
    if bool(redaction.get("uses_pymupdf_redaction")):
        diagnostics["legacy_pymupdf_redaction_pages"] = int(
            diagnostics.get("legacy_pymupdf_redaction_pages", 0) or 0
        ) + 1
        reason = str(redaction.get("legacy_pdf_write_reason") or redaction.get("route") or "unknown")
        reasons = diagnostics.setdefault("legacy_pdf_write_reasons", {})
        if isinstance(reasons, dict):
            reasons[reason] = int(reasons.get(reason, 0) or 0) + 1


def apply_merge_elapsed(
    diagnostics: dict[str, object],
    page_diag: dict[str, object],
    merge_elapsed: float,
) -> None:
    page_diag["overlay_merge_elapsed_seconds"] = merge_elapsed
    diagnostics["overlay_merge_elapsed_seconds"] = float(
        diagnostics.get("overlay_merge_elapsed_seconds", 0.0) or 0.0
    ) + merge_elapsed

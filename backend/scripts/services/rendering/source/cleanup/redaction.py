from __future__ import annotations

import fitz

from services.rendering.source.cleanup.analysis import (
    item_has_removable_text,
)
from services.rendering.source.cleanup.plan import build_redaction_plan
from services.rendering.source.cleanup.routes import apply_redaction_route


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    diagnostics: dict[str, object] | None = None,
) -> dict[str, object]:
    plan = build_redaction_plan(page, translated_items)
    valid_items = plan.valid_items
    if not valid_items:
        result = {
            "items": 0,
            "raw_removable_rects": 0,
            "merged_removable_rects": 0,
            "cover_rects": 0,
            "fast_page_cover_only": False,
            "item_fast_cover_count": 0,
            "route": "empty",
            "strategy": strategy or "auto",
        }
        if diagnostics is not None:
            diagnostics.update(result)
        return result

    result = apply_redaction_route(
        page,
        valid_items,
        fill_background=fill_background,
        cover_only=cover_only,
        strategy=strategy,
        plan=plan,
    )
    if diagnostics is not None:
        diagnostics.update(result)
    return result


__all__ = [
    "item_has_removable_text",
    "redact_translated_text_areas",
]

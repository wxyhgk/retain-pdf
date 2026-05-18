from __future__ import annotations

import fitz

from services.rendering.source.cleanup.redaction_flow import execute_redaction_flow
from services.rendering.source.cleanup.text_matching import item_has_removable_text


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    diagnostics: dict[str, object] | None = None,
) -> dict[str, object]:
    result = execute_redaction_flow(
        page,
        translated_items,
        fill_background=fill_background,
        cover_only=cover_only,
        strategy=strategy,
    )
    if diagnostics is not None:
        diagnostics.update(result)
    return result


__all__ = [
    "item_has_removable_text",
    "redact_translated_text_areas",
]

from __future__ import annotations

import fitz

from services.rendering.source.cleanup.redaction import redact_translated_text_areas


def redact_source_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    diagnostics: dict[str, object] | None = None,
) -> dict[str, object]:
    return redact_translated_text_areas(
        page,
        translated_items,
        fill_background=fill_background,
        cover_only=cover_only,
        strategy=strategy,
        diagnostics=diagnostics,
    )

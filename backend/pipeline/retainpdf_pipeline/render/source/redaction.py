from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source.cleanup.redaction import redact_translated_text_areas
from retainpdf_pipeline.render.visual_profile import VisualProfileRuntime


def redact_source_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    diagnostics: dict[str, object] | None = None,
    visual_profile: VisualProfileRuntime | None = None,
) -> dict[str, object]:
    return redact_translated_text_areas(
        page,
        translated_items,
        fill_background=fill_background,
        cover_only=cover_only,
        strategy=strategy,
        diagnostics=diagnostics,
        visual_profile=visual_profile,
    )

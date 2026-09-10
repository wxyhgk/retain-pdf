from __future__ import annotations

import fitz

from retainpdf_pipeline.render.source.cleanup.redaction_flow import execute_redaction_flow
from retainpdf_pipeline.render.source.cleanup.text_matching import item_has_removable_text
from retainpdf_pipeline.render.visual_profile import VisualProfileRuntime


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
    cover_only: bool = False,
    strategy: str | None = None,
    diagnostics: dict[str, object] | None = None,
    visual_profile: VisualProfileRuntime | None = None,
) -> dict[str, object]:
    result = execute_redaction_flow(
        page,
        translated_items,
        fill_background=fill_background,
        cover_only=cover_only,
        strategy=strategy,
        visual_profile=visual_profile,
    )
    if diagnostics is not None:
        diagnostics.update(result)
    return result


__all__ = [
    "item_has_removable_text",
    "redact_translated_text_areas",
]

from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.translate.core.payload import save_translations
from retainpdf_pipeline.translate.core.orchestration.units import refresh_translation_units_by_page


def save_pages(
    page_payloads: dict[int, list[dict]],
    translation_paths: dict[int, Path],
    page_indices: set[int] | None = None,
    *,
    refresh_units: bool = False,
) -> None:
    # Default persistence is mutation-free. Retain the explicit opt-in keyword
    # for compatibility; production stages prepare units before calling here.
    if refresh_units:
        refresh_translation_units_by_page(page_payloads)
    targets = sorted(page_payloads) if page_indices is None else sorted(page_indices)
    for page_idx in targets:
        save_translations(translation_paths[page_idx], page_payloads[page_idx])


__all__ = ["save_pages"]

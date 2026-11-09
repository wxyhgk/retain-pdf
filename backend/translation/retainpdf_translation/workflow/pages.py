from __future__ import annotations

from collections.abc import Iterable
from contextlib import ExitStack
import logging
from pathlib import Path

import fitz

from retainpdf_translation.core.ocr.json_extractor import extract_text_items
from retainpdf_translation.core.ocr.table_cells import extract_table_cell_items
from retainpdf_translation.core.payload import ensure_translation_template
from retainpdf_translation.core.payload import load_translations
from retainpdf_translation.core.orchestration.units import refresh_translation_units_by_page
from retainpdf_translation.core.orchestration.units import refresh_translation_units_and_collect_changed_pages
from retainpdf_translation.services.results.page_io import save_pages
from retainpdf_translation.workflow.translation_workflow import page_translation_path

logger = logging.getLogger(__name__)


def load_page_payloads(
    *,
    data: dict,
    output_dir: Path,
    page_indices: Iterable[int],
    math_mode: str = "direct_typst",
    table_source_pdf: Path | None = None,
) -> tuple[dict[int, Path], dict[int, list[dict]]]:
    translation_paths: dict[int, Path] = {}
    page_payloads: dict[int, list[dict]] = {}
    output_dir.mkdir(parents=True, exist_ok=True)
    with ExitStack() as stack:
        pdf = None
        if table_source_pdf is not None:
            try:
                pdf = stack.enter_context(fitz.open(table_source_pdf))
            except (OSError, RuntimeError, ValueError) as error:
                logger.warning("Skipping table extraction: source PDF could not be opened: %s", error)
        for page_idx in page_indices:
            items = extract_text_items(data, page_idx=page_idx)
            if pdf is not None:
                items.extend(extract_table_cell_items(data, page_idx, pdf))
            translation_path = page_translation_path(output_dir, page_idx)
            ensure_translation_template(items, translation_path, page_idx=page_idx, math_mode=math_mode)
            translation_paths[page_idx] = translation_path
            page_payloads[page_idx] = load_translations(translation_path)
    return translation_paths, page_payloads


__all__ = ["load_page_payloads", "save_pages", "refresh_translation_units_by_page", "refresh_translation_units_and_collect_changed_pages"]

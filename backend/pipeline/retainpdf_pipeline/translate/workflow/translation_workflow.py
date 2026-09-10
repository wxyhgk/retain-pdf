from __future__ import annotations

"""Compatibility exports for the legacy page-by-page translation workflow."""

from retainpdf_pipeline.translate.workflow.legacy.page_translation import chunked
from retainpdf_pipeline.translate.workflow.legacy.page_translation import default_page_translation_name
from retainpdf_pipeline.translate.workflow.legacy.page_translation import translate_items_to_path

__all__ = [
    "chunked",
    "default_page_translation_name",
    "translate_items_to_path",
]

"""Translate-local normalization-report file helpers.

Duplicated constants/helpers from:
- retainpdf_pipeline.ocr.document_schema.version
  (``DOCUMENT_SCHEMA_REPORT_FILE_NAME``)
- retainpdf_pipeline.ocr.document_schema.reporting
  (``load_normalization_report``, ``build_normalization_summary``)

plus a file-based structural ``build_validation_report_from_path`` over the
``document.v1.json`` input already handed to this stage.

(stage-decouple: translate entrypoints must read the report/document files
directly instead of importing ocr.)
"""

from __future__ import annotations

import json
from pathlib import Path


DOCUMENT_SCHEMA_REPORT_FILE_NAME = "document.v1.report.json"
DOCUMENT_SCHEMA_FILE_NAME = "document.v1.json"


def load_normalization_report(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _sum_default_hits(payload: dict | None) -> int:
    data = payload or {}
    return sum(int(value or 0) for value in data.values())


def build_normalization_summary(report: dict | None) -> dict:
    data = report or {}
    defaults = data.get("defaults", {}) or {}
    validation = data.get("validation", {}) or {}
    detection = data.get("detection", {}) or {}
    document_defaults = defaults.get("document_defaults", {}) or {}
    page_defaults = defaults.get("page_defaults", {}) or {}
    block_defaults = defaults.get("block_defaults", {}) or {}
    return {
        "provider": str(data.get("provider", "") or ""),
        "detected_provider": str(data.get("detected_provider", "") or ""),
        "provider_was_explicit": bool(data.get("provider_was_explicit", False)),
        "pages_observed": int(defaults.get("pages_seen", 0) or 0),
        "blocks_observed": int(defaults.get("blocks_seen", 0) or 0),
        "defaulted_document_fields": _sum_default_hits(document_defaults),
        "defaulted_page_fields": _sum_default_hits(page_defaults),
        "defaulted_block_fields": _sum_default_hits(block_defaults),
        "any_defaults_applied": bool(document_defaults or page_defaults or block_defaults),
        "valid": bool(validation.get("valid", False)),
        "complete": bool(validation.get("complete", False)),
        "warnings": list(validation.get("warnings", []) or []),
        "page_count": int(validation.get("page_count", 0) or 0),
        "block_count": int(validation.get("block_count", 0) or 0),
        "asset_count": int(validation.get("asset_count", 0) or 0),
        "referenced_asset_count": int(validation.get("referenced_asset_count", 0) or 0),
        "unreferenced_asset_count": int(validation.get("unreferenced_asset_count", 0) or 0),
        "provider_markdown_image_count": int(validation.get("provider_markdown_image_count", 0) or 0),
        "covered_provider_markdown_image_count": int(
            validation.get("covered_provider_markdown_image_count", 0) or 0
        ),
        "uncovered_provider_markdown_image_count": int(
            validation.get("uncovered_provider_markdown_image_count", 0) or 0
        ),
        "asset_block_count": int(validation.get("asset_block_count", 0) or 0),
        "linked_asset_block_count": int(validation.get("linked_asset_block_count", 0) or 0),
        "unlinked_asset_block_count": int(validation.get("unlinked_asset_block_count", 0) or 0),
        "zero_segment_bbox_count": int(validation.get("zero_segment_bbox_count", 0) or 0),
        "approximate_segment_bbox_count": int(validation.get("approximate_segment_bbox_count", 0) or 0),
        "coordinate_space": str(validation.get("coordinate_space", "") or ""),
        "geometry_bbox_consistent": bool(validation.get("geometry_bbox_consistent", False)),
        "detection_matched": bool(detection.get("matched", False)),
        "detection_attempts": len(detection.get("attempts", []) or []),
    }


def build_validation_report_from_path(path: Path) -> dict:
    """Build a structural validation summary from the ``document.v1.json`` file.

    Full schema validation stays in the ocr stage (which writes the
    normalization report next to the document). Here translate only confirms
    the file it was given is a structurally usable normalized document; the
    result feeds the stage summary JSON.
    """

    with Path(path).open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict) or not str(data.get("schema", "") or "").startswith("normalized_document_v"):
        raise RuntimeError(f"translate expects normalized document.v1.json: {path}")
    pages = data.get("pages", []) or []
    if not isinstance(pages, list):
        raise RuntimeError(f"translate expects normalized document.v1.json pages list: {path}")
    block_count = sum(len(page.get("blocks", []) or []) for page in pages if isinstance(page, dict))
    report = {
        "valid": True,
        "complete": True,
        "page_count": len(pages),
        "block_count": block_count,
        "path": str(path),
    }
    return report


__all__ = [
    "DOCUMENT_SCHEMA_FILE_NAME",
    "DOCUMENT_SCHEMA_REPORT_FILE_NAME",
    "build_normalization_summary",
    "build_validation_report_from_path",
    "load_normalization_report",
]

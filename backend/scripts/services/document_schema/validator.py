from __future__ import annotations

from pathlib import Path
import json

from services.document_schema.compat import upgrade_document_payload
from services.document_schema.version import DOCUMENT_SCHEMA_FILE_NAME
from services.document_schema.version import DOCUMENT_SCHEMA_NAME
from services.document_schema.version import DOCUMENT_SCHEMA_VERSION

SUPPORTED_DOCUMENT_SCHEMA_VERSIONS = ("1.0", DOCUMENT_SCHEMA_VERSION)


class DocumentSchemaValidationError(ValueError):
    pass


def _fail(path: str, message: str) -> None:
    raise DocumentSchemaValidationError(f"{path}: {message}")


def _expect_type(path: str, value, expected_type) -> None:
    if not isinstance(value, expected_type):
        expected = expected_type.__name__ if isinstance(expected_type, type) else "/".join(t.__name__ for t in expected_type)
        _fail(path, f"expected {expected}, got {type(value).__name__}")


def _validate_bbox(path: str, bbox) -> None:
    _expect_type(path, bbox, list)
    if len(bbox) != 4:
        _fail(path, f"expected 4 numbers, got {len(bbox)}")
    for index, value in enumerate(bbox):
        if not isinstance(value, (int, float)):
            _fail(f"{path}[{index}]", f"expected number, got {type(value).__name__}")


def _validate_derived(path: str, derived: dict) -> None:
    _expect_type(path, derived, dict)
    for key in ("role", "by", "confidence"):
        if key not in derived:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.role", derived["role"], str)
    _expect_type(f"{path}.by", derived["by"], str)
    confidence = derived["confidence"]
    if not isinstance(confidence, (int, float)):
        _fail(f"{path}.confidence", f"expected number, got {type(confidence).__name__}")
    if confidence < 0.0 or confidence > 1.0:
        _fail(f"{path}.confidence", f"expected 0.0 <= confidence <= 1.0, got {confidence}")


def _validate_continuation_hint(path: str, hint: dict) -> None:
    _expect_type(path, hint, dict)
    for key in ("source", "group_id", "role", "scope", "reading_order", "confidence"):
        if key not in hint:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.source", hint["source"], str)
    if hint["source"] not in {"", "provider"}:
        _fail(f"{path}.source", f"unexpected continuation source '{hint['source']}'")
    _expect_type(f"{path}.group_id", hint["group_id"], str)
    _expect_type(f"{path}.role", hint["role"], str)
    if hint["role"] not in {"", "single", "head", "middle", "tail"}:
        _fail(f"{path}.role", f"unexpected continuation role '{hint['role']}'")
    _expect_type(f"{path}.scope", hint["scope"], str)
    if hint["scope"] not in {"", "intra_page", "cross_page"}:
        _fail(f"{path}.scope", f"unexpected continuation scope '{hint['scope']}'")
    reading_order = hint["reading_order"]
    if isinstance(reading_order, bool) or not isinstance(reading_order, int):
        _fail(f"{path}.reading_order", f"expected integer, got {type(reading_order).__name__}")
    if reading_order < -1:
        _fail(f"{path}.reading_order", f"expected >= -1, got {reading_order}")
    confidence = hint["confidence"]
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        _fail(f"{path}.confidence", f"expected number, got {type(confidence).__name__}")
    if confidence < 0.0 or confidence > 1.0:
        _fail(f"{path}.confidence", f"expected 0.0 <= confidence <= 1.0, got {confidence}")


def _validate_segment(path: str, segment: dict) -> None:
    _expect_type(path, segment, dict)
    for key in ("type", "raw_type", "text", "bbox"):
        if key not in segment:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.type", segment["type"], str)
    if segment["type"] not in {"text", "formula"}:
        _fail(f"{path}.type", f"unexpected segment type '{segment['type']}'")
    _expect_type(f"{path}.raw_type", segment["raw_type"], str)
    _expect_type(f"{path}.text", segment["text"], str)
    _validate_bbox(f"{path}.bbox", segment["bbox"])
    if "score" in segment and segment["score"] is not None and not isinstance(segment["score"], (int, float)):
        _fail(f"{path}.score", f"expected number|null, got {type(segment['score']).__name__}")


def _validate_line(path: str, line: dict) -> None:
    _expect_type(path, line, dict)
    if "bbox" not in line or "spans" not in line:
        _fail(path, "missing key 'bbox' or 'spans'")
    _validate_bbox(f"{path}.bbox", line["bbox"])
    _expect_type(f"{path}.spans", line["spans"], list)
    for index, span in enumerate(line["spans"]):
        _validate_segment(f"{path}.spans[{index}]", span)


def _validate_block(path: str, block: dict, *, page_index: int) -> None:
    _expect_type(path, block, dict)
    required = (
        "block_id",
        "page_index",
        "order",
        "type",
        "sub_type",
        "bbox",
        "text",
        "lines",
        "segments",
        "tags",
        "derived",
        "continuation_hint",
        "metadata",
        "source",
    )
    for key in required:
        if key not in block:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.block_id", block["block_id"], str)
    _expect_type(f"{path}.page_index", block["page_index"], int)
    if block["page_index"] != page_index:
        _fail(f"{path}.page_index", f"expected {page_index}, got {block['page_index']}")
    _expect_type(f"{path}.order", block["order"], int)
    _expect_type(f"{path}.type", block["type"], str)
    if block["type"] not in {"text", "formula", "image", "table", "code", "unknown"}:
        _fail(f"{path}.type", f"unexpected block type '{block['type']}'")
    _expect_type(f"{path}.sub_type", block["sub_type"], str)
    _validate_bbox(f"{path}.bbox", block["bbox"])
    _expect_type(f"{path}.text", block["text"], str)
    _expect_type(f"{path}.lines", block["lines"], list)
    for index, line in enumerate(block["lines"]):
        _validate_line(f"{path}.lines[{index}]", line)
    _expect_type(f"{path}.segments", block["segments"], list)
    for index, segment in enumerate(block["segments"]):
        _validate_segment(f"{path}.segments[{index}]", segment)
    _expect_type(f"{path}.tags", block["tags"], list)
    for index, tag in enumerate(block["tags"]):
        _expect_type(f"{path}.tags[{index}]", tag, str)
    _validate_derived(f"{path}.derived", block["derived"])
    _validate_continuation_hint(f"{path}.continuation_hint", block["continuation_hint"])
    _expect_type(f"{path}.metadata", block["metadata"], dict)
    _expect_type(f"{path}.source", block["source"], dict)
    provider = block["source"].get("provider")
    if not isinstance(provider, str) or not provider:
        _fail(f"{path}.source.provider", "expected non-empty string")


def _validate_page(path: str, page: dict, *, page_index: int) -> None:
    _expect_type(path, page, dict)
    required = ("page_index", "width", "height", "unit", "blocks")
    for key in required:
        if key not in page:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.page_index", page["page_index"], int)
    if page["page_index"] != page_index:
        _fail(f"{path}.page_index", f"expected {page_index}, got {page['page_index']}")
    for key in ("width", "height"):
        if not isinstance(page[key], (int, float)):
            _fail(f"{path}.{key}", f"expected number, got {type(page[key]).__name__}")
        if page[key] < 0:
            _fail(f"{path}.{key}", f"expected >= 0, got {page[key]}")
    _expect_type(f"{path}.unit", page["unit"], str)
    if page["unit"] != "pt":
        _fail(f"{path}.unit", f"expected 'pt', got '{page['unit']}'")
    _expect_type(f"{path}.blocks", page["blocks"], list)
    for index, block in enumerate(page["blocks"]):
        _validate_block(f"{path}.blocks[{index}]", block, page_index=page_index)


def validate_document_payload(data: dict) -> None:
    _expect_type("$", data, dict)
    required = ("schema", "schema_version", "document_id", "source", "page_count", "pages", "derived", "markers")
    for key in required:
        if key not in data:
            _fail("$", f"missing key '{key}'")
    if data["schema"] != DOCUMENT_SCHEMA_NAME:
        _fail("$.schema", f"expected '{DOCUMENT_SCHEMA_NAME}', got '{data['schema']}'")
    if data["schema_version"] not in SUPPORTED_DOCUMENT_SCHEMA_VERSIONS:
        _fail(
            "$.schema_version",
            f"expected one of {SUPPORTED_DOCUMENT_SCHEMA_VERSIONS}, got '{data['schema_version']}'",
        )
    _expect_type("$.document_id", data["document_id"], str)
    _expect_type("$.source", data["source"], dict)
    _expect_type("$.page_count", data["page_count"], int)
    _expect_type("$.pages", data["pages"], list)
    _expect_type("$.derived", data["derived"], dict)
    _expect_type("$.markers", data["markers"], dict)
    if data["page_count"] != len(data["pages"]):
        _fail("$.page_count", f"expected {len(data['pages'])}, got {data['page_count']}")
    for index, page in enumerate(data["pages"]):
        _validate_page(f"$.pages[{index}]", page, page_index=index)
    reference_start = data["markers"].get("reference_start")
    if reference_start is not None:
        _expect_type("$.markers.reference_start", reference_start, dict)
        for key in ("page_index", "block_id", "order"):
            if key not in reference_start:
                _fail("$.markers.reference_start", f"missing key '{key}'")


def validate_document_path(path: Path) -> dict:
    data = upgrade_document_payload(json.loads(path.read_text(encoding="utf-8")))
    validate_document_payload(data)
    return data


def build_validation_report(data: dict) -> dict:
    validate_document_payload(data)
    page_count = len(data.get("pages", []) or [])
    block_count = sum(len(page.get("blocks", []) or []) for page in data.get("pages", []) or [])
    return {
        "valid": True,
        "schema": data.get("schema", ""),
        "schema_version": data.get("schema_version", ""),
        "page_count": page_count,
        "block_count": block_count,
    }


def build_validation_report_from_path(path: Path) -> dict:
    data = validate_document_path(path)
    report = build_validation_report(data)
    report["path"] = str(path)
    return report


def validate_saved_document_path(path: Path) -> dict:
    try:
        return build_validation_report_from_path(path)
    except DocumentSchemaValidationError as exc:
        raise RuntimeError(f"normalized document schema validation failed: path={path} error={exc}") from exc


def default_schema_json_path() -> Path:
    return Path(__file__).with_name(DOCUMENT_SCHEMA_FILE_NAME.replace(".json", ".schema.json"))


__all__ = [
    "DocumentSchemaValidationError",
    "build_validation_report",
    "build_validation_report_from_path",
    "default_schema_json_path",
    "validate_document_path",
    "validate_document_payload",
    "validate_saved_document_path",
]

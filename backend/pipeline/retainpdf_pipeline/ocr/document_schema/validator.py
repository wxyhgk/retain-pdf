from __future__ import annotations

import json
import math
from importlib import resources
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.classification import (
    derive_block_class,
)
from retainpdf_pipeline.ocr.document_schema.version import (
    DOCUMENT_SCHEMA_FILE_NAME,
    DOCUMENT_SCHEMA_NAME,
    DOCUMENT_SCHEMA_VERSION,
)
from retainpdf_pipeline.ocr.document_schema.vocabulary import (
    BLOCK_CLASSES,
    BLOCK_TYPES,
    CONTENT_KINDS,
    LAYOUT_ROLES,
    SEGMENT_TYPES,
    SEMANTIC_ROLES,
)

SUPPORTED_DOCUMENT_SCHEMA_VERSIONS = (DOCUMENT_SCHEMA_VERSION,)


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
        if not math.isfinite(float(value)):
            _fail(f"{path}[{index}]", "expected finite number")


def _bbox_has_positive_area(bbox: list) -> bool:
    return len(bbox) == 4 and float(bbox[2]) > float(bbox[0]) and float(bbox[3]) > float(bbox[1])


def _validate_bbox_within(path: str, bbox: list, container: list, *, container_name: str) -> None:
    # A zero bbox is an explicit completeness problem reported separately; it
    # remains schema-valid. Any usable bbox must stay inside its owning region.
    if not _bbox_has_positive_area(bbox):
        return
    tolerance = 1e-3
    if (
        float(bbox[0]) < float(container[0]) - tolerance
        or float(bbox[1]) < float(container[1]) - tolerance
        or float(bbox[2]) > float(container[2]) + tolerance
        or float(bbox[3]) > float(container[3]) + tolerance
    ):
        _fail(path, f"must stay within {container_name} bbox {container}")


def _validate_geometry(path: str, geometry: dict) -> None:
    _expect_type(path, geometry, dict)
    if "bbox" not in geometry:
        _fail(path, "missing key 'bbox'")
    _validate_bbox(f"{path}.bbox", geometry["bbox"])
    x0, y0, x1, y1 = (float(value) for value in geometry["bbox"])
    if x1 <= x0 or y1 <= y0:
        _fail(f"{path}.bbox", "expected a positive-area rectangle")


def _validate_content(path: str, content: dict) -> None:
    _expect_type(path, content, dict)
    if "kind" not in content:
        _fail(path, "missing key 'kind'")
    _expect_type(f"{path}.kind", content["kind"], str)
    if content["kind"] not in CONTENT_KINDS:
        _fail(f"{path}.kind", f"unexpected content kind '{content['kind']}'")
    if "text" in content:
        _expect_type(f"{path}.text", content["text"], str)
    if "line_texts" in content:
        _expect_type(f"{path}.line_texts", content["line_texts"], list)
        for index, line_text in enumerate(content["line_texts"]):
            _expect_type(f"{path}.line_texts[{index}]", line_text, str)
    if "text_flow" in content:
        _expect_type(f"{path}.text_flow", content["text_flow"], str)
        if content["text_flow"] not in {"flow", "preserve_lines"}:
            _fail(f"{path}.text_flow", f"unexpected text flow '{content['text_flow']}'")
    if "asset_id" in content:
        _expect_type(f"{path}.asset_id", content["asset_id"], str)
        if not content["asset_id"]:
            _fail(f"{path}.asset_id", "expected non-empty string")
    if "asset_ids" in content:
        _expect_type(f"{path}.asset_ids", content["asset_ids"], list)
        if not content["asset_ids"]:
            _fail(f"{path}.asset_ids", "expected at least one asset id")
        seen_asset_ids: set[str] = set()
        for index, asset_id in enumerate(content["asset_ids"]):
            _expect_type(f"{path}.asset_ids[{index}]", asset_id, str)
            if not asset_id:
                _fail(f"{path}.asset_ids[{index}]", "expected non-empty string")
            if asset_id in seen_asset_ids:
                _fail(f"{path}.asset_ids[{index}]", f"duplicate asset id '{asset_id}'")
            seen_asset_ids.add(asset_id)
        primary_asset_id = str(content.get("asset_id", "") or "")
        if primary_asset_id and primary_asset_id != content["asset_ids"][0]:
            _fail(f"{path}.asset_ids[0]", "must match primary asset_id")
    if "toc_entries" in content:
        _expect_type(f"{path}.toc_entries", content["toc_entries"], list)
        for index, entry in enumerate(content["toc_entries"]):
            _expect_type(f"{path}.toc_entries[{index}]", entry, dict)
            for key in ("title", "page_label"):
                if key not in entry:
                    _fail(f"{path}.toc_entries[{index}]", f"missing key '{key}'")
                _expect_type(f"{path}.toc_entries[{index}].{key}", entry[key], str)
            if "number" in entry:
                _expect_type(f"{path}.toc_entries[{index}].number", entry["number"], str)
            if "level" in entry:
                _expect_type(f"{path}.toc_entries[{index}].level", entry["level"], int)
            if "line_index" in entry:
                _expect_type(f"{path}.toc_entries[{index}].line_index", entry["line_index"], int)
            if "bbox" in entry:
                _validate_bbox(f"{path}.toc_entries[{index}].bbox", entry["bbox"])


def _validate_policy(path: str, policy: dict) -> None:
    _expect_type(path, policy, dict)
    for key in ("translate", "translate_reason"):
        if key not in policy:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.translate", policy["translate"], bool)
    _expect_type(f"{path}.translate_reason", policy["translate_reason"], str)


def _validate_role_string(path: str, value) -> str:
    _expect_type(path, value, str)
    return str(value).strip().lower()


def _validate_provenance(path: str, provenance: dict) -> None:
    _expect_type(path, provenance, dict)
    for key in ("provider", "raw_label", "raw_sub_type", "raw_bbox", "raw_path"):
        if key not in provenance:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.provider", provenance["provider"], str)
    if not provenance["provider"]:
        _fail(f"{path}.provider", "expected non-empty string")
    _expect_type(f"{path}.raw_label", provenance["raw_label"], str)
    _expect_type(f"{path}.raw_sub_type", provenance["raw_sub_type"], str)
    _validate_bbox(f"{path}.raw_bbox", provenance["raw_bbox"])
    _expect_type(f"{path}.raw_path", provenance["raw_path"], str)


def _validate_assets(path: str, assets: dict) -> None:
    _expect_type(path, assets, dict)
    for key, asset in assets.items():
        _expect_type(f"{path}.{key}", asset, dict)
        for required_key in ("kind", "uri", "source"):
            if required_key not in asset:
                _fail(f"{path}.{key}", f"missing key '{required_key}'")
        _expect_type(f"{path}.{key}.kind", asset["kind"], str)
        _expect_type(f"{path}.{key}.uri", asset["uri"], str)
        if not asset["uri"]:
            _fail(f"{path}.{key}.uri", "expected non-empty string")
        _expect_type(f"{path}.{key}.source", asset["source"], str)


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
    if segment["type"] not in SEGMENT_TYPES:
        _fail(f"{path}.type", f"unexpected segment type '{segment['type']}'")
    _expect_type(f"{path}.raw_type", segment["raw_type"], str)
    _expect_type(f"{path}.text", segment["text"], str)
    _validate_bbox(f"{path}.bbox", segment["bbox"])
    if "score" in segment and segment["score"] is not None and not isinstance(segment["score"], (int, float)):
        _fail(f"{path}.score", f"expected number|null, got {type(segment['score']).__name__}")


def _validate_line(path: str, line: dict, *, block_bbox: list) -> None:
    _expect_type(path, line, dict)
    if "bbox" not in line or "spans" not in line:
        _fail(path, "missing key 'bbox' or 'spans'")
    _validate_bbox(f"{path}.bbox", line["bbox"])
    _validate_bbox_within(
        f"{path}.bbox",
        line["bbox"],
        block_bbox,
        container_name="block",
    )
    if "bbox_precision" in line:
        _expect_type(f"{path}.bbox_precision", line["bbox_precision"], str)
        if line["bbox_precision"] not in {
            "provider_layout",
            "block_fallback",
            "synthetic_newline",
            "synthetic_wrap",
        }:
            _fail(
                f"{path}.bbox_precision",
                f"unexpected line bbox precision '{line['bbox_precision']}'",
            )
    _expect_type(f"{path}.spans", line["spans"], list)
    for index, span in enumerate(line["spans"]):
        _validate_segment(f"{path}.spans[{index}]", span)
        _validate_bbox_within(
            f"{path}.spans[{index}].bbox",
            span["bbox"],
            line["bbox"],
            container_name="line",
        )


def _validate_block(
    path: str,
    block: dict,
    *,
    page_index: int,
    page_width: float,
    page_height: float,
) -> None:
    _expect_type(path, block, dict)
    required = (
        "block_id",
        "page_index",
        "order",
        "geometry",
        "content",
        "layout_role",
        "semantic_role",
        "structure_role",
        "policy",
        "provenance",
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
    _validate_geometry(f"{path}.geometry", block["geometry"])
    x0, y0, x1, y1 = (float(value) for value in block["geometry"]["bbox"])
    tolerance = 1e-3
    if x0 < -tolerance or y0 < -tolerance or x1 > page_width + tolerance or y1 > page_height + tolerance:
        _fail(
            f"{path}.geometry.bbox",
            f"must stay within page bounds [0, 0, {page_width}, {page_height}]",
        )
    _validate_content(f"{path}.content", block["content"])
    layout_role = _validate_role_string(f"{path}.layout_role", block["layout_role"])
    if layout_role not in LAYOUT_ROLES:
        _fail(f"{path}.layout_role", f"unexpected layout role '{block['layout_role']}'")
    semantic_role = _validate_role_string(f"{path}.semantic_role", block["semantic_role"])
    if semantic_role not in SEMANTIC_ROLES:
        _fail(f"{path}.semantic_role", f"unexpected semantic role '{block['semantic_role']}'")
    _validate_role_string(f"{path}.structure_role", block["structure_role"])
    _validate_policy(f"{path}.policy", block["policy"])
    _validate_provenance(f"{path}.provenance", block["provenance"])
    _validate_continuation_hint(f"{path}.continuation_hint", block["continuation_hint"])
    _expect_type(f"{path}.metadata", block["metadata"], dict)
    _expect_type(f"{path}.source", block["source"], dict)
    provider = block["source"].get("provider")
    if not isinstance(provider, str) or not provider:
        _fail(f"{path}.source.provider", "expected non-empty string")
    if "reading_order" in block:
        _expect_type(f"{path}.reading_order", block["reading_order"], int)
        if block["reading_order"] < 0:
            _fail(f"{path}.reading_order", f"expected >= 0, got {block['reading_order']}")

    if "type" in block:
        _expect_type(f"{path}.type", block["type"], str)
        if block["type"] not in BLOCK_TYPES:
            _fail(f"{path}.type", f"unexpected block type '{block['type']}'")
        if block["type"] != block["content"]["kind"]:
            _fail(
                f"{path}.type",
                "must match content.kind in the canonical content projection",
            )
    if "block_class" in block:
        _expect_type(f"{path}.block_class", block["block_class"], str)
        if block["block_class"] not in BLOCK_CLASSES:
            _fail(
                f"{path}.block_class",
                f"unexpected block class '{block['block_class']}'",
            )
        expected_block_class = derive_block_class(
            content_kind=block["content"]["kind"],
            layout_role=layout_role,
            semantic_role=semantic_role,
            structure_role=block["structure_role"],
        )
        if block["block_class"] != expected_block_class:
            _fail(
                f"{path}.block_class",
                f"expected '{expected_block_class}' from canonical roles",
            )
    if "sub_type" in block:
        _expect_type(f"{path}.sub_type", block["sub_type"], str)
    if "bbox" in block:
        _validate_bbox(f"{path}.bbox", block["bbox"])
        geometry_bbox = block["geometry"]["bbox"]
        if any(abs(float(left) - float(right)) > 1e-6 for left, right in zip(block["bbox"], geometry_bbox)):
            _fail(f"{path}.geometry.bbox", "must match block.bbox in the canonical PDF-point coordinate space")
    if "text" in block:
        _expect_type(f"{path}.text", block["text"], str)
        if block["text"] != block["content"].get("text", ""):
            _fail(
                f"{path}.text",
                "must match content.text in the canonical content projection",
            )
    if "lines" in block:
        _expect_type(f"{path}.lines", block["lines"], list)
        for index, line in enumerate(block["lines"]):
            _validate_line(
                f"{path}.lines[{index}]",
                line,
                block_bbox=block["geometry"]["bbox"],
            )
    if "segments" in block:
        _expect_type(f"{path}.segments", block["segments"], list)
        for index, segment in enumerate(block["segments"]):
            _validate_segment(f"{path}.segments[{index}]", segment)
            _validate_bbox_within(
                f"{path}.segments[{index}].bbox",
                segment["bbox"],
                block["geometry"]["bbox"],
                container_name="block",
            )
    if "tags" in block:
        _expect_type(f"{path}.tags", block["tags"], list)
        for index, tag in enumerate(block["tags"]):
            _expect_type(f"{path}.tags[{index}]", tag, str)
    if "derived" in block:
        _validate_derived(f"{path}.derived", block["derived"])


def _validate_page(path: str, page: dict, *, page_index: int) -> None:
    _expect_type(path, page, dict)
    required = ("page_index", "width", "height", "unit", "blocks")
    for key in required:
        if key not in page:
            _fail(path, f"missing key '{key}'")
    _expect_type(f"{path}.page_index", page["page_index"], int)
    if page["page_index"] != page_index:
        _fail(f"{path}.page_index", f"expected {page_index}, got {page['page_index']}")
    if "page" in page:
        _expect_type(f"{path}.page", page["page"], int)
        if page["page"] < 1:
            _fail(f"{path}.page", f"expected >= 1, got {page['page']}")
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
        _validate_block(
            f"{path}.blocks[{index}]",
            block,
            page_index=page_index,
            page_width=float(page["width"]),
            page_height=float(page["height"]),
        )


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
    if "doc_id" in data:
        _expect_type("$.doc_id", data["doc_id"], str)
        if not data["doc_id"]:
            _fail("$.doc_id", "expected non-empty string")
    _expect_type("$.source", data["source"], dict)
    _expect_type("$.page_count", data["page_count"], int)
    _expect_type("$.pages", data["pages"], list)
    if "assets" in data:
        _validate_assets("$.assets", data["assets"])
    _expect_type("$.derived", data["derived"], dict)
    _expect_type("$.markers", data["markers"], dict)
    if data["page_count"] != len(data["pages"]):
        _fail("$.page_count", f"expected {len(data['pages'])}, got {data['page_count']}")
    for index, page in enumerate(data["pages"]):
        _validate_page(f"$.pages[{index}]", page, page_index=index)
    assets = data.get("assets", {}) or {}
    for page_index, page in enumerate(data["pages"]):
        for block_index, block in enumerate(page.get("blocks", []) or []):
            content = block.get("content", {}) or {}
            raw_asset_ids = content.get("asset_ids", [])
            asset_ids = list(raw_asset_ids) if isinstance(raw_asset_ids, list) else []
            primary_asset_id = str(content.get("asset_id", "") or "").strip()
            if primary_asset_id and primary_asset_id not in asset_ids:
                asset_ids.insert(0, primary_asset_id)
            for asset_index, asset_id in enumerate(asset_ids):
                if asset_id and asset_id not in assets:
                    _fail(
                        f"$.pages[{page_index}].blocks[{block_index}].content.asset_ids[{asset_index}]",
                        f"references missing top-level asset '{asset_id}'",
                    )
    reference_start = data["markers"].get("reference_start")
    if reference_start is not None:
        _expect_type("$.markers.reference_start", reference_start, dict)
        for key in ("page_index", "block_id", "order"):
            if key not in reference_start:
                _fail("$.markers.reference_start", f"missing key '{key}'")


def validate_document_path(path: Path) -> dict:
    # Stream-read to avoid path.read_text + json.loads peak-memory spike
    # on large document.v1.json (see issue #80 MemoryError).
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    validate_document_payload(data)
    return data


def build_validation_report(data: dict) -> dict:
    validate_document_payload(data)
    page_count = len(data.get("pages", []) or [])
    blocks = [
        block
        for page in data.get("pages", []) or []
        for block in page.get("blocks", []) or []
    ]
    block_count = len(blocks)
    asset_blocks = [
        block
        for block in blocks
        if str((block.get("content", {}) or {}).get("kind", "") or "").lower()
        in {"image", "chart"}
    ]
    asset_block_count = len(asset_blocks)
    linked_asset_block_count = sum(
        1
        for block in asset_blocks
        if str((block.get("content", {}) or {}).get("asset_id", "") or "").strip()
    )
    unlinked_asset_block_count = max(0, asset_block_count - linked_asset_block_count)
    assets = data.get("assets", {}) or {}
    referenced_asset_ids: set[str] = set()
    for block in blocks:
        content = block.get("content", {}) or {}
        primary_asset_id = str(content.get("asset_id", "") or "").strip()
        raw_asset_ids = content.get("asset_ids", [])
        if primary_asset_id:
            referenced_asset_ids.add(primary_asset_id)
        if isinstance(raw_asset_ids, list):
            referenced_asset_ids.update(
                str(asset_id).strip()
                for asset_id in raw_asset_ids
                if str(asset_id).strip()
            )
    unreferenced_asset_ids = sorted(set(assets) - referenced_asset_ids)

    provider_markdown_image_uris: set[str] = set()
    for page in data.get("pages", []) or []:
        markdown = ((page.get("metadata", {}) or {}).get("markdown", {}) or {})
        images = markdown.get("images", {})
        if isinstance(images, dict):
            provider_markdown_image_uris.update(
                str(uri).strip()
                for uri in images.values()
                if str(uri).strip()
            )
    normalized_asset_uris = {
        str(asset.get("uri", "") or "").strip()
        for asset in assets.values()
        if isinstance(asset, dict) and str(asset.get("uri", "") or "").strip()
    }
    uncovered_provider_image_uris = sorted(provider_markdown_image_uris - normalized_asset_uris)
    zero_segment_bbox_count = sum(
        1
        for block in blocks
        for segment in block.get("segments", []) or []
        if segment.get("bbox") in (None, [], [0, 0, 0, 0])
    )
    approximate_segment_bbox_count = sum(
        1
        for block in blocks
        for segment in block.get("segments", []) or []
        if str(segment.get("bbox_precision", "") or "") in {"block", "line"}
    )
    provider_segment_bbox_count = sum(
        1
        for block in blocks
        for segment in block.get("segments", []) or []
        if str(segment.get("bbox_precision", "") or "") == "provider_layout"
    )
    formula_segments = [
        segment
        for block in blocks
        for segment in block.get("segments", []) or []
        if str(segment.get("type", "") or "") in {"formula", "inline_formula"}
    ]
    provider_formula_segment_bbox_count = sum(
        1
        for segment in formula_segments
        if str(segment.get("bbox_precision", "") or "") == "provider_layout"
    )
    approximate_formula_segment_bbox_count = sum(
        1
        for segment in formula_segments
        if str(segment.get("bbox_precision", "") or "") in {"block", "line"}
    )
    line_bbox_precision_counts: dict[str, int] = {}
    for block in blocks:
        for line in block.get("lines", []) or []:
            precision = str(line.get("bbox_precision", "unspecified") or "unspecified")
            line_bbox_precision_counts[precision] = line_bbox_precision_counts.get(precision, 0) + 1
    warnings = []
    if unlinked_asset_block_count:
        warnings.append(f"{unlinked_asset_block_count} image/chart blocks have no asset_id")
    if unreferenced_asset_ids:
        warnings.append(f"{len(unreferenced_asset_ids)} top-level assets are not referenced by any block")
    if uncovered_provider_image_uris:
        warnings.append(
            f"{len(uncovered_provider_image_uris)} provider Markdown images are absent from top-level assets"
        )
    if zero_segment_bbox_count:
        warnings.append(f"{zero_segment_bbox_count} segments have no usable bbox")
    return {
        "valid": True,
        "complete": not warnings,
        "warnings": warnings,
        "schema": data.get("schema", ""),
        "schema_version": data.get("schema_version", ""),
        "page_count": page_count,
        "block_count": block_count,
        "asset_count": len(assets),
        "referenced_asset_count": len(referenced_asset_ids),
        "unreferenced_asset_count": len(unreferenced_asset_ids),
        "provider_markdown_image_count": len(provider_markdown_image_uris),
        "covered_provider_markdown_image_count": len(
            provider_markdown_image_uris & normalized_asset_uris
        ),
        "uncovered_provider_markdown_image_count": len(uncovered_provider_image_uris),
        "asset_block_count": asset_block_count,
        "linked_asset_block_count": linked_asset_block_count,
        "unlinked_asset_block_count": unlinked_asset_block_count,
        "zero_segment_bbox_count": zero_segment_bbox_count,
        "approximate_segment_bbox_count": approximate_segment_bbox_count,
        "provider_segment_bbox_count": provider_segment_bbox_count,
        "formula_segment_count": len(formula_segments),
        "provider_formula_segment_bbox_count": provider_formula_segment_bbox_count,
        "approximate_formula_segment_bbox_count": approximate_formula_segment_bbox_count,
        "line_bbox_precision_counts": line_bbox_precision_counts,
        "geometry_bbox_consistent": True,
        "segment_bbox_within_block": True,
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
    resource = resources.files(__package__).joinpath(
        DOCUMENT_SCHEMA_FILE_NAME.replace(".json", ".schema.json")
    )
    return Path(str(resource))


__all__ = [
    "DocumentSchemaValidationError",
    "build_validation_report",
    "build_validation_report_from_path",
    "default_schema_json_path",
    "validate_document_path",
    "validate_document_payload",
    "validate_saved_document_path",
]

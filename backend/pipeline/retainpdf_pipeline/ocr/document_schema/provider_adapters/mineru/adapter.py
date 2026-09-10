from __future__ import annotations

import json
import re
from collections import Counter
from collections.abc import Iterable
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.assets import (
    build_mineru_asset_metadata,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.label_catalog import (
    MINERU_MIDDLE_TAXONOMY_PROFILE,
    MINERU_TEXT_AGGREGATE_CONTAINERS,
    get_mineru_label_definition,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.projection import (
    MinerUBlockProjection,
    project_mineru_block,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.relations import (
    attach_mineru_group_relations,
)
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU
from retainpdf_pipeline.ocr.document_schema.version import (
    DOCUMENT_SCHEMA_NAME,
    DOCUMENT_SCHEMA_VERSION,
)

_MATH_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _iter_layout_pages(layout_payload: dict) -> list[dict]:
    pages = layout_payload.get("pdf_info", []) or []
    return pages if isinstance(pages, list) else []


def _iter_child_blocks(block: dict) -> list[dict]:
    children = block.get("blocks", []) or []
    return (
        [child for child in children if isinstance(child, dict)]
        if isinstance(children, list)
        else []
    )


def _repair_math_control_chars(text: str, next_text: str = "") -> str:
    """Keep the existing narrow repair for legacy MinerU math control bytes."""

    if not text or not _MATH_CONTROL_CHAR_RE.search(text):
        return text
    chars = list(text)
    for match in list(_MATH_CONTROL_CHAR_RE.finditer(text)):
        start, end = match.span()
        before = text[max(0, start - 48) : start].lower()
        after = (text[end : min(len(text), end + 48)] + " " + next_text[:48]).lower()
        if re.search(
            r"(fixing|rotation angle|torsion angle|dihedral angle|angle|angles|function of)\s*$",
            before,
        ) or re.search(
            r"^\s*(as a dihedral angle|of the methyl group|varying|represents|=|and|or|\))",
            after,
        ):
            chars[start] = r"\theta"
        else:
            chars[start] = " "
    return "".join(chars)


def _normalize_text(
    raw_text: str, next_text: str = "", *, preserve_lines: bool = False
) -> str:
    repaired = _repair_math_control_chars(raw_text, next_text=next_text)
    if preserve_lines:
        return repaired.strip()
    return " ".join(repaired.split())


def _iter_direct_lines(block: dict) -> Iterable[dict]:
    lines = block.get("lines", []) or []
    if isinstance(lines, list):
        yield from (line for line in lines if isinstance(line, dict))


def _iter_descendant_lines(block: dict) -> Iterable[dict]:
    yield from _iter_direct_lines(block)
    for child in _iter_child_blocks(block):
        yield from _iter_descendant_lines(child)


def _iter_spans(raw_spans: object) -> Iterable[dict]:
    if not isinstance(raw_spans, list):
        return
    for span in raw_spans:
        if not isinstance(span, dict):
            continue
        children = span.get("children")
        if str(
            span.get("type", "") or ""
        ).strip().lower() == "hyperlink" and isinstance(children, list):
            yield from _iter_spans(children)
            continue
        yield span


def _normalized_line_and_segments(
    line: dict,
    *,
    preserve_lines: bool,
) -> tuple[dict | None, list[dict]]:
    spans = list(_iter_spans(line.get("spans", [])))
    spans_out: list[dict] = []
    for index, span in enumerate(spans):
        content = span.get("content", "")
        if content is None or not str(content).strip():
            continue
        next_content = (
            spans[index + 1].get("content", "") if index + 1 < len(spans) else ""
        )
        span_type = str(span.get("type", "text") or "text").strip().lower()
        normalized_span = {
            "type": (
                "inline_formula"
                if span_type == "inline_equation"
                else (
                    "formula"
                    if span_type in {"interline_equation", "equation"}
                    else "text"
                )
            ),
            "raw_type": span_type,
            "text": _normalize_text(
                str(content),
                str(next_content or ""),
                preserve_lines=preserve_lines,
            ),
            "bbox": span.get("bbox", []),
            "score": span.get("score"),
        }
        if _valid_bbox(span.get("bbox")) is not None:
            normalized_span["bbox_precision"] = "provider_layout"
        spans_out.append(normalized_span)
    if not spans_out:
        return None, []
    normalized_line = {"bbox": line.get("bbox", []), "spans": spans_out}
    if _valid_bbox(line.get("bbox")) is not None:
        normalized_line["bbox_precision"] = "provider_layout"
    return normalized_line, spans_out


def _extract_text_structure(
    block: dict, *, aggregate_children: bool
) -> tuple[list[dict], list[dict], str]:
    raw_type = str(block.get("type", "") or "").strip().lower()
    preserve_lines = raw_type in {"code", "code_body", "algorithm"}
    raw_lines = (
        _iter_descendant_lines(block)
        if aggregate_children
        else _iter_direct_lines(block)
    )
    lines_out: list[dict] = []
    segments: list[dict] = []
    for line in raw_lines:
        normalized_line, line_segments = _normalized_line_and_segments(
            line,
            preserve_lines=preserve_lines,
        )
        if normalized_line is not None:
            lines_out.append(normalized_line)
            segments.extend(line_segments)
    separator = "\n" if preserve_lines else " "
    text = separator.join(
        segment["text"] for segment in segments if segment.get("text")
    ).strip()
    return lines_out, segments, text


def _make_raw_path(page_idx: int, raw_path_parts: list[str | int]) -> str:
    return "/".join([f"/pdf_info/{page_idx}", *(str(part) for part in raw_path_parts)])


def _default_derived() -> dict:
    return {"role": "", "by": "", "confidence": 0.0}


def _derived_for_projection(projection: MinerUBlockProjection) -> dict:
    if projection.layout_role == "caption":
        return {"role": "caption", "by": "provider_rule", "confidence": 0.98}
    if projection.semantic_role == "abstract":
        return {"role": "abstract", "by": "provider_rule", "confidence": 0.98}
    if projection.semantic_role == "reference":
        return {"role": "reference_entry", "by": "provider_rule", "confidence": 0.98}
    return _default_derived()


def _provider_payload_metadata(block: dict) -> dict:
    image_paths: list[str] = []
    table_html_values: list[str] = []
    for line in _iter_descendant_lines(block):
        for span in _iter_spans(line.get("spans", [])):
            image_path = str(span.get("image_path", "") or "").strip()
            if image_path and image_path not in image_paths:
                image_paths.append(image_path)
            table_html = str(span.get("html", "") or "").strip()
            if table_html and table_html not in table_html_values:
                table_html_values.append(table_html)
    metadata: dict[str, object] = {}
    if image_paths:
        metadata["provider_image_paths"] = image_paths
        metadata.update(build_mineru_asset_metadata(image_paths))
    if table_html_values:
        metadata["provider_table_html_available"] = True
        metadata["provider_table_html_count"] = len(table_html_values)
        metadata["content_format"] = "html_table"
    return metadata


def _first_provider_table_html(block: dict) -> str:
    for line in _iter_descendant_lines(block):
        for span in _iter_spans(line.get("spans", [])):
            table_html = str(span.get("html", "") or "").strip()
            if table_html:
                return table_html
    return ""


def _valid_bbox(value: object) -> list[float] | None:
    if not isinstance(value, (list, tuple)) or len(value) != 4:
        return None
    try:
        bbox = [float(item) for item in value]
    except (TypeError, ValueError):
        return None
    if bbox[2] < bbox[0] or bbox[3] < bbox[1]:
        return None
    return bbox


def _effective_block_bbox(
    block: dict, *, aggregate_children: bool
) -> list[float] | list:
    raw_bbox = _valid_bbox(block.get("bbox"))
    if not aggregate_children:
        return raw_bbox or block.get("bbox", [])
    candidates = [raw_bbox] if raw_bbox is not None else []
    for line in _iter_descendant_lines(block):
        line_bbox = _valid_bbox(line.get("bbox"))
        if line_bbox is not None:
            candidates.append(line_bbox)
    if not candidates:
        return block.get("bbox", [])
    return [
        min(bbox[0] for bbox in candidates),
        min(bbox[1] for bbox in candidates),
        max(bbox[2] for bbox in candidates),
        max(bbox[3] for bbox in candidates),
    ]


def _build_block_record(
    *,
    block: dict,
    page_idx: int,
    page_block_index: int,
    raw_path_parts: list[str | int],
    aggregate_children: bool,
    parent_group: dict | None,
) -> dict:
    raw_type = str(block.get("type", "") or "").strip().lower()
    raw_sub_type = str(block.get("sub_type", "") or "").strip().lower()
    lines, segments, text = _extract_text_structure(
        block, aggregate_children=aggregate_children
    )
    projection = project_mineru_block(
        raw_type, raw_sub_type=raw_sub_type, has_text=bool(text)
    )
    block_id = f"p{page_idx + 1:03d}-b{page_block_index:04d}"
    normalized_bbox = _effective_block_bbox(
        block, aggregate_children=aggregate_children
    )
    metadata: dict[str, object] = {
        "raw_index": block.get("index"),
        "raw_angle": block.get("angle"),
        "raw_sub_type": raw_sub_type,
        "parent_block_id": "",
        **_provider_payload_metadata(block),
    }
    if parent_group:
        metadata.update(parent_group)
    record = {
        "block_id": block_id,
        "page_index": page_idx,
        "order": page_block_index,
        "type": projection.content_kind,
        "sub_type": projection.sub_type,
        "bbox": normalized_bbox,
        "text": text,
        "lines": lines,
        "segments": segments,
        "tags": list(projection.tags),
        "derived": _derived_for_projection(projection),
        "layout_role": projection.layout_role,
        "semantic_role": projection.semantic_role,
        "structure_role": projection.structure_role,
        "policy": {
            "translate": projection.translate,
            "translate_reason": projection.translate_reason,
        },
        "metadata": metadata,
        "source": {
            "provider": PROVIDER_MINERU,
            "raw_page_index": page_idx,
            "raw_path": _make_raw_path(page_idx, raw_path_parts),
            "raw_type": raw_type,
            "raw_sub_type": raw_sub_type,
            "raw_bbox": block.get("bbox", []),
            "raw_text_excerpt": text[:200],
            "raw_unit": "pt",
            "raw_origin": "top_left",
        },
    }
    table_html = _first_provider_table_html(block)
    if projection.content_kind == "table" and table_html:
        record["content"] = {
            "kind": "table",
            "table_html": table_html,
        }
    return record


def _ordered_page_roots(page: dict) -> list[tuple[dict, list[str | int]]]:
    roots: list[tuple[dict, list[str | int], int, int]] = []
    ordinal = 0
    for field in ("para_blocks", "discarded_blocks"):
        raw_blocks = page.get(field, []) or []
        if not isinstance(raw_blocks, list):
            continue
        for index, block in enumerate(raw_blocks):
            if not isinstance(block, dict):
                continue
            raw_index = block.get("index")
            sort_index = (
                raw_index if isinstance(raw_index, int) else 1_000_000 + ordinal
            )
            roots.append((block, [field, index], sort_index, ordinal))
            ordinal += 1
    roots.sort(key=lambda item: (item[2], item[3]))
    return [(block, path) for block, path, _index, _ordinal in roots]


def _build_page_record(page: dict, *, page_idx: int) -> tuple[dict, int]:
    page_size = page.get("page_size", []) or []
    width = page_size[0] if len(page_size) >= 1 else 0
    height = page_size[1] if len(page_size) >= 2 else 0
    blocks_out: list[dict] = []
    skipped_container_count = 0

    def visit_block(
        block: dict,
        raw_path_parts: list[str | int],
        parent_group: dict | None = None,
    ) -> None:
        nonlocal skipped_container_count
        raw_type = str(block.get("type", "") or "").strip().lower()
        children = _iter_child_blocks(block)
        aggregate_children = raw_type in MINERU_TEXT_AGGREGATE_CONTAINERS and bool(
            children
        )
        if children and not aggregate_children:
            skipped_container_count += 1
            group_raw_path = _make_raw_path(page_idx, raw_path_parts)
            group = {
                "provider_group_type": raw_type,
                "provider_group_bbox": block.get("bbox", []),
                "provider_group_raw_path": group_raw_path,
            }
            start = len(blocks_out)
            for child_idx, child in enumerate(children):
                visit_block(
                    child, [*raw_path_parts, "blocks", child_idx], parent_group=group
                )
            group_records = blocks_out[start:]
            target = next(
                (
                    record
                    for record in group_records
                    if (record.get("content", {}) or {}).get("kind", record.get("type"))
                    in {"image", "table", "code"}
                ),
                None,
            )
            if target is not None:
                attach_mineru_group_relations(
                    group_type=raw_type,
                    target_block=target,
                    related_blocks=group_records,
                )
            return

        # A container without children is emitted as a conservative fallback;
        # some MinerU backends flatten their middle output.
        blocks_out.append(
            _build_block_record(
                block=block,
                page_idx=page_idx,
                page_block_index=len(blocks_out),
                raw_path_parts=raw_path_parts,
                aggregate_children=aggregate_children,
                parent_group=parent_group,
            )
        )

    for block, raw_path_parts in _ordered_page_roots(page):
        visit_block(block, raw_path_parts)

    markdown_images: dict[str, str] = {}
    for record in blocks_out:
        metadata = record.get("metadata", {}) or {}
        raw_paths = metadata.get("asset_paths", [])
        if not isinstance(raw_paths, list):
            continue
        for value in raw_paths:
            relative = str(value or "").strip()
            if relative:
                markdown_images[relative] = (
                    f"md/images/page-{page_idx + 1}/{relative.lstrip('/')}"
                )

    return (
        {
            "page_index": page_idx,
            "width": width,
            "height": height,
            "unit": "pt",
            "blocks": blocks_out,
            **(
                {"metadata": {"markdown": {"images": markdown_images}}}
                if markdown_images
                else {}
            ),
        },
        skipped_container_count,
    )


def _collect_raw_label_counts(layout_payload: dict) -> Counter[str]:
    counts: Counter[str] = Counter()

    def visit(block: dict) -> None:
        label = str(block.get("type", "") or "").strip().lower() or "<missing>"
        counts[label] += 1
        for child in _iter_child_blocks(block):
            visit(child)

    for page in _iter_layout_pages(layout_payload):
        for block, _raw_path in _ordered_page_roots(page):
            visit(block)
    return counts


def build_mineru_document(
    payload: dict,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    page_results = [
        _build_page_record(page, page_idx=page_idx)
        for page_idx, page in enumerate(_iter_layout_pages(payload))
    ]
    pages = [page for page, _skipped in page_results]
    raw_label_counts = _collect_raw_label_counts(payload)
    unknown_labels = sorted(
        label
        for label in raw_label_counts
        if label != "<missing>" and get_mineru_label_definition(label) is None
    )
    resolved_version = str(provider_version or payload.get("_version_name", "") or "")
    return {
        "schema": DOCUMENT_SCHEMA_NAME,
        "schema_version": DOCUMENT_SCHEMA_VERSION,
        "document_id": document_id,
        "source": {
            "provider": PROVIDER_MINERU,
            "provider_version": resolved_version,
            "raw_files": {"layout_json": str(source_json_path)},
        },
        "page_count": len(pages),
        "pages": pages,
        "derived": {
            "notes": "MinerU middle.json adapted through RetainPDF canonical roles.",
            "provider_signals": {
                "taxonomy_profile": MINERU_MIDDLE_TAXONOMY_PROFILE,
                "backend": str(payload.get("_backend", "") or ""),
                "mineru_version": str(payload.get("_version_name", "") or ""),
                "raw_block_type_counts": dict(sorted(raw_label_counts.items())),
                "unknown_block_types": unknown_labels,
                "structural_containers_not_emitted": sum(
                    skipped for _page, skipped in page_results
                ),
            },
        },
    }


def build_normalized_document_from_layout_payload(
    *,
    layout_payload: dict,
    document_id: str,
    layout_json_path: Path,
    provider_version: str = "",
) -> dict:
    return build_mineru_document(
        payload=layout_payload,
        document_id=document_id,
        source_json_path=layout_json_path,
        provider_version=provider_version,
    )


def build_normalized_document_from_layout_path(
    *,
    layout_json_path: Path,
    document_id: str,
    provider_version: str = "",
) -> dict:
    payload = json.loads(layout_json_path.read_text(encoding="utf-8"))
    return build_normalized_document_from_layout_payload(
        layout_payload=payload,
        document_id=document_id,
        layout_json_path=layout_json_path,
        provider_version=provider_version,
    )


__all__ = [
    "build_mineru_document",
    "build_normalized_document_from_layout_path",
    "build_normalized_document_from_layout_payload",
]

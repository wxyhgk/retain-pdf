from __future__ import annotations

"""MinerU raw layout -> normalized_document_v1 adapter.

This module owns only the structural adaptation step:

- input: raw MinerU `layout.json` payload
- output: normalized in-memory document dict

It may attach lightweight derived tags / markers that are stable enough to be
part of the normalized document itself, but it should not take on downstream
translation or rendering policy decisions.
"""

import json
import re
from pathlib import Path

from services.document_schema.providers import PROVIDER_MINERU
from services.document_schema.version import DOCUMENT_SCHEMA_NAME
from services.document_schema.version import DOCUMENT_SCHEMA_VERSION

_MATH_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def _iter_layout_pages(layout_payload: dict) -> list[dict]:
    return layout_payload.get("pdf_info", []) or []


def _iter_page_blocks(page: dict) -> list[dict]:
    return page.get("para_blocks", []) or []


def _iter_child_blocks(block: dict) -> list[dict]:
    return block.get("blocks", []) or []


def _repair_math_control_chars(text: str, next_text: str = "") -> str:
    if not text or not _MATH_CONTROL_CHAR_RE.search(text):
        return text

    chars = list(text)
    for match in list(_MATH_CONTROL_CHAR_RE.finditer(text)):
        start, end = match.span()
        before = text[max(0, start - 48) : start].lower()
        after = (text[end : min(len(text), end + 48)] + " " + next_text[:48]).lower()
        if (
            re.search(r"(fixing|rotation angle|torsion angle|dihedral angle|angle|angles|function of)\s*$", before)
            or re.search(r"^\s*(as a dihedral angle|of the methyl group|varying|represents|=|and|or|\))", after)
        ):
            chars[start] = r"\theta"
        else:
            chars[start] = " "
    return "".join(chars)


def _normalize_text(raw_text: str, next_text: str = "") -> str:
    return " ".join(_repair_math_control_chars(raw_text, next_text=next_text).split())


def _iter_block_lines(block: dict):
    yield from block.get("lines", [])


def _block_segments(block: dict) -> list[dict]:
    segments: list[dict] = []
    for line in _iter_block_lines(block):
        spans = line.get("spans", [])
        for index, span in enumerate(spans):
            content = span.get("content", "")
            if not content or not str(content).strip():
                continue
            next_content = spans[index + 1].get("content", "") if index + 1 < len(spans) else ""
            span_type = str(span.get("type", "text") or "text")
            segments.append(
                {
                    "type": "formula" if span_type == "inline_equation" else "text",
                    "raw_type": span_type,
                    "text": _normalize_text(str(content), str(next_content)),
                    "bbox": span.get("bbox", []),
                    "score": span.get("score"),
                }
            )
    return segments


def _block_lines(block: dict) -> list[dict]:
    lines_out: list[dict] = []
    for line in _iter_block_lines(block):
        spans_out = []
        spans = line.get("spans", [])
        for index, span in enumerate(spans):
            content = span.get("content", "")
            if not content or not str(content).strip():
                continue
            next_content = spans[index + 1].get("content", "") if index + 1 < len(spans) else ""
            span_type = str(span.get("type", "text") or "text")
            spans_out.append(
                {
                    "type": "formula" if span_type == "inline_equation" else "text",
                    "raw_type": span_type,
                    "text": _normalize_text(str(content), str(next_content)),
                    "bbox": span.get("bbox", []),
                    "score": span.get("score"),
                }
            )
        if spans_out:
            lines_out.append(
                {
                    "bbox": line.get("bbox", []),
                    "spans": spans_out,
                }
            )
    return lines_out


def _merge_segments_text(segments: list[dict]) -> str:
    return " ".join(segment["text"] for segment in segments if segment.get("text")).strip()


def _map_block_kind(raw_type: str, raw_sub_type: str, has_text: bool) -> tuple[str, str]:
    normalized_sub = raw_sub_type.strip().lower()
    if raw_type == "title":
        return "text", "title"
    if raw_type == "interline_equation":
        return "formula", "display_formula"
    if raw_type in {"image", "image_body"}:
        return "image", "figure"
    if raw_type in {"table", "table_body"}:
        return "table", "table_body"
    if raw_type in {"code", "code_body"} or normalized_sub == "algorithm":
        return "code", "code_block"
    if raw_type == "page_header":
        return "text", "header"
    if raw_type == "page_footer":
        return "text", "footer"
    if raw_type == "page_number":
        return "text", "page_number"
    if raw_type in {"image_footnote", "table_footnote"}:
        return "text", "footnote"
    if raw_type in {"text", "list"}:
        return "text", "body"
    if has_text:
        return "text", "metadata"
    return "unknown", ""


def _make_raw_path(page_idx: int, raw_path_parts: list[str | int]) -> str:
    path = [f"/pdf_info/{page_idx}"]
    for part in raw_path_parts:
        path.append(str(part))
    return "/".join(path)


def _default_derived() -> dict:
    return {
        "role": "",
        "by": "",
        "confidence": 0.0,
    }


def _caption_derived(raw_type: str) -> tuple[list[str], dict]:
    if raw_type not in {"image_caption", "table_caption", "table_footnote", "image_footnote"}:
        return [], _default_derived()
    return (
        ["caption", raw_type],
        {
            "role": "caption",
            "by": "provider_rule",
            "confidence": 0.98,
        },
    )


def _build_document_source(*, layout_json_path: Path, provider_version: str) -> dict:
    return {
        "provider": PROVIDER_MINERU,
        "provider_version": provider_version,
        "raw_files": {
            "layout_json": str(layout_json_path),
        },
    }


def _build_block_record(
    *,
    block: dict,
    page_idx: int,
    page_block_index: int,
    raw_path_parts: list[str | int],
    parent_block_id: str | None,
) -> dict:
    raw_type = str(block.get("type", "") or "")
    raw_sub_type = str(block.get("sub_type", "") or "")
    segments = _block_segments(block)
    lines = _block_lines(block)
    text = _merge_segments_text(segments)
    block_type, sub_type = _map_block_kind(raw_type, raw_sub_type, has_text=bool(text))
    block_id = f"p{page_idx + 1:03d}-b{page_block_index:04d}"
    tags, derived = _caption_derived(raw_type)
    return {
        "block_id": block_id,
        "page_index": page_idx,
        "order": page_block_index,
        "type": block_type,
        "sub_type": sub_type,
        "bbox": block.get("bbox", []),
        "text": text,
        "lines": lines,
        "segments": segments,
        "tags": tags,
        "derived": derived,
        "metadata": {
            "raw_index": block.get("index"),
            "raw_angle": block.get("angle"),
            "raw_sub_type": raw_sub_type,
            "parent_block_id": parent_block_id or "",
        },
        "source": {
            "provider": PROVIDER_MINERU,
            "raw_page_index": page_idx,
            "raw_path": _make_raw_path(page_idx, raw_path_parts),
            "raw_type": raw_type,
            "raw_sub_type": raw_sub_type,
            "raw_bbox": block.get("bbox", []),
            "raw_text_excerpt": text[:200],
        },
    }

def _build_page_record(page: dict, *, page_idx: int) -> dict:
    page_size = page.get("page_size", []) or []
    width = page_size[0] if len(page_size) >= 1 else 0
    height = page_size[1] if len(page_size) >= 2 else 0
    blocks_out: list[dict] = []
    page_block_index = 0

    def visit_block(block: dict, raw_path_parts: list[str | int], parent_block_id: str | None = None) -> None:
        nonlocal page_block_index
        record = _build_block_record(
            block=block,
            page_idx=page_idx,
            page_block_index=page_block_index,
            raw_path_parts=raw_path_parts,
            parent_block_id=parent_block_id,
        )
        blocks_out.append(record)
        current_block_id = record["block_id"]
        page_block_index += 1
        for child_idx, child in enumerate(_iter_child_blocks(block)):
            visit_block(child, [*raw_path_parts, "blocks", child_idx], parent_block_id=current_block_id)

    for block_idx, block in enumerate(_iter_page_blocks(page)):
        visit_block(block, ["para_blocks", block_idx])

    return {
        "page_index": page_idx,
        "width": width,
        "height": height,
        "unit": "pt",
        "blocks": blocks_out,
    }


def build_normalized_document(
    *,
    layout_payload: dict,
    document_id: str,
    layout_json_path: Path,
    provider_version: str = "",
) -> dict:
    pages_out = [
        _build_page_record(page, page_idx=page_idx)
        for page_idx, page in enumerate(_iter_layout_pages(layout_payload))
    ]

    document = {
        "schema": DOCUMENT_SCHEMA_NAME,
        "schema_version": DOCUMENT_SCHEMA_VERSION,
        "document_id": document_id,
        "source": _build_document_source(
            layout_json_path=layout_json_path,
            provider_version=provider_version,
        ),
        "page_count": len(pages_out),
        "pages": pages_out,
        "derived": {
            "notes": "This layer stores post-OCR semantic conclusions from provider rules, local rules, or later LLM judgment.",
        },
    }
    return document


def build_normalized_document_from_layout_payload(
    *,
    layout_payload: dict,
    document_id: str,
    layout_json_path: Path,
    provider_version: str = "",
) -> dict:
    return build_normalized_document(
        layout_payload=layout_payload,
        document_id=document_id,
        layout_json_path=layout_json_path,
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
    "build_normalized_document",
    "build_normalized_document_from_layout_payload",
    "build_normalized_document_from_layout_path",
]

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.render.semantics.item_view import block_kind as schema_block_kind
from retainpdf_pipeline.render.policy.cleanup_policy import item_will_render_translated_overlay
from retainpdf_pipeline.render.source.prewarm_algorithm_hash import source_cleanup_implementation_hash
from retainpdf_pipeline.render.source.prewarm_contracts import BBOX_TEXT_STRIP_ALGORITHM_ID
from retainpdf_pipeline.render.source.prewarm_contracts import GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_contracts import HIDDEN_TEXT_STRIP_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_contracts import IMAGE_COMPRESSION_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_contracts import PAYLOAD_RENDER_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_manifest import float_or_zero
from retainpdf_pipeline.render.source.prewarm_manifest import int_or_default
from retainpdf_pipeline.render.source_cleanup.protected_blocks import protected_pages_from_document_path


def build_payload_structure_hash(translated_pages: dict[int, list[dict]]) -> str:
    digest = hashlib.sha256()
    for page_idx in sorted(translated_pages):
        compact_items = [
            _payload_structure_item(page_idx, item)
            for item in translated_pages[page_idx]
            if _is_render_payload_candidate(item)
        ]
        if not compact_items:
            continue
        digest.update(f"page:{page_idx}\n".encode("utf-8"))
        for compact in compact_items:
            digest.update(json.dumps(compact, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
            digest.update(b"\n")
    return digest.hexdigest()


def build_visual_payload_hash(translated_pages: dict[int, list[dict]]) -> str:
    digest = hashlib.sha256()
    for page_idx in sorted(translated_pages):
        compact_items = [
            _payload_visual_item(page_idx, item)
            for item in translated_pages[page_idx]
            if _is_render_payload_candidate(item)
        ]
        if not compact_items:
            continue
        digest.update(f"page:{page_idx}\n".encode("utf-8"))
        for compact in compact_items:
            digest.update(json.dumps(compact, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
            digest.update(b"\n")
    return digest.hexdigest()


def build_render_prewarm_fingerprint(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> dict[str, Any]:
    source_pdf_path = Path(source_pdf_path).resolve()
    stat = source_pdf_path.stat()
    cleanup_strategy = layout.normalize_source_cleanup_strategy(source_cleanup_strategy)
    selected_pages = _bbox_text_strip_page_indexes(translated_pages) if layout.use_bbox_text_strip_cleanup(cleanup_strategy) else []
    return {
        "source_pdf_path": str(source_pdf_path),
        "source_pdf_size": int(stat.st_size),
        "source_pdf_mtime_ns": int(stat.st_mtime_ns),
        "selected_page_indexes": selected_pages,
        "page_range": {"start_page": int(start_page), "end_page": int(end_page)},
        "effective_render_mode": str(effective_render_mode),
        "strip_hidden_text": bool(effective_render_mode != "overlay"),
        "pdf_compress_dpi": int(pdf_compress_dpi),
        "source_cleanup_strategy": cleanup_strategy,
        "payload_structure_hash": build_payload_structure_hash(translated_pages),
        "visual_payload_hash": build_visual_payload_hash(translated_pages),
        "render_payload_hash": build_payload_structure_hash(translated_pages),
        "bbox_text_strip_algorithm": BBOX_TEXT_STRIP_ALGORITHM_ID,
        "bbox_text_strip_implementation_hash": source_cleanup_implementation_hash(),
        "bbox_text_strip_protected_source_hash": build_protected_source_hash(
            source_pdf_path.parent.parent / "ocr" / "normalized" / "document.v1.json"
        ),
        "hidden_text_strip_algorithm": HIDDEN_TEXT_STRIP_ALGORITHM_VERSION,
        "image_compression_algorithm": IMAGE_COMPRESSION_ALGORITHM_VERSION,
        "geometry_adjustment_algorithm": GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION,
        "payload_render_algorithm": PAYLOAD_RENDER_ALGORITHM_VERSION,
    }


def build_protected_source_hash(document_path: Path) -> str:
    protected_pages = protected_pages_from_document_path(document_path)
    digest = hashlib.sha256()
    for page_idx in sorted(protected_pages):
        digest.update(f"page:{page_idx}\n".encode("utf-8"))
        for item in protected_pages[page_idx]:
            compact = {
                "item_id": str(item.get("item_id") or ""),
                "bbox": [float_or_zero(value) for value in list(item.get("bbox", []) or [])[:4]],
                "source_text": str(item.get("source_text") or ""),
            }
            digest.update(json.dumps(compact, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
            digest.update(b"\n")
    return digest.hexdigest()


def _payload_structure_item(page_idx: int, item: dict) -> dict[str, Any]:
    item_kind = schema_block_kind(item)
    return {
        "item_id": str(item.get("item_id", "") or ""),
        "page_idx": int_or_default(item.get("page_idx"), page_idx),
        "block_type": str(item.get("block_type", "") or ""),
        "block_kind": item_kind,
        "bbox": [float_or_zero(value) for value in list(item.get("bbox", []) or [])[:4]],
        "layout_role": str(item.get("layout_role", "") or ""),
        "semantic_role": str(item.get("semantic_role", "") or ""),
        "structure_role": str(item.get("structure_role", "") or ""),
        "raw_block_type": str(item.get("raw_block_type", "") or ""),
        "normalized_sub_type": str(item.get("normalized_sub_type", "") or ""),
        "translation_unit_id": str(item.get("translation_unit_id", "") or ""),
        "translation_unit_member_ids": [str(value) for value in list(item.get("translation_unit_member_ids") or [])],
        "continuation_group": str(item.get("continuation_group") or item.get("continuation_group_id") or ""),
        "should_translate": bool(item.get("should_translate", item.get("policy_translate", True))),
        "skip_reason": str(item.get("skip_reason", "") or item.get("classification_label", "") or ""),
        "source_text": _render_source_text(item),
        "render_text": _render_output_text(item),
        "render_protected_text": str(item.get("render_protected_text", "") or ""),
        "protected_map": _jsonable(item.get("protected_map") or item.get("translation_unit_protected_map") or []),
        "formula_map": _jsonable(item.get("formula_map") or item.get("translation_unit_formula_map") or []),
        "lines": _line_signature(item.get("lines")),
        "source_line_texts": [str(value) for value in list(item.get("source_line_texts") or [])],
        "toc_entries": _jsonable(item.get("toc_entries") or []),
        "render_policy": _jsonable(item.get("_render_policy") or {}),
        "render_flags": {
            "preserve_line_breaks": bool(item.get("_render_preserve_line_breaks")),
            "force_plain_line": bool(item.get("_force_plain_line")),
            "force_visual_cover_only": bool(item.get("_force_visual_cover_only")),
            "render_use_cover_fill": bool(item.get("_render_use_cover_fill")),
        },
        "strip_candidate": _has_text_overlay(item),
    }


def _payload_visual_item(page_idx: int, item: dict) -> dict[str, Any]:
    return {
        "item_id": str(item.get("item_id", "") or ""),
        "page_idx": int_or_default(item.get("page_idx"), page_idx),
        "block_type": str(item.get("block_type", "") or ""),
        "block_kind": schema_block_kind(item),
        "bbox": [float_or_zero(value) for value in list(item.get("bbox", []) or [])[:4]],
        "layout_role": str(item.get("layout_role", "") or ""),
        "semantic_role": str(item.get("semantic_role", "") or ""),
        "structure_role": str(item.get("structure_role", "") or ""),
        "raw_block_type": str(item.get("raw_block_type", "") or ""),
        "normalized_sub_type": str(item.get("normalized_sub_type", "") or ""),
        "lines": _line_signature(item.get("lines")),
        "source_line_texts": [str(value) for value in list(item.get("source_line_texts") or [])],
    }


def _bbox_text_strip_page_indexes(translated_pages: dict[int, list[dict]]) -> list[int]:
    return [
        int(page_idx)
        for page_idx in sorted(translated_pages)
        if any(_is_bbox_text_strip_candidate(item) for item in translated_pages[page_idx])
    ]


def _is_bbox_text_strip_candidate(item: dict) -> bool:
    if not _is_render_payload_candidate(item):
        return False
    return _has_text_overlay(item)


def _is_render_payload_candidate(item: dict) -> bool:
    if schema_block_kind(item) != "text":
        return False
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return False
    if all(float_or_zero(value) == 0.0 for value in bbox):
        return False
    return True


def _has_text_overlay(item: dict) -> bool:
    return item_will_render_translated_overlay(item)


def _render_source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    ).strip()


def _render_output_text(item: dict) -> str:
    return str(
        item.get("render_protected_text")
        or item.get("protected_translated_text")
        or item.get("translated_text")
        or item.get("translation_unit_protected_text")
        or item.get("translation_unit_translated_text")
        or ""
    ).strip()


def _line_signature(value: object) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for line in value if isinstance(value, list) else []:
        if not isinstance(line, dict):
            continue
        result.append(
            {
                "bbox": [float_or_zero(raw) for raw in list(line.get("bbox", []) or [])[:4]],
                "text": str(line.get("text") or line.get("content") or ""),
            }
        )
    return result


def _jsonable(value: object) -> object:
    try:
        json.dumps(value, sort_keys=True, ensure_ascii=False)
        return value
    except TypeError:
        return str(value)


__all__ = [
    "build_payload_structure_hash",
    "build_render_prewarm_fingerprint",
    "build_visual_payload_hash",
]

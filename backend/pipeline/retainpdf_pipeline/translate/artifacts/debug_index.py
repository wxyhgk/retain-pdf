from __future__ import annotations

from pathlib import Path

from retainpdf_pipeline.services.pipeline_shared.io import save_json
from retainpdf_pipeline.translate.artifacts.item_summary import preview_text
from retainpdf_pipeline.translate.artifacts.item_summary import raw_excerpt_from_diagnostics
from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role
from retainpdf_pipeline.translate.core.item_reader import item_structure_role


TRANSLATION_DEBUG_INDEX_SCHEMA = "translation_debug_index_v1"
TRANSLATION_DEBUG_INDEX_SCHEMA_VERSION = 1


def build_translation_debug_index(translated_pages_map: dict[int, list[dict]]) -> dict[str, object]:
    items: list[dict[str, object]] = []
    for page_idx, page_items in sorted(translated_pages_map.items()):
        for item in page_items:
            diagnostics = dict(item.get("translation_diagnostics") or {})
            error_trace = [
                dict(entry)
                for entry in (diagnostics.get("error_trace") or [])
                if isinstance(entry, dict)
            ]
            error_types = [
                str(entry.get("type", "") or "").strip()
                for entry in error_trace
                if str(entry.get("type", "") or "").strip()
            ]
            route_path = [
                str(part or "").strip()
                for part in (diagnostics.get("route_path") or [])
                if str(part or "").strip()
            ]
            term_scope = diagnostics.get("term_scope") if isinstance(diagnostics.get("term_scope"), dict) else {}
            items.append(
                {
                    "item_id": str(item.get("item_id", "") or ""),
                    "page_idx": int(item.get("page_idx", page_idx) or page_idx),
                    "block_idx": int(item.get("block_idx", -1) or -1),
                    "block_type": str(item.get("block_type", "") or ""),
                    "block_kind": item_block_kind(item),
                    "layout_role": item_layout_role(item),
                    "semantic_role": item_semantic_role(item),
                    "structure_role": item_structure_role(item),
                    "math_mode": str(item.get("math_mode", "") or ""),
                    "continuation_group": str(item.get("continuation_group", "") or ""),
                    "classification_label": str(item.get("classification_label", "") or ""),
                    "should_translate": bool(item.get("should_translate", True)),
                    "skip_reason": str(item.get("skip_reason", "") or ""),
                    "final_status": str(
                        item.get("final_status", "")
                        or diagnostics.get("final_status", "")
                        or ""
                    ),
                    "source_preview": preview_text(str(item.get("source_text", "") or "")),
                    "translated_preview": preview_text(str(item.get("translated_text", "") or "")),
                    "route_path": route_path,
                    "fallback_to": str(diagnostics.get("fallback_to", "") or ""),
                    "degradation_reason": str(diagnostics.get("degradation_reason", "") or ""),
                    "provider": str(diagnostics.get("provider", "") or diagnostics.get("provider_family", "") or ""),
                    "prompt_mode": str(diagnostics.get("prompt_mode", "") or item.get("math_mode", "") or ""),
                    "request_label": str(diagnostics.get("request_label", "") or ""),
                    "raw_excerpt": raw_excerpt_from_diagnostics(diagnostics),
                    "error_types": error_types,
                    "term_scope": term_scope,
                }
            )
    return {
        "schema": TRANSLATION_DEBUG_INDEX_SCHEMA,
        "schema_version": TRANSLATION_DEBUG_INDEX_SCHEMA_VERSION,
        "items": items,
    }


def write_translation_debug_index(
    path: Path,
    translated_pages_map: dict[int, list[dict]],
) -> dict[str, object]:
    payload = build_translation_debug_index(translated_pages_map)
    save_json(path, payload)
    return payload


__all__ = [
    "TRANSLATION_DEBUG_INDEX_SCHEMA",
    "TRANSLATION_DEBUG_INDEX_SCHEMA_VERSION",
    "build_translation_debug_index",
    "write_translation_debug_index",
]

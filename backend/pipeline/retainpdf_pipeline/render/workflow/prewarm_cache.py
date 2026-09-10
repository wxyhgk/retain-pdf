from __future__ import annotations

import json
from pathlib import Path

from retainpdf_pipeline.render.source.prewarm_payload import build_payload_prewarm
from retainpdf_pipeline.render.source.prewarm_fingerprint import build_render_prewarm_fingerprint
from retainpdf_pipeline.render.source.prewarm_manifest import write_json_atomic
from retainpdf_pipeline.render.source.prewarm_manifest_io import bbox_candidates_to_manifest
from retainpdf_pipeline.render.source.prewarm_manifest_io import build_prewarm_manifest


def persist_sync_render_source_prewarm(
    *,
    manifest_path: Path | None,
    prepared,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str,
    elapsed: float,
    payload_prewarm: dict[str, object] | None = None,
) -> bool:
    if manifest_path is None:
        return False
    try:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        merged_payload_prewarm = build_sync_payload_prewarm(
            manifest_path=manifest_path,
            prepared=prepared,
            payload_prewarm=payload_prewarm,
        )
        manifest = build_prewarm_manifest(
            manifest_path=manifest_path,
            prepared=prepared,
            fingerprint=build_render_prewarm_fingerprint(
                source_pdf_path=source_pdf_path,
                translated_pages=translated_pages,
                effective_render_mode=effective_render_mode,
                start_page=start_page,
                end_page=end_page,
                pdf_compress_dpi=pdf_compress_dpi,
                source_cleanup_strategy=source_cleanup_strategy,
            ),
            elapsed=elapsed,
            payload_prewarm=merged_payload_prewarm,
            document_analysis=getattr(prepared, "document_analysis", None),
        )
        write_json_atomic(manifest_path, manifest)
        print(f"render prewarm: cached synchronous source manifest={manifest_path}", flush=True)
        return True
    except Exception as exc:
        print(f"render prewarm: sync source cache write failed {type(exc).__name__}: {exc}", flush=True)
        return False


def sync_source_payload_prewarm(prepared) -> dict[str, object]:
    candidates = getattr(prepared, "bbox_text_strip_candidates", None)
    if candidates is None:
        return {}
    return {
        "bbox_text_strip_candidates": bbox_candidates_to_manifest(candidates),
    }


def build_full_sync_payload_prewarm(
    *,
    manifest_path: Path | None,
    prepared,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    source_cleanup_strategy: str,
) -> dict[str, object]:
    if manifest_path is None:
        return sync_source_payload_prewarm(prepared)
    return build_payload_prewarm(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        manifest_path=manifest_path,
        effective_render_mode=effective_render_mode,
        source_cleanup_strategy=source_cleanup_strategy,
        bbox_text_strip_candidates=getattr(prepared, "bbox_text_strip_candidates", None),
    )


def build_sync_payload_prewarm(
    *,
    manifest_path: Path | None,
    prepared,
    payload_prewarm: dict[str, object] | None = None,
) -> dict[str, object]:
    existing = existing_payload_prewarm(manifest_path) if manifest_path is not None else {}
    merged = merge_payload_prewarm(existing, payload_prewarm or {})
    merged.update(sync_source_payload_prewarm(prepared))
    return merged


def merge_payload_prewarm(existing: dict[str, object], fresh: dict[str, object]) -> dict[str, object]:
    # Algorithm-version changes invalidate the payload fields produced by the
    # previous algorithm. Keeping existing values first here can otherwise
    # publish a manifest with a new version label but stale geometry/colors.
    # A partial legacy payload without version markers is still merged below
    # so source-only refreshes retain compatible prewarm material.
    if _has_algorithm_version_mismatch(existing, fresh):
        return dict(fresh)

    merged = dict(existing)
    for key, value in fresh.items():
        if key.endswith("_algorithm"):
            merged[key] = value
            continue
        if not _payload_value_has_material(value):
            if key not in merged:
                merged[key] = value
            continue
        if key not in merged:
            merged[key] = value
            continue
        merged[key] = _merge_existing_first(merged[key], value)
    return merged


def _has_algorithm_version_mismatch(
    existing: dict[str, object],
    fresh: dict[str, object],
) -> bool:
    for key, fresh_value in fresh.items():
        if not key.endswith("_algorithm") or not _payload_value_has_material(fresh_value):
            continue
        existing_value = existing.get(key)
        if _payload_value_has_material(existing_value) and existing_value != fresh_value:
            return True
    return False


def _merge_existing_first(existing: object, fresh: object) -> object:
    if isinstance(existing, dict) and isinstance(fresh, dict):
        merged = dict(existing)
        for key, value in fresh.items():
            if key not in merged:
                merged[key] = value
            else:
                merged[key] = _merge_existing_first(merged[key], value)
        return merged
    return existing if _payload_value_has_material(existing) else fresh


def _payload_value_has_material(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, (dict, list, tuple, set, frozenset, str, bytes)):
        return bool(value)
    return True


def existing_payload_prewarm(manifest_path: Path) -> dict[str, object]:
    try:
        with Path(manifest_path).open("r", encoding="utf-8") as f:
            manifest = json.load(f)
        payload = manifest.get("payload_prewarm")
        return dict(payload) if isinstance(payload, dict) else {}
    except Exception:
        return {}


def has_material_payload_prewarm(payload_prewarm) -> bool:
    if payload_prewarm is None:
        return False
    return bool(
        payload_prewarm.first_line_indent_lookup
        or payload_prewarm.effective_inner_bbox_lookup
        or payload_prewarm.bbox_text_strip_candidates is not None
        or payload_prewarm.background_render_page_specs is not None
        or payload_prewarm.render_colors_by_item_id
        or (payload_prewarm.visual_profile_path is not None and payload_prewarm.visual_profile_path.exists())
        or (
            payload_prewarm.pdf_structure_profile_path is not None
            and payload_prewarm.pdf_structure_profile_path.exists()
        )
    )

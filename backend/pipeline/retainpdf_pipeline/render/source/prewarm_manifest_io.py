from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_CANDIDATE_SOURCE_MANIFEST
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.contracts import RenderDocumentAnalysis
from retainpdf_pipeline.render.source.prewarm_color_profile import render_colors_from_manifest
from retainpdf_pipeline.render.source.prewarm_contracts import BBOX_TEXT_STRIP_ALGORITHM_ID
from retainpdf_pipeline.render.source.prewarm_contracts import RENDER_PREWARM_SCHEMA
from retainpdf_pipeline.render.source.prewarm_contracts import RenderPayloadPrewarm
from retainpdf_pipeline.render.source.prewarm_fingerprint import build_render_prewarm_fingerprint
from retainpdf_pipeline.render.source.prewarm_manifest import bbox_list_from_value
from retainpdf_pipeline.render.source.prewarm_manifest import float_or_none
from retainpdf_pipeline.render.source.prewarm_manifest import int_list
from retainpdf_pipeline.render.source.prewarm_manifest import rect_tuple_from_value
from retainpdf_pipeline.render.source.prewarm_manifest import relative_to_manifest
from retainpdf_pipeline.render.source.prewarm_manifest import resolve_manifest_path
from retainpdf_pipeline.render.source.prewarm_page_specs import render_page_specs_from_manifest
from retainpdf_pipeline.render.source.render_source import RenderSourcePdf


def build_prewarm_manifest(
    *,
    manifest_path: Path,
    prepared: RenderSourcePdf,
    fingerprint: dict[str, Any],
    elapsed: float,
    payload_prewarm: dict[str, Any] | None = None,
    document_analysis: RenderDocumentAnalysis | None = None,
) -> dict[str, Any]:
    return {
        "schema": RENDER_PREWARM_SCHEMA,
        "fingerprint": fingerprint,
        "document_analysis": document_analysis.to_manifest() if document_analysis is not None else {},
        "render_source": {
            "path": relative_to_manifest(manifest_path, prepared.path),
            "image_compressed": prepared.image_compressed,
            "bbox_text_stripped_page_indices": sorted(prepared.bbox_text_stripped_page_indices),
            "bbox_text_strip_skipped_page_indices": sorted(prepared.bbox_text_strip_skipped_page_indices),
            "source_text_precleaned_page_indices": sorted(prepared.source_text_precleaned_page_indices),
            "source_cleanup_cover_fallback_page_indices": sorted(
                getattr(prepared, "source_cleanup_cover_fallback_page_indices", frozenset())
            ),
        },
        "payload_prewarm": payload_prewarm or {},
        "elapsed_seconds": round(float(elapsed), 3),
}


def document_analysis_from_manifest(value: object) -> RenderDocumentAnalysis | None:
    return RenderDocumentAnalysis.from_manifest(value)


def try_load_prewarmed_render_source_pdf(
    *,
    manifest_path: Path | None,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> RenderSourcePdf | None:
    manifest = load_matching_manifest(
        manifest_path=manifest_path,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        effective_render_mode=effective_render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
        match_payload=False,
    )
    if manifest is None:
        return None
    try:
        render_source = dict(manifest.get("render_source") or {})
        render_source_path = resolve_manifest_path(Path(manifest_path), render_source.get("path"))
        if render_source_path is None or not render_source_path.exists():
            print("render prewarm: source file missing; fallback to synchronous render source prep", flush=True)
            return None
        if _looks_like_legacy_fast_cover_manifest(render_source):
            print("render prewarm: legacy fast-cover source manifest ignored; rebuilding source cleanup", flush=True)
            return None
        bbox_candidates = bbox_candidates_from_manifest(
            dict(manifest.get("payload_prewarm") or {}).get("bbox_text_strip_candidates")
        )
        document_analysis = document_analysis_from_manifest(manifest.get("document_analysis"))
        print(f"render prewarm: hit source={render_source_path}", flush=True)
        return RenderSourcePdf(
            path=render_source_path,
            temp_paths=[],
            image_compressed=bool(render_source.get("image_compressed")),
            bbox_text_stripped_page_indices=frozenset(int_list(render_source.get("bbox_text_stripped_page_indices"))),
            bbox_text_strip_skipped_page_indices=frozenset(int_list(render_source.get("bbox_text_strip_skipped_page_indices"))),
            source_text_precleaned_page_indices=frozenset(int_list(render_source.get("source_text_precleaned_page_indices"))),
            source_cleanup_cover_fallback_page_indices=frozenset(
                int_list(render_source.get("source_cleanup_cover_fallback_page_indices"))
            ),
            bbox_text_strip_candidates=bbox_candidates,
            document_analysis=document_analysis,
        )
    except Exception as exc:
        print(f"render prewarm: load failed {type(exc).__name__}: {exc}; fallback", flush=True)
        return None


def try_load_render_payload_prewarm(
    *,
    manifest_path: Path | None,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> RenderPayloadPrewarm | None:
    manifest = load_matching_manifest(
        manifest_path=manifest_path,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        effective_render_mode=effective_render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
    )
    visual_only = False
    if manifest is None:
        manifest = load_visual_payload_matching_manifest(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            effective_render_mode=effective_render_mode,
            start_page=start_page,
            end_page=end_page,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
        )
        visual_only = manifest is not None
    layout_safe_only = False
    if manifest is None:
        manifest = load_layout_safe_payload_matching_manifest(
            manifest_path=manifest_path,
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            effective_render_mode=effective_render_mode,
            start_page=start_page,
            end_page=end_page,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
        )
        layout_safe_only = manifest is not None
    if manifest is None:
        return None
    payload = dict(manifest.get("payload_prewarm") or {})
    if visual_only:
        payload = {
            "render_color_profile": payload.get("render_color_profile"),
        }
    if layout_safe_only:
        payload = {
            "first_line_indent_by_item_id": payload.get("first_line_indent_by_item_id"),
            "effective_inner_bbox_by_item_id": payload.get("effective_inner_bbox_by_item_id"),
            "bbox_text_strip_candidates": payload.get("bbox_text_strip_candidates"),
            "render_color_profile": payload.get("render_color_profile"),
        }
    payload["_manifest_path"] = str(manifest_path)
    return render_payload_prewarm_from_manifest_payload(
        payload,
        document_analysis=document_analysis_from_manifest(manifest.get("document_analysis")),
    )


def render_payload_prewarm_from_manifest_payload(
    payload: dict[str, Any],
    *,
    document_analysis: RenderDocumentAnalysis | None = None,
) -> RenderPayloadPrewarm | None:
    first_line_indent_lookup = {
        str(key): float(value)
        for key, value in dict(payload.get("first_line_indent_by_item_id") or {}).items()
        if float_or_none(value) is not None
    }
    effective_inner_bbox_lookup = {
        str(key): bbox
        for key, value in dict(payload.get("effective_inner_bbox_by_item_id") or {}).items()
        if (bbox := bbox_list_from_value(value)) is not None
    }
    bbox_candidates = bbox_candidates_from_manifest(payload.get("bbox_text_strip_candidates"))
    background_render_page_specs = render_page_specs_from_manifest(
        payload.get("background_render_page_specs")
    )
    prepared_overlay_pages = prepared_overlay_pages_from_manifest(payload.get("prepared_overlay_pages"))
    manifest_path_value = Path(payload.get("_manifest_path", "")) if payload.get("_manifest_path") else None
    visual_profile_path = (
        resolve_manifest_path(manifest_path_value, payload.get("visual_profile_path"))
        if manifest_path_value is not None
        else None
    )
    pdf_structure_profile_path = (
        resolve_manifest_path(manifest_path_value, payload.get("pdf_structure_profile_path"))
        if manifest_path_value is not None
        else None
    )
    render_colors_by_item_id = render_colors_from_manifest(
        payload.get("render_color_profile"),
        manifest_path=manifest_path_value,
    )
    overlay_source_path = resolve_manifest_path(
        manifest_path_value or Path(""),
        payload.get("overlay_source_path"),
    ) if payload.get("_manifest_path") else None
    if (
        not first_line_indent_lookup
        and not effective_inner_bbox_lookup
        and bbox_candidates is None
        and background_render_page_specs is None
        and prepared_overlay_pages is None
        and (visual_profile_path is None or not visual_profile_path.exists())
        and (pdf_structure_profile_path is None or not pdf_structure_profile_path.exists())
        and not render_colors_by_item_id
        and overlay_source_path is None
        and document_analysis is None
    ):
        return None
    print(
        f"render payload prewarm: hit indents={len(first_line_indent_lookup)} "
        f"geometry={len(effective_inner_bbox_lookup)} "
        f"bbox_pages={len(bbox_candidates.page_rects) if bbox_candidates is not None else 0} "
        f"bbox_source={bbox_candidates.candidate_source if bbox_candidates is not None else '-'} "
        f"background_specs={len(background_render_page_specs or [])} "
        f"colors={len(render_colors_by_item_id)}",
        flush=True,
    )
    return RenderPayloadPrewarm(
        first_line_indent_lookup=first_line_indent_lookup,
        effective_inner_bbox_lookup=effective_inner_bbox_lookup,
        bbox_text_strip_candidates=bbox_candidates,
        background_render_page_specs=background_render_page_specs,
        prepared_overlay_pages=prepared_overlay_pages,
        render_colors_by_item_id=render_colors_by_item_id or None,
        visual_profile_path=visual_profile_path if visual_profile_path and visual_profile_path.exists() else None,
        pdf_structure_profile_path=(
            pdf_structure_profile_path
            if pdf_structure_profile_path and pdf_structure_profile_path.exists()
            else None
        ),
        overlay_source_path=overlay_source_path if overlay_source_path and overlay_source_path.exists() else None,
        document_analysis=document_analysis,
    )


def prepared_overlay_pages_from_manifest(value: object) -> dict[int, list[dict]] | None:
    if not isinstance(value, dict):
        return None
    pages: dict[int, list[dict]] = {}
    for page_key, raw_items in value.items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        if not isinstance(raw_items, list):
            return None
        items: list[dict] = []
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                return None
            items.append(dict(raw_item))
        pages[page_idx] = items
    return pages or None


def load_matching_manifest(
    *,
    manifest_path: Path | None,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str = "pikepdf_text_strip",
    match_payload: bool = True,
) -> dict[str, Any] | None:
    if manifest_path is None or not Path(manifest_path).exists():
        return None
    try:
        with Path(manifest_path).open("r", encoding="utf-8") as f:
            manifest = json.load(f)
        if manifest.get("schema") != RENDER_PREWARM_SCHEMA:
            return None
        expected = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            effective_render_mode=effective_render_mode,
            start_page=start_page,
            end_page=end_page,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
        )
        actual = dict(manifest.get("fingerprint") or {})
        if not match_payload:
            actual = _source_fingerprint(actual)
            expected = _source_fingerprint(expected)
        if actual != expected:
            print("render prewarm: manifest fingerprint mismatch; fallback to synchronous render source prep", flush=True)
            return None
        return manifest
    except Exception as exc:
        print(f"render prewarm: load failed {type(exc).__name__}: {exc}; fallback", flush=True)
        return None


def _source_fingerprint(value: dict[str, Any]) -> dict[str, Any]:
    ignored = {"payload_structure_hash", "render_payload_hash", "payload_render_algorithm"}
    return {key: item for key, item in value.items() if key not in ignored}


def load_visual_payload_matching_manifest(
    *,
    manifest_path: Path | None,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> dict[str, Any] | None:
    if manifest_path is None or not Path(manifest_path).exists():
        return None
    try:
        with Path(manifest_path).open("r", encoding="utf-8") as f:
            manifest = json.load(f)
        if manifest.get("schema") != RENDER_PREWARM_SCHEMA:
            return None
        expected = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            effective_render_mode=effective_render_mode,
            start_page=start_page,
            end_page=end_page,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
        )
        actual = dict(manifest.get("fingerprint") or {})
        if _visual_payload_fingerprint(actual) != _visual_payload_fingerprint(expected):
            return None
        return manifest
    except Exception as exc:
        print(f"render prewarm: visual payload load failed {type(exc).__name__}: {exc}; fallback", flush=True)
        return None


def load_layout_safe_payload_matching_manifest(
    *,
    manifest_path: Path | None,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    effective_render_mode: str,
    start_page: int,
    end_page: int,
    pdf_compress_dpi: int,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> dict[str, Any] | None:
    if manifest_path is None or not Path(manifest_path).exists():
        return None
    try:
        with Path(manifest_path).open("r", encoding="utf-8") as f:
            manifest = json.load(f)
        if manifest.get("schema") != RENDER_PREWARM_SCHEMA:
            return None
        expected = build_render_prewarm_fingerprint(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            effective_render_mode=effective_render_mode,
            start_page=start_page,
            end_page=end_page,
            pdf_compress_dpi=pdf_compress_dpi,
            source_cleanup_strategy=source_cleanup_strategy,
        )
        actual = dict(manifest.get("fingerprint") or {})
        if _layout_safe_payload_fingerprint(actual) != _layout_safe_payload_fingerprint(expected):
            return None
        print("render payload prewarm: using layout-safe cache without prepared overlay pages", flush=True)
        return manifest
    except Exception as exc:
        print(f"render prewarm: layout-safe payload load failed {type(exc).__name__}: {exc}; fallback", flush=True)
        return None


def _visual_payload_fingerprint(value: dict[str, Any]) -> dict[str, Any]:
    keep = {
        "source_pdf_path",
        "source_pdf_size",
        "source_pdf_mtime_ns",
        "page_range",
        "effective_render_mode",
        "pdf_compress_dpi",
        "visual_payload_hash",
        "geometry_adjustment_algorithm",
        "payload_render_algorithm",
    }
    return {key: value.get(key) for key in keep}


def _layout_safe_payload_fingerprint(value: dict[str, Any]) -> dict[str, Any]:
    ignored = {
        "payload_structure_hash",
        "render_payload_hash",
    }
    return {key: item for key, item in value.items() if key not in ignored}


def _looks_like_legacy_fast_cover_manifest(render_source: dict[str, Any]) -> bool:
    return (
        not int_list(render_source.get("bbox_text_stripped_page_indices"))
        and not int_list(render_source.get("source_text_precleaned_page_indices"))
        and bool(int_list(render_source.get("bbox_text_strip_skipped_page_indices")))
        and "source_cleanup_cover_fallback_page_indices" not in render_source
    )


def bbox_candidates_to_manifest(candidates: BBoxTextStripCandidates) -> dict[str, Any]:
    return {
        "algorithm": BBOX_TEXT_STRIP_ALGORITHM_ID,
        "candidate_source": candidates.candidate_source,
        "page_rects": {
            str(page_idx): [list(rect) for rect in rects]
            for page_idx, rects in sorted(candidates.page_rects.items())
        },
        "page_protected_rects": {
            str(page_idx): [list(rect) for rect in rects]
            for page_idx, rects in sorted((candidates.page_protected_rects or {}).items())
        },
        "page_path_rects": {
            str(page_idx): [list(rect) for rect in rects]
            for page_idx, rects in sorted((getattr(candidates, "page_path_rects", None) or {}).items())
        },
        "uncovered_unsafe_vector_item_ids": sorted(candidates.uncovered_unsafe_vector_item_ids),
        "pages_skipped_complex": candidates.pages_skipped_complex,
        "pages_skipped_no_text_overlap": candidates.pages_skipped_no_text_overlap,
        "pages_skipped_visual_background": candidates.pages_skipped_visual_background,
        "pages_skipped_form_xobject": candidates.pages_skipped_form_xobject,
        "pages_strip_no_effect": candidates.pages_strip_no_effect,
        "skipped_complex_page_indices": sorted(candidates.skipped_complex_page_indices),
        "skipped_no_text_overlap_page_indices": sorted(candidates.skipped_no_text_overlap_page_indices),
        "skipped_visual_background_page_indices": sorted(candidates.skipped_visual_background_page_indices),
        "skipped_form_xobject_page_indices": sorted(candidates.skipped_form_xobject_page_indices),
        "strip_no_effect_page_indices": sorted(candidates.strip_no_effect_page_indices),
        "page_features": {
            str(page_idx): dict(features)
            for page_idx, features in sorted((candidates.page_features or {}).items())
        },
        "deletion_contracts_by_page": {
            str(page_idx): [dict(contract) for contract in contracts]
            for page_idx, contracts in sorted((getattr(candidates, "deletion_contracts_by_page", None) or {}).items())
        },
    }


def bbox_candidates_from_manifest(value: object) -> BBoxTextStripCandidates | None:
    payload = dict(value or {})
    if payload.get("algorithm") != BBOX_TEXT_STRIP_ALGORITHM_ID:
        return None
    page_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = {}
    page_protected_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = {}
    page_path_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = {}
    for page_key, raw_rects in dict(payload.get("page_rects") or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        rects: list[tuple[float, float, float, float]] = []
        for raw_rect in raw_rects if isinstance(raw_rects, list) else []:
            rect = rect_tuple_from_value(raw_rect)
            if rect is not None:
                rects.append(rect)
        if rects:
            page_rects[page_idx] = tuple(rects)
    for page_key, raw_rects in dict(payload.get("page_protected_rects") or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        rects: list[tuple[float, float, float, float]] = []
        for raw_rect in raw_rects if isinstance(raw_rects, list) else []:
            rect = rect_tuple_from_value(raw_rect)
            if rect is not None:
                rects.append(rect)
        if rects:
            page_protected_rects[page_idx] = tuple(rects)
    for page_key, raw_rects in dict(payload.get("page_path_rects") or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        rects: list[tuple[float, float, float, float]] = []
        for raw_rect in raw_rects if isinstance(raw_rects, list) else []:
            rect = rect_tuple_from_value(raw_rect)
            if rect is not None:
                rects.append(rect)
        if rects:
            page_path_rects[page_idx] = tuple(rects)
    if (
        not page_rects
        and not payload.get("skipped_complex_page_indices")
        and not payload.get("skipped_no_text_overlap_page_indices")
        and not payload.get("skipped_visual_background_page_indices")
        and not payload.get("skipped_form_xobject_page_indices")
        and not payload.get("strip_no_effect_page_indices")
    ):
        return None
    candidate_kwargs: dict[str, object] = {
        "page_rects": page_rects,
        "page_protected_rects": page_protected_rects,
        "uncovered_unsafe_vector_item_ids": frozenset(
            str(value)
            for value in list(payload.get("uncovered_unsafe_vector_item_ids") or [])
            if str(value).strip()
        ),
        "candidate_source": BBOX_TEXT_STRIP_CANDIDATE_SOURCE_MANIFEST,
        "pages_skipped_complex": int(payload.get("pages_skipped_complex") or 0),
        "pages_skipped_no_text_overlap": int(payload.get("pages_skipped_no_text_overlap") or 0),
        "pages_skipped_visual_background": int(payload.get("pages_skipped_visual_background") or 0),
        "pages_skipped_form_xobject": int(payload.get("pages_skipped_form_xobject") or 0),
        "pages_strip_no_effect": int(payload.get("pages_strip_no_effect") or 0),
        "skipped_complex_page_indices": frozenset(int_list(payload.get("skipped_complex_page_indices"))),
        "skipped_no_text_overlap_page_indices": frozenset(int_list(payload.get("skipped_no_text_overlap_page_indices"))),
        "skipped_visual_background_page_indices": frozenset(int_list(payload.get("skipped_visual_background_page_indices"))),
        "skipped_form_xobject_page_indices": frozenset(int_list(payload.get("skipped_form_xobject_page_indices"))),
        "strip_no_effect_page_indices": frozenset(int_list(payload.get("strip_no_effect_page_indices"))),
        "page_features": page_features_from_manifest(payload.get("page_features")),
    }
    candidate_fields = getattr(BBoxTextStripCandidates, "__dataclass_fields__", {})
    if "page_path_rects" in candidate_fields:
        candidate_kwargs["page_path_rects"] = page_path_rects
    if "deletion_contracts_by_page" in candidate_fields:
        candidate_kwargs["deletion_contracts_by_page"] = deletion_contracts_from_manifest(
            payload.get("deletion_contracts_by_page")
        )
    return BBoxTextStripCandidates(**candidate_kwargs)


def page_features_from_manifest(value: object) -> dict[int, dict[str, object]]:
    features_by_page: dict[int, dict[str, object]] = {}
    for page_key, raw_features in dict(value or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        payload = dict(raw_features or {})
        if payload:
            features_by_page[page_idx] = payload
    return features_by_page


def deletion_contracts_from_manifest(value: object) -> dict[int, tuple[dict[str, object], ...]]:
    contracts_by_page: dict[int, tuple[dict[str, object], ...]] = {}
    for page_key, raw_contracts in dict(value or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        if not isinstance(raw_contracts, list):
            continue
        contracts = tuple(dict(contract) for contract in raw_contracts if isinstance(contract, dict))
        if contracts:
            contracts_by_page[page_idx] = contracts
    return contracts_by_page


__all__ = [
    "bbox_candidates_from_manifest",
    "bbox_candidates_to_manifest",
    "build_prewarm_manifest",
    "document_analysis_from_manifest",
    "load_matching_manifest",
    "load_visual_payload_matching_manifest",
    "load_layout_safe_payload_matching_manifest",
    "render_payload_prewarm_from_manifest_payload",
    "try_load_prewarmed_render_source_pdf",
    "try_load_render_payload_prewarm",
]

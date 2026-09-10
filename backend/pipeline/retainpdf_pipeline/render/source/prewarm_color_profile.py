from __future__ import annotations

from pathlib import Path
from typing import Any

import fitz

from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.output.typst.color_adapt import apply_adaptive_overlay_colors
from retainpdf_pipeline.render.source.prewarm_manifest import color_tuple
from retainpdf_pipeline.render.source.prewarm_manifest import relative_to_manifest
from retainpdf_pipeline.render.source.prewarm_manifest import resolve_manifest_path
from retainpdf_pipeline.render.visual_profile import DocumentVisualProfile
from retainpdf_pipeline.render.visual_profile import build_document_visual_profile
from retainpdf_pipeline.render.visual_profile import load_visual_profile_runtime
from retainpdf_pipeline.render.visual_profile import read_document_visual_profile
from retainpdf_pipeline.render.visual_profile.manifest import document_visual_profile_from_manifest


RENDER_COLOR_PROFILE_ALGORITHM_VERSION = "render_color_profile_v3_visual_profile"
LEGACY_RENDER_COLOR_PROFILE_ALGORITHM_VERSION = "render_color_profile_v2_tuple_color"


def build_render_color_profile_manifest(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    first_line_indent_lookup: dict[str, float],
    effective_inner_bbox_lookup: dict[str, list[float]],
    prepared_translated_pages: dict[int, list[dict]] | None = None,
    color_adapted_pages: dict[int, list[dict]] | None = None,
    visual_profile: DocumentVisualProfile | None = None,
    visual_profile_path: Path | None = None,
    manifest_path: Path | None = None,
) -> dict[str, Any]:
    try:
        prepared = prepared_translated_pages or prepare_translated_pages_for_render(
            source_pdf_path,
            translated_pages,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
        )
        visual_profile = visual_profile or build_document_visual_profile(source_pdf_path, prepared)
        adapted = color_adapted_pages or apply_page_color_adapt_for_prewarm(
            source_pdf_path,
            prepared,
            visual_profile=visual_profile,
        )
        colors: dict[str, dict[str, list[float]]] = {}
        for items in adapted.values():
            for item in items:
                item_id = str(item.get("item_id") or "")
                if not item_id:
                    continue
                colors[item_id] = {
                    "cover_fill": round_color(item.get("_render_cover_fill", (1, 1, 1))),
                    "text_color": round_color(item.get("_render_text_color", (0, 0, 0))),
                }
        return {
            "algorithm": RENDER_COLOR_PROFILE_ALGORITHM_VERSION,
            "visual_profile_path": (
                relative_to_manifest(manifest_path, visual_profile_path)
                if manifest_path is not None and visual_profile_path is not None
                else ""
            ),
            "colors_by_item_id": colors,
        }
    except Exception as exc:
        print(f"render payload prewarm: color profile failed {type(exc).__name__}: {exc}", flush=True)
        return {}


def apply_page_color_adapt_for_prewarm(
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    *,
    visual_profile: DocumentVisualProfile | None = None,
) -> dict[int, list[dict]]:
    profile = visual_profile or build_document_visual_profile(source_pdf_path, translated_pages)
    precomputed = render_colors_from_visual_profile(profile)
    if _precomputed_colors_cover_pages(translated_pages, precomputed):
        return _apply_precomputed_colors_to_pages(translated_pages, precomputed)
    sample_doc = fitz.open(source_pdf_path)
    try:
        return {
            page_idx: apply_adaptive_overlay_colors(
                sample_doc[page_idx],
                items,
                precomputed_colors_by_item_id=precomputed,
            )
            if 0 <= page_idx < len(sample_doc)
            else list(items)
            for page_idx, items in translated_pages.items()
        }
    finally:
        sample_doc.close()


def _precomputed_colors_cover_pages(
    pages: dict[int, list[dict]],
    colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]],
) -> bool:
    for items in pages.values():
        for item in items:
            item_id = str(item.get("item_id") or "")
            if not item_id or item_id not in colors_by_item_id:
                return False
    return True


def _apply_precomputed_colors_to_pages(
    pages: dict[int, list[dict]],
    colors_by_item_id: dict[str, dict[str, tuple[float, float, float]]],
) -> dict[int, list[dict]]:
    adapted: dict[int, list[dict]] = {}
    for page_idx, items in pages.items():
        adapted_items: list[dict] = []
        for item in items:
            next_item = dict(item)
            colors = colors_by_item_id[str(next_item.get("item_id") or "")]
            next_item["_render_cover_fill"] = colors.get(
                "cover_fill",
                next_item.get("_render_cover_fill", (1, 1, 1)),
            )
            next_item["_render_text_color"] = colors.get(
                "text_color",
                next_item.get("_render_text_color", (0, 0, 0)),
            )
            adapted_items.append(next_item)
        adapted[page_idx] = adapted_items
    return adapted


def render_colors_from_manifest(
    value: object,
    *,
    manifest_path: Path | None = None,
) -> dict[str, dict[str, tuple[float, float, float]]]:
    payload = dict(value or {})
    algorithm = payload.get("algorithm")
    if algorithm == RENDER_COLOR_PROFILE_ALGORITHM_VERSION:
        profile_path = resolve_manifest_path(manifest_path, payload.get("visual_profile_path")) if manifest_path else None
        if profile_path is not None:
            runtime = load_visual_profile_runtime(profile_path)
            colors = runtime.colors_by_item_id()
            if colors:
                return colors
        embedded_profile = document_visual_profile_from_manifest(payload.get("visual_profile"))
        embedded_colors = render_colors_from_visual_profile(embedded_profile)
        if embedded_colors:
            return embedded_colors
    if algorithm not in {RENDER_COLOR_PROFILE_ALGORITHM_VERSION, LEGACY_RENDER_COLOR_PROFILE_ALGORITHM_VERSION}:
        return {}
    result: dict[str, dict[str, tuple[float, float, float]]] = {}
    for item_id, raw in dict(payload.get("colors_by_item_id") or {}).items():
        if not isinstance(raw, dict):
            continue
        result[str(item_id)] = {
            "cover_fill": color_tuple(raw.get("cover_fill"), default=(1.0, 1.0, 1.0)),
            "text_color": color_tuple(raw.get("text_color"), default=(0.0, 0.0, 0.0)),
        }
    return result


def render_colors_from_visual_profile(
    profile: DocumentVisualProfile,
) -> dict[str, dict[str, tuple[float, float, float]]]:
    colors: dict[str, dict[str, tuple[float, float, float]]] = {}
    for page in profile.pages.values():
        for item_id, item in page.items.items():
            colors[item_id] = {
                "cover_fill": item.background_rgb,
                "text_color": item.text_rgb,
            }
    return colors


def round_color(value: object) -> list[float]:
    color = color_tuple(value, default=(0.0, 0.0, 0.0))
    return [round(float(component), 5) for component in color]


__all__ = [
    "RENDER_COLOR_PROFILE_ALGORITHM_VERSION",
    "apply_page_color_adapt_for_prewarm",
    "build_render_color_profile_manifest",
    "render_colors_from_manifest",
    "render_colors_from_visual_profile",
]

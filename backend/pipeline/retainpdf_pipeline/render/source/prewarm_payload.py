from __future__ import annotations

from pathlib import Path
import os
from statistics import median
import time
from typing import Any

import fitz

from retainpdf_pipeline.foundation.config import layout
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.render.layout.payload.block_seed_metrics import collect_page_seed_metrics
from retainpdf_pipeline.render.layout.payload.first_line_indent import MAX_INDENT_EM
from retainpdf_pipeline.render.layout.payload.first_line_indent import detect_first_line_indent_pt_with_displaylist
from retainpdf_pipeline.render.layout.payload.first_line_indent import is_first_line_indent_candidate
from retainpdf_pipeline.render.layout.payload.render_item import get_render_first_line_indent_pt
from retainpdf_pipeline.render.layout.payload.render_item import seed_render_fields
from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.pdf_structure_profile.contracts import PdfStructureDocumentProfile
from retainpdf_pipeline.render.pdf_structure_profile.io import pdf_structure_profile_path_from_prewarm_manifest
from retainpdf_pipeline.render.pdf_structure_profile.io import read_pdf_structure_profile
from retainpdf_pipeline.render.pdf_structure_profile.io import write_pdf_structure_profile
from retainpdf_pipeline.render.pdf_structure_profile.sampler import build_pdf_structure_profile
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source_cleanup import plan_source_cleanup
from retainpdf_pipeline.render.source.prewarm_color_profile import apply_page_color_adapt_for_prewarm
from retainpdf_pipeline.render.source.prewarm_color_profile import build_render_color_profile_manifest
from retainpdf_pipeline.render.source.prewarm_contracts import FIRST_LINE_INDENT_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_contracts import GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_contracts import PAYLOAD_RENDER_ALGORITHM_VERSION
from retainpdf_pipeline.render.source.prewarm_manifest_io import bbox_candidates_to_manifest
from retainpdf_pipeline.render.source.prewarm_page_specs import build_background_render_page_specs_manifest
from retainpdf_pipeline.render.visual_profile import build_document_visual_profile
from retainpdf_pipeline.render.visual_profile import visual_profile_path_from_prewarm_manifest
from retainpdf_pipeline.render.visual_profile import write_document_visual_profile

PIXMAP_INDENT_DEFAULT_MAX_CANDIDATES_PER_PAGE = 10
PIXMAP_INDENT_DEFAULT_MAX_SECONDS = 8.0
PIXMAP_INDENT_AUTO_ENABLE_MAX_PAGES = 2


def build_payload_prewarm(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    manifest_path: Path,
    effective_render_mode: str = "",
    source_cleanup_strategy: str = "pikepdf_text_strip",
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    timings: dict[str, float] = {}
    prepared_pages = seed_pages_for_payload_prewarm(translated_pages)
    first_line_indent_by_item_id: dict[str, float] = {}
    effective_inner_bbox_by_item_id: dict[str, list[float]] = {}
    indent_stats: dict[str, Any] = {
        "line_hits": 0,
        "pixmap_candidates": 0,
        "pixmap_checked": 0,
        "pixmap_hits": 0,
        "pixmap_budget_exhausted": 0,
        "pixmap_disabled_candidates": 0,
    }
    geometry_started = time.perf_counter()
    pixmap_indent_deadline = geometry_started + _pixmap_first_line_indent_max_seconds()
    page_widths = page_widths_by_index(source_pdf_path)
    with fitz.open(source_pdf_path) as source_doc:
        pixmap_policy = _pixmap_first_line_indent_policy(page_count=len(source_doc))
        indent_stats["pixmap_enabled"] = pixmap_policy["enabled"]
        indent_stats["pixmap_reason"] = pixmap_policy["reason"]
        indent_stats["pixmap_auto_max_pages"] = PIXMAP_INDENT_AUTO_ENABLE_MAX_PAGES
        for page_idx, items in prepared_pages.items():
            page_width = page_widths.get(page_idx)
            try:
                metrics = collect_page_seed_metrics(items, page_width=page_width)
            except Exception as exc:
                print(f"render payload prewarm: geometry build failed page={page_idx + 1} {type(exc).__name__}: {exc}", flush=True)
                continue
            for index, bbox in metrics.effective_inner_bboxes.items():
                if index < 0 or index >= len(items):
                    continue
                item_id = str(items[index].get("item_id", "") or "")
                if item_id:
                    effective_inner_bbox_by_item_id[item_id] = [round(float(value), 3) for value in bbox]
            collect_first_line_indent_lookup(
                source_doc=source_doc,
                page_idx=page_idx,
                items=items,
                metrics=metrics,
                sink=first_line_indent_by_item_id,
                stats=indent_stats,
                pixmap_deadline=pixmap_indent_deadline,
                pixmap_policy=pixmap_policy,
            )
    timings["geometry_indent"] = time.perf_counter() - geometry_started
    structure_started = time.perf_counter()
    pdf_structure_profile_path, pdf_structure_profile = ensure_pdf_structure_profile(
        source_pdf_path=source_pdf_path,
        translated_pages=prepared_pages,
        manifest_path=manifest_path,
    )
    timings["pdf_structure_profile"] = time.perf_counter() - structure_started
    mode = str(effective_render_mode or "").strip()
    if layout.use_bbox_text_strip_cleanup(source_cleanup_strategy):
        try:
            bbox_started = time.perf_counter()
            bbox_candidates = (
                bbox_text_strip_candidates
                or plan_source_cleanup(
                    source_pdf_path=source_pdf_path,
                    translated_pages=translated_pages,
                    skip_formula_pages=False,
                    pdf_structure_profile=pdf_structure_profile,
                )
            )
            bbox_payload = bbox_candidates_to_manifest(bbox_candidates)
            timings["bbox_candidates"] = time.perf_counter() - bbox_started
        except Exception as exc:
            print(f"render payload prewarm: bbox candidate build failed {type(exc).__name__}: {exc}", flush=True)
            bbox_payload = {}
            timings["bbox_candidates"] = 0.0
    else:
        bbox_payload = {}
        timings["bbox_candidates"] = 0.0
    should_build_background_specs = mode in {"typst", "typst_visual"}
    prepared_for_render = None
    color_adapted_pages = None
    visual_profile = None
    try:
        visual_started = time.perf_counter()
        prepared_for_render = prepare_translated_pages_for_render(
            source_pdf_path,
            translated_pages,
            first_line_indent_lookup=first_line_indent_by_item_id,
            effective_inner_bbox_lookup=effective_inner_bbox_by_item_id,
        )
        timings["prepare_render_payload"] = time.perf_counter() - visual_started
    except Exception as exc:
        print(f"render payload prewarm: prepare render payload failed {type(exc).__name__}: {exc}", flush=True)
        timings["prepare_render_payload"] = 0.0
    if prepared_for_render is not None:
        try:
            color_adapt_started = time.perf_counter()
            visual_profile = build_document_visual_profile(source_pdf_path, prepared_for_render)
            visual_profile_path = visual_profile_path_from_prewarm_manifest(manifest_path)
            write_document_visual_profile(visual_profile_path, visual_profile)
            color_adapted_pages = apply_page_color_adapt_for_prewarm(
                source_pdf_path,
                prepared_for_render,
                visual_profile=visual_profile,
            )
            timings["color_adapt"] = time.perf_counter() - color_adapt_started
        except Exception as exc:
            print(f"render payload prewarm: color adapt failed {type(exc).__name__}: {exc}", flush=True)
            timings["color_adapt"] = 0.0
    color_profile_started = time.perf_counter()
    render_color_profile = build_render_color_profile_manifest(
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        first_line_indent_lookup=first_line_indent_by_item_id,
        effective_inner_bbox_lookup=effective_inner_bbox_by_item_id,
        prepared_translated_pages=prepared_for_render,
        color_adapted_pages=color_adapted_pages,
        visual_profile=visual_profile,
        visual_profile_path=visual_profile_path_from_prewarm_manifest(manifest_path) if visual_profile is not None else None,
        manifest_path=manifest_path,
    )
    timings["color_profile_manifest"] = time.perf_counter() - color_profile_started
    background_specs_started = time.perf_counter()
    background_render_page_specs = (
        build_background_render_page_specs_manifest(
            source_pdf_path=source_pdf_path,
            translated_pages=translated_pages,
            first_line_indent_lookup=first_line_indent_by_item_id,
            effective_inner_bbox_lookup=effective_inner_bbox_by_item_id,
            prepared_translated_pages=prepared_for_render,
            color_adapted_pages=color_adapted_pages,
        )
        if should_build_background_specs
        else {}
    )
    timings["background_specs"] = time.perf_counter() - background_specs_started
    elapsed_s = time.perf_counter() - started
    message = (
        f"render payload prewarm: ready mode={mode or 'unknown'} "
        f"indents={len(first_line_indent_by_item_id)} "
        f"geometry={len(effective_inner_bbox_by_item_id)} "
        f"background_specs={'yes' if should_build_background_specs else 'skipped'} "
        f"indent_stats={indent_stats} "
        f"timings={format_prewarm_timings(timings)} "
        f"elapsed={elapsed_s:.2f}s"
    )
    emit_stage_progress(
        stage="render_preprocess",
        substage="render_prewarm",
        message=message,
        stage_detail="渲染 payload 预热完成",
        progress_current=2,
        progress_total=3,
        elapsed_ms=int(elapsed_s * 1000),
        payload={
            "user_stage": "render",
            "progress_unit": "step",
            "effective_render_mode": mode,
            "page_count": len(translated_pages),
            "indents": len(first_line_indent_by_item_id),
            "geometry": len(effective_inner_bbox_by_item_id),
            "background_specs": "built" if should_build_background_specs else "skipped",
            "indent_stats": dict(indent_stats),
            "timings": {key: round(value, 3) for key, value in timings.items()},
        },
    )
    print(message, flush=True)
    return {
        "first_line_indent_algorithm": FIRST_LINE_INDENT_ALGORITHM_VERSION,
        "first_line_indent_by_item_id": first_line_indent_by_item_id,
        "first_line_indent_diagnostics": dict(indent_stats),
        "geometry_adjustment_algorithm": GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION,
        "payload_render_algorithm": PAYLOAD_RENDER_ALGORITHM_VERSION,
        "effective_render_mode": mode,
        "effective_inner_bbox_by_item_id": effective_inner_bbox_by_item_id,
        "bbox_text_strip_candidates": bbox_payload,
        "pdf_structure_profile_path": (
            "pdf_structure_profile.v1.json"
            if pdf_structure_profile_path is not None
            else ""
        ),
        "visual_profile_path": (
            "visual_profile.v1.json"
            if visual_profile is not None
            else ""
        ),
        "render_color_profile": render_color_profile,
        "background_render_page_specs": background_render_page_specs,
        "prepared_overlay_pages": prepared_overlay_pages_to_manifest(color_adapted_pages or {}),
        "overlay_source_path": "",
    }


def ensure_pdf_structure_profile(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    manifest_path: Path,
) -> tuple[Path | None, PdfStructureDocumentProfile | None]:
    pdf_structure_profile_path = pdf_structure_profile_path_from_prewarm_manifest(manifest_path)
    if pdf_structure_profile_path.exists():
        profile = read_pdf_structure_profile(pdf_structure_profile_path)
        if profile is not None:
            return pdf_structure_profile_path, profile
    try:
        profile = build_pdf_structure_profile(source_pdf_path, translated_pages)
        write_pdf_structure_profile(pdf_structure_profile_path, profile)
        return pdf_structure_profile_path, profile
    except Exception as exc:
        print(f"render payload prewarm: pdf structure profile failed {type(exc).__name__}: {exc}", flush=True)
        return None, None


def prepared_overlay_pages_to_manifest(pages: dict[int, list[dict]]) -> dict[str, list[dict]]:
    return {
        str(page_idx): [dict(item) for item in items]
        for page_idx, items in sorted(pages.items())
    }


def format_prewarm_timings(timings: dict[str, float]) -> str:
    return ",".join(f"{key}={value:.2f}s" for key, value in sorted(timings.items())) or "-"


def seed_pages_for_payload_prewarm(translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    seeded: dict[int, list[dict]] = {}
    for page_idx, items in translated_pages.items():
        seeded_items: list[dict] = []
        for item in items:
            clone = dict(item)
            seed_render_fields(clone)
            seeded_items.append(clone)
        seeded[page_idx] = seeded_items
    return seeded


def collect_first_line_indent_lookup(
    *,
    source_doc: fitz.Document,
    page_idx: int,
    items: list[dict],
    metrics,
    sink: dict[str, float],
    stats: dict[str, Any] | None = None,
    pixmap_deadline: float | None = None,
    pixmap_policy: dict[str, Any] | None = None,
) -> None:
    if page_idx < 0 or page_idx >= len(source_doc):
        return
    candidates: list[tuple[dict, float]] = []
    max_candidates = _pixmap_first_line_indent_max_candidates_per_page()
    policy = pixmap_policy or _pixmap_first_line_indent_policy(page_count=len(source_doc))
    pixmap_enabled = bool(policy.get("enabled"))
    if stats is not None:
        stats.setdefault("pixmap_enabled", pixmap_enabled)
        stats.setdefault("pixmap_reason", str(policy.get("reason", "")))
        stats.setdefault("pixmap_disabled_candidates", 0)
    for index, item in enumerate(items):
        item_id = str(item.get("item_id", "") or "")
        if not item_id:
            continue
        existing_indent = get_render_first_line_indent_pt(item)
        if existing_indent > 0:
            sink[item_id] = round(existing_indent, 2)
            continue
        base = metrics.base_metrics.get(index)
        if base is None:
            continue
        font_size_pt, _leading_em = base
        if not is_first_line_indent_candidate(item, page_text_width_med=metrics.page_text_width_med):
            continue
        line_indent = first_line_indent_from_item_lines(item, font_size_pt=font_size_pt)
        if line_indent > 0:
            sink[item_id] = line_indent
            if stats is not None:
                stats["line_hits"] = int(stats.get("line_hits", 0)) + 1
            continue
        if stats is not None:
            stats["pixmap_candidates"] = int(stats.get("pixmap_candidates", 0)) + 1
        if not pixmap_enabled:
            if stats is not None:
                stats["pixmap_disabled_candidates"] = int(stats.get("pixmap_disabled_candidates", 0)) + 1
            continue
        if len(candidates) < max_candidates:
            candidates.append((item, font_size_pt))
    if not candidates:
        return
    if pixmap_deadline is not None and time.perf_counter() >= pixmap_deadline:
        if stats is not None:
            stats["pixmap_budget_exhausted"] = int(stats.get("pixmap_budget_exhausted", 0)) + len(candidates)
        return
    displaylist = source_doc[page_idx].get_displaylist()
    for item, font_size_pt in candidates:
        if pixmap_deadline is not None and time.perf_counter() >= pixmap_deadline:
            if stats is not None:
                stats["pixmap_budget_exhausted"] = int(stats.get("pixmap_budget_exhausted", 0)) + 1
            break
        item_id = str(item.get("item_id", "") or "")
        if stats is not None:
            stats["pixmap_checked"] = int(stats.get("pixmap_checked", 0)) + 1
        indent_pt = detect_first_line_indent_pt_with_displaylist(
            source_doc,
            displaylist,
            item,
            page_idx=page_idx,
            font_size_pt=font_size_pt,
            page_text_width_med=metrics.page_text_width_med,
        )
        if indent_pt > 0:
            sink[item_id] = round(indent_pt, 2)
            if stats is not None:
                stats["pixmap_hits"] = int(stats.get("pixmap_hits", 0)) + 1


def first_line_indent_from_item_lines(item: dict, *, font_size_pt: float) -> float:
    lines = item.get("lines")
    if not isinstance(lines, list) or len(lines) < 2:
        return 0.0
    lefts: list[float] = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        bbox = line.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            continue
        try:
            x0 = float(bbox[0])
            x1 = float(bbox[2])
        except Exception:
            continue
        if x1 <= x0:
            continue
        lefts.append(x0)
    if len(lefts) < 2:
        return 0.0
    indent_pt = lefts[0] - median(lefts[1:])
    threshold = max(4.0, min(8.0, font_size_pt * 0.75))
    if indent_pt < threshold:
        return 0.0
    max_indent = max(8.0, font_size_pt * MAX_INDENT_EM)
    return round(max(0.0, min(indent_pt, max_indent)), 2)


def page_widths_by_index(source_pdf_path: Path) -> dict[int, float]:
    try:
        with fitz.open(source_pdf_path) as doc:
            return {index: float(page.rect.width) for index, page in enumerate(doc)}
    except Exception:
        return {}


def _pixmap_first_line_indent_policy(*, page_count: int) -> dict[str, Any]:
    value = str(os.environ.get("RETAIN_RENDER_PIXMAP_INDENT", "") or "").strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return {"enabled": True, "reason": "env_enabled"}
    if value in {"0", "false", "no", "off"}:
        return {"enabled": False, "reason": "env_disabled"}
    if 0 <= int(page_count) <= PIXMAP_INDENT_AUTO_ENABLE_MAX_PAGES:
        return {"enabled": True, "reason": "small_document_auto_enabled"}
    return {"enabled": False, "reason": "default_disabled"}


def _pixmap_first_line_indent_max_candidates_per_page() -> int:
    raw = str(os.environ.get("RETAIN_RENDER_PIXMAP_INDENT_MAX_CANDIDATES_PER_PAGE", "") or "").strip()
    try:
        return max(0, int(raw)) if raw else PIXMAP_INDENT_DEFAULT_MAX_CANDIDATES_PER_PAGE
    except ValueError:
        return PIXMAP_INDENT_DEFAULT_MAX_CANDIDATES_PER_PAGE


def _pixmap_first_line_indent_max_seconds() -> float:
    raw = str(os.environ.get("RETAIN_RENDER_PIXMAP_INDENT_MAX_SECONDS", "") or "").strip()
    try:
        return max(0.0, float(raw)) if raw else PIXMAP_INDENT_DEFAULT_MAX_SECONDS
    except ValueError:
        return PIXMAP_INDENT_DEFAULT_MAX_SECONDS


__all__ = [
    "build_payload_prewarm",
    "collect_first_line_indent_lookup",
    "first_line_indent_from_item_lines",
    "page_widths_by_index",
    "seed_pages_for_payload_prewarm",
]

from __future__ import annotations

from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import time
from typing import Any

import fitz

from foundation.config import layout
from runtime.pipeline.render_mode import resolve_effective_render_mode
from services.rendering.source.render_source import RenderSourcePdf
from services.rendering.source.render_source import build_render_source_pdf
from services.rendering.source.preparation.bbox_text_strip_candidates import build_bbox_text_strip_candidates
from services.rendering.source.preparation.bbox_text_strip_types import BBoxTextStripCandidates
from services.rendering.layout.payload.block_seed_metrics import collect_page_seed_metrics
from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page
from services.rendering.layout.payload.render_item import get_render_first_line_indent_pt
from services.rendering.policy import apply_render_pages_policy_fields
from services.translation.item_reader import item_block_kind


RENDER_PREWARM_DIR_NAME = "render_prewarm"
RENDER_PREWARM_MANIFEST_NAME = "render_source_prewarm_manifest.json"
RENDER_PREWARM_SCHEMA = "render_source_prewarm_v1"
BBOX_TEXT_STRIP_ALGORITHM_VERSION = "bbox_text_strip_v10_formula_guarded_pages"
HIDDEN_TEXT_STRIP_ALGORITHM_VERSION = "hidden_text_strip_v1"
IMAGE_COMPRESSION_ALGORITHM_VERSION = "image_only_compress_v1"
FIRST_LINE_INDENT_ALGORITHM_VERSION = "first_line_indent_v1"
GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION = "geometry_adjustments_v1"


@dataclass(frozen=True)
class RenderPrewarmSpec:
    source_pdf_path: Path
    output_pdf_path: Path
    artifacts_dir: Path
    translated_pages: dict[int, list[dict]]
    render_mode: str
    start_page: int
    end_page: int
    pdf_compress_dpi: int
    source_cleanup_strategy: str = "pikepdf_text_strip"


@dataclass(frozen=True)
class RenderPrewarmHandle:
    manifest_path: Path
    future: Future[Path | None] | None = None
    executor: ThreadPoolExecutor | None = None

    def wait(self) -> Path | None:
        try:
            return self.future.result() if self.future is not None else self.manifest_path
        finally:
            if self.executor is not None:
                self.executor.shutdown(wait=True, cancel_futures=False)


@dataclass(frozen=True)
class RenderPayloadPrewarm:
    first_line_indent_lookup: dict[str, float]
    effective_inner_bbox_lookup: dict[str, list[float]]
    bbox_text_strip_candidates: BBoxTextStripCandidates | None = None


def prewarm_manifest_path_from_artifacts_dir(artifacts_dir: Path) -> Path:
    return Path(artifacts_dir) / RENDER_PREWARM_DIR_NAME / RENDER_PREWARM_MANIFEST_NAME


def prewarm_manifest_path_from_translations_dir(translations_dir: Path | None) -> Path | None:
    if translations_dir is None:
        return None
    return prewarm_manifest_path_from_artifacts_dir(Path(translations_dir).parent / "artifacts")


def build_payload_structure_hash(translated_pages: dict[int, list[dict]]) -> str:
    digest = hashlib.sha256()
    for page_idx in sorted(translated_pages):
        compact_items = [
            _payload_structure_item(page_idx, item)
            for item in translated_pages[page_idx]
            if _is_bbox_text_strip_candidate(item)
        ]
        if not compact_items:
            continue
        digest.update(f"page:{page_idx}\n".encode("utf-8"))
        for compact in compact_items:
            digest.update(json.dumps(compact, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
            digest.update(b"\n")
    return digest.hexdigest()


def _payload_structure_item(page_idx: int, item: dict) -> dict[str, Any]:
    block_kind = item_block_kind(item)
    return {
        "item_id": str(item.get("item_id", "") or ""),
        "page_idx": _int_or_default(item.get("page_idx"), page_idx),
        "block_type": str(item.get("block_type", "") or ""),
        "block_kind": block_kind,
        "bbox": [_float_or_zero(value) for value in list(item.get("bbox", []) or [])[:4]],
        "layout_role": str(item.get("layout_role", "") or ""),
        "semantic_role": str(item.get("semantic_role", "") or ""),
        "structure_role": str(item.get("structure_role", "") or ""),
        "raw_block_type": str(item.get("raw_block_type", "") or ""),
        "normalized_sub_type": str(item.get("normalized_sub_type", "") or ""),
        "strip_candidate": _has_render_source_or_output_text(item),
    }


def _bbox_text_strip_page_indexes(translated_pages: dict[int, list[dict]]) -> list[int]:
    return [
        int(page_idx)
        for page_idx in sorted(translated_pages)
        if any(_is_bbox_text_strip_candidate(item) for item in translated_pages[page_idx])
    ]


def _is_bbox_text_strip_candidate(item: dict) -> bool:
    if item_block_kind(item) != "text":
        return False
    bbox = item.get("bbox", [])
    if len(bbox) != 4:
        return False
    if all(_float_or_zero(value) == 0.0 for value in bbox):
        return False
    return _has_render_source_or_output_text(item)


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
        "bbox_text_strip_algorithm": BBOX_TEXT_STRIP_ALGORITHM_VERSION,
        "hidden_text_strip_algorithm": HIDDEN_TEXT_STRIP_ALGORITHM_VERSION,
        "image_compression_algorithm": IMAGE_COMPRESSION_ALGORITHM_VERSION,
        "geometry_adjustment_algorithm": GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION,
    }


def start_render_source_prewarm(spec: RenderPrewarmSpec) -> RenderPrewarmHandle:
    manifest_path = prewarm_manifest_path_from_artifacts_dir(spec.artifacts_dir)
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="render-prewarm")
    future = executor.submit(_run_render_source_prewarm, spec, manifest_path)
    return RenderPrewarmHandle(manifest_path=manifest_path, future=future, executor=executor)


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
    manifest = _load_matching_manifest(
        manifest_path=manifest_path,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        effective_render_mode=effective_render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
    )
    if manifest is None:
        return None
    try:
        render_source = dict(manifest.get("render_source") or {})
        render_source_path = _resolve_manifest_path(Path(manifest_path), render_source.get("path"))
        if render_source_path is None or not render_source_path.exists():
            print("render prewarm: source file missing; fallback to synchronous render source prep", flush=True)
            return None
        print(f"render prewarm: hit source={render_source_path}", flush=True)
        return RenderSourcePdf(
            path=render_source_path,
            temp_paths=[],
            image_compressed=bool(render_source.get("image_compressed")),
            bbox_text_stripped_page_indices=frozenset(_int_list(render_source.get("bbox_text_stripped_page_indices"))),
            bbox_text_strip_skipped_page_indices=frozenset(_int_list(render_source.get("bbox_text_strip_skipped_page_indices"))),
            source_text_precleaned_page_indices=frozenset(_int_list(render_source.get("source_text_precleaned_page_indices"))),
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
    manifest = _load_matching_manifest(
        manifest_path=manifest_path,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages,
        effective_render_mode=effective_render_mode,
        start_page=start_page,
        end_page=end_page,
        pdf_compress_dpi=pdf_compress_dpi,
        source_cleanup_strategy=source_cleanup_strategy,
    )
    if manifest is None:
        return None
    payload = dict(manifest.get("payload_prewarm") or {})
    first_line_indent_lookup = {
        str(key): float(value)
        for key, value in dict(payload.get("first_line_indent_by_item_id") or {}).items()
        if _float_or_none(value) is not None
    }
    effective_inner_bbox_lookup = {
        str(key): bbox
        for key, value in dict(payload.get("effective_inner_bbox_by_item_id") or {}).items()
        if (bbox := _bbox_list_from_value(value)) is not None
    }
    bbox_candidates = _bbox_candidates_from_manifest(payload.get("bbox_text_strip_candidates"))
    if (
        not first_line_indent_lookup
        and not effective_inner_bbox_lookup
        and bbox_candidates is None
    ):
        return None
    print(
        f"render payload prewarm: hit indents={len(first_line_indent_lookup)} "
        f"geometry={len(effective_inner_bbox_lookup)} "
        f"bbox_pages={len(bbox_candidates.page_rects) if bbox_candidates is not None else 0}",
        flush=True,
    )
    return RenderPayloadPrewarm(
        first_line_indent_lookup=first_line_indent_lookup,
        effective_inner_bbox_lookup=effective_inner_bbox_lookup,
        bbox_text_strip_candidates=bbox_candidates,
    )


def _load_matching_manifest(
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
        if manifest.get("fingerprint") != expected:
            print("render prewarm: manifest fingerprint mismatch; fallback to synchronous render source prep", flush=True)
            return None
        return manifest
    except Exception as exc:
        print(f"render prewarm: load failed {type(exc).__name__}: {exc}; fallback", flush=True)
        return None


def _run_render_source_prewarm(spec: RenderPrewarmSpec, manifest_path: Path) -> Path | None:
    started = time.perf_counter()
    try:
        prewarm_dir = manifest_path.parent
        prewarm_dir.mkdir(parents=True, exist_ok=True)
        effective_render_mode = resolve_effective_render_mode(
            render_mode=spec.render_mode,
            source_pdf_path=spec.source_pdf_path,
            start_page=spec.start_page,
            end_page=spec.end_page,
            translated_pages_map=_pages_for_prewarm_mode_probe(spec.translated_pages),
        )
        prepared = build_render_source_pdf(
            source_pdf_path=spec.source_pdf_path,
            output_pdf_path=prewarm_dir / spec.output_pdf_path.name,
            pdf_compress_dpi=spec.pdf_compress_dpi,
            translated_pages=spec.translated_pages,
            strip_hidden_text=effective_render_mode != "overlay",
            start_page=spec.start_page,
            end_page=spec.end_page,
            artifact_mode=True,
            source_cleanup_strategy=spec.source_cleanup_strategy,
        )
        payload_prewarm = _build_payload_prewarm(
            source_pdf_path=spec.source_pdf_path,
            translated_pages=spec.translated_pages,
            manifest_path=manifest_path,
            source_cleanup_strategy=spec.source_cleanup_strategy,
        )
        manifest = _build_manifest(
            manifest_path=manifest_path,
            prepared=prepared,
            fingerprint=build_render_prewarm_fingerprint(
                source_pdf_path=spec.source_pdf_path,
                translated_pages=spec.translated_pages,
                effective_render_mode=effective_render_mode,
                start_page=spec.start_page,
                end_page=spec.end_page,
                pdf_compress_dpi=spec.pdf_compress_dpi,
                source_cleanup_strategy=spec.source_cleanup_strategy,
            ),
            elapsed=time.perf_counter() - started,
            payload_prewarm=payload_prewarm,
        )
        _write_json_atomic(manifest_path, manifest)
        print(f"render prewarm: ready elapsed={time.perf_counter() - started:.2f}s manifest={manifest_path}", flush=True)
        return manifest_path
    except Exception as exc:
        print(f"render prewarm: failed {type(exc).__name__}: {exc}", flush=True)
        return None


def _build_manifest(
    *,
    manifest_path: Path,
    prepared: RenderSourcePdf,
    fingerprint: dict[str, Any],
    elapsed: float,
    payload_prewarm: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "schema": RENDER_PREWARM_SCHEMA,
        "fingerprint": fingerprint,
        "render_source": {
            "path": _relative_to_manifest(manifest_path, prepared.path),
            "image_compressed": prepared.image_compressed,
            "bbox_text_stripped_page_indices": sorted(prepared.bbox_text_stripped_page_indices),
            "bbox_text_strip_skipped_page_indices": sorted(prepared.bbox_text_strip_skipped_page_indices),
            "source_text_precleaned_page_indices": sorted(prepared.source_text_precleaned_page_indices),
        },
        "payload_prewarm": payload_prewarm or {},
        "elapsed_seconds": round(float(elapsed), 3),
    }


def _build_payload_prewarm(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    manifest_path: Path,
    source_cleanup_strategy: str = "pikepdf_text_strip",
) -> dict[str, Any]:
    started = time.perf_counter()
    prepared_pages = apply_render_pages_policy_fields(
        prepare_render_payloads_by_page(translated_pages, source_pdf_path=source_pdf_path)
    )
    first_line_indent_by_item_id: dict[str, float] = {}
    effective_inner_bbox_by_item_id: dict[str, list[float]] = {}
    for items in prepared_pages.values():
        for item in items:
            item_id = str(item.get("item_id", "") or "")
            indent_pt = get_render_first_line_indent_pt(item)
            if item_id and indent_pt is not None and indent_pt > 0:
                first_line_indent_by_item_id[item_id] = round(indent_pt, 2)
    page_widths = _page_widths_by_index(source_pdf_path)
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
    if layout.use_bbox_text_strip_cleanup(source_cleanup_strategy):
        try:
            bbox_candidates = build_bbox_text_strip_candidates(
                source_pdf_path=source_pdf_path,
                translated_pages=translated_pages,
                skip_formula_pages=False,
            )
            bbox_payload = _bbox_candidates_to_manifest(bbox_candidates)
        except Exception as exc:
            print(f"render payload prewarm: bbox candidate build failed {type(exc).__name__}: {exc}", flush=True)
            bbox_payload = {}
    else:
        bbox_payload = {}
    print(
        f"render payload prewarm: ready indents={len(first_line_indent_by_item_id)} "
        f"geometry={len(effective_inner_bbox_by_item_id)} "
        f"elapsed={time.perf_counter() - started:.2f}s",
        flush=True,
    )
    return {
        "first_line_indent_algorithm": FIRST_LINE_INDENT_ALGORITHM_VERSION,
        "first_line_indent_by_item_id": first_line_indent_by_item_id,
        "geometry_adjustment_algorithm": GEOMETRY_ADJUSTMENT_ALGORITHM_VERSION,
        "effective_inner_bbox_by_item_id": effective_inner_bbox_by_item_id,
        "bbox_text_strip_candidates": bbox_payload,
    }


def _page_widths_by_index(source_pdf_path: Path) -> dict[int, float]:
    try:
        with fitz.open(source_pdf_path) as doc:
            return {index: float(page.rect.width) for index, page in enumerate(doc)}
    except Exception:
        return {}


def _page_sizes_by_index(source_pdf_path: Path) -> dict[int, tuple[float, float]]:
    try:
        with fitz.open(source_pdf_path) as doc:
            return {index: (float(page.rect.width), float(page.rect.height)) for index, page in enumerate(doc)}
    except Exception:
        return {}


def _bbox_candidates_to_manifest(candidates: BBoxTextStripCandidates) -> dict[str, Any]:
    return {
        "algorithm": BBOX_TEXT_STRIP_ALGORITHM_VERSION,
        "page_rects": {
            str(page_idx): [list(rect) for rect in rects]
            for page_idx, rects in sorted(candidates.page_rects.items())
        },
        "page_protected_rects": {
            str(page_idx): [list(rect) for rect in rects]
            for page_idx, rects in sorted((candidates.page_protected_rects or {}).items())
        },
        "pages_skipped_complex": candidates.pages_skipped_complex,
        "pages_skipped_no_text_overlap": candidates.pages_skipped_no_text_overlap,
        "skipped_complex_page_indices": sorted(candidates.skipped_complex_page_indices),
        "skipped_no_text_overlap_page_indices": sorted(candidates.skipped_no_text_overlap_page_indices),
    }


def _bbox_candidates_from_manifest(value: object) -> BBoxTextStripCandidates | None:
    payload = dict(value or {})
    if payload.get("algorithm") != BBOX_TEXT_STRIP_ALGORITHM_VERSION:
        return None
    page_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = {}
    page_protected_rects: dict[int, tuple[tuple[float, float, float, float], ...]] = {}
    for page_key, raw_rects in dict(payload.get("page_rects") or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        rects: list[tuple[float, float, float, float]] = []
        for raw_rect in raw_rects if isinstance(raw_rects, list) else []:
            rect = _rect_tuple_from_value(raw_rect)
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
            rect = _rect_tuple_from_value(raw_rect)
            if rect is not None:
                rects.append(rect)
        if rects:
            page_protected_rects[page_idx] = tuple(rects)
    if not page_rects and not payload.get("skipped_complex_page_indices") and not payload.get("skipped_no_text_overlap_page_indices"):
        return None
    return BBoxTextStripCandidates(
        page_rects=page_rects,
        page_protected_rects=page_protected_rects,
        pages_skipped_complex=int(payload.get("pages_skipped_complex") or 0),
        pages_skipped_no_text_overlap=int(payload.get("pages_skipped_no_text_overlap") or 0),
        skipped_complex_page_indices=frozenset(_int_list(payload.get("skipped_complex_page_indices"))),
        skipped_no_text_overlap_page_indices=frozenset(_int_list(payload.get("skipped_no_text_overlap_page_indices"))),
    )


def _rect_tuple_from_value(value: object) -> tuple[float, float, float, float] | None:
    if not isinstance(value, list) or len(value) != 4:
        return None
    rect = tuple(_float_or_none(item) for item in value)
    if any(item is None for item in rect):
        return None
    return (float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3]))  # type: ignore[arg-type]


def _bbox_list_from_value(value: object) -> list[float] | None:
    rect = _rect_tuple_from_value(value)
    if rect is None:
        return None
    return [float(rect[0]), float(rect[1]), float(rect[2]), float(rect[3])]


def _pages_for_prewarm_mode_probe(translated_pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    probed: dict[int, list[dict]] = {}
    for page_idx, items in translated_pages.items():
        probed_items: list[dict] = []
        for item in items:
            clone = dict(item)
            if not str(
                clone.get("render_protected_text")
                or clone.get("protected_translated_text")
                or clone.get("translated_text")
                or ""
            ).strip():
                source_text = str(
                    clone.get("translation_unit_protected_source_text")
                    or clone.get("protected_source_text")
                    or clone.get("source_text")
                    or ""
                ).strip()
                if source_text:
                    clone["render_protected_text"] = source_text
            probed_items.append(clone)
        probed[page_idx] = probed_items
    return probed


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with tmp_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    tmp_path.replace(path)


def _relative_to_manifest(manifest_path: Path, path: Path) -> str:
    try:
        return str(Path(path).resolve().relative_to(manifest_path.parent.resolve()))
    except Exception:
        return str(Path(path).resolve())


def _resolve_manifest_path(manifest_path: Path, value: object) -> Path | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    path = Path(raw)
    return path if path.is_absolute() else manifest_path.parent / path


def _float_or_zero(value: object) -> float:
    try:
        return round(float(value), 3)
    except Exception:
        return 0.0


def _float_or_none(value: object) -> float | None:
    try:
        return float(value)
    except Exception:
        return None


def _int_or_default(value: object, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return int(default)


def _has_render_source_or_output_text(item: dict) -> bool:
    return bool(
        str(
            item.get("render_protected_text")
            or item.get("protected_translated_text")
            or item.get("translated_text")
            or item.get("render_text")
            or item.get("translation_unit_protected_source_text")
            or item.get("protected_source_text")
            or item.get("source_text")
            or ""
        ).strip()
    )


def _int_list(value: object) -> list[int]:
    if not isinstance(value, list):
        return []
    result: list[int] = []
    for item in value:
        try:
            result.append(int(item))
        except Exception:
            continue
    return result


__all__ = [
    "RenderPrewarmHandle",
    "RenderPrewarmSpec",
    "prewarm_manifest_path_from_artifacts_dir",
    "prewarm_manifest_path_from_translations_dir",
    "start_render_source_prewarm",
    "try_load_prewarmed_render_source_pdf",
    "try_load_render_payload_prewarm",
]

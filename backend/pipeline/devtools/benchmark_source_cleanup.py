from __future__ import annotations

import argparse
from dataclasses import replace
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
from typing import Any

import fitz


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))


from retainpdf_pipeline.render.source_cleanup import SourceCleanupOptions
from retainpdf_pipeline.render.source_cleanup import SourceCleanupRequest
from retainpdf_pipeline.render.source_cleanup import execute_source_cleanup
from retainpdf_pipeline.render.source_cleanup.pdf.document import strip_bbox_text_rects_from_pdf_copy
from retainpdf_pipeline.render.source_cleanup.types import BBOX_TEXT_STRIP_CANDIDATE_SOURCE_MANIFEST
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripCandidates
from retainpdf_pipeline.render.source.prewarm_manifest import int_list
from retainpdf_pipeline.render.source.prewarm_manifest import rect_tuple_from_value
from retainpdf_pipeline.render.source.prewarm_manifest_io import bbox_candidates_from_manifest
from retainpdf_pipeline.render.source.prewarm import RenderPrewarmSpec
from retainpdf_pipeline.render.source.prewarm import start_render_source_prewarm
from retainpdf_pipeline.render.source.prewarm_payload import build_payload_prewarm


DEFAULT_SOURCE_PDF = REPO_ROOT / "data" / "temPDF" / "test3.pdf"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "tmp" / "render-source-cleanup-benchmark"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark RetainPDF render source cleanup without running translation or Typst compile.",
    )
    parser.add_argument("--source-pdf", type=Path, default=DEFAULT_SOURCE_PDF)
    parser.add_argument("--translated-pages-json", type=Path, default=None)
    parser.add_argument("--translations-dir", type=Path, default=None)
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--workers", type=int, default=0, help="Override RETAIN_BBOX_TEXT_STRIP_WORKERS. 0 keeps default.")
    parser.add_argument("--max-pages", type=int, default=0, help="Limit candidate/translated pages. 0 means all.")
    parser.add_argument("--payload-prewarm", action="store_true", help="Benchmark render payload prewarm instead of source cleanup.")
    parser.add_argument("--full-prewarm", action="store_true", help="Benchmark full render source prewarm.")
    parser.add_argument("--render-mode", default="typst", help="Effective render mode used for payload prewarm.")
    parser.add_argument("--ignore-manifest", action="store_true", help="Force fresh planning when translated pages are provided.")
    parser.add_argument("--keep-outputs", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    started = time.perf_counter()
    source_pdf = args.source_pdf.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    output_pdf = output_dir / "source-cleaned.pdf"
    output_pdf.unlink(missing_ok=True)

    manifest_algorithm, manifest_candidates = (
        ("", None) if args.ignore_manifest else _load_manifest_candidates(args.manifest)
    )
    translated_pages = _load_translated_pages(
        args.translated_pages_json,
        translations_dir=args.translations_dir,
        max_pages=args.max_pages,
    )
    candidates = _limit_candidates(manifest_candidates, max_pages=args.max_pages)

    previous_workers = os.environ.get("RETAIN_BBOX_TEXT_STRIP_WORKERS")
    if args.workers > 0:
        os.environ["RETAIN_BBOX_TEXT_STRIP_WORKERS"] = str(args.workers)
    try:
        if args.full_prewarm:
            if translated_pages is None:
                raise SystemExit("--full-prewarm requires --translations-dir or --translated-pages-json.")
            handle = start_render_source_prewarm(
                RenderPrewarmSpec(
                    source_pdf_path=source_pdf,
                    output_pdf_path=output_pdf,
                    artifacts_dir=output_dir / "artifacts",
                    translated_pages=translated_pages,
                    render_mode=args.render_mode,
                    start_page=0,
                    end_page=-1,
                    pdf_compress_dpi=0,
                    source_cleanup_strategy="pikepdf_text_strip",
                )
            )
            manifest_path = handle.wait()
            print(
                json.dumps(
                    {
                        "ok": manifest_path is not None,
                        "mode": "full_prewarm",
                        "source_pdf": str(source_pdf),
                        "translations_dir": str(args.translations_dir.resolve()) if args.translations_dir is not None else "",
                        "translated_pages_json": str(args.translated_pages_json.resolve()) if args.translated_pages_json is not None else "",
                        "max_pages": int(args.max_pages or 0),
                        "render_mode": args.render_mode,
                        "manifest": str(manifest_path or ""),
                        "elapsed_seconds": round(time.perf_counter() - started, 3),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                )
            )
            if not args.keep_outputs:
                shutil.rmtree(output_dir, ignore_errors=True)
            return
        if args.payload_prewarm:
            if translated_pages is None:
                raise SystemExit("--payload-prewarm requires --translations-dir or --translated-pages-json.")
            payload = build_payload_prewarm(
                source_pdf_path=source_pdf,
                translated_pages=translated_pages,
                manifest_path=output_dir / "render_source_prewarm_manifest.json",
                effective_render_mode=args.render_mode,
                source_cleanup_strategy="pikepdf_text_strip",
                bbox_text_strip_candidates=candidates,
            )
            result = None
            mode = "payload_prewarm"
        elif translated_pages is not None:
            result = execute_source_cleanup(
                SourceCleanupRequest(
                    source_pdf_path=source_pdf,
                    output_pdf_path=output_pdf,
                    translated_pages=translated_pages,
                    candidates=candidates,
                    options=SourceCleanupOptions(strategy="pikepdf_text_strip"),
                )
            ).bbox_text_strip
            mode = "source_cleanup"
        elif candidates is not None:
            result = strip_bbox_text_rects_from_pdf_copy(
                source_pdf_path=source_pdf,
                output_pdf_path=output_pdf,
                page_rects=candidates.fitz_page_rects(),
                page_protected_rects=candidates.fitz_page_protected_rects(),
                skip_form_xobject_pages=True,
                pre_skipped_form_xobject_page_indices=candidates.skipped_form_xobject_page_indices,
                pre_strip_no_effect_page_indices=candidates.strip_no_effect_page_indices,
                candidate_source=candidates.candidate_source,
            )
            mode = "rewrite_only"
        else:
            raise SystemExit("Provide --translated-pages-json for fresh planning or --manifest for rewrite-only benchmarking.")
    finally:
        if args.workers > 0:
            if previous_workers is None:
                os.environ.pop("RETAIN_BBOX_TEXT_STRIP_WORKERS", None)
            else:
                os.environ["RETAIN_BBOX_TEXT_STRIP_WORKERS"] = previous_workers

    if args.payload_prewarm:
        bbox_payload = dict(payload.get("bbox_text_strip_candidates") or {})
        payload_summary = {
            "first_line_indents": len(dict(payload.get("first_line_indent_by_item_id") or {})),
            "geometry_adjustments": len(dict(payload.get("effective_inner_bbox_by_item_id") or {})),
            "bbox_candidate_pages": len(dict(bbox_payload.get("page_rects") or {})),
            "background_render_page_specs": len(
                list(dict(payload.get("background_render_page_specs") or {}).get("page_specs") or [])
            ),
            "render_color_items": len(
                dict(dict(payload.get("render_color_profile") or {}).get("colors_by_item_id") or {})
            ),
        }
        print(
            json.dumps(
                {
                    "ok": True,
                    "mode": mode,
                    "source_pdf": str(source_pdf),
                    "translations_dir": str(args.translations_dir.resolve()) if args.translations_dir is not None else "",
                    "translated_pages_json": str(args.translated_pages_json.resolve()) if args.translated_pages_json is not None else "",
                    "max_pages": int(args.max_pages or 0),
                    "render_mode": args.render_mode,
                    **payload_summary,
                    "elapsed_seconds": round(time.perf_counter() - started, 3),
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        if not args.keep_outputs:
            shutil.rmtree(output_dir, ignore_errors=True)
        return

    result_candidates = result.candidates or candidates
    summary = {
        "ok": True,
        "mode": mode,
        "source_pdf": str(source_pdf),
        "manifest": str(args.manifest.resolve()) if args.manifest is not None else "",
        "manifest_algorithm": manifest_algorithm,
        "translated_pages_json": str(args.translated_pages_json.resolve()) if args.translated_pages_json is not None else "",
        "translations_dir": str(args.translations_dir.resolve()) if args.translations_dir is not None else "",
        "output_pdf": str(output_pdf) if output_pdf.exists() else "",
        "workers": int(args.workers or 0),
        "max_pages": int(args.max_pages or 0),
        "candidate_source": result_candidates.candidate_source if result_candidates is not None else "fresh_plan",
        "candidate_pages": len(result_candidates.page_rects) if result_candidates is not None else 0,
        "changed": result.changed,
        "pages_changed": result.pages_changed,
        "text_show_ops_removed": result.text_show_ops_removed,
        "pages_skipped_complex": result.pages_skipped_complex,
        "pages_skipped_no_text_overlap": result.pages_skipped_no_text_overlap,
        "pages_skipped_visual_background": result.pages_skipped_visual_background,
        "pages_skipped_form_xobject": result.pages_skipped_form_xobject,
        "pages_strip_no_effect": result.pages_strip_no_effect,
        "changed_page_indices": _index_summary(result.changed_page_indices),
        "skipped_complex_page_indices": _index_summary(result.skipped_complex_page_indices),
        "skipped_no_text_overlap_page_indices": _index_summary(result.skipped_no_text_overlap_page_indices),
        "skipped_visual_background_page_indices": _index_summary(result.skipped_visual_background_page_indices),
        "skipped_form_xobject_page_indices": _index_summary(result.skipped_form_xobject_page_indices),
        "strip_no_effect_page_indices": _index_summary(result.strip_no_effect_page_indices),
        "elapsed_seconds": round(time.perf_counter() - started, 3),
    }
    print(json.dumps(summary, ensure_ascii=False, sort_keys=True))

    if not args.keep_outputs:
        shutil.rmtree(output_dir, ignore_errors=True)


def _load_manifest_candidates(manifest_path: Path | None) -> tuple[str, BBoxTextStripCandidates | None]:
    if manifest_path is None:
        return "", None
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload = dict(manifest.get("payload_prewarm") or {}).get("bbox_text_strip_candidates")
    algorithm = str(dict(payload or {}).get("algorithm") or "")
    current = bbox_candidates_from_manifest(payload)
    if current is not None:
        return algorithm, current
    return algorithm, _legacy_manifest_candidates(payload)


def _legacy_manifest_candidates(value: object) -> BBoxTextStripCandidates | None:
    payload = dict(value or {})
    page_rects = _legacy_page_rects(payload.get("page_rects"))
    page_protected_rects = _legacy_page_rects(payload.get("page_protected_rects"))
    if not page_rects:
        return None
    return BBoxTextStripCandidates(
        page_rects=page_rects,
        page_protected_rects=page_protected_rects,
        candidate_source=BBOX_TEXT_STRIP_CANDIDATE_SOURCE_MANIFEST,
        pages_skipped_complex=int(payload.get("pages_skipped_complex") or 0),
        pages_skipped_no_text_overlap=int(payload.get("pages_skipped_no_text_overlap") or 0),
        pages_skipped_visual_background=int(payload.get("pages_skipped_visual_background") or 0),
        pages_skipped_form_xobject=int(payload.get("pages_skipped_form_xobject") or 0),
        pages_strip_no_effect=int(payload.get("pages_strip_no_effect") or 0),
        skipped_complex_page_indices=frozenset(int_list(payload.get("skipped_complex_page_indices"))),
        skipped_no_text_overlap_page_indices=frozenset(int_list(payload.get("skipped_no_text_overlap_page_indices"))),
        skipped_visual_background_page_indices=frozenset(int_list(payload.get("skipped_visual_background_page_indices"))),
        skipped_form_xobject_page_indices=frozenset(int_list(payload.get("skipped_form_xobject_page_indices"))),
        strip_no_effect_page_indices=frozenset(int_list(payload.get("strip_no_effect_page_indices"))),
    )


def _legacy_page_rects(value: object) -> dict[int, tuple[tuple[float, float, float, float], ...]]:
    result: dict[int, tuple[tuple[float, float, float, float], ...]] = {}
    for page_key, raw_rects in dict(value or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        rects = tuple(
            rect
            for raw_rect in (raw_rects if isinstance(raw_rects, list) else [])
            if (rect := rect_tuple_from_value(raw_rect)) is not None
        )
        if rects:
            result[page_idx] = rects
    return result


def _load_translated_pages(
    path: Path | None,
    *,
    translations_dir: Path | None,
    max_pages: int,
) -> dict[int, list[dict]] | None:
    if translations_dir is not None:
        return _load_translations_dir(translations_dir, max_pages=max_pages)
    if path is None:
        return None
    value = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(value, dict) and "pages" in value:
        value = value["pages"]
    pages: dict[int, list[dict]] = {}
    if isinstance(value, dict):
        for key, items in value.items():
            try:
                page_idx = int(key)
            except Exception:
                continue
            if isinstance(items, list):
                pages[page_idx] = [dict(item) for item in items if isinstance(item, dict)]
    elif isinstance(value, list):
        for index, items in enumerate(value):
            if isinstance(items, list):
                pages[index] = [dict(item) for item in items if isinstance(item, dict)]
            elif isinstance(items, dict):
                page_idx = int(items.get("page_index", index) or index)
                blocks = items.get("items") or items.get("blocks") or []
                if isinstance(blocks, list):
                    pages[page_idx] = [dict(item) for item in blocks if isinstance(item, dict)]
    if max_pages > 0:
        selected = set(sorted(pages)[:max_pages])
        pages = {page_idx: items for page_idx, items in pages.items() if page_idx in selected}
    return pages


def _load_translations_dir(translations_dir: Path, *, max_pages: int) -> dict[int, list[dict]]:
    pages: dict[int, list[dict]] = {}
    page_files = sorted(translations_dir.glob("page-*-deepseek.json"))
    for path in page_files:
        page_idx = _page_idx_from_translation_path(path)
        if page_idx is None:
            continue
        raw_items = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(raw_items, list):
            pages[page_idx] = [dict(item) for item in raw_items if isinstance(item, dict)]
    if max_pages > 0:
        selected = set(sorted(pages)[:max_pages])
        pages = {page_idx: items for page_idx, items in pages.items() if page_idx in selected}
    return pages


def _page_idx_from_translation_path(path: Path) -> int | None:
    match = re.fullmatch(r"page-(\d+)-deepseek", path.stem)
    if match is None:
        return None
    return max(0, int(match.group(1)) - 1)


def _limit_candidates(candidates: BBoxTextStripCandidates | None, *, max_pages: int) -> BBoxTextStripCandidates | None:
    if candidates is None or max_pages <= 0:
        return candidates
    selected = set(sorted(candidates.page_rects)[:max_pages])
    return replace(
        candidates,
        page_rects={page_idx: rects for page_idx, rects in candidates.page_rects.items() if page_idx in selected},
        page_protected_rects={
            page_idx: rects
            for page_idx, rects in (candidates.page_protected_rects or {}).items()
            if page_idx in selected
        },
    )


def _index_summary(indices: frozenset[int]) -> dict[str, object]:
    ordered = sorted(indices)
    return {
        "count": len(ordered),
        "head": ordered[:20],
        "tail": ordered[-20:] if len(ordered) > 20 else [],
    }


if __name__ == "__main__":
    main()

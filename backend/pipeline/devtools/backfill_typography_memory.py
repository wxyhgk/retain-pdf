#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time

import fitz


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))


from retainpdf_pipeline.render.translation_loader import load_translated_pages
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.translate.public import TRANSLATION_MANIFEST_FILE_NAME


def main() -> None:
    args = _parse_args()
    jobs_root = Path(args.jobs_root).resolve()
    started = time.perf_counter()
    results: list[dict[str, object]] = []
    processed = 0
    skipped = 0
    failed = 0
    for job_dir in _iter_job_dirs(jobs_root, args.job_id):
        if args.limit > 0 and processed >= args.limit:
            break
        result = _process_job(
            job_dir,
            max_pages=args.max_pages,
            detect_first_line_indent=args.detect_first_line_indent,
        )
        results.append(result)
        status = str(result["status"])
        if status == "ok":
            processed += 1
            print(
                "typography memory backfill ok "
                f"job={job_dir.name} pages={result['pages']} items={result['items']} "
                f"elapsed={result['elapsed_seconds']:.2f}s",
                flush=True,
            )
        elif status == "skipped":
            skipped += 1
        else:
            failed += 1
            if args.verbose_failures:
                print(f"typography memory backfill failed job={job_dir.name} error={result['error']}", flush=True)
    summary = {
        "jobs_root": str(jobs_root),
        "processed": processed,
        "skipped": skipped,
        "failed": failed,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "results": results,
    }
    if args.report:
        report_path = Path(args.report).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key != "results"}, ensure_ascii=False), flush=True)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill the global typography memory from existing translated jobs.")
    parser.add_argument("--jobs-root", default="data/jobs", help="Root directory containing job folders.")
    parser.add_argument("--job-id", action="append", default=[], help="Limit backfill to one or more job ids.")
    parser.add_argument("--limit", type=int, default=0, help="Maximum number of jobs to process; 0 means unlimited.")
    parser.add_argument("--max-pages", type=int, default=0, help="Maximum translated pages per job; 0 means all pages.")
    parser.add_argument("--report", default="", help="Optional JSON report path.")
    parser.add_argument(
        "--detect-first-line-indent",
        action="store_true",
        help="Use source PDF probing for first-line indent. Slower and may print MuPDF warnings.",
    )
    parser.add_argument("--verbose-failures", action="store_true", help="Print every failed/skipped job reason.")
    return parser.parse_args()


def _iter_job_dirs(jobs_root: Path, job_ids: list[str]) -> list[Path]:
    if job_ids:
        return [jobs_root / job_id for job_id in job_ids]
    return sorted(path for path in jobs_root.iterdir() if path.is_dir())


def _process_job(job_dir: Path, *, max_pages: int, detect_first_line_indent: bool) -> dict[str, object]:
    started = time.perf_counter()
    source_pdf = _source_pdf_for_job(job_dir)
    translations_dir = job_dir / "translated"
    manifest = translations_dir / TRANSLATION_MANIFEST_FILE_NAME
    if source_pdf is None:
        return _result(job_dir, "skipped", started, error="missing source pdf")
    if not manifest.exists():
        return _result(job_dir, "skipped", started, error="missing translation manifest")
    try:
        translated_pages = load_translated_pages(translations_dir, manifest_path=manifest)
        if max_pages > 0:
            translated_pages = {
                page_idx: items
                for page_idx, items in sorted(translated_pages.items())[:max_pages]
            }
        prepared = prepare_translated_pages_for_render(
            source_pdf if detect_first_line_indent else None,
            translated_pages,
        )
        learned_items = _learn_from_prepared_pages(source_pdf, prepared)
        return _result(
            job_dir,
            "ok",
            started,
            pages=len(prepared),
            items=learned_items,
            source_pdf=str(source_pdf),
        )
    except Exception as exc:
        message = f"{type(exc).__name__}: {exc}"
        if _is_legacy_translation_payload_error(message):
            return _result(job_dir, "skipped", started, error=message)
        return _result(job_dir, "failed", started, error=message)


def _source_pdf_for_job(job_dir: Path) -> Path | None:
    source_dir = job_dir / "source"
    if not source_dir.exists():
        return None
    pdfs = sorted(path for path in source_dir.iterdir() if path.is_file() and path.suffix.lower() == ".pdf")
    return pdfs[0] if pdfs else None


def _learn_from_prepared_pages(source_pdf: Path, prepared: dict[int, list[dict]]) -> int:
    learned_items = 0
    source_doc = fitz.open(source_pdf)
    try:
        for page_idx, items in sorted(prepared.items()):
            if page_idx < 0 or page_idx >= len(source_doc):
                continue
            page = source_doc[page_idx]
            blocks = build_render_blocks(
                items,
                page_width=page.rect.width,
                page_height=page.rect.height,
            )
            learned_items += len(blocks)
    finally:
        source_doc.close()
    return learned_items


def _result(
    job_dir: Path,
    status: str,
    started: float,
    *,
    pages: int = 0,
    items: int = 0,
    source_pdf: str = "",
    error: str = "",
) -> dict[str, object]:
    return {
        "job_id": job_dir.name,
        "status": status,
        "pages": pages,
        "items": items,
        "source_pdf": source_pdf,
        "error": error,
        "elapsed_seconds": round(time.perf_counter() - started, 3),
    }


def _is_legacy_translation_payload_error(message: str) -> bool:
    return "missing strict contract fields" in message or "invalid translation payload" in message


if __name__ == "__main__":
    main()

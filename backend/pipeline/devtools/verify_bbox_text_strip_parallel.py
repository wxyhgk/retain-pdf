from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
from typing import Any

import fitz


SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SCRIPTS_ROOT.parents[1]
sys.path.insert(0, str(SCRIPTS_ROOT))


from retainpdf_pipeline.render.source_cleanup.pdf.document import strip_bbox_text_rects_from_pdf_copy
from retainpdf_pipeline.render.source_cleanup.types import BBoxTextStripResult


DEFAULT_SOURCE_PDF = REPO_ROOT / "data" / "temPDF" / "test3.pdf"
DEFAULT_MANIFEST = REPO_ROOT / "tmp" / "test3-paddle-rampup" / "artifacts" / "render_prewarm" / "render_source_prewarm_manifest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify bbox text strip serial/parallel consistency on a real PDF sample.",
    )
    parser.add_argument("--source-pdf", type=Path, default=DEFAULT_SOURCE_PDF)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output-dir", type=Path, default=REPO_ROOT / "tmp" / "bbox-text-strip-parallel-verify")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--max-pages", type=int, default=0, help="Limit candidate pages for a faster smoke run. 0 means all.")
    parser.add_argument("--keep-outputs", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    started = time.perf_counter()
    source_pdf = args.source_pdf.resolve()
    manifest_path = args.manifest.resolve()
    output_dir = args.output_dir.resolve()

    candidates = _load_candidates(manifest_path, max_pages=int(args.max_pages or 0))
    if not candidates["page_rects"]:
        raise SystemExit(f"No bbox strip candidates found in manifest: {manifest_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    serial_pdf = output_dir / "serial.pdf"
    parallel_pdf = output_dir / "parallel.pdf"
    serial_result = _run_strip(
        source_pdf=source_pdf,
        output_pdf=serial_pdf,
        workers=1,
        candidates=candidates,
    )
    parallel_result = _run_strip(
        source_pdf=source_pdf,
        output_pdf=parallel_pdf,
        workers=max(2, int(args.workers)),
        candidates=candidates,
    )

    serial_summary = _result_summary(serial_result)
    parallel_summary = _result_summary(parallel_result)
    if serial_summary != parallel_summary:
        raise SystemExit(
            "bbox text strip serial/parallel result mismatch:\n"
            f"serial={json.dumps(serial_summary, ensure_ascii=False, sort_keys=True)}\n"
            f"parallel={json.dumps(parallel_summary, ensure_ascii=False, sort_keys=True)}"
        )

    serial_digest = _pdf_text_digest(serial_pdf)
    parallel_digest = _pdf_text_digest(parallel_pdf)
    if serial_digest != parallel_digest:
        raise SystemExit(f"bbox text strip serial/parallel text digest mismatch: {serial_digest} != {parallel_digest}")

    print(
        json.dumps(
            {
                "ok": True,
                "source_pdf": str(source_pdf),
                "manifest": str(manifest_path),
                "candidate_pages": len(candidates["page_rects"]),
                "workers": int(args.workers),
                "result": serial_summary,
                "text_digest": serial_digest,
                "elapsed_seconds": round(time.perf_counter() - started, 3),
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )

    if not args.keep_outputs:
        shutil.rmtree(output_dir, ignore_errors=True)


def _load_candidates(manifest_path: Path, *, max_pages: int) -> dict[str, dict[int, list[fitz.Rect]]]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload = dict(manifest.get("payload_prewarm") or {}).get("bbox_text_strip_candidates") or {}
    page_rects = _load_page_rects(payload.get("page_rects"))
    page_protected_rects = _load_page_rects(payload.get("page_protected_rects"))
    if max_pages > 0:
        selected = set(sorted(page_rects)[:max_pages])
        page_rects = {page_idx: rects for page_idx, rects in page_rects.items() if page_idx in selected}
        page_protected_rects = {page_idx: rects for page_idx, rects in page_protected_rects.items() if page_idx in selected}
    return {"page_rects": page_rects, "page_protected_rects": page_protected_rects}


def _load_page_rects(raw: object) -> dict[int, list[fitz.Rect]]:
    result: dict[int, list[fitz.Rect]] = {}
    for page_key, raw_rects in dict(raw or {}).items():
        try:
            page_idx = int(page_key)
        except Exception:
            continue
        rects = []
        for raw_rect in raw_rects if isinstance(raw_rects, list) else []:
            if isinstance(raw_rect, list) and len(raw_rect) == 4:
                with contextlib.suppress(Exception):
                    rects.append(fitz.Rect([float(value) for value in raw_rect]))
        if rects:
            result[page_idx] = rects
    return result


def _run_strip(
    *,
    source_pdf: Path,
    output_pdf: Path,
    workers: int,
    candidates: dict[str, dict[int, list[fitz.Rect]]],
) -> BBoxTextStripResult:
    output_pdf.unlink(missing_ok=True)
    previous = os.environ.get("RETAIN_BBOX_TEXT_STRIP_WORKERS")
    os.environ["RETAIN_BBOX_TEXT_STRIP_WORKERS"] = str(workers)
    try:
        return strip_bbox_text_rects_from_pdf_copy(
            source_pdf_path=source_pdf,
            output_pdf_path=output_pdf,
            page_rects=candidates["page_rects"],
            page_protected_rects=candidates["page_protected_rects"],
            recurse_forms=True,
        )
    finally:
        if previous is None:
            os.environ.pop("RETAIN_BBOX_TEXT_STRIP_WORKERS", None)
        else:
            os.environ["RETAIN_BBOX_TEXT_STRIP_WORKERS"] = previous


def _result_summary(result: BBoxTextStripResult) -> dict[str, Any]:
    return {
        "changed": result.changed,
        "pages_changed": result.pages_changed,
        "text_show_ops_removed": result.text_show_ops_removed,
        "forms_changed": result.forms_changed,
        "pages_strip_no_effect": result.pages_strip_no_effect,
        "changed_page_indices": sorted(result.changed_page_indices),
        "strip_no_effect_page_indices": sorted(result.strip_no_effect_page_indices),
    }


def _pdf_text_digest(pdf_path: Path) -> str:
    digest = hashlib.sha256()
    with fitz.open(pdf_path) as doc:
        for page_idx, page in enumerate(doc):
            digest.update(f"page:{page_idx}\n".encode("utf-8"))
            digest.update(page.get_text("text").encode("utf-8", errors="replace"))
            digest.update(b"\n")
    return digest.hexdigest()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="retainpdf-import-") as _tmp:
        main()

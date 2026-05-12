from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import fitz


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_ROOT = REPO_ROOT / "backend" / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from foundation.shared.job_dirs import create_job_dirs
from services.translation.diagnostics.io import aggregate_payload_diagnostics


DEFAULT_SAMPLE = REPO_ROOT / "resources" / "samples" / "golden-pdfs" / "1.pdf"
GOLDEN_SAMPLE_ROOT = REPO_ROOT / "resources" / "samples" / "golden-pdfs"
GOLDEN_MANIFEST = GOLDEN_SAMPLE_ROOT / "manifest.csv"
PROVIDER_ENTRYPOINT = SCRIPTS_ROOT / "entrypoints" / "run_provider_case.py"
RENDER_ENTRYPOINT = SCRIPTS_ROOT / "entrypoints" / "run_render_only.py"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run and verify a RetainPDF golden OCR->translation->render flow.",
    )
    parser.add_argument("--pdf", type=str, default=str(DEFAULT_SAMPLE), help="Source PDF path.")
    parser.add_argument("--sample-id", type=str, default="", help="Golden sample id from resources/samples/golden-pdfs/manifest.csv.")
    parser.add_argument("--list-samples", action="store_true", help="List configured golden PDF samples and exit.")
    parser.add_argument("--check-manifest", action="store_true", help="Validate the golden PDF manifest and exit.")
    parser.add_argument("--job-id", type=str, default="", help="Optional job id. Default uses golden-fullflow timestamp.")
    parser.add_argument("--job-root", type=str, default="", help="Verify or render an existing job root.")
    parser.add_argument("--output-root", type=str, default=str(REPO_ROOT / "data" / "jobs"))
    parser.add_argument("--provider", type=str, default="paddle", choices=["paddle", "mineru"])
    parser.add_argument("--provider-credential-ref", type=str, default="env:RETAIN_PADDLE_API_TOKEN")
    parser.add_argument("--translation-credential-ref", type=str, default="env:RETAIN_TRANSLATION_API_KEY")
    parser.add_argument("--model", type=str, default="deepseek-v4-flash")
    parser.add_argument("--base-url", type=str, default="https://api.deepseek.com/v1")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--compile-workers", type=int, default=4)
    parser.add_argument("--render-mode", type=str, default="auto")
    parser.add_argument("--pdf-compress-dpi", type=int, default=0)
    parser.add_argument("--skip-run", action="store_true", help="Only verify an existing job.")
    parser.add_argument("--render-only", action="store_true", help="Render an existing translated job, then verify.")
    parser.add_argument("--no-render", action="store_true", help="Run provider flow but do not run extra render-only fallback.")
    parser.add_argument("--bbox-item", type=str, default="p001-b013", help="Item id to check Typst placement against OCR bbox.")
    return parser.parse_args()


def _load_manifest() -> list[dict[str, str]]:
    if not GOLDEN_MANIFEST.exists():
        raise RuntimeError(f"golden manifest not found: {GOLDEN_MANIFEST}")
    with GOLDEN_MANIFEST.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return rows


def _manifest_sample_rows(*, existing_only: bool = False) -> list[dict[str, str]]:
    rows = _load_manifest()
    if existing_only:
        rows = [row for row in rows if str(row.get("file", "") or "").strip()]
    return rows


def _sample_pdf(sample_id: str) -> Path:
    target = sample_id.strip()
    if not target:
        raise RuntimeError("--sample-id cannot be empty")
    matches = [row for row in _manifest_sample_rows(existing_only=True) if row.get("id") == target]
    if not matches:
        known = ", ".join(row.get("id", "") for row in _manifest_sample_rows(existing_only=True))
        raise RuntimeError(f"unknown golden sample id: {target}; known samples: {known}")
    sample_file = str(matches[0].get("file", "") or "").strip()
    path = GOLDEN_SAMPLE_ROOT / sample_file
    if not path.exists():
        raise RuntimeError(f"golden sample file does not exist: {path}")
    return path.resolve()


def _check_manifest() -> list[dict[str, str]]:
    rows = _load_manifest()
    seen: set[str] = set()
    errors: list[str] = []
    required = ("id", "file", "category", "pages", "focus", "notes")
    for idx, row in enumerate(rows, start=2):
        missing_columns = [key for key in required if key not in row]
        if missing_columns:
            errors.append(f"manifest row {idx}: missing columns {missing_columns}")
            continue
        sample_id = str(row.get("id", "") or "").strip()
        sample_file = str(row.get("file", "") or "").strip()
        if not sample_id:
            errors.append(f"manifest row {idx}: missing id")
        elif sample_id in seen:
            errors.append(f"manifest row {idx}: duplicate id '{sample_id}'")
        seen.add(sample_id)
        if sample_file:
            path = GOLDEN_SAMPLE_ROOT / sample_file
            if not path.exists():
                errors.append(f"manifest row {idx}: file not found: {sample_file}")
            elif path.suffix.lower() != ".pdf":
                errors.append(f"manifest row {idx}: file is not a PDF: {sample_file}")
    if errors:
        raise RuntimeError("golden manifest check failed:\n- " + "\n- ".join(errors))
    return rows


def _print_samples() -> None:
    rows = _check_manifest()
    available = [
        {
            "id": row.get("id", ""),
            "file": row.get("file", ""),
            "category": row.get("category", ""),
            "focus": row.get("focus", ""),
            "available": bool(str(row.get("file", "") or "").strip() and (GOLDEN_SAMPLE_ROOT / str(row.get("file", "") or "")).exists()),
        }
        for row in rows
    ]
    print(json.dumps(available, ensure_ascii=False, indent=2))


def _job_id() -> str:
    return f"golden-fullflow-{datetime.now().strftime('%Y%m%d%H%M%S')}"


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _save_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _provider_spec(args: argparse.Namespace, job_root: Path, source_pdf: Path) -> dict:
    return {
        "schema_version": "provider.stage.v1",
        "stage": "provider",
        "job": {
            "job_id": job_root.name,
            "job_root": str(job_root),
            "workflow": "book",
        },
        "source": {
            "file_path": str(source_pdf),
            "file_url": "",
        },
        "ocr": {
            "provider": args.provider,
            "credential_ref": args.provider_credential_ref,
            "model_version": "vlm",
            "paddle_api_url": "",
            "paddle_model": "PaddleOCR-VL-1.5",
            "is_ocr": False,
            "disable_formula": False,
            "disable_table": False,
            "language": "ch",
            "page_ranges": "",
            "data_id": "",
            "no_cache": False,
            "cache_tolerance": 900,
            "extra_formats": "",
            "poll_interval": 5,
            "poll_timeout": 1800,
        },
        "translation": {
            "start_page": 0,
            "end_page": -1,
            "batch_size": 1,
            "workers": args.workers,
            "mode": "sci",
            "math_mode": "direct_typst",
            "skip_title_translation": False,
            "classify_batch_size": 8,
            "rule_profile_name": "general_sci",
            "custom_rules_text": "",
            "glossary_id": "",
            "glossary_name": "",
            "glossary_resource_entry_count": 0,
            "glossary_inline_entry_count": 0,
            "glossary_overridden_entry_count": 0,
            "glossary_entries": [],
            "model": args.model,
            "base_url": args.base_url,
            "credential_ref": args.translation_credential_ref,
        },
        "render": _render_params(args, "golden-fullflow-translated.pdf"),
    }


def _render_params(args: argparse.Namespace, translated_pdf_name: str) -> dict:
    return {
        "render_mode": args.render_mode,
        "compile_workers": args.compile_workers,
        "typst_font_family": "Source Han Serif SC",
        "pdf_compress_dpi": args.pdf_compress_dpi,
        "translated_pdf_name": translated_pdf_name,
        "body_font_size_factor": 0.95,
        "body_leading_factor": 1.08,
        "inner_bbox_shrink_x": 0.0,
        "inner_bbox_shrink_y": 0.0,
        "inner_bbox_dense_shrink_x": 0.0,
        "inner_bbox_dense_shrink_y": 0.0,
    }


def _render_spec(args: argparse.Namespace, job_root: Path) -> dict:
    source_pdf = _single_pdf(job_root / "source")
    return {
        "schema_version": "render.stage.v1",
        "stage": "render",
        "job": {
            "job_id": job_root.name,
            "job_root": str(job_root),
            "workflow": "book",
        },
        "inputs": {
            "source_pdf": str(source_pdf),
            "translations_dir": str(job_root / "translated"),
            "translation_manifest": str(job_root / "translated" / "translation-manifest.json"),
        },
        "params": {
            **_render_params(args, "golden-fullflow-translated.pdf"),
            "start_page": 0,
            "end_page": -1,
            "model": args.model,
            "base_url": args.base_url,
            "credential_ref": "",
        },
    }


def _single_pdf(path: Path) -> Path:
    pdfs = sorted(path.glob("*.pdf"))
    if len(pdfs) != 1:
        raise RuntimeError(f"expected exactly one PDF in {path}, found {len(pdfs)}")
    return pdfs[0].resolve()


def _run(cmd: list[str], *, env: dict[str, str] | None = None) -> None:
    print("+ " + " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=REPO_ROOT, env=env, check=True)


def _translated_pages(job_root: Path) -> dict[int, list[dict]]:
    manifest = _load_json(job_root / "translated" / "translation-manifest.json")
    pages: dict[int, list[dict]] = {}
    for page in manifest.get("pages", []):
        rel = str(page.get("path", "") or "").strip()
        if not rel:
            continue
        page_idx = int(page.get("page_index", len(pages)) or 0)
        pages[page_idx] = _load_json(job_root / "translated" / rel)
    return pages


def _verify_unresolved(job_root: Path) -> dict:
    _items, summary = aggregate_payload_diagnostics(_translated_pages(job_root))
    unresolved = int(summary.get("unresolved_translation_count", 0) or 0)
    if unresolved:
        preview = summary.get("unresolved_items", [])[:8]
        raise RuntimeError(f"unresolved translations remain: {unresolved}: {preview}")
    return summary


def _verify_pdf(job_root: Path, source_pdf: Path) -> Path:
    rendered = sorted((job_root / "rendered").glob("*.pdf"))
    rendered = [path for path in rendered if path.name != "book-background-cleaned.pdf"]
    if not rendered:
        raise RuntimeError(f"no rendered PDF found under {job_root / 'rendered'}")
    output_pdf = max(rendered, key=lambda path: path.stat().st_mtime)
    with fitz.open(source_pdf) as src_doc, fitz.open(output_pdf) as out_doc:
        if out_doc.page_count != src_doc.page_count:
            raise RuntimeError(f"page count mismatch: source={src_doc.page_count} output={out_doc.page_count}")
    return output_pdf


def _find_item_bbox(job_root: Path, item_id: str) -> list[float] | None:
    def _normalize_id(value: str) -> str:
        match = re.fullmatch(r"p(\d+)-b0*(\d+)", value)
        if not match:
            return value
        return f"p{int(match.group(1)):03d}-b{int(match.group(2)):03d}"

    target_id = _normalize_id(item_id)
    document = _load_json(job_root / "ocr" / "normalized" / "document.v1.json")
    for page in document.get("pages", []):
        for block in page.get("blocks", []):
            block_id = str(
                block.get("id", "")
                or block.get("block_id", "")
                or block.get("item_id", "")
                or ""
            )
            if _normalize_id(block_id) == target_id:
                bbox = block.get("bbox", [])
                return [float(v) for v in bbox] if len(bbox) == 4 else None
    return None


def _verify_typst_bbox(job_root: Path, item_id: str) -> dict:
    expected = _find_item_bbox(job_root, item_id)
    if not expected:
        raise RuntimeError(f"cannot find OCR bbox for item: {item_id}")
    typst_path = job_root / "rendered" / "typst" / "background-book" / "book-background-overlay.typ"
    if not typst_path.exists():
        raise RuntimeError(f"typst overlay not found: {typst_path}")
    token = "item_" + item_id.replace("-", "_")
    text = typst_path.read_text(encoding="utf-8")
    start = text.find(token)
    if start < 0:
        raise RuntimeError(f"cannot find Typst block for item: {item_id}")
    snippet = text[start : start + 1200]
    match = re.search(r"place\(top \+ left, dx: ([0-9.]+)pt, dy: ([0-9.]+)pt", snippet)
    if not match:
        raise RuntimeError(f"cannot parse Typst place() for item: {item_id}")
    actual = [float(match.group(1)), float(match.group(2))]
    expected_xy = expected[:2]
    if any(abs(a - b) > 0.01 for a, b in zip(actual, expected_xy)):
        raise RuntimeError(f"Typst bbox mismatch for {item_id}: actual={actual}, expected={expected_xy}")
    return {"item_id": item_id, "actual_xy": actual, "expected_xy": expected_xy}


def _ensure_job(args: argparse.Namespace) -> Path:
    if args.job_root:
        return Path(args.job_root).resolve()
    return create_job_dirs(Path(args.output_root), args.job_id.strip() or _job_id()).root


def main() -> None:
    args = parse_args()
    if args.check_manifest:
        rows = _check_manifest()
        print(json.dumps({"status": "ok", "sample_count": len(rows)}, ensure_ascii=False, indent=2))
        return
    if args.list_samples:
        _print_samples()
        return

    job_root = _ensure_job(args)
    specs_dir = job_root / "specs"
    specs_dir.mkdir(parents=True, exist_ok=True)
    source_pdf = _sample_pdf(args.sample_id) if args.sample_id else Path(args.pdf).resolve()

    if not args.skip_run and not args.render_only:
        for subdir in ("source", "ocr", "translated", "rendered", "artifacts", "logs"):
            (job_root / subdir).mkdir(parents=True, exist_ok=True)
        provider_spec = specs_dir / "provider.golden.spec.json"
        _save_json(provider_spec, _provider_spec(args, job_root, source_pdf))
        _run([sys.executable, str(PROVIDER_ENTRYPOINT), "--spec", str(provider_spec)], env=os.environ.copy())

    if args.render_only:
        render_spec = specs_dir / "render.golden.spec.json"
        _save_json(render_spec, _render_spec(args, job_root))
        _run([sys.executable, str(RENDER_ENTRYPOINT), "--spec", str(render_spec)], env=os.environ.copy())

    summary = _verify_unresolved(job_root)
    source_for_check = _single_pdf(job_root / "source") if (job_root / "source").exists() else source_pdf
    output_pdf = _verify_pdf(job_root, source_for_check)
    bbox_check = _verify_typst_bbox(job_root, args.bbox_item)

    result = {
        "job_root": str(job_root),
        "output_pdf": str(output_pdf),
        "status_summary": summary.get("status_summary", {}),
        "unresolved_translation_count": summary.get("unresolved_translation_count", 0),
        "bbox_check": bbox_check,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

"""Cold-start render speed benchmark over render_speed_cases.json.

Each case runs render-only in a FRESH job dir (no prewarm/background caches
by construction) with isolated global caches (OUTPUT_ROOT), then collects
total time, stage timings and key diagnostics.

Usage (repo/worktree root):
  PYTHONPATH=backend/pipeline python backend/pipeline/devtools/run_render_speed_bench.py [--cases ID,...] [--repeat N] [--keep-bench-jobs]

Caveats: single-run numbers include machine noise (small cases vary widely);
use --repeat 3+ and compare medians. See results.json provenance.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
RENDER_MODULE = "retainpdf_pipeline.render"
CASES_FILE = Path(__file__).resolve().parent / "render_speed_cases.json"

SPEC_PARAMS = {
    "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "body_font_size_factor": 0.95,
    "body_leading_factor": 1.08,
    "compile_workers": 0,
    "credential_ref": "env:RETAIN_TRANSLATION_API_KEY",
    "end_page": 100000,
    "font_unify_mode": "role_min",
    "inner_bbox_dense_shrink_x": 0.0,
    "inner_bbox_dense_shrink_y": 0.0,
    "inner_bbox_shrink_x": 0.0,
    "inner_bbox_shrink_y": 0.0,
    "model": "qwen3.8-flash",
    "pdf_compress_dpi": 0,
    "render_mode": "typst",
    "source_cleanup_strategy": "pikepdf_text_strip",
    "start_page": 0,
    "translated_pdf_name": "",
    "typst_font_family": "Source Han Serif SC",
}

ENV_KEEP_PREFIXES = (
    "RETAIN_",
    "RETAINPDF_",
    "TYPST_",
    "HOME",
    "TMPDIR",
    "PATH",
    "CONDA_",
    "PYTHON",
    "LANG",
    "LC_",
)


def resolve_case_source(case: dict) -> Path:
    raw = case.get("fixture_pdf") or case["source_pdf"]
    path = Path(raw)
    if path.is_absolute():
        return path
    # Worktree checkouts lack untracked fixture PDFs: use the nearest tree
    # that actually contains the file.
    candidate = ROOT
    for _ in range(6):
        if (candidate / raw).exists():
            return candidate / raw
        if candidate.parent == candidate:
            break
        candidate = candidate.parent
    return ROOT / raw


def check_case_prerequisites(case: dict) -> list[str]:
    missing = []
    if not resolve_case_source(case).exists():
        missing.append(f"source_pdf: {case.get('fixture_pdf') or case.get('source_pdf')}")
    translated = Path(case["translated_dir"])
    if not (translated / "translation-manifest.json").exists():
        missing.append(f"translation-manifest.json in {translated}")
    if not list(translated.glob("page-*.json")):
        missing.append(f"page-*.json in {translated}")
    return missing


def build_case_job(case: dict, bench_root: Path, stamp: str, run_index: int) -> Path:
    job_id = f"{stamp}-bench-{case['id']}-r{run_index}"
    job_root = bench_root / job_id
    src_pdf = resolve_case_source(case)
    src_translated = Path(case["translated_dir"])
    (job_root / "source").mkdir(parents=True)
    (job_root / "specs").mkdir(parents=True)
    shutil.copy(src_pdf, job_root / "source")
    tdir = job_root / "translated"
    tdir.mkdir()
    for name in ("translation-manifest.json", "domain-context.json"):
        src = src_translated / name
        if src.exists():
            shutil.copy(src, tdir)
    for page_json in sorted(src_translated.glob("page-*.json")):
        shutil.copy(page_json, tdir)
    for sub in ("rendered", "artifacts", "logs", "md", "ocr"):
        (job_root / sub).mkdir()
    spec = {
        "inputs": {
            "source_pdf": str(job_root / "source" / src_pdf.name),
            "translation_manifest": str(tdir / "translation-manifest.json"),
            "translations_dir": str(tdir),
        },
        "job": {"job_id": job_id, "job_root": str(job_root), "workflow": "translate"},
        "params": dict(SPEC_PARAMS),
        "schema_version": "render.stage.v1",
        "stage": "render",
    }
    (job_root / "specs" / "render.spec.json").write_text(
        json.dumps(spec, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return job_root


def child_env(global_caches_dir: Path) -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if key.startswith(ENV_KEEP_PREFIXES)}
    env["PYTHONPATH"] = "backend/pipeline"
    env["OUTPUT_ROOT"] = str(global_caches_dir)
    return env


def run_case(job_root: Path, global_caches_dir: Path) -> dict:
    started = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, "-m", RENDER_MODULE, "--spec", str(job_root / "specs" / "render.spec.json")],
            cwd=ROOT,
            env=child_env(global_caches_dir),
            capture_output=True,
            text=True,
            timeout=3600,
        )
    except subprocess.TimeoutExpired as exc:
        return {
            "exit_code": None,
            "wall_seconds": round(time.perf_counter() - started, 2),
            "total_seconds": None,
            "timeout": True,
            "stderr_tail": str(getattr(exc, "stderr", "") or "")[-2000:],
            "stdout_tail": str(getattr(exc, "stdout", "") or "")[-4000:],
        }
    wall = time.perf_counter() - started
    m = re.search(r"^total time: ([\d.]+)s", proc.stdout, re.M)
    result: dict = {
        "exit_code": proc.returncode,
        "wall_seconds": round(wall, 2),
        "total_seconds": float(m.group(1)) if m else None,
    }
    prewarm_match = re.search(r"timings=([A-Za-z0-9_=.,-]+)", proc.stdout)
    if prewarm_match:
        prewarm_timings = {}
        for chunk in prewarm_match.group(1).split(","):
            if "=" in chunk:
                key, value = chunk.split("=", 1)
                try:
                    prewarm_timings[key] = float(value.rstrip("s"))
                except ValueError:
                    pass
        result["prewarm_timings"] = prewarm_timings
    if proc.returncode != 0:
        result["stderr_tail"] = proc.stderr[-2000:]
        result["stdout_tail"] = proc.stdout[-4000:]
        return result
    try:
        summary = json.loads((job_root / "artifacts" / "pipeline_summary.json").read_text())
        diag = summary.get("render_diagnostics", {})
        result["pages"] = summary.get("pages_processed")
        result["timings"] = {
            k: v for k, v in diag.items() if ("elapsed" in k or k.endswith("_seconds")) and isinstance(v, (int, float))
        }
        try:
            manifest = json.loads((job_root / "artifacts" / "render_prewarm" / "render_source_prewarm_manifest.json").read_text())
            specs_payload = (manifest.get("payload_prewarm") or {}).get("background_render_page_specs") or {}
            manifest_prescreen = specs_payload.get("math_prescreen_items")
        except Exception:
            manifest_prescreen = None
        result["flags"] = {
            k: diag.get(k)
            for k in ("background_compile_retried", "background_compile_failed", "background_bad_page_indices", "background_fallback_overlay", "background_math_prescreen_items", "bbox_text_stripped_pages")
        }
        if result["flags"].get("background_math_prescreen_items") is None:
            result["flags"]["background_math_prescreen_items"] = manifest_prescreen
    except Exception as exc:
        result["summary_error"] = f"{type(exc).__name__}: {exc}"
    return result


def git_revision() -> str:
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, timeout=10
        )
        return proc.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", default="", help="comma-separated case ids (default: all)")
    parser.add_argument("--repeat", type=int, default=1, help="runs per case; reports min/median")
    parser.add_argument("--keep-bench-jobs", action="store_true", help="keep staged job dirs (default: remove on success, keep on failure)")
    args = parser.parse_args()
    cases = json.loads(CASES_FILE.read_text())["cases"]
    wanted = {c.strip() for c in args.cases.split(",") if c.strip()}
    if wanted:
        unknown = wanted - {c["id"] for c in cases}
        if unknown:
            raise SystemExit(f"unknown case ids: {sorted(unknown)} (available: {sorted(c['id'] for c in cases)})")
        cases = [c for c in cases if c["id"] in wanted]
    for case in cases:
        missing = check_case_prerequisites(case)
        if missing:
            raise SystemExit(f"case {case['id']} prerequisites missing: {missing}")
    repeat = max(1, args.repeat)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    bench_root = ROOT / "data/jobs"
    out_dir = ROOT / "tmp" / "render-speed-bench" / stamp
    out_dir.mkdir(parents=True)
    global_caches_dir = out_dir / "global-caches"
    global_caches_dir.mkdir()
    provenance = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "cpu_count": os.cpu_count(),
        "git_rev": git_revision(),
        "repeat": repeat,
        "note": "single-run numbers include machine noise; compare medians across repeats",
    }
    results: list[dict] = []

    def flush() -> None:
        (out_dir / "results.json").write_text(
            json.dumps({"provenance": provenance, "results": results}, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    try:
        for case in cases:
            case_runs = []
            for run_index in range(repeat):
                print(f"[{case['id']} r{run_index + 1}/{repeat}] staging...", flush=True)
                job_root = build_case_job(case, bench_root, stamp, run_index)
                print(f"[{case['id']} r{run_index + 1}/{repeat}] running cold render...", flush=True)
                try:
                    result = run_case(job_root, global_caches_dir)
                except KeyboardInterrupt:
                    flush()
                    raise
                except Exception as exc:
                    result = {"exit_code": None, "error": f"{type(exc).__name__}: {exc}"}
                result.update({"id": case["id"], "run": run_index, "pages": result.get("pages") or case["pages"], "job": job_root.name})
                case_runs.append(result)
                results.append(result)
                flush()
                print(
                    f"[{case['id']} r{run_index + 1}/{repeat}] total={result.get('total_seconds')}s "
                    f"wall={result.get('wall_seconds', '?')}s exit={result.get('exit_code')}",
                    flush=True,
                )
                if not args.keep_bench_jobs and result.get("exit_code") == 0:
                    shutil.rmtree(job_root, ignore_errors=True)
            totals = sorted(r["total_seconds"] for r in case_runs if r.get("total_seconds") is not None)
            if totals:
                print(
                    f"[{case['id']}] min={min(totals):.2f}s median={statistics.median(totals):.2f}s n={len(totals)}",
                    flush=True,
                )
    except KeyboardInterrupt:
        print("\ninterrupted; partial results flushed", flush=True)
        raise SystemExit(130)
    print(f"\nresults: {out_dir / 'results.json'}")
    print(f"{'case':<24} {'pages':>6} {'min':>8} {'median':>8}  flags(last run)")
    by_case: dict[str, list[dict]] = {}
    for r in results:
        by_case.setdefault(r["id"], []).append(r)
    for case_id, runs in by_case.items():
        totals = sorted(r["total_seconds"] for r in runs if r.get("total_seconds") is not None)
        last = runs[-1]
        f = last.get("flags", {}) or {}
        flag_str = f"retried={f.get('background_compile_retried')} bad={f.get('background_bad_page_indices')} prescreen={f.get('background_math_prescreen_items')}"
        if totals:
            print(f"{case_id:<24} {last.get('pages', '?'):>6} {min(totals):>8.2f} {statistics.median(totals):>8.2f}  {flag_str}")
        else:
            print(f"{case_id:<24} {last.get('pages', '?'):>6} {'FAIL':>8} {'FAIL':>8}  {flag_str}")


if __name__ == "__main__":
    main()

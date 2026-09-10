#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path


EXPERIMENT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = EXPERIMENT_ROOT.parents[1]
CASE_JSON = EXPERIMENT_ROOT / "case.json"
DEFAULT_CASE_ROOT = EXPERIMENT_ROOT / "case-data" / "quantum_chem_533" / "job"
RUNS_ROOT = EXPERIMENT_ROOT / "runs"


def _load_case() -> dict:
    return json.loads(CASE_JSON.read_text(encoding="utf-8"))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _link_or_copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def _copy_tree(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    for path in src.rglob("*"):
        rel = path.relative_to(src)
        target = dst / rel
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            _link_or_copy_file(path, target)


def _rewrite_prewarm_manifest(job_root: Path) -> None:
    manifest_path = job_root / "artifacts/render_prewarm/render_source_prewarm_manifest.json"
    source_pdf = job_root / "source/Quantum-Chemistry-&-Spectroscopy-by-Thomas-Engel.pdf"
    if not manifest_path.exists() or not source_pdf.exists():
        return
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    fingerprint = dict(manifest.get("fingerprint") or {})
    stat = source_pdf.stat()
    fingerprint["source_pdf_path"] = str(source_pdf.resolve())
    fingerprint["source_pdf_size"] = int(stat.st_size)
    fingerprint["source_pdf_mtime_ns"] = int(stat.st_mtime_ns)
    manifest["fingerprint"] = fingerprint
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _ensure_case_root(case_root: Path, *, auto_materialize: bool) -> Path:
    if case_root.exists():
        return case_root
    if not auto_materialize:
        raise FileNotFoundError(f"case root does not exist: {case_root}")
    sys.path.insert(0, str(EXPERIMENT_ROOT / "scripts"))
    from materialize import materialize

    return materialize(EXPERIMENT_ROOT / "case-data")


def _prepare_run_job(case: dict, case_root: Path, run_root: Path) -> tuple[Path, Path]:
    job_root = run_root / "job"
    if job_root.exists():
        shutil.rmtree(job_root)
    job_root.mkdir(parents=True)

    for rel_dir in (
        "source",
        "translated",
        "specs",
        "ocr/normalized",
        "artifacts/render_prewarm",
    ):
        _copy_tree(case_root / rel_dir, job_root / rel_dir)
    _rewrite_prewarm_manifest(job_root)

    for rel_dir in ("logs", "rendered"):
        (job_root / rel_dir).mkdir(parents=True, exist_ok=True)
    (job_root / "artifacts").mkdir(parents=True, exist_ok=True)

    spec_path = job_root / case["inputs"]["render_spec"]
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    source_pdf = job_root / case["inputs"]["source_pdf"]
    translations_dir = job_root / case["inputs"]["translations_dir"]
    translation_manifest = translations_dir / "translation-manifest.json"

    spec["job"]["job_id"] = f"bench-{run_root.name}"
    spec["job"]["job_root"] = str(job_root)
    spec["inputs"]["source_pdf"] = str(source_pdf)
    spec["inputs"]["translations_dir"] = str(translations_dir)
    spec["inputs"]["translation_manifest"] = str(translation_manifest) if translation_manifest.exists() else ""
    spec["params"]["translated_pdf_name"] = f"{case['case_id']}-{run_root.name}.pdf"
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return job_root, spec_path


def _load_summary(job_root: Path) -> dict:
    summary_path = job_root / "artifacts" / "pipeline_summary.json"
    if not summary_path.exists():
        return {}
    return json.loads(summary_path.read_text(encoding="utf-8"))


def run_benchmark(args: argparse.Namespace) -> Path:
    case = _load_case()
    case_root = _ensure_case_root(args.case_root.resolve(), auto_materialize=not args.no_materialize)
    run_id = args.run_id or datetime.now().strftime("%Y%m%d-%H%M%S")
    run_root = (RUNS_ROOT / run_id).resolve()
    if run_root.exists() and not args.overwrite:
        raise FileExistsError(f"run already exists: {run_root}")
    if run_root.exists():
        shutil.rmtree(run_root)
    run_root.mkdir(parents=True)

    job_root, spec_path = _prepare_run_job(case, case_root, run_root)
    stdout_path = run_root / "render.stdout.log"
    stderr_path = run_root / "render.stderr.log"
    profile_path = run_root / "render.prof"

    command = [
        sys.executable,
    ]
    if args.profile:
        command.extend(["-m", "cProfile", "-o", str(profile_path)])
    command.extend(
        [
            "-m",
            "retainpdf_pipeline.render",
            "--spec",
            str(spec_path),
        ]
    )

    started = time.perf_counter()
    pipeline_root = REPO_ROOT / "services" / "pipeline"
    with stdout_path.open("w", encoding="utf-8") as stdout, stderr_path.open("w", encoding="utf-8") as stderr:
        completed = subprocess.run(command, cwd=pipeline_root, stdout=stdout, stderr=stderr, check=False)
    wall_seconds = time.perf_counter() - started

    summary = _load_summary(job_root)
    render_diagnostics = summary.get("render_diagnostics") or {}
    source_pdf = job_root / case["inputs"]["source_pdf"]
    report = {
        "schema_version": "retainpdf.render_benchmark_report.v1",
        "case_id": case["case_id"],
        "run_id": run_id,
        "success": completed.returncode == 0,
        "returncode": completed.returncode,
        "wall_seconds": round(wall_seconds, 3),
        "render_elapsed_seconds": round(float(summary.get("render_elapsed", 0.0) or 0.0), 3),
        "effective_render_mode": summary.get("effective_render_mode", ""),
        "pages_processed": summary.get("pages_processed", 0),
        "render_diagnostics": render_diagnostics,
        "paths": {
            "run_root": str(run_root),
            "job_root": str(job_root),
            "spec": str(spec_path),
            "stdout": str(stdout_path),
            "stderr": str(stderr_path),
            "summary": str(job_root / "artifacts" / "pipeline_summary.json"),
            "output_pdf": str(summary.get("output_pdf", "")),
            "profile": str(profile_path) if args.profile else "",
        },
        "input_hashes": {
            "source_pdf_sha256": _sha256(source_pdf) if source_pdf.exists() else "",
        },
        "command": command,
    }
    report_path = run_root / "report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(report_path)
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the RetainPDF 533-page render benchmark.")
    parser.add_argument("--case-root", type=Path, default=DEFAULT_CASE_ROOT)
    parser.add_argument("--run-id", type=str, default="")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--no-materialize", action="store_true")
    parser.add_argument("--profile", action="store_true")
    args = parser.parse_args()
    run_benchmark(args)


if __name__ == "__main__":
    main()

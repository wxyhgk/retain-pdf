#!/usr/bin/env python3
from __future__ import annotations

import argparse
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
TYPST_CASES_ROOT = EXPERIMENT_ROOT / "typst-cases"


def _typst_bin() -> str:
    explicit = os.environ.get("TYPST_BIN", "").strip()
    if explicit:
        return explicit
    discovered = shutil.which("typst")
    if discovered:
        return discovered
    return "/snap/bin/typst"


def _font_paths(extra_font_paths: list[str]) -> list[Path]:
    paths: list[Path] = []
    for candidate in [REPO_ROOT / "infra/fonts", REPO_ROOT / "services/fonts"]:
        if candidate.exists():
            paths.append(candidate)
    raw = os.environ.get("RETAIN_PDF_TYPST_FONT_DIRS", "").strip()
    if raw:
        for entry in raw.split(os.pathsep):
            value = entry.strip()
            if value:
                paths.append(Path(value))
    for entry in extra_font_paths:
        if entry.strip():
            paths.append(Path(entry))

    deduped: list[Path] = []
    seen: set[str] = set()
    for path in paths:
        key = str(path.resolve(strict=False))
        if key not in seen:
            seen.add(key)
            deduped.append(path)
    return deduped


def compile_typst_case(
    typst_case: str,
    *,
    run_id: str = "",
    source_name: str = "book-overlay.typ",
    extra_font_paths: list[str] | None = None,
    overwrite: bool = False,
) -> Path:
    case_root = TYPST_CASES_ROOT / typst_case
    if not case_root.exists():
        raise FileNotFoundError(f"typst case not found: {case_root}")

    run_id = run_id.strip() or datetime.now().strftime("%Y%m%d-%H%M%S")
    run_root = case_root / "compile-runs" / run_id
    if run_root.exists() and not overwrite:
        raise FileExistsError(f"compile run already exists: {run_root}")
    if run_root.exists():
        shutil.rmtree(run_root)
    run_root.mkdir(parents=True)

    src_typ = case_root / source_name
    if not src_typ.exists():
        raise FileNotFoundError(src_typ)
    typ_path = run_root / source_name
    pdf_path = run_root / f"{Path(source_name).stem}.pdf"
    shutil.copy2(src_typ, typ_path)

    command = [_typst_bin(), "compile"]
    for font_path in _font_paths(extra_font_paths or []):
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])

    started = time.perf_counter()
    proc = subprocess.run(command, capture_output=True, text=True, cwd=REPO_ROOT)
    elapsed = time.perf_counter() - started
    (run_root / "typst.stdout.log").write_text(proc.stdout or "", encoding="utf-8")
    (run_root / "typst.stderr.log").write_text(proc.stderr or "", encoding="utf-8")

    report = {
        "schema_version": "retainpdf.typst_compile_report.v1",
        "typst_case": typst_case,
        "run_id": run_id,
        "success": proc.returncode == 0,
        "returncode": proc.returncode,
        "elapsed_seconds": round(elapsed, 3),
        "command": command,
        "paths": {
            "run_root": str(run_root),
            "typ": str(typ_path),
            "pdf": str(pdf_path),
            "stdout": str(run_root / "typst.stdout.log"),
            "stderr": str(run_root / "typst.stderr.log"),
        },
        "pdf_size_bytes": pdf_path.stat().st_size if pdf_path.exists() else 0,
    }
    report_path = run_root / "compile-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(report_path)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile an exported Typst benchmark case only.")
    parser.add_argument("--typst-case", required=True)
    parser.add_argument("--run-id", default="")
    parser.add_argument("--source-name", default="book-overlay.typ")
    parser.add_argument("--font-path", action="append", default=[])
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    compile_typst_case(
        args.typst_case,
        run_id=args.run_id,
        source_name=args.source_name,
        extra_font_paths=args.font_path,
        overwrite=args.overwrite,
    )


if __name__ == "__main__":
    main()

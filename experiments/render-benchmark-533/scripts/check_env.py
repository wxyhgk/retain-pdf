#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path


EXPERIMENT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = EXPERIMENT_ROOT.parents[1]


def _check(name: str, ok: bool, detail: str = "") -> bool:
    mark = "OK" if ok else "FAIL"
    suffix = f" - {detail}" if detail else ""
    print(f"[{mark}] {name}{suffix}")
    return ok


def main() -> None:
    ok = True
    ok &= _check("repo root", (REPO_ROOT / "services/pipeline/retainpdf_pipeline/render/__main__.py").exists(), str(REPO_ROOT))
    ok &= _check("python >= 3.10", sys.version_info >= (3, 10), sys.version.split()[0])
    ok &= _check("typst executable", shutil.which("typst") is not None, shutil.which("typst") or "not found")
    ok &= _check("PyMuPDF import", importlib.util.find_spec("fitz") is not None)
    ok &= _check("backend scripts import path", (REPO_ROOT / "services/pipeline").exists())
    case_root = EXPERIMENT_ROOT / "case-data/quantum_chem_533/job"
    ok &= _check("materialized case", case_root.exists(), str(case_root))
    ok &= _check("case source pdf", (case_root / "source/Quantum-Chemistry-&-Spectroscopy-by-Thomas-Engel.pdf").exists())
    ok &= _check("case translations", (case_root / "translated").exists())
    ok &= _check("case render spec", (case_root / "specs/render.spec.json").exists())
    if shutil.which("typst"):
        try:
            result = subprocess.run(["typst", "--version"], check=False, capture_output=True, text=True)
            version = (result.stdout or result.stderr).strip().splitlines()[0]
        except Exception as exc:
            version = f"{type(exc).__name__}: {exc}"
        print(f"[INFO] typst version: {version}")
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()

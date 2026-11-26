"""Run import-time assertions without changing pytest's module registry."""

from __future__ import annotations

from pathlib import Path
import subprocess
import sys


def run_cold_import_probe(test_file: str, probe: str, *args: str) -> None:
    """Run a named probe in a fresh interpreter, with a bounded lifetime.

    Isolated mode ignores inherited Python paths and startup customization;
    only this checkout's pipeline, its sibling ``retainpdf_*`` packages and the
    test directory are added explicitly (in a worktree the shared venv's
    editable installs point at the main checkout; 2026-11-26 the store started
    importing ``retainpdf_base.io`` and the probe picked up the wrong copy).
    subprocess.run kills and reaps the child on timeout.
    """
    path = Path(test_file).resolve()
    result = subprocess.run(
        [
            sys.executable,
            "-I",
            "-c",
            "import pathlib, runpy, sys; "
            "path = pathlib.Path(sys.argv[1]); "
            "packages = sorted({str(init.parent.parent) for init in path.parents[4].glob('*/retainpdf_*/__init__.py')}); "
            "sys.path[:0] = [str(path.parents[3]), *packages, str(path.parent)]; "
            "namespace = runpy.run_path(str(path)); "
            "namespace[sys.argv[2]](*sys.argv[3:])",
            str(path),
            probe,
            *args,
        ],
        cwd=path.parents[3],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, (
        f"Cold import probe {probe} exited with {result.returncode}\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )

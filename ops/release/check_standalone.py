#!/usr/bin/env python3
"""Verify the committed aggregate source as an isolated backend workspace."""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import tempfile


from build_source_archive import ARCHIVE_PATHS, REQUIRED_FILES

REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICES_ROOT = REPO_ROOT / "backend"

FONT_SHA256 = {
    "resources/fonts/SourceHanSerifSC-Regular.otf": "78aa7a328fd974df2d688c8a9fd74a33d8334dfa84ab24d9d11efb2ffc464117",
    "resources/fonts/SourceHanSerifSC-Bold.otf": "706b8c0de2deff6cbc0c87e2cdedfd33a78b7ffd76cebb4549012f197ba611fe",
}


def _run(
    command: list[str],
    *,
    cwd: Path,
    env: dict[str, str] | None = None,
    suppress_stdout: bool = False,
) -> None:
    print(f"standalone: {' '.join(command)}", flush=True)
    subprocess.run(
        command,
        cwd=cwd,
        env=env,
        check=True,
        stdout=subprocess.DEVNULL if suppress_stdout else None,
    )


def _git_archive_source(*, allow_dirty: bool) -> tuple[Path, str]:
    result = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        cwd=SERVICES_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    git_root = Path(result.stdout.strip()).resolve()
    if REPO_ROOT != git_root:
        raise RuntimeError("release tools must be inside the repository root")
    treeish = "HEAD"

    dirty = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=no", "--", *ARCHIVE_PATHS],
        cwd=git_root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    if dirty and not allow_dirty:
        raise RuntimeError(
            "tracked backend changes are not committed; commit them or pass --allow-dirty "
            "to verify the current HEAD snapshot explicitly"
        )
    if dirty:
        print("standalone: warning: verifying HEAD; tracked worktree changes are excluded")
    return git_root, treeish


def _extract_tracked_snapshot(
    destination: Path,
    *,
    git_root: Path,
    treeish: str,
) -> None:
    archive_path = destination.parent / "services.tar"
    with archive_path.open("wb") as archive:
        subprocess.run(
            ["git", "archive", "--format=tar", treeish, "--", *ARCHIVE_PATHS],
            cwd=git_root,
            stdout=archive,
            check=True,
        )

    with tarfile.open(archive_path) as archive:
        for member in archive.getmembers():
            relative = PurePosixPath(member.name)
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError(f"unsafe archive member: {member.name}")
            if not (member.isfile() or member.isdir()):
                raise RuntimeError(f"unsupported archive member type: {member.name}")
        archive.extractall(destination, filter="data")


def _require_layout(root: Path) -> None:
    required = (
        *REQUIRED_FILES,
        "backend/pipeline/devtools/extract_pipeline_requirements.py",
        "backend/contracts/check_parity.py",
        "ops/release/build_source_archive.py",
        "resources/fonts/README.md",
        *FONT_SHA256,
        "tests/fixtures/golden-jobs/chem-6ada81-10p/artifacts/pipeline_summary.json",
    )
    missing = [relative for relative in required if not (root / relative).is_file()]
    if missing:
        raise RuntimeError(f"standalone backend snapshot is incomplete: {', '.join(missing)}")
    for relative, expected in FONT_SHA256.items():
        actual = hashlib.sha256((root / relative).read_bytes()).hexdigest()
        if actual != expected:
            raise RuntimeError(f"bundled font checksum mismatch: {relative}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--compile-rust",
        action="store_true",
        help="also compile every Rust workspace test without executing it",
    )
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="verify committed HEAD even when tracked backend files differ locally",
    )
    args = parser.parse_args()

    for command in ("git", "uv", "cargo"):
        if shutil.which(command) is None:
            raise RuntimeError(f"required command is unavailable: {command}")

    git_root, treeish = _git_archive_source(allow_dirty=args.allow_dirty)

    with tempfile.TemporaryDirectory(prefix="retainpdf-backend-standalone-") as raw_tmp:
        temp_root = Path(raw_tmp)
        snapshot = temp_root / "workspace"
        snapshot.mkdir()
        _extract_tracked_snapshot(snapshot, git_root=git_root, treeish=treeish)
        _require_layout(snapshot)
        backend = snapshot / "backend"

        env = os.environ.copy()
        for inherited_python_path in ("PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV"):
            env.pop(inherited_python_path, None)
        env["UV_PROJECT_ENVIRONMENT"] = str(temp_root / "venv")
        env["CARGO_TARGET_DIR"] = str(temp_root / "cargo-target")

        reports = temp_root / "dependency-reports"
        _run(
            [
                "python3",
                "pipeline/devtools/extract_pipeline_requirements.py",
                "--services-root",
                ".",
                "--json-out",
                str(reports / "pipeline_dependencies.json"),
                "--markdown-out",
                str(reports / "pipeline_dependencies.md"),
                "--runtime-req-out",
                str(reports / "pipeline_runtime_requirements.in"),
                "--test-req-out",
                str(reports / "pipeline_test_requirements.in"),
            ],
            cwd=backend,
            env=env,
            suppress_stdout=True,
        )
        _run(["python3", "contracts/check_parity.py"], cwd=backend, env=env)
        _run(["uv", "sync", "--locked", "--all-extras"], cwd=backend, env=env)
        _run(
            [
                "uv",
                "run",
                "--locked",
                "python",
                "-c",
                (
                    "from pathlib import Path; "
                    "import retainpdf_ai, retainpdf_pipeline; "
                    "root = Path.cwd().resolve(); "
                    "assert Path(retainpdf_ai.__file__).resolve().is_relative_to(root); "
                    "assert Path(retainpdf_pipeline.__file__).resolve().is_relative_to(root); "
                    "from retainpdf_pipeline.ocr.ocr_provider_config "
                    "import _config_path; "
                    "assert _config_path() == Path.cwd() / 'config' / 'ocr_providers.json'; "
                    "from retainpdf_pipeline.foundation.config.fonts import BACKEND_FONTS_DIR; "
                    "assert BACKEND_FONTS_DIR == Path.cwd().parent / 'resources' / 'fonts'"
                ),
            ],
            cwd=backend,
            env=env,
        )
        _run(
            ["uv", "run", "--locked", "retainpdf-pipeline", "--help"],
            cwd=backend,
            env=env,
        )
        _run(
            [
                "cargo",
                "metadata",
                "--locked",
                "--no-deps",
                "--format-version",
                "1",
                "--manifest-path",
                str(snapshot / "Cargo.toml"),
            ],
            cwd=backend,
            env=env,
            suppress_stdout=True,
        )
        if args.compile_rust:
            _run(
                [
                    "cargo",
                    "test",
                    "--locked",
                    "--workspace",
                    "--no-run",
                    "--manifest-path",
                    str(snapshot / "Cargo.toml"),
                ],
                cwd=backend,
                env=env,
            )

    print("isolated backend source workspace smoke passed")
    print("backend source, runtime assets, and app Docker boundary are self-contained")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

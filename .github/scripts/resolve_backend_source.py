#!/usr/bin/env python3
"""Resolve and verify the backend package embedded in the product repository."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from pathlib import PurePosixPath
import subprocess
import sys
from typing import Any


REQUIRED_PATHS = (
    "pyproject.toml",
    "uv.lock",
    "api/Cargo.toml",
    "ai/pyproject.toml",
    "pipeline/pyproject.toml",
    "config/ocr_providers.json",
)

# A backend source package includes its workspace and shared resources.
PACKAGE_PATHS = (
    ".dockerignore", "Cargo.toml", "Cargo.lock", "backend", "database", "contracts",
    "resources/fonts", "ops/deployment", "ops/release", "tests/fixtures",
)
REQUIRED_ROOT_PATHS = (
    "Cargo.toml", "Cargo.lock", "ops/deployment/docker/backend/Dockerfile.app",
)


def _git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def _load_manifest(repo_root: Path) -> dict[str, Any]:
    manifest_path = repo_root / "backend-package.json"
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1:
        raise RuntimeError(f"unsupported backend package schema: {manifest_path}")
    raw_path = str(payload.get("source_path") or "")
    relative = PurePosixPath(raw_path)
    if (
        relative.is_absolute()
        or ".." in relative.parts
        or not relative.parts
        or raw_path in {"", "."}
        or "\\" in raw_path
    ):
        raise RuntimeError(
            "backend package source_path must be a safe repository-relative path: "
            f"{manifest_path}"
        )
    return payload


def _git_source(source_root: Path) -> tuple[str, str, Path, str]:
    git_root = Path(_git("rev-parse", "--show-toplevel", cwd=source_root)).resolve()
    relative = source_root.relative_to(git_root)
    treeish = "HEAD^{tree}" if relative == Path(".") else f"HEAD:{relative.as_posix()}"
    return (
        _git("rev-parse", "HEAD", cwd=git_root),
        _git("rev-parse", treeish, cwd=git_root),
        git_root,
        relative.as_posix(),
    )


def resolve_backend_source(
    repo_root: Path,
    *,
    allow_dirty: bool = False,
) -> dict[str, str]:
    repo_root = repo_root.resolve()
    manifest = _load_manifest(repo_root)
    source_root = (repo_root / str(manifest["source_path"])).resolve()
    try:
        source_root.relative_to(repo_root)
    except ValueError as exc:
        raise RuntimeError(f"backend package escapes product repository: {source_root}") from exc
    if not source_root.is_dir():
        raise RuntimeError(f"backend package directory is unavailable: {source_root}")

    missing = [item for item in REQUIRED_PATHS if not (source_root / item).is_file()]
    missing.extend(item for item in REQUIRED_ROOT_PATHS if not (repo_root / item).is_file())
    if missing:
        raise RuntimeError(
            f"backend package layout is incomplete at {source_root}: {', '.join(missing)}"
        )

    actual_revision, actual_tree, git_root, relative = _git_source(repo_root)
    if git_root != repo_root:
        raise RuntimeError(
            f"backend package must belong to the product Git repository: {source_root}"
        )

    dirty = _git(
        "status",
        "--porcelain",
        "--untracked-files=normal",
        "--",
        *PACKAGE_PATHS,
        cwd=git_root,
    )
    if dirty and not allow_dirty:
        raise RuntimeError(f"backend package has uncommitted changes: {source_root}")

    return {
        "path": str(source_root),
        "source_root": str(repo_root),
        "kind": "embedded-package",
        "revision": actual_revision,
        "tree": actual_tree,
        "dirty": "true" if dirty else "false",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="RetainPDF product repository root.",
    )
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Allow local backend package changes for developer commands.",
    )
    output = parser.add_mutually_exclusive_group()
    output.add_argument("--print-path", action="store_true")
    output.add_argument("--json", action="store_true")
    args = parser.parse_args()

    resolved = resolve_backend_source(args.repo_root, allow_dirty=args.allow_dirty)
    if args.print_path:
        print(resolved["path"])
    elif args.json:
        print(json.dumps(resolved, ensure_ascii=False, sort_keys=True))
    else:
        print(
            f"backend package verified: {resolved['tree']} "
            f"at {resolved['path']}"
        )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error

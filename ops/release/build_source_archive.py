#!/usr/bin/env python3
"""Build a deterministic, provenance-stamped archive of the backend workspace."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tempfile
import tomllib


REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICES_ROOT = REPO_ROOT / "backend"
ARCHIVE_PATHS = (
    "Cargo.toml", "Cargo.lock", ".dockerignore", "backend", "database", "resources/fonts",
    "contracts", "ops/deployment", "ops/release", "tests/fixtures",
)
REQUIRED_FILES = (
    "Cargo.toml", "Cargo.lock", ".dockerignore",
    "backend/pyproject.toml", "backend/uv.lock",
    "backend/api/Cargo.toml", "backend/ai/pyproject.toml",
    "backend/pipeline/pyproject.toml", "backend/config/ocr_providers.json",
    "ops/deployment/docker/backend/Dockerfile.app",
    "resources/fonts/LICENSE-OFL-1.1.txt",
)


def _git(*args: str, cwd: Path = SERVICES_ROOT) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def _source() -> tuple[Path, str, str]:
    git_root = Path(_git("rev-parse", "--show-toplevel")).resolve()
    if REPO_ROOT != git_root:
        raise RuntimeError("release tools must be inside the repository root")
    return git_root, "HEAD", "."


def _version() -> str:
    payload = tomllib.loads((SERVICES_ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    version = str((payload.get("project") or {}).get("version") or "").strip()
    if not version:
        raise RuntimeError("backend workspace version is missing")
    return version


def _validate_archive(path: Path, *, prefix: str, provenance: dict[str, str]) -> None:
    with tarfile.open(path, "r:gz") as archive:
        names: set[str] = set()
        for member in archive.getmembers():
            relative = PurePosixPath(member.name)
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError(f"unsafe archive member: {member.name}")
            if not (member.isfile() or member.isdir()):
                raise RuntimeError(f"unsupported archive member type: {member.name}")
            names.add(member.name.rstrip("/"))

        required = {f"{prefix}{relative}" for relative in REQUIRED_FILES}
        required.add(f"{prefix}SOURCE.json")
        missing = sorted(required - names)
        if missing:
            raise RuntimeError(f"backend archive is incomplete: {', '.join(missing)}")

        source = archive.extractfile(f"{prefix}SOURCE.json")
        if source is None:
            raise RuntimeError("backend archive provenance is unreadable")
        archived_provenance = json.loads(source.read().decode("utf-8"))
        if archived_provenance != provenance:
            raise RuntimeError("backend archive provenance does not match its source")


def _write_text_atomic(path: Path, content: str) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
        delete=False,
    ) as handle:
        handle.write(content)
        temp_path = Path(handle.name)
    os.replace(temp_path, path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Output .tar.gz path.")
    parser.add_argument(
        "--allow-dirty",
        action="store_true",
        help="Package committed HEAD even when tracked backend files differ locally.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing archive and checksum sidecar.",
    )
    args = parser.parse_args()

    git_root, treeish, pathspec = _source()
    dirty = _git(
        "status",
        "--porcelain",
        "--untracked-files=no",
        "--",
        *ARCHIVE_PATHS,
        cwd=git_root,
    )
    if dirty and not args.allow_dirty:
        raise RuntimeError(
            "tracked backend changes are not committed; commit them or pass --allow-dirty"
        )

    version = _version()
    safe_version = "".join(
        character if character.isalnum() or character in ".-_" else "-"
        for character in version
    )
    output = (args.output or SERVICES_ROOT / "dist" / f"retainpdf-backend-{safe_version}.tar.gz").resolve()
    checksum_path = output.with_name(f"{output.name}.sha256")
    if not args.force and (output.exists() or checksum_path.exists()):
        raise RuntimeError(f"output already exists; pass --force to replace it: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)

    revision = _git("rev-parse", "HEAD", cwd=git_root)
    tree_spec = "HEAD^{tree}" if treeish == "HEAD" else treeish
    tree = _git("rev-parse", tree_spec, cwd=git_root)
    prefix = f"retainpdf-backend-{safe_version}/"
    provenance = {
        "schema": "retainpdf_backend_source_v1",
        "version": version,
        "git_revision": revision,
        "services_tree": tree,
    }
    provenance_json = json.dumps(provenance, ensure_ascii=False, sort_keys=True) + "\n"

    with tempfile.NamedTemporaryFile(
        dir=output.parent,
        prefix=f".{output.name}.",
        suffix=".tmp",
        delete=False,
    ) as handle:
        temp_archive = Path(handle.name)
    try:
        subprocess.run(
            [
                "git",
                "archive",
                "--format=tar.gz",
                f"--prefix={prefix}",
                f"--add-virtual-file={prefix}SOURCE.json:{provenance_json}",
                f"--output={temp_archive}",
                treeish,
                "--",
                *ARCHIVE_PATHS,
            ],
            cwd=git_root,
            check=True,
        )
        _validate_archive(temp_archive, prefix=prefix, provenance=provenance)
        digest = hashlib.sha256(temp_archive.read_bytes()).hexdigest()
        os.replace(temp_archive, output)
        _write_text_atomic(checksum_path, f"{digest}  {output.name}\n")
    finally:
        temp_archive.unlink(missing_ok=True)

    print(output)
    print(checksum_path)
    print(f"sha256={digest}")
    print(f"git_revision={revision}")
    print(f"services_tree={tree}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Select PR checks and detect changes to the standalone backend package boundary."""
from __future__ import annotations

import argparse
import os
from pathlib import Path, PurePosixPath
import subprocess


def is_documentation(path: str) -> bool:
    if path.startswith(("docs/api/", "docs/adr/", "docs/core/python/")):
        return False
    return path.startswith("docs/") or path in {"README.md", "CONTRIBUTING.md", "CLAUDE.md"}


def affects_backend_archive(path: str) -> bool:
    if path in {
        ".dockerignore", ".github/workflows/tests.yml", ".github/scripts/ci_scope.py",
        ".github/scripts/resolve_backend_source.py", "Cargo.toml", "Cargo.lock",
        "backend-package.json", "backend/uv.lock",
    } or path.startswith((
        ".cargo/", ".github/actions/prepare-backend-source/", "backend/config/",
        "backend/contracts/", "contracts/", "ops/deployment/", "ops/release/",
        "resources/fonts/", "tests/fixtures/",
    )):
        return True
    name = PurePosixPath(path).name
    return name == ".gitattributes" or (
        path.startswith(("backend/", "database/")) and name in {"Cargo.toml", "build.rs", "pyproject.toml"}
    )


def select_checks(event: str, paths: list[str] | None) -> tuple[str, bool]:
    if not paths:
        return "full", True
    archive = any(affects_backend_archive(path) for path in paths)
    if event != "pull_request" or archive:
        return "full", archive
    if all(is_documentation(path) for path in paths):
        return "docs", archive
    if all(
        is_documentation(path) or (
            path.startswith("frontend/")
            and PurePosixPath(path).name not in {"package.json", "package-lock.json", "npm-shrinkwrap.json"}
        )
        for path in paths
    ):
        return "frontend", archive
    return "full", archive


def changed_paths(event: str, ref_type: str, before: str, sha: str) -> list[str] | None:
    if event == "pull_request":
        # Check the files that changed in the merge tree GitHub tests.
        merge_parents = subprocess.check_output(["git", "show", "-s", "--format=%P", sha]).split()
        if len(merge_parents) != 2:
            return None
        before = os.fsdecode(merge_parents[0])
    elif event != "push" or ref_type != "branch" or not before or before == "0" * 40:
        return None
    elif subprocess.run(
        ["git", "cat-file", "-e", f"{before}^{{commit}}"], capture_output=True
    ).returncode:
        subprocess.run(["git", "fetch", "--no-tags", "--depth=1", "origin", before], check=True)
    diff = subprocess.check_output(["git", "diff", "--name-only", "--no-renames", "-z", before, sha, "--"])
    return [os.fsdecode(path) for path in diff.split(b"\0") if path]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tested-main-run-id", default="")
    args = parser.parse_args()
    event = os.environ["GITHUB_EVENT_NAME"]
    ref_type = os.environ["GITHUB_REF_TYPE"]
    sha = os.environ["GITHUB_SHA"]
    if args.tested_main_run_id:
        if event != "push" or ref_type != "tag" or not args.tested_main_run_id.isdecimal():
            raise SystemExit("Only a release tag can reuse verified main Tests")
        scope, archive = "reuse", False
        print(f"Reusing main Tests run {args.tested_main_run_id} for {sha}")
    else:
        try:
            paths = changed_paths(event, ref_type, os.environ.get("PUSH_BEFORE", ""), sha)
        except subprocess.CalledProcessError:
            paths = None
            print("Could not compare Git trees. Running all checks.")
        scope, archive = select_checks(event, paths)
        print(f"Test scope: {scope}. Isolated backend archive: {archive}.")
    with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as output:
        output.write(f"scope={scope}\narchive={str(archive).lower()}\n")


if __name__ == "__main__":
    main()

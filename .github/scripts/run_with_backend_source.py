#!/usr/bin/env python3
"""Run a command after replacing {backend} with the verified backend root."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess

from resolve_backend_source import resolve_backend_source


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
    )
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()

    command = list(args.command)
    if command[:1] == ["--"]:
        command = command[1:]
    if not command:
        parser.error("a command is required")

    repo_root = args.repo_root.resolve()
    source = resolve_backend_source(repo_root, allow_dirty=True)
    expanded = [item.replace("{backend}", source["path"]).replace("{source_root}", source["source_root"]) for item in command]
    environment = dict(os.environ)
    # The embedded backend snapshot deliberately does not contain a virtualenv.
    # Keep Rust integration tests and Python workers on the caller's locked
    # project environment when the wrapper is used from a checkout that has one.
    project_environment = environment.get("UV_PROJECT_ENVIRONMENT", "").strip()
    if not project_environment:
        local_environment = repo_root / "backend" / ".venv"
        if local_environment.is_dir():
            project_environment = str(local_environment)
            environment["UV_PROJECT_ENVIRONMENT"] = project_environment
    if project_environment:
        bin_dir = Path(project_environment) / ("Scripts" if os.name == "nt" else "bin")
        environment["PATH"] = os.pathsep.join(
            [str(bin_dir), environment.get("PATH", "")]
        )
    return subprocess.run(expanded, cwd=repo_root, env=environment, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())

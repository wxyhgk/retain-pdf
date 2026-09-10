#!/usr/bin/env python3
"""Run a command after replacing {backend} with the verified backend root."""

from __future__ import annotations

import argparse
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
    return subprocess.run(expanded, cwd=repo_root, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())

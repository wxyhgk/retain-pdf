#!/usr/bin/env python3
"""Validate backend contracts and, in the monorepo, their upstream parity."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


CONTRACT_NAMES = (
    "ai-ask.v1.schema.json",
    "agent-calculation.v1.schema.json",
    "ai-conversations.v1.schema.json",
    "create-job.v1.schema.json",
    "job-events.v2.schema.json",
    "job-status.v1.schema.json",
    "jobs-control.v1.schema.json",
    "library-books.v1.schema.json",
    "pipeline-stdout.v1.schema.json",
    "public-document-operation.v1.schema.json",
    "reader-data.v1.schema.json",
    "runtime-config.v1.schema.json",
)

CONTRACTS_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = CONTRACTS_ROOT.parent
UPSTREAM_ROOT = BACKEND_ROOT.parent / "contracts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate backend contract JSON and monorepo byte parity."
    )
    parser.add_argument(
        "--require-upstream",
        action="store_true",
        help="Fail instead of skipping when the root contracts package is unavailable.",
    )
    return parser.parse_args()


def validate_local_contracts() -> None:
    for name in CONTRACT_NAMES:
        path = CONTRACTS_ROOT / name
        if not path.is_file():
            raise SystemExit(f"missing backend contract: {path}")
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise SystemExit(f"invalid backend contract {path}: {error}") from error


def validate_upstream_parity(*, require_upstream: bool) -> None:
    if not UPSTREAM_ROOT.is_dir():
        if require_upstream:
            raise SystemExit(f"upstream schema directory is unavailable: {UPSTREAM_ROOT}")
        print(f"upstream schemas unavailable; local contracts valid: {CONTRACTS_ROOT}")
        return

    mismatches: list[str] = []
    for name in CONTRACT_NAMES:
        local_path = CONTRACTS_ROOT / name
        upstream_path = UPSTREAM_ROOT / name
        if not upstream_path.is_file():
            mismatches.append(f"missing upstream schema: {upstream_path}")
        elif local_path.read_bytes() != upstream_path.read_bytes():
            mismatches.append(f"contract differs from upstream: {name}")
    if mismatches:
        raise SystemExit("\n".join(mismatches))
    print(f"backend contracts match upstream byte-for-byte: {UPSTREAM_ROOT}")


def main() -> None:
    args = parse_args()
    validate_local_contracts()
    validate_upstream_parity(require_upstream=args.require_upstream)


if __name__ == "__main__":
    main()

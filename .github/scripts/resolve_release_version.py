from __future__ import annotations

import argparse
import os
from pathlib import Path
import re


SEMVER_TAG = re.compile(
    r"^v?(?P<version>"
    r"(?:0|[1-9][0-9]*)\."
    r"(?:0|[1-9][0-9]*)\."
    r"(?:0|[1-9][0-9]*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r")$"
)
SAFE_LABEL = re.compile(r"^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$")


def resolve_release_version(tag: str, *, allow_label: bool = False) -> dict[str, str]:
    ref_name = tag.strip()
    match = SEMVER_TAG.fullmatch(ref_name)
    if match is not None:
        version = match.group("version")
        prerelease = "-" in version.split("+", 1)[0]
        return {
            "tag": ref_name,
            "version": version,
            "prerelease": str(prerelease).lower(),
            "stable": str(not prerelease).lower(),
        }

    if allow_label and SAFE_LABEL.fullmatch(ref_name):
        return {
            "tag": ref_name,
            "version": ref_name.removeprefix("v"),
            "prerelease": "true",
            "stable": "false",
        }

    expected = "a semantic version tag such as 4.2.0-beta1 or v4.2.0"
    if allow_label:
        expected += ", or a safe Docker label such as dev"
    raise ValueError(f"invalid release reference {tag!r}; expected {expected}")


def _write_github_output(path: Path, values: dict[str, str]) -> None:
    with path.open("a", encoding="utf-8") as output:
        for key, value in values.items():
            if "\n" in value or "\r" in value:
                raise ValueError(f"release output {key} contains a newline")
            output.write(f"{key}={value}\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate a release ref and expose normalized GitHub Actions outputs."
    )
    parser.add_argument("--tag", required=True)
    parser.add_argument(
        "--allow-label",
        action="store_true",
        help="also accept a safe non-semver label for manual Docker builds",
    )
    parser.add_argument(
        "--github-output",
        type=Path,
        default=Path(os.environ["GITHUB_OUTPUT"]) if "GITHUB_OUTPUT" in os.environ else None,
    )
    args = parser.parse_args()

    try:
        values = resolve_release_version(args.tag, allow_label=args.allow_label)
    except ValueError as exc:
        parser.error(str(exc))

    if args.github_output is None:
        parser.error("--github-output or GITHUB_OUTPUT is required")
    _write_github_output(args.github_output, values)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Callable

sys.path.append(str(Path(__file__).resolve().parents[1]))

from foundation.shared.stage_specs import BookStageSpec
from foundation.shared.stage_specs import NormalizeStageSpec
from foundation.shared.stage_specs import ProviderStageSpec
from foundation.shared.stage_specs import RenderStageSpec
from foundation.shared.stage_specs import TranslateStageSpec


SPEC_LOADERS: dict[str, Callable[[Path], object]] = {
    "book": BookStageSpec.load,
    "normalize": NormalizeStageSpec.load,
    "provider": ProviderStageSpec.load,
    "render": RenderStageSpec.load,
    "translate": TranslateStageSpec.load,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Validate RetainPDF stage spec JSON files against the Python stage spec loaders. "
            "Use this to catch Rust/Python stage-contract drift."
        ),
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Spec files or directories to scan. Defaults to data/jobs.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail when no spec files are found.",
    )
    return parser.parse_args()


def _iter_spec_files(paths: list[Path]) -> tuple[list[Path], bool]:
    roots = paths or [Path("data/jobs")]
    specs: list[Path] = []
    has_explicit_file = False
    for root in roots:
        if root.is_file():
            has_explicit_file = True
            specs.append(root)
            continue
        if not root.exists():
            continue
        specs.extend(sorted(root.rglob("*.spec.json")))
    return sorted({path.resolve() for path in specs}), has_explicit_file


def _stage_from_spec_path(path: Path) -> str:
    name = path.name
    if not name.endswith(".spec.json"):
        raise ValueError(f"not a stage spec file: {path}")
    return name[: -len(".spec.json")]


def validate_spec(path: Path) -> tuple[str, str]:
    stage = _stage_from_spec_path(path)
    loader = SPEC_LOADERS.get(stage)
    if loader is None:
        return "skip", f"unsupported stage spec name '{stage}'"
    try:
        loader(path)
    except Exception as exc:
        return "fail", f"{type(exc).__name__}: {exc}"
    return "ok", stage


def main() -> int:
    args = parse_args()
    spec_files, has_explicit_file = _iter_spec_files(args.paths)
    if not spec_files:
        message = "no stage spec files found"
        print(message, file=sys.stderr)
        return 1 if args.strict else 0

    failures: list[tuple[Path, str]] = []
    skipped = 0
    for path in spec_files:
        status, detail = validate_spec(path)
        rel = path
        try:
            rel = path.relative_to(Path.cwd())
        except ValueError:
            pass
        if status == "ok":
            print(f"ok {detail}: {rel}")
        elif status == "skip" and not has_explicit_file:
            skipped += 1
            print(f"skip: {rel}: {detail}")
        else:
            print(f"fail: {rel}: {detail}", file=sys.stderr)
            failures.append((path, detail))

    if failures:
        print(f"stage_spec_contract=failed failures={len(failures)} total={len(spec_files)}", file=sys.stderr)
        return 1
    print(f"stage_spec_contract=ok checked={len(spec_files) - skipped} skipped={skipped} total={len(spec_files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

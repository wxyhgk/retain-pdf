from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import tomllib  # type: ignore[attr-defined]
except ModuleNotFoundError:  # pragma: no cover
    tomllib = None


DESKTOP_MACOS_EXTRA_HEADER = [
    "# Legacy compatibility copy. CI should stay aligned with requirements-desktop-posix.txt.",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync generated runtime/test requirements from pyproject.toml.",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Product repository root that owns the generated consumer files.",
    )
    parser.add_argument(
        "--services-root",
        type=Path,
        default=None,
        help=(
            "Embedded backend package. Defaults to RETAIN_PDF_SERVICES_ROOT or "
            "<repo-root>/backend."
        ),
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if generated files differ from checked-in files.",
    )
    return parser.parse_args()


def _load_dependency_groups(pyproject_path: Path) -> tuple[list[str], list[str]]:
    text = pyproject_path.read_text(encoding="utf-8")
    if tomllib is None:
        return _load_dependency_groups_fallback(text, pyproject_path)
    payload = tomllib.loads(text)
    project = payload.get("project") or {}
    runtime = [str(item).strip() for item in project.get("dependencies") or [] if str(item).strip()]
    optional = project.get("optional-dependencies") or {}
    test = [str(item).strip() for item in optional.get("test") or [] if str(item).strip()]
    if not runtime:
        raise RuntimeError(f"No project.dependencies found in {pyproject_path}")
    return runtime, test


def _load_dependency_groups_fallback(text: str, pyproject_path: Path) -> tuple[list[str], list[str]]:
    lines = text.splitlines()
    section = ""
    current_array: str | None = None
    arrays: dict[str, list[str]] = {}
    for raw_line in lines:
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line.strip("[]").strip()
            current_array = None
            continue
        if section not in {"project", "project.optional-dependencies"}:
            continue
        if current_array is None:
            if "=" not in line:
                continue
            key, value = [part.strip() for part in line.split("=", 1)]
            if value == "[":
                current_array = f"{section}.{key}"
                arrays[current_array] = []
                continue
            if value.startswith("[") and value.endswith("]"):
                items = [
                    item.strip().strip('"').strip("'")
                    for item in value.strip("[]").split(",")
                    if item.strip()
                ]
                arrays[f"{section}.{key}"] = items
            continue
        if line == "]":
            current_array = None
            continue
        arrays[current_array].append(line.rstrip(",").strip().strip('"').strip("'"))
    runtime = arrays.get("project.dependencies", [])
    test = arrays.get("project.optional-dependencies.test", [])
    if not runtime:
        raise RuntimeError(f"No project.dependencies found in {pyproject_path}")
    return runtime, test


def _render_requirements(
    lines: list[str],
    *,
    source: str,
    extra_header: list[str] | None = None,
) -> str:
    header = [
        f"# Generated from {source} by .github/scripts/sync_backend_python_requirements.py.",
        "# Do not edit manually.",
    ]
    if extra_header:
        header.extend(extra_header)
    return "\n".join(header + [""] + lines) + "\n"


def _sync_file(path: Path, expected: str, *, check_only: bool) -> bool:
    current = path.read_text(encoding="utf-8") if path.exists() else None
    if current == expected:
        return False
    if check_only:
        raise RuntimeError(f"Generated requirements out of sync: {path}")
    if not path.parent.exists():
        # docker/desktop 是 symlink，本身已被视为不存在但 is_symlink 为 True，跳过 mkdir
        if not path.parent.is_symlink():
            path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(expected, encoding="utf-8")
    return True


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    raw_services_root = args.services_root or Path(
        os.environ.get("RETAIN_PDF_SERVICES_ROOT", "backend")
    )
    services_root = (
        raw_services_root
        if raw_services_root.is_absolute()
        else repo_root / raw_services_root
    ).resolve()
    pipeline_path = services_root / "pipeline" / "pyproject.toml"
    ai_path = services_root / "ai" / "pyproject.toml"
    # Keep generated headers stable even when the backend is checked out beside
    # the product repository rather than inside the backend package.
    pipeline_source = "backend/pipeline/pyproject.toml"
    ai_source = "backend/ai/pyproject.toml"
    pipeline_runtime, pipeline_test = _load_dependency_groups(pipeline_path)
    ai_runtime, _ai_test = _load_dependency_groups(ai_path)
    pipeline_with_test = pipeline_runtime + pipeline_test

    targets = {
        repo_root / "ops" / "deployment" / "docker" / "requirements-app.txt": _render_requirements(
            pipeline_runtime,
            source=pipeline_source,
        ),
        repo_root / "ops" / "deployment" / "docker" / "requirements-test.txt": _render_requirements(
            pipeline_with_test,
            source=pipeline_source,
        ),
        repo_root / "frontend" / "desktop" / "requirements-desktop-posix.txt": _render_requirements(
            pipeline_runtime,
            source=pipeline_source,
        ),
        repo_root / "frontend" / "desktop" / "requirements-desktop-windows.txt": _render_requirements(
            pipeline_runtime,
            source=pipeline_source,
        ),
        repo_root / "frontend" / "desktop" / "requirements-desktop-macos.txt": _render_requirements(
            pipeline_runtime,
            source=pipeline_source,
            extra_header=DESKTOP_MACOS_EXTRA_HEADER,
        ),
        repo_root / "frontend" / "desktop" / "requirements-ai-service.txt": _render_requirements(
            ai_runtime,
            source=ai_source,
        ),
    }

    changed_paths: list[str] = []
    for path, expected in targets.items():
        if _sync_file(path, expected, check_only=args.check):
            changed_paths.append(str(path.relative_to(repo_root)))

    if args.check:
        print("python requirements are in sync")
    elif changed_paths:
        print("updated generated requirement files:")
        for rel in changed_paths:
            print(f"  {rel}")
    else:
        print("generated requirement files already up to date")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise

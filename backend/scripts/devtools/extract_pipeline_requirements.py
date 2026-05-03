from __future__ import annotations

import argparse
import ast
import json
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


IMPORT_TO_PACKAGE = {
    "PIL": "Pillow",
    "fitz": "PyMuPDF",
    "pikepdf": "pikepdf",
    "pytest": "pytest",
    "requests": "requests",
    "urllib3": "urllib3",
}

EXTERNAL_COMMAND_MARKERS = {
    "typst": ("typst", 'which("typst")', '"/snap/bin/typst"', '"/usr/local/bin/typst"'),
    "gs": ('which("gs")', '"gs"'),
}


@dataclass(frozen=True)
class ImportHit:
    module: str
    importer: Path


def parse_args() -> argparse.Namespace:
    default_output_dir = Path("doc") / "python"
    parser = argparse.ArgumentParser(
        description="Extract Python/runtime dependency signals from backend/scripts.",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[3],
        help="Repository root path.",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=default_output_dir / "pipeline_dependencies.json",
        help="Optional JSON output path.",
    )
    parser.add_argument(
        "--markdown-out",
        type=Path,
        default=default_output_dir / "pipeline_dependencies.md",
        help="Optional Markdown output path.",
    )
    parser.add_argument(
        "--runtime-req-out",
        type=Path,
        default=default_output_dir / "pipeline_runtime_requirements.in",
        help="Optional runtime requirements output path.",
    )
    parser.add_argument(
        "--test-req-out",
        type=Path,
        default=default_output_dir / "pipeline_test_requirements.in",
        help="Optional test requirements output path.",
    )
    return parser.parse_args()


def _is_ignored(path: Path) -> bool:
    parts = set(path.parts)
    return "__pycache__" in parts or ".ipynb_checkpoints" in parts


def _stdlib_modules() -> set[str]:
    names = set(getattr(sys, "stdlib_module_names", set()))
    names.update(
        {
            "__future__",
            "tomllib",
            "typing_extensions",
        }
    )
    return names


def _local_module_names(root: Path) -> set[str]:
    names: set[str] = set()
    for path in root.rglob("*.py"):
        if _is_ignored(path):
            continue
        names.add(path.stem)
    for path in root.rglob("*"):
        if path.is_dir() and not _is_ignored(path):
            names.add(path.name)
    return names


def _module_path_exists(root: Path, importer: Path, top: str, local_names: set[str]) -> bool:
    if top in local_names:
        return True
    candidates = [
        importer.parent / f"{top}.py",
        importer.parent / top / "__init__.py",
        root / f"{top}.py",
        root / top / "__init__.py",
    ]
    return any(path.exists() for path in candidates)


def _classify_importer(path: Path) -> str:
    text = path.as_posix()
    if "/devtools/tests/" in text:
        return "test"
    if "/devtools/" in text:
        return "devtool"
    return "runtime"


def _scan_imports(scripts_root: Path) -> dict[str, list[ImportHit]]:
    stdlib = _stdlib_modules()
    local_names = _local_module_names(scripts_root)
    hits: dict[str, list[ImportHit]] = defaultdict(list)
    for path in scripts_root.rglob("*.py"):
        if _is_ignored(path):
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                if not node.module:
                    continue
                names = [node.module]
            else:
                continue
            for name in names:
                top = name.split(".")[0]
                if top in stdlib:
                    continue
                if _module_path_exists(scripts_root, path, top, local_names):
                    continue
                hits[top].append(ImportHit(module=top, importer=path))
    return hits


def _scan_external_commands(scripts_root: Path) -> dict[str, list[str]]:
    results: dict[str, list[str]] = {}
    self_script = Path(__file__).resolve()
    for command, markers in EXTERNAL_COMMAND_MARKERS.items():
        refs: list[str] = []
        for path in scripts_root.rglob("*.py"):
            if _is_ignored(path):
                continue
            if path.resolve() == self_script:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except Exception:
                continue
            if any(marker in text for marker in markers):
                refs.append(str(path.relative_to(scripts_root)))
        if refs:
            results[command] = sorted(refs)
    return results


def _build_report(repo_root: Path) -> dict[str, object]:
    scripts_root = repo_root / "backend" / "scripts"
    raw_hits = _scan_imports(scripts_root)
    packages: list[dict[str, object]] = []
    runtime_packages: list[str] = []
    test_only_packages: list[str] = []
    for import_name in sorted(raw_hits):
        refs = raw_hits[import_name]
        buckets: dict[str, list[str]] = defaultdict(list)
        for hit in refs:
            buckets[_classify_importer(hit.importer)].append(str(hit.importer.relative_to(scripts_root)))
        package_name = IMPORT_TO_PACKAGE.get(import_name, import_name)
        entry = {
            "import_name": import_name,
            "package_name": package_name,
            "runtime_files": sorted(set(buckets.get("runtime", []))),
            "devtool_files": sorted(set(buckets.get("devtool", []))),
            "test_files": sorted(set(buckets.get("test", []))),
            "runtime_required": bool(buckets.get("runtime")),
            "devtool_required": bool(buckets.get("devtool")),
        }
        packages.append(entry)
        if entry["runtime_required"]:
            runtime_packages.append(package_name)
        elif entry["devtool_required"]:
            runtime_packages.append(package_name)
        else:
            test_only_packages.append(package_name)
    runtime_packages = sorted(dict.fromkeys(runtime_packages))
    test_only_packages = sorted(dict.fromkeys(test_only_packages))
    requirement_files = [
        "docker/requirements-app.txt",
        "desktop/requirements-desktop-posix.txt",
        "desktop/requirements-desktop-windows.txt",
        "desktop/requirements-desktop-macos.txt",
    ]
    return {
        "repo_root": str(repo_root),
        "scripts_root": str(scripts_root),
        "runtime_python_packages": runtime_packages,
        "test_only_python_packages": test_only_packages,
        "external_commands": _scan_external_commands(scripts_root),
        "packages": packages,
        "existing_requirement_files": requirement_files,
        "notes": [
            "runtime_required=true means imported from runtime or devtool code, not just tests",
            "external_commands are non-Python binary dependencies detected by marker scan",
        ],
    }


def _render_markdown(report: dict[str, object]) -> str:
    output_dir = Path("doc") / "python"
    lines = [
        "# Python Pipeline Dependencies",
        "",
        "This file is generated from static import scanning under `backend/scripts`.",
        "Regenerate with:",
        "`python backend/scripts/devtools/extract_pipeline_requirements.py --repo-root . --json-out doc/core/python/pipeline_dependencies.json --markdown-out doc/core/python/pipeline_dependencies.md --runtime-req-out doc/core/python/pipeline_runtime_requirements.in --test-req-out doc/core/python/pipeline_test_requirements.in`",
        "",
        "## Runtime Python Packages",
        "",
    ]
    for package in report["runtime_python_packages"]:
        lines.append(f"- `{package}`")
    lines.extend(
        [
            "",
            "## Test-only Python Packages",
            "",
        ]
    )
    for package in report["test_only_python_packages"]:
        lines.append(f"- `{package}`")
    lines.extend(
        [
            "",
            "## External Commands",
            "",
        ]
    )
    external_commands = report["external_commands"]
    if external_commands:
        for command, refs in external_commands.items():
            lines.append(f"- `{command}`")
            lines.append(f"  refs: {', '.join(f'`{ref}`' for ref in refs[:6])}")
    else:
        lines.append("- none detected")
    lines.extend(
        [
            "",
            "## Package Map",
            "",
            "| Import | Package | Runtime | Test | Example refs |",
            "| --- | --- | --- | --- | --- |",
        ]
    )
    for package in report["packages"]:
        example_refs = package["runtime_files"] or package["devtool_files"] or package["test_files"]
        lines.append(
            "| "
            f"`{package['import_name']}` | `{package['package_name']}` | "
            f"{'yes' if package['runtime_required'] or package['devtool_required'] else 'no'} | "
            f"{'yes' if package['test_files'] else 'no'} | "
            f"{', '.join(f'`{ref}`' for ref in example_refs[:3])} |"
        )
    lines.extend(
        [
            "",
            "## Existing Requirement Files",
            "",
        ]
    )
    for path in report["existing_requirement_files"]:
        lines.append(f"- `{path}`")
    lines.extend(
        [
            "",
            "## Generated Outputs",
            "",
            f"- `{output_dir / 'pipeline_dependencies.json'}`",
            f"- `{output_dir / 'pipeline_dependencies.md'}`",
            f"- `{output_dir / 'pipeline_runtime_requirements.in'}`",
            f"- `{output_dir / 'pipeline_test_requirements.in'}`",
        ]
    )
    lines.append("")
    return "\n".join(lines)


def _render_requirements(packages: list[str]) -> str:
    return "\n".join(packages) + "\n"


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    report = _build_report(repo_root)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.markdown_out:
        args.markdown_out.parent.mkdir(parents=True, exist_ok=True)
        args.markdown_out.write_text(_render_markdown(report), encoding="utf-8")
    if args.runtime_req_out:
        args.runtime_req_out.parent.mkdir(parents=True, exist_ok=True)
        args.runtime_req_out.write_text(
            _render_requirements(report["runtime_python_packages"]),
            encoding="utf-8",
        )
    if args.test_req_out:
        args.test_req_out.parent.mkdir(parents=True, exist_ok=True)
        args.test_req_out.write_text(
            _render_requirements(report["test_only_python_packages"]),
            encoding="utf-8",
        )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

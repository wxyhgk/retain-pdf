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

REGENERATE_COMMAND = (
    "python backend/pipeline/devtools/extract_pipeline_requirements.py "
    "--services-root backend "
    "--json-out docs/core/python/pipeline_dependencies.json "
    "--markdown-out docs/core/python/pipeline_dependencies.md "
    "--runtime-req-out docs/core/python/pipeline_runtime_requirements.in "
    "--test-req-out docs/core/python/pipeline_test_requirements.in"
)

EXTERNAL_COMMAND_MARKERS = {
    "typst": ("typst", 'which("typst")', "resolve_typst_bin"),
    "gs": ('which("gs")', '"gs"'),
}


@dataclass(frozen=True)
class ImportHit:
    module: str
    importer: Path


def parse_args() -> argparse.Namespace:
    default_output_dir = Path("docs") / "core" / "python"
    parser = argparse.ArgumentParser(
        description="Extract Python/runtime dependency signals from the backend pipeline.",
    )
    parser.add_argument(
        "--services-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Standalone backend workspace root.",
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
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the checked-in reports differ from what a fresh scan produces.",
    )
    return parser.parse_args()


def _is_ignored(path: Path) -> bool:
    parts = set(path.parts)
    return "__pycache__" in parts or ".ipynb_checkpoints" in parts


def _stdlib_modules() -> set[str]:
    # 没有 stdlib_module_names（Python < 3.10）时整个标准库都会被当成第三方包，
    # 生成出来的 .in 里会混进 os / json / subprocess 这类名字。宁可报错退出，
    # 也不要让这种产物被当成真实依赖清单提交。
    names = set(getattr(sys, "stdlib_module_names", ()))
    if not names:
        raise SystemExit(
            "extract_pipeline_requirements.py 需要 Python 3.10+"
            f"（sys.stdlib_module_names 不可用，当前 {sys.version.split()[0]}）"
        )
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


def _sys_path_roots(tree: ast.AST, importer: Path, repo_root: Path) -> list[Path]:
    """返回该文件自己塞进 sys.path 的仓库内目录。

    devtools/tests/translation/test_request_capture.py 靠
    `sys.path.insert(0, ... / "tests/performance/pipeline")` 才能 import
    inspect_capture —— 那是仓库里的文件，不是 PyPI 包。不解析这一步的话
    inspect_capture 会被当成第三方依赖写进 pipeline_test_requirements.in，
    而那个名字根本装不上。
    """
    literals: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr not in {"insert", "append"}:
            continue
        target = func.value
        if not (
            isinstance(target, ast.Attribute)
            and target.attr == "path"
            and isinstance(target.value, ast.Name)
            and target.value.id == "sys"
        ):
            continue
        for inner in ast.walk(node):
            if isinstance(inner, ast.Constant) and isinstance(inner.value, str):
                literals.append(inner.value)
    if not literals:
        return []

    # 路径通常写成 `Path(__file__).resolve().parents[N] / "a/b"`，N 静态算不出来，
    # 所以拿 importer 到仓库根之间的每一层当基准逐个试。
    bases: list[Path] = []
    cursor = importer.parent
    while True:
        bases.append(cursor)
        if cursor == repo_root or repo_root not in cursor.parents:
            break
        cursor = cursor.parent

    roots: list[Path] = []
    for literal in literals:
        if not literal or Path(literal).is_absolute():
            continue
        for base in bases:
            candidate = base / literal
            if candidate.is_dir() and candidate not in roots:
                roots.append(candidate)
    return roots


def _module_path_exists(
    root: Path,
    importer: Path,
    top: str,
    local_names: set[str],
    extra_roots: list[Path] | None = None,
) -> bool:
    if top in local_names:
        return True
    candidates = [
        importer.parent / f"{top}.py",
        importer.parent / top / "__init__.py",
        root / f"{top}.py",
        root / top / "__init__.py",
    ]
    for extra_root in extra_roots or ():
        candidates.append(extra_root / f"{top}.py")
        candidates.append(extra_root / top / "__init__.py")
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
    repo_root = scripts_root.parent.parent
    hits: dict[str, list[ImportHit]] = defaultdict(list)
    for path in scripts_root.rglob("*.py"):
        if _is_ignored(path):
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        extra_roots = _sys_path_roots(tree, path, repo_root)
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
                if _module_path_exists(scripts_root, path, top, local_names, extra_roots):
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


def _build_report(services_root: Path) -> dict[str, object]:
    scripts_root = services_root / "pipeline"
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
    dependency_sources = [
        "pyproject.toml",
        "uv.lock",
        "pipeline/pyproject.toml",
        "ai/pyproject.toml",
    ]
    return {
        "services_root": str(services_root),
        "scripts_root": str(scripts_root),
        "runtime_python_packages": runtime_packages,
        "test_only_python_packages": test_only_packages,
        "external_commands": _scan_external_commands(scripts_root),
        "packages": packages,
        "dependency_sources": dependency_sources,
        "notes": [
            "runtime_required=true means imported from runtime or devtool code, not just tests",
            "external_commands are non-Python binary dependencies detected by marker scan",
        ],
    }


def _render_markdown(report: dict[str, object]) -> str:
    output_dir = Path("docs") / "core" / "python"
    lines = [
        "# Python Pipeline Dependencies",
        "",
        "This file is generated from static import scanning under `backend/pipeline`.",
        "Regenerate with:",
        f"`{REGENERATE_COMMAND}`",
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
            "## Dependency Sources",
            "",
        ]
    )
    for path in report["dependency_sources"]:
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
    services_root = args.services_root.resolve()
    report = _build_report(services_root)
    if not args.services_root.is_absolute():
        report["services_root"] = args.services_root.as_posix()
        report["scripts_root"] = (args.services_root / "pipeline").as_posix()
    outputs: list[tuple[Path, str]] = []
    if args.json_out:
        outputs.append((args.json_out, json.dumps(report, ensure_ascii=False, indent=2) + "\n"))
    if args.markdown_out:
        outputs.append((args.markdown_out, _render_markdown(report)))
    if args.runtime_req_out:
        outputs.append(
            (args.runtime_req_out, _render_requirements(report["runtime_python_packages"]))
        )
    if args.test_req_out:
        outputs.append(
            (args.test_req_out, _render_requirements(report["test_only_python_packages"]))
        )

    if args.check:
        stale = [
            path
            for path, expected in outputs
            if not path.is_file() or path.read_text(encoding="utf-8") != expected
        ]
        if stale:
            print("生成产物与当前源码不一致：", file=sys.stderr)
            for path in stale:
                print(f"  {path}", file=sys.stderr)
            print(f"重新生成：{REGENERATE_COMMAND}", file=sys.stderr)
            raise SystemExit(1)
        print("pipeline dependency reports are in sync")
        return

    for path, expected in outputs:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(expected, encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

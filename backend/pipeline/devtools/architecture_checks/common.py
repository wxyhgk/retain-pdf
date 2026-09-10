from __future__ import annotations

import ast
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[4]
SCRIPTS_ROOT = REPO_ROOT / "backend" / "pipeline"
PACKAGE_ROOT = SCRIPTS_ROOT / "retainpdf_pipeline"


class ArchitectureCheckSyntaxError(Exception):
    def __init__(self, path: Path, error: SyntaxError) -> None:
        self.path = path
        self.error = error
        location = f"{error.lineno}:{error.offset}" if error.lineno else "unknown"
        super().__init__(
            f"{display_path(path)}: syntax error while scanning imports at {location}: {error.msg}"
        )


def scan_py_files(root: Path) -> list[Path]:
    paths: list[Path] = []
    for path in root.rglob("*.py"):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(root).parts
        if "__pycache__" in rel_parts or ".ipynb_checkpoints" in rel_parts:
            continue
        paths.append(path)
    return sorted(paths)


def rel(path: Path) -> Path:
    return path.relative_to(SCRIPTS_ROOT)


def display_path(path: Path) -> Path:
    try:
        return rel(path)
    except ValueError:
        return path


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_python_file(path: Path) -> ast.AST:
    try:
        return ast.parse(read_text(path), filename=str(path))
    except SyntaxError as exc:
        raise ArchitectureCheckSyntaxError(path, exc) from exc


def imported_modules(path: Path) -> list[str]:
    modules: list[str] = []
    tree = parse_python_file(path)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def imported_from_symbols(path: Path) -> list[tuple[str, str]]:
    symbols: list[tuple[str, str]] = []
    tree = parse_python_file(path)
    for node in ast.walk(tree):
        if not isinstance(node, ast.ImportFrom) or not node.module:
            continue
        for alias in node.names:
            symbols.append((node.module, alias.name))
    return symbols


def module_allowed(module: str, allowed_prefixes: tuple[str, ...]) -> bool:
    return any(module == prefix or module.startswith(f"{prefix}.") for prefix in allowed_prefixes)


__all__ = [
    "ArchitectureCheckSyntaxError",
    "PACKAGE_ROOT",
    "REPO_ROOT",
    "SCRIPTS_ROOT",
    "imported_from_symbols",
    "imported_modules",
    "module_allowed",
    "parse_python_file",
    "read_text",
    "display_path",
    "rel",
    "scan_py_files",
]

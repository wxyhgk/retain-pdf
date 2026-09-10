#!/usr/bin/env python3
"""Count RetainPDF source lines without external dependencies."""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


DEFAULT_EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".claude",
    ".ipynb_checkpoints",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "target",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
    ".cache",
    "runs",
    "tmp",
    "vendor",
    "work",
}

DEFAULT_EXCLUDED_PATHS = {
    ("PDF_MD_lib",),
    ("data", "jobs"),
    ("backend", "data", "jobs"),
    ("experiments", "render-chunk-size-benchmark"),
    ("experiments", "render-combined-prewarm"),
    ("experiments", "render-benchmark-533", "case-data"),
    ("experiments", "layout-fit", "fixtures", "jobs"),
    ("experiments", "layout-fit", "fixtures", "pdf-pages"),
    ("experiments", "layout-fit", "fixtures", "source-pdfs"),
}

ALWAYS_EXCLUDED_DIRS = {".git"}

BINARY_EXTENSIONS = {
    ".7z",
    ".a",
    ".avi",
    ".bcmap",
    ".bin",
    ".bmp",
    ".bz2",
    ".class",
    ".dmg",
    ".doc",
    ".docx",
    ".eot",
    ".exe",
    ".gif",
    ".gz",
    ".ico",
    ".jar",
    ".jpeg",
    ".jpg",
    ".mov",
    ".mp3",
    ".mp4",
    ".o",
    ".otf",
    ".pdf",
    ".pfb",
    ".png",
    ".pyc",
    ".pyd",
    ".rlib",
    ".so",
    ".sqlite",
    ".sqlite3",
    ".tar",
    ".tiff",
    ".ttf",
    ".wasm",
    ".webp",
    ".woff",
    ".woff2",
    ".xls",
    ".xlsx",
    ".zip",
}

SOURCE_EXTENSIONS = {
    ".bat": "Batch",
    ".c": "C",
    ".cfg": "Config",
    ".conf": "Config",
    ".cpp": "C++",
    ".css": "CSS",
    ".csv": "CSV",
    ".dockerignore": "Docker",
    ".env": "Env",
    ".example": "Example",
    ".go": "Go",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header",
    ".html": "HTML",
    ".ini": "Config",
    ".js": "JavaScript",
    ".json": "JSON",
    ".jsx": "JavaScript",
    ".lock": "Lockfile",
    ".md": "Markdown",
    ".mjs": "JavaScript",
    ".ps1": "PowerShell",
    ".py": "Python",
    ".rs": "Rust",
    ".sh": "Shell",
    ".sql": "SQL",
    ".svg": "SVG",
    ".toml": "TOML",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".txt": "Text",
    ".typ": "Typst",
    ".xml": "XML",
    ".yaml": "YAML",
    ".yml": "YAML",
}

SOURCE_FILENAMES = {
    "Dockerfile": "Docker",
    "Makefile": "Makefile",
    "README": "Text",
}

SINGLE_LINE_COMMENTS = {
    ".bat": ("REM ", "::"),
    ".c": ("//",),
    ".conf": ("#",),
    ".cpp": ("//",),
    ".cfg": ("#",),
    ".css": (),
    ".dockerignore": ("#",),
    ".env": ("#",),
    ".go": ("//",),
    ".h": ("//",),
    ".hpp": ("//",),
    ".ini": ("#", ";"),
    ".js": ("//",),
    ".jsx": ("//",),
    ".mjs": ("//",),
    ".ps1": ("#",),
    ".py": ("#",),
    ".rs": ("//",),
    ".sh": ("#",),
    ".sql": ("--",),
    ".toml": ("#",),
    ".ts": ("//",),
    ".tsx": ("//",),
    ".typ": ("//",),
    ".yaml": ("#",),
    ".yml": ("#",),
}

BLOCK_COMMENTS = {
    ".c": (("/*", "*/"),),
    ".cpp": (("/*", "*/"),),
    ".css": (("/*", "*/"),),
    ".go": (("/*", "*/"),),
    ".h": (("/*", "*/"),),
    ".hpp": (("/*", "*/"),),
    ".html": (("<!--", "-->"),),
    ".js": (("/*", "*/"),),
    ".jsx": (("/*", "*/"),),
    ".mjs": (("/*", "*/"),),
    ".py": (('"""', '"""'), ("'''", "'''")),
    ".rs": (("/*", "*/"),),
    ".svg": (("<!--", "-->"),),
    ".ts": (("/*", "*/"),),
    ".tsx": (("/*", "*/"),),
    ".xml": (("<!--", "-->"),),
}

MAX_FILE_BYTES = 2 * 1024 * 1024
NUL_SAMPLE_BYTES = 4096


@dataclass
class Counts:
    files: int = 0
    total_lines: int = 0
    code_lines: int = 0
    blank_lines: int = 0
    comment_lines: int = 0

    def add(self, other: "Counts") -> None:
        self.files += other.files
        self.total_lines += other.total_lines
        self.code_lines += other.code_lines
        self.blank_lines += other.blank_lines
        self.comment_lines += other.comment_lines

    def as_dict(self) -> dict[str, int]:
        return {
            "files": self.files,
            "total_lines": self.total_lines,
            "code_lines": self.code_lines,
            "blank_lines": self.blank_lines,
            "comment_lines": self.comment_lines,
        }


def language_for(path: Path) -> str | None:
    if path.name in SOURCE_FILENAMES:
        return SOURCE_FILENAMES[path.name]
    if path.name.startswith("Dockerfile"):
        return "Docker"
    if path.suffix:
        return SOURCE_EXTENSIONS.get(path.suffix.lower())
    return None


def extension_key(path: Path) -> str:
    if path.suffix:
        return path.suffix.lower()
    return path.name


def path_has_parts(path: Path, parts: tuple[str, ...]) -> bool:
    path_parts = path.parts
    width = len(parts)
    return any(tuple(path_parts[index : index + width]) == parts for index in range(len(path_parts) - width + 1))


def iter_files(root: Path, include_all: bool) -> Iterable[Path]:
    for current_root, dirnames, filenames in os.walk(root):
        current = Path(current_root)
        relative_dir = current.relative_to(root)
        excluded_dirs = ALWAYS_EXCLUDED_DIRS if include_all else DEFAULT_EXCLUDED_DIRS
        dirnames[:] = [
            dirname
            for dirname in dirnames
            if dirname not in excluded_dirs
        ]

        if not include_all and any(path_has_parts(relative_dir, parts) for parts in DEFAULT_EXCLUDED_PATHS):
            dirnames[:] = []
            continue

        for filename in filenames:
            path = current / filename
            relative_path = path.relative_to(root)
            if not include_all and any(path_has_parts(relative_path, parts) for parts in DEFAULT_EXCLUDED_PATHS):
                continue
            yield path


def is_binary(path: Path) -> bool:
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with path.open("rb") as handle:
            sample = handle.read(NUL_SAMPLE_BYTES)
    except OSError:
        return True
    return b"\0" in sample


def should_count(path: Path, include_all: bool) -> bool:
    try:
        if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
            return False
    except OSError:
        return False
    if is_binary(path):
        return False
    if include_all:
        return True
    return language_for(path) is not None


def line_kind(stripped: str, suffix: str, block_state: tuple[str, str] | None) -> tuple[str, tuple[str, str] | None]:
    if not stripped:
        return "blank", block_state

    if block_state is not None:
        _, end = block_state
        if end in stripped:
            block_state = None
        return "comment", block_state

    for start, end in BLOCK_COMMENTS.get(suffix, ()):
        if stripped.startswith(start):
            if end not in stripped[len(start) :]:
                block_state = (start, end)
            return "comment", block_state

    for marker in SINGLE_LINE_COMMENTS.get(suffix, ()):
        if stripped.startswith(marker):
            return "comment", block_state

    return "code", block_state


def count_file(path: Path) -> Counts:
    suffix = path.suffix.lower()
    counts = Counts(files=1)
    block_state: tuple[str, str] | None = None
    try:
        with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
            for line in handle:
                counts.total_lines += 1
                kind, block_state = line_kind(line.strip(), suffix, block_state)
                if kind == "blank":
                    counts.blank_lines += 1
                elif kind == "comment":
                    counts.comment_lines += 1
                else:
                    counts.code_lines += 1
    except OSError:
        return Counts()
    return counts


def build_report(root: Path, include_all: bool) -> dict[str, object]:
    total = Counts()
    by_language: dict[str, Counts] = {}
    by_extension: dict[str, Counts] = {}

    for path in iter_files(root, include_all):
        if not should_count(path, include_all):
            continue
        counts = count_file(path)
        if counts.files == 0:
            continue
        language = language_for(path) or "Text"
        extension = extension_key(path)
        total.add(counts)
        by_language.setdefault(language, Counts()).add(counts)
        by_extension.setdefault(extension, Counts()).add(counts)

    return {
        "root": str(root),
        "mode": "all" if include_all else "default",
        "total": total.as_dict(),
        "by_language": {key: value.as_dict() for key, value in sorted(by_language.items())},
        "by_extension": {key: value.as_dict() for key, value in sorted(by_extension.items())},
    }


def print_table(title: str, rows: dict[str, dict[str, int]]) -> None:
    print(f"\n{title}")
    print(f"{'name':<22} {'files':>7} {'total':>10} {'code':>10} {'blank':>10} {'comment':>10}")
    print("-" * 75)
    for name, counts in sorted(rows.items(), key=lambda item: item[1]["total_lines"], reverse=True):
        print(
            f"{name:<22} {counts['files']:>7} {counts['total_lines']:>10} "
            f"{counts['code_lines']:>10} {counts['blank_lines']:>10} {counts['comment_lines']:>10}"
        )


def print_text_report(report: dict[str, object]) -> None:
    total = report["total"]
    assert isinstance(total, dict)
    print(f"Root: {report['root']}")
    print(f"Mode: {report['mode']}")
    print(
        "Total: "
        f"files={total['files']} "
        f"lines={total['total_lines']} "
        f"code={total['code_lines']} "
        f"blank={total['blank_lines']} "
        f"comment={total['comment_lines']}"
    )
    print_table("By language", report["by_language"])  # type: ignore[arg-type]
    print_table("By extension", report["by_extension"])  # type: ignore[arg-type]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Count RetainPDF code lines by language and extension.")
    parser.add_argument(
        "root",
        nargs="?",
        default=Path(__file__).resolve().parents[3],
        type=Path,
        help="repository root to scan; defaults to the RetainPDF checkout",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="relax default directory and source-extension filters; .git, binary files, and files over 2 MiB stay excluded",
    )
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    report = build_report(root, include_all=args.all)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_text_report(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

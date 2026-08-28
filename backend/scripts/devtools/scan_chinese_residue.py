#!/usr/bin/env python3
"""Scan source files for remaining Chinese text and write a Markdown worklist."""

from __future__ import annotations

import argparse
import os
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


CHINESE_RE = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+")
MAX_FILE_BYTES = 2 * 1024 * 1024
NUL_SAMPLE_BYTES = 4096

DEFAULT_OUTPUT = Path("docs/wiki/translation/chinese-residue-report.md")

EXCLUDED_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".claude",
    ".ipynb_checkpoints",
    ".kilo",
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

EXCLUDED_PATHS = {
    ("PDF_MD_lib",),
    ("data",),
    ("backend", "data"),
    ("docs", "wiki", "translation", "chinese-residue-report.md"),
    ("frontend", "tests", "visual", "baseline"),
    ("frontend", "tests", "helpers", "css-color-literals-baseline.json"),
    ("frontend", "tests", "helpers", "tsx-color-literals-baseline.json"),
    ("backend", "scripts", "devtools", "promptfoo", "fixtures"),
    ("backend", "scripts", "devtools", "tests", "test_scan_chinese_residue.py"),
    ("backend", "scripts", "devtools", "tests", "translation", "golden_replay"),
    ("backend", "scripts", "devtools", "tests", "document_schema", "fixtures"),
    ("resources", "samples"),
}

BINARY_EXTENSIONS = {
    ".7z",
    ".avi",
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
    ".otf",
    ".pdf",
    ".png",
    ".pyc",
    ".pyd",
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
    ".bat",
    ".c",
    ".cfg",
    ".conf",
    ".cpp",
    ".css",
    ".env",
    ".go",
    ".h",
    ".hpp",
    ".html",
    ".ini",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".rs",
    ".sh",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".typ",
    ".xml",
    ".yaml",
    ".yml",
}

SOURCE_FILENAMES = {
    ".dockerignore",
    ".gitignore",
    "Dockerfile",
    "Makefile",
    "README",
}

PROMPT_PATH_MARKERS = (
    ("backend", "scripts", "foundation", "prompts"),
)

PROMPT_CODE_NAMES = {
    "prompt_building.py",
    "prompt_protocols.py",
    "direct_typst_math.py",
    "prompting.py",
}

UI_PATH_MARKERS = (
    ("frontend", "src"),
    ("desktop",),
)

DOC_PATH_MARKERS = (
    ("doc",),
    ("docs",),
)

COMMENT_PREFIXES = {
    ".bat": ("REM ", "::"),
    ".c": ("//",),
    ".conf": ("#",),
    ".cpp": ("//",),
    ".cfg": ("#",),
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

BLOCK_COMMENT_MARKERS = {
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

REPORT_SECTIONS = (
    ("prompt", "Prompt -> English"),
    ("ui", "UI -> Vietnamese"),
    ("comment", "Comment -> Vietnamese"),
    ("docs", "Docs -> Vietnamese"),
    ("manual", "Review manually"),
)

TRANSLATION_TARGETS = {
    "prompt": "Vietnamese",
    "ui": "Vietnamese",
    "comment": "Vietnamese",
    "docs": "Vietnamese",
    "manual": "Review manually",
}


@dataclass(frozen=True)
class ChineseResidue:
    path: str
    line_number: int
    category: str
    target: str
    snippet: str


@dataclass(frozen=True)
class ScanReport:
    root: Path
    scanned_files: int
    matches: tuple[ChineseResidue, ...]


def _normalize_parts(path: Path) -> tuple[str, ...]:
    return tuple(part.replace("\\", "/") for part in path.parts)


def path_has_parts(path: Path, parts: Sequence[str]) -> bool:
    path_parts = _normalize_parts(path)
    width = len(parts)
    return any(tuple(path_parts[index : index + width]) == tuple(parts) for index in range(len(path_parts) - width + 1))


def is_source_file(path: Path) -> bool:
    return path.name in SOURCE_FILENAMES or path.suffix.lower() in SOURCE_EXTENSIONS


def is_binary(path: Path) -> bool:
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with path.open("rb") as handle:
            sample = handle.read(NUL_SAMPLE_BYTES)
    except OSError:
        return True
    return b"\0" in sample


def should_scan_file(path: Path) -> bool:
    try:
        if not path.is_file() or path.stat().st_size > MAX_FILE_BYTES:
            return False
    except OSError:
        return False
    return is_source_file(path) and not is_binary(path)


def iter_source_files(repo_root: Path, exclude: Iterable[Sequence[str]] = EXCLUDED_PATHS) -> Iterable[Path]:
    excluded_paths = tuple(tuple(parts) for parts in exclude)
    for current_root, dirnames, filenames in os.walk(repo_root):
        current = Path(current_root)
        relative_dir = current.relative_to(repo_root)
        dirnames[:] = [dirname for dirname in dirnames if dirname not in EXCLUDED_DIRS]

        if any(path_has_parts(relative_dir, parts) for parts in excluded_paths):
            dirnames[:] = []
            continue

        for filename in filenames:
            path = current / filename
            relative_path = path.relative_to(repo_root)
            if any(path_has_parts(relative_path, parts) for parts in excluded_paths):
                continue
            if should_scan_file(path):
                yield path


def is_comment_line(line: str, suffix: str, block_state: tuple[str, str] | None) -> tuple[bool, tuple[str, str] | None]:
    stripped = line.strip()
    if block_state is not None:
        _, end = block_state
        if end in stripped:
            block_state = None
        return True, block_state

    for start, end in BLOCK_COMMENT_MARKERS.get(suffix, ()):
        if stripped.startswith(start):
            if end not in stripped[len(start) :]:
                block_state = (start, end)
            return True, block_state

    return any(stripped.startswith(prefix) for prefix in COMMENT_PREFIXES.get(suffix, ())), block_state


def _is_prompt_path(relative_path: Path) -> bool:
    return (
        relative_path.suffix.lower() == ".txt"
        and any(path_has_parts(relative_path, marker) for marker in PROMPT_PATH_MARKERS)
    ) or relative_path.name in PROMPT_CODE_NAMES


def _is_ui_path(relative_path: Path) -> bool:
    if not any(path_has_parts(relative_path, marker) for marker in UI_PATH_MARKERS):
        return False
    return relative_path.suffix.lower() in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".html"}


def _is_docs_path(relative_path: Path) -> bool:
    return relative_path.suffix.lower() == ".md" or any(path_has_parts(relative_path, marker) for marker in DOC_PATH_MARKERS)


def classify_residue(relative_path: Path, line: str, is_comment: bool) -> str:
    if _is_prompt_path(relative_path):
        return "prompt"
    if is_comment:
        return "comment"
    if _is_ui_path(relative_path):
        return "ui"
    if _is_docs_path(relative_path):
        return "docs"
    return "manual"


def build_snippet(line: str, max_chars: int = 180) -> str:
    compact = " ".join(line.strip().split())
    if len(compact) <= max_chars:
        return compact
    return compact[: max_chars - 1].rstrip() + "..."


def scan_file(repo_root: Path, path: Path) -> tuple[ChineseResidue, ...]:
    relative_path = path.relative_to(repo_root)
    suffix = path.suffix.lower()
    block_state: tuple[str, str] | None = None
    matches: list[ChineseResidue] = []

    try:
        with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
            for line_number, line in enumerate(handle, start=1):
                is_comment, block_state = is_comment_line(line, suffix, block_state)
                if not CHINESE_RE.search(line):
                    continue
                category = classify_residue(relative_path, line, is_comment)
                matches.append(
                    ChineseResidue(
                        path=relative_path.as_posix(),
                        line_number=line_number,
                        category=category,
                        target=TRANSLATION_TARGETS[category],
                        snippet=build_snippet(line),
                    )
                )
    except OSError:
        return ()

    return tuple(matches)


def scan_chinese_residue(
    repo_root: Path,
    include: Iterable[str] | None = None,
    exclude: Iterable[Sequence[str]] = EXCLUDED_PATHS,
) -> ScanReport:
    root = repo_root.resolve()
    include_prefixes = tuple(include or ())
    scanned_files = 0
    matches: list[ChineseResidue] = []

    for path in iter_source_files(root, exclude=exclude):
        relative_path = path.relative_to(root).as_posix()
        if include_prefixes and not relative_path.startswith(include_prefixes):
            continue
        scanned_files += 1
        matches.extend(scan_file(root, path))

    return ScanReport(root=root, scanned_files=scanned_files, matches=tuple(matches))


def markdown_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("|", "\\|")
        .replace("[", "&#91;")
        .replace("]", "&#93;")
        .replace("(", "&#40;")
        .replace(")", "&#41;")
        .replace("\n", " ")
    )


def render_markdown_report(report: ScanReport) -> str:
    counts = Counter(match.category for match in report.matches)
    by_section: dict[str, list[ChineseResidue]] = defaultdict(list)
    for match in report.matches:
        by_section[match.category].append(match)

    lines = [
        "# Chinese Residue Translation Worklist",
        "",
        "Generated by `retainpdf-scan-chinese-residue`.",
        "",
        "## Summary",
        "",
        f"- Repository root: `{report.root}`",
        f"- Scanned source files: `{report.scanned_files}`",
        f"- Chinese residue lines: `{len(report.matches)}`",
        "",
        "| Classification | Count | Target |",
        "| --- | ---: | --- |",
    ]
    for category, title in REPORT_SECTIONS:
        lines.append(f"| {title} | {counts.get(category, 0)} | {TRANSLATION_TARGETS[category]} |")

    for category, title in REPORT_SECTIONS:
        lines.extend(["", f"## {title}", ""])
        section_matches = sorted(by_section.get(category, ()), key=lambda item: (item.path, item.line_number))
        if not section_matches:
            lines.append("_No matches._")
            continue
        lines.extend(
            [
                "| Location | Target | Snippet |",
                "| --- | --- | --- |",
            ]
        )
        for match in section_matches:
            location = f"[{match.path}:{match.line_number}](../../../{match.path}#L{match.line_number})"
            lines.append(
                f"| {location} | {markdown_escape(match.target)} | {markdown_escape(match.snippet)} |"
            )

    lines.append("")
    return "\n".join(lines)


def write_markdown_report(report: ScanReport, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render_markdown_report(report), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scan RetainPDF source files for remaining Chinese text.")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--include",
        action="append",
        default=[],
        help="optional relative path prefix to include; may be passed multiple times",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output = args.output
    if not output.is_absolute():
        output = repo_root / output
    report = scan_chinese_residue(repo_root, include=args.include)
    write_markdown_report(report, output)
    print(f"Wrote {len(report.matches)} matches from {report.scanned_files} files to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

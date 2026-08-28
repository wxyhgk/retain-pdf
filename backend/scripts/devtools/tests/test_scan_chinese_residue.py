from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from devtools.scan_chinese_residue import classify_residue
from devtools.scan_chinese_residue import render_markdown_report
from devtools.scan_chinese_residue import scan_chinese_residue


def test_scanner_detects_chinese_and_classifies_core_file_types(tmp_path: Path) -> None:
    prompt = tmp_path / "backend" / "scripts" / "foundation" / "prompts" / "translation_system.txt"
    prompt.parent.mkdir(parents=True)
    prompt.write_text("\u4f60\u662f\u7ffb\u8bd1\u52a9\u624b\n", encoding="utf-8")

    ui = tmp_path / "frontend" / "src" / "pages" / "home" / "View.tsx"
    ui.parent.mkdir(parents=True)
    ui.write_text('export const title = "\u5f00\u59cb\u7ffb\u8bd1";\n', encoding="utf-8")

    comment = tmp_path / "backend" / "scripts" / "devtools" / "tool.py"
    comment.parent.mkdir(parents=True)
    comment.write_text("# \u53ea\u626b\u63cf\u6e90\u7801\nvalue = 1\n", encoding="utf-8")

    docs = tmp_path / "docs" / "guide.md"
    docs.parent.mkdir(parents=True)
    docs.write_text("## \u4f7f\u7528\u8bf4\u660e\n", encoding="utf-8")

    report = scan_chinese_residue(tmp_path)
    categories = {(match.path, match.category, match.target) for match in report.matches}

    assert ("backend/scripts/foundation/prompts/translation_system.txt", "prompt", "English") in categories
    assert ("frontend/src/pages/home/View.tsx", "ui", "Vietnamese") in categories
    assert ("backend/scripts/devtools/tool.py", "comment", "Vietnamese") in categories
    assert ("docs/guide.md", "docs", "Vietnamese") in categories


def test_scanner_skips_excluded_directories_and_binary_files(tmp_path: Path) -> None:
    node_file = tmp_path / "node_modules" / "pkg" / "index.js"
    node_file.parent.mkdir(parents=True)
    node_file.write_text('export const label = "\u4e2d\u6587";\n', encoding="utf-8")

    data_file = tmp_path / "data" / "jobs" / "job.json"
    data_file.parent.mkdir(parents=True)
    data_file.write_text('{"text":"\u4e2d\u6587"}\n', encoding="utf-8")

    binary = tmp_path / "frontend" / "src" / "asset.bin"
    binary.parent.mkdir(parents=True)
    binary.write_bytes(b"\x00\xe4\xb8\xad")

    source = tmp_path / "frontend" / "src" / "visible.ts"
    source.write_text('export const label = "\u53ef\u89c1\u4e2d\u6587";\n', encoding="utf-8")

    report = scan_chinese_residue(tmp_path)

    assert [match.path for match in report.matches] == ["frontend/src/visible.ts"]


def test_manual_classification_for_ambiguous_source_line() -> None:
    assert classify_residue(Path("backend/scripts/services/runtime.py"), 'value = "中文"', False) == "manual"


def test_markdown_report_preserves_line_numbers_and_escapes_table_cells(tmp_path: Path) -> None:
    source = tmp_path / "frontend" / "src" / "View.tsx"
    source.parent.mkdir(parents=True)
    source.write_text("\n".join(["const a = 1;", 'const label = "\u5f00\u59cb|\u7ffb\u8bd1";']) + "\n", encoding="utf-8")

    report = scan_chinese_residue(tmp_path)
    markdown = render_markdown_report(report)

    assert "[frontend/src/View.tsx:2](../../../frontend/src/View.tsx#L2)" in markdown
    assert "开始\\|翻译" in markdown


def test_markdown_report_escapes_snippet_links(tmp_path: Path) -> None:
    docs = tmp_path / "docs" / "guide.md"
    docs.parent.mkdir(parents=True)
    docs.write_text("[\u8bf4\u660e](../missing.md)\n", encoding="utf-8")

    markdown = render_markdown_report(scan_chinese_residue(tmp_path))

    assert "&#91;说明&#93;&#40;../missing.md&#41;" in markdown

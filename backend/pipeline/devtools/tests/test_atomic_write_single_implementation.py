"""「先写临时文件、再换名」只许有一份实现：`retainpdf_base/io.py`（2026-11-26，状态管理 Z5 / S33）。

以前断点、页文件、manifest、memo、领域推断、规范化文档……各写一份，原子性不一、Windows 上都不重试（杀毒软件短暂占着
文件就整个任务失败）。现在都调 `atomic_write` / `save_json_atomic` / `replace_file`，重试和清理临时文件只在那一处。

下面的名单是还没收过来的：渲染里用 PDF 库把整份 PDF 存到临时路径再换上的几处（写法是库的 `save(path)`，不是往句柄里写），
和只许用标准库的翻译 agent 核心包。名单只许减不许加；新代码要原子写就调底座包。
"""

from __future__ import annotations

import ast
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[3]
SINGLE_IMPLEMENTATION = "base/retainpdf_base/io.py"
KNOWN_REMAINING = {
    "pipeline/retainpdf_pipeline/render/document/link_relocation.py",
    "pipeline/retainpdf_pipeline/render/document/pikepdf_pages.py",
    "pipeline/retainpdf_pipeline/render/output/rpr_fit/formula_check.py",
    "pipeline/retainpdf_pipeline/render/output/tables/overlay.py",
    "pipeline/retainpdf_pipeline/render/prepare/text_strip.py",
    "pipeline/retainpdf_pipeline/render/source/compression/ghostscript.py",
    "pipeline/retainpdf_pipeline/render/source/compression/save_ops.py",
    "pipeline/retainpdf_pipeline/render/source/render_source.py",
    "pipeline/retainpdf_pipeline/render/source_cleanup/pdf/document.py",
    # 核心包只许用标准库（backend/translation-agent/tests 钉着），不能 import 底座包。
    "translation-agent/retainpdf_translation_agent/runner.py",
}
_TEMPORARY_HINTS = ("tmp", "temp", "scratch")


def _skipped(relative: str) -> bool:
    parts = relative.split("/")
    return ".venv" in parts or "tests" in parts or "node_modules" in parts or parts[-1].startswith("test_")


def _replaces_a_file(node: ast.AST) -> bool:
    """``os.replace(...)`` / ``os.rename(...)``，或者 ``<临时路径>.replace(target)``（Path.replace）。"""
    if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
        return False
    if node.func.attr not in {"replace", "rename"}:
        return False
    owner = node.func.value
    if isinstance(owner, ast.Name) and owner.id == "os":
        return True
    return (
        len(node.args) == 1
        and not node.keywords
        and isinstance(owner, ast.Name)
        and any(hint in owner.id.lower() for hint in _TEMPORARY_HINTS)
    )


def _files_that_replace_files() -> set[str]:
    found: set[str] = set()
    for path in BACKEND_ROOT.rglob("*.py"):
        relative = path.relative_to(BACKEND_ROOT).as_posix()
        if _skipped(relative):
            continue
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError):
            continue
        if any(_replaces_a_file(node) for node in ast.walk(tree)):
            found.add(relative)
    return found


def test_temporary_file_then_replace_lives_only_in_the_base_package() -> None:
    found = _files_that_replace_files()
    assert SINGLE_IMPLEMENTATION in found, "扫描规则失灵了：底座包自己的实现都没扫到"
    extra = sorted(found - KNOWN_REMAINING - {SINGLE_IMPLEMENTATION})
    assert not extra, "这些文件自己写了一份「临时文件再换名」，改调 retainpdf_base.io 的 atomic_write / save_json_atomic / replace_file：\n" + "\n".join(extra)


def test_known_remaining_list_only_shrinks() -> None:
    stale = sorted(KNOWN_REMAINING - _files_that_replace_files())
    assert not stale, "这些文件已经收过去了，从 KNOWN_REMAINING 删掉：\n" + "\n".join(stale)

"""每页译文的文件名。

2026-11-02 从 workflow/legacy/page_translation.py 搬来：那个按页翻译的老流程（translate_items_to_path、
pages.translate_book_pages）没人调用，而且它按页收尾编排信息，正是跨页接续会断的写法（core/orchestration/units.py），已删。
"""

from __future__ import annotations

from pathlib import Path


def default_page_translation_name(page_idx: int) -> str:
    """每页译文的文件名，不带模型名（2026-10-30 前叫 page-NNN-deepseek.json，见 legacy_page_translation_name）。"""
    return f"page-{page_idx + 1:03d}.json"


def legacy_page_translation_name(page_idx: int) -> str:
    """旧任务的每页译文文件名；读的一侧照常认，写的一侧只在这一页已经有旧文件时沿用。"""
    return f"page-{page_idx + 1:03d}-deepseek.json"


def page_translation_path(output_dir: Path, page_idx: int) -> Path:
    """这一页译文写到哪：目录里已经有旧名字的文件（升级前开始、升级后续跑的任务）就沿用旧名字，免得同一页出现两份；否则用新名字。"""
    legacy = output_dir / legacy_page_translation_name(page_idx)
    return legacy if legacy.exists() else output_dir / default_page_translation_name(page_idx)


__all__ = [
    "default_page_translation_name",
    "legacy_page_translation_name",
    "page_translation_path",
]

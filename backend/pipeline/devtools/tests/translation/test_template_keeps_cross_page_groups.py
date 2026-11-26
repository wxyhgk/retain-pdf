"""读页（`ensure_translation_template`）不能把跨页接续组降成单块（2026-11-26，S23；状态梳理 T-N5）。

以前读页末尾按单页刷新翻译单元：跨页组在这一页里只有一个成员，被降成 single，组层译文 `group_*` 被清空写回磁盘，
`translation_unit_protected_source_text` 改回本块原文；之后整本刷新只把组号补回来，组层原文、译文回不来。
续跑后的块和第一次跑完的块同一个字段含义不同（最终补救、修订校验、渲染的组原文都读它）。
"""
from __future__ import annotations

import json
from pathlib import Path

from retainpdf_translation.core.ocr.models import TextItem
from retainpdf_translation.core.payload.parts.apply import apply_translated_text_map
from retainpdf_translation.core.payload.parts.units import pending_translation_items
from retainpdf_translation.core.payload.translations import ensure_translation_template
from retainpdf_translation.core.payload.translations import load_translations
from retainpdf_translation.core.payload.translations import save_translations

GROUP_TEXT = "前半句接着在下一页继续。"


def _text_item(page_idx: int, block_idx: int, text: str) -> TextItem:
    return TextItem(
        item_id=f"p{page_idx + 1:03d}-b{block_idx:03d}",
        page_idx=page_idx,
        block_idx=block_idx,
        block_type="text",
        bbox=[50, 100 + block_idx * 40, 500, 130 + block_idx * 40],
        text=text,
        segments=[],
        lines=[],
        block_kind="text",
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
        policy_translate=True,
        reading_order=block_idx,
        raw_block_type="text",
        normalized_sub_type="body",
    )


def _translated_cross_page_group(tmp_path: Path) -> tuple[dict[int, list[TextItem]], dict[int, Path]]:
    items = {0: [_text_item(0, 9, "The first half of a sentence that")], 1: [_text_item(1, 0, "continues on the next page.")]}
    paths = {idx: tmp_path / f"page-{idx + 1:03d}-deepseek.json" for idx in items}
    for idx in items:
        ensure_translation_template(items[idx], paths[idx], idx, math_mode="direct_typst")
    pages = {idx: load_translations(paths[idx]) for idx in items}
    for records in pages.values():
        records[0]["continuation_group"] = "cg-1"
    flat = [record for idx in sorted(pages) for record in pages[idx]]
    [unit] = pending_translation_items(flat)
    assert unit["item_id"].startswith("__cg__:")
    apply_translated_text_map(flat, {unit["item_id"]: GROUP_TEXT})
    for idx in pages:
        save_translations(paths[idx], pages[idx])
    return items, paths


def test_reading_a_page_keeps_the_cross_page_group(tmp_path: Path) -> None:
    items, paths = _translated_cross_page_group(tmp_path)
    before = load_translations(paths[0])[0]
    assert before["translation_unit_kind"] == "group"
    assert before["group_translated_text"] == GROUP_TEXT
    assert "continues" in before["translation_unit_protected_source_text"]
    before_bytes = paths[0].read_bytes()

    # 续跑：逐页读回模板
    for idx in items:
        ensure_translation_template(items[idx], paths[idx], idx, math_mode="direct_typst")

    after = load_translations(paths[0])[0]
    assert after["translation_unit_kind"] == "group"
    assert after["group_translated_text"] == GROUP_TEXT
    assert "continues" in after["translation_unit_protected_source_text"]
    assert paths[0].read_bytes() == before_bytes, "读页不该改写已经译好的页"

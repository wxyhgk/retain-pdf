"""目录条目的页码小块跟着条目走（2026-11-25）。

归一化时每条目录后面跟一个页码小块（``structure_role = toc_page_label``，ocr/document_schema/toc_pages.py），
定译就是页码本身，排版时擦掉原来的页码、在原处重画（``render_item.redraws_same_text``）。不少书一行的标题、点线、
页码是同一条绘字指令：擦页码也会把标题擦掉。所以条目自己没有译文要排（翻译失败、模型判保留原文、没翻）时，
它的页码也不动，标题和页码一起留在原图上。

页码小块紧跟在它的条目后面，块号是条目的块号加一。
"""

from __future__ import annotations

from retainpdf_pipeline.render.policy.cleanup_policy import item_is_marked_non_translated
from retainpdf_pipeline.render.layout.model.render_text import render_protected_translation_text

TOC_ENTRY_ROLE = "toc_entry"
TOC_PAGE_LABEL_ROLE = "toc_page_label"
_TRANSLATION_KEYS = (
    "translated_text",
    "protected_translated_text",
    "translation_unit_translated_text",
    "translation_unit_protected_translated_text",
    "group_translated_text",
    "group_protected_translated_text",
)


def _role(item: dict) -> str:
    return str(item.get("structure_role") or "").strip().lower()


def _block_idx(item: dict) -> int | None:
    value = item.get("block_idx")
    return value if isinstance(value, int) else None


def _entry_is_redrawn(entry: dict | None) -> bool:
    return entry is not None and not item_is_marked_non_translated(entry) and bool(render_protected_translation_text(entry))


def _held(label: dict) -> dict:
    held = dict(label)
    for key in _TRANSLATION_KEYS:
        if key in held:
            held[key] = ""
    held["final_status"] = "kept_origin"
    held["toc_page_label_held"] = True
    return held


def hold_toc_page_labels_of_untranslated_entries(pages: dict[int, list[dict]]) -> dict[int, list[dict]]:
    """条目不重画的，页码小块也不重画（改成保留原文）。没有页码小块的页原样返回。"""
    result: dict[int, list[dict]] = {}
    for page_idx, items in pages.items():
        if not any(isinstance(item, dict) and _role(item) == TOC_PAGE_LABEL_ROLE for item in items or []):
            result[page_idx] = items
            continue
        entries = {_block_idx(item): item for item in items if isinstance(item, dict) and _role(item) == TOC_ENTRY_ROLE}
        patched: list[dict] = []
        for item in items:
            if isinstance(item, dict) and _role(item) == TOC_PAGE_LABEL_ROLE:
                index = _block_idx(item)
                entry = entries.get(index - 1) if index is not None else None
                if not _entry_is_redrawn(entry):
                    item = _held(item)
            patched.append(item)
        result[page_idx] = patched
    return result


__all__ = ["hold_toc_page_labels_of_untranslated_entries"]

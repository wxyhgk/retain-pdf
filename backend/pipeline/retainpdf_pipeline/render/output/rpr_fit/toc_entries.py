"""目录条目交给引擎前的排版调整（2026-11-25）。

原文两行的目录条目（标题折行，页码在第二行），译文一行放得下时，引擎照框从上往下排，
译文落在第一行、页码在第二行，中间空一行，和页码对不齐。这里给引擎一份文档副本：这种条目的
排版框只留最后一行（页码那一行）。盖原文的框照旧是整条——引擎盖底色按 visual_profile 里的条目框，
擦原文按译文条目的框，都不看这份副本。

只认归一化时按文字层拆出的条目（`structure_role = toc_entry`，见 `ocr/document_schema/toc_pages.py`）。
"""

from __future__ import annotations

import copy
import json
import unicodedata
from pathlib import Path

TOC_ENTRY_ROLE = "toc_entry"
# 估宽：全角字一个字号宽，其余按 0.55 个字号；留 5% 余量。字号按原文的 0.8 倍估——引擎排中文目录
# 一般比原文字号小一圈（2026-11-25 那本书原文 11.46pt，排出来 9.1pt）
WIDE_CHAR_EM = 1.0
NARROW_CHAR_EM = 0.55
FIT_SLACK = 0.95
SOURCE_SIZE_SCALE = 0.8


def _block_number(identifier: str) -> int | None:
    _, _, tail = str(identifier or "").rpartition("-b")
    return int(tail) if tail.isdigit() else None


def estimated_text_width(text: str, font_size: float) -> float:
    width = 0.0
    for char in str(text or ""):
        wide = unicodedata.east_asian_width(char) in ("W", "F")
        width += (WIDE_CHAR_EM if wide else NARROW_CHAR_EM) * font_size
    return width


def _translations_by_block(translated_pages: dict[int, list[dict]]) -> dict[tuple[int, int], str]:
    found: dict[tuple[int, int], str] = {}
    for page_idx, items in translated_pages.items():
        for item in items or []:
            if not isinstance(item, dict) or str(item.get("structure_role") or "") != TOC_ENTRY_ROLE:
                continue
            number = _block_number(str(item.get("item_id") or ""))
            text = str(item.get("translated_text") or "").strip()
            if number is not None and text:
                found[(int(page_idx), number)] = text
    return found


def _last_line_box(block: dict, translated: str) -> list[float] | None:
    lines = [line for line in block.get("lines") or [] if isinstance(line, dict) and len(line.get("bbox") or []) == 4]
    if len(lines) < 2:
        return None
    font_size = float((block.get("metadata") or {}).get("toc_entry_source_font_size") or 0)
    if font_size <= 0:
        return None
    last = [float(value) for value in lines[-1]["bbox"]]
    if estimated_text_width(translated, font_size * SOURCE_SIZE_SCALE) > (last[2] - last[0]) * FIT_SLACK:
        return None
    return last


def toc_entry_layout_document(
    document_path: Path, translated_pages: dict[int, list[dict]], out_dir: Path
) -> tuple[Path, int]:
    """返回（给引擎的文档路径，改了几条）。没有要改的就返回原路径。"""
    translations = _translations_by_block(translated_pages)
    if not translations:
        return document_path, 0
    document = json.loads(Path(document_path).read_text(encoding="utf-8"))
    changed = 0
    for page in document.get("pages") or []:
        page_idx = int(page.get("page_index", -1))
        for block in page.get("blocks") or []:
            if str(block.get("structure_role") or "") != TOC_ENTRY_ROLE:
                continue
            number = _block_number(str(block.get("block_id") or ""))
            translated = translations.get((page_idx, number)) if number is not None else None
            if not translated:
                continue
            box = _last_line_box(block, translated)
            if box is None:
                continue
            last_line = copy.deepcopy(block["lines"][-1])
            for span in last_line.get("spans") or []:
                span["text"] = block.get("text", "")
            block["bbox"] = list(box)
            block["lines"] = [last_line]
            if isinstance(block.get("geometry"), dict):
                block["geometry"]["bbox"] = list(box)
            changed += 1
    if not changed:
        return document_path, 0
    target = Path(out_dir) / "document.toc-layout.json"
    target.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return target, changed

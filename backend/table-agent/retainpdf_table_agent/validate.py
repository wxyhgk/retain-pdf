"""模型交上来的格子译文的确定性校验：不过的格子连同原因退回给模型改，不靠模型自觉。

- 数字原样：译文里的数字（含小数）和原文一样多、一样的值；
- 上下标原样：`<sup>a</sup>`、`<sub>2</sub>` 一个不能少、不能改；
- 真翻了：除了说 keep 的，译文里要有中文；和原文一字不差的算 keep；
- 同表同译：原文一样的格子译法一样（含前面分段定下的）。
"""
from __future__ import annotations

import re
from collections import Counter

from retainpdf_table_agent.cells import Cell
from retainpdf_table_agent.cells import plain

KEEP = "keep"
_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")
_SCRIPT = re.compile(r"<(sup|sub)>(.*?)</\1>", re.DOTALL)
_CJK = re.compile(r"[㐀-鿿]")


def numbers(text: str) -> Counter:
    return Counter(_NUMBER.findall(plain(text)))


def scripts(text: str) -> Counter:
    return Counter((tag, " ".join(body.split())) for tag, body in _SCRIPT.findall(text or ""))


def normalize_source(text: str) -> str:
    return " ".join((text or "").split()).casefold()


def check_cell(cell: Cell, value: object) -> tuple[str | None, str | None]:
    """返回 (译文或 None 表示 keep, 错误原因或 None)。"""
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, "译文要是字符串（或 \"keep\"）"
    translated = value.strip()
    if not translated or translated.casefold() == KEEP or translated == cell.text:
        return None, None
    if numbers(translated) != numbers(cell.text):
        return None, f"数字和原文不一致（原文 {sorted(numbers(cell.text).elements())}，译文 {sorted(numbers(translated).elements())}）"
    if scripts(translated) != scripts(cell.text):
        return None, "上下标（<sup>/<sub> 及里面的内容）要原样保留"
    if not _CJK.search(plain(translated)):
        return None, "译文里没有中文；不该翻就写 \"keep\""
    return translated, None


def check_consistency(cells: dict[str, Cell], accepted: dict[str, str | None]) -> dict[str, str]:
    """原文一样、译法不一样的格子（都退回，让模型统一）。"""
    by_source: dict[str, set[str | None]] = {}
    for cell_id, translation in accepted.items():
        by_source.setdefault(normalize_source(cells[cell_id].text), set()).add(translation)
    errors: dict[str, str] = {}
    for cell_id, translation in accepted.items():
        variants = by_source[normalize_source(cells[cell_id].text)]
        if len(variants) > 1:
            shown = " / ".join(sorted(KEEP if value is None else value for value in variants))
            errors[cell_id] = f"原文相同的格子译法不一致（{shown}），统一成一种"
    return errors


__all__ = ["KEEP", "check_cell", "check_consistency", "normalize_source", "numbers", "scripts"]

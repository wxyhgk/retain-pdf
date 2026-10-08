"""引擎的 obstacles：底图上原样保留、译文不该压住的东西。

来源是 OCR 规范化文档 ``ocr/normalized/document.v1.json`` 的块框——同页里**没有**进
page_specs 的块都算：不翻译的文字（页眉页脚、作者名、公式编号……）、行间公式、图、表。
进了 page_specs 的块（包括「未翻译但含公式、重渲染原文」的块）由引擎自己排，不算障碍。

document.v1 的 block_id 是 ``p002-b0003``，译文条目的 item_id 是 ``p002-b003``，按
「页 + 块序号」对齐。文档读不到时退回用译文条目自己的 bbox（条目覆盖所有 OCR 块）。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.semantics.document_reader import block_bbox
from retainpdf_pipeline.render.semantics.document_reader import block_kind
from retainpdf_pipeline.render.semantics.document_reader import get_pages
from retainpdf_pipeline.render.semantics.document_reader import iter_page_blocks

_BLOCK_NUMBER_RE = re.compile(r"-b0*(\d+)$")
_FIGURE_TYPES = {"image", "figure", "chart", "picture", "img"}
_TABLE_TYPES = {"table"}
_FORMULA_TYPES = {"formula", "equation", "display_formula", "interline_equation"}


def obstacle_kind(block_type: str) -> str:
    kind = str(block_type or "").strip().lower()
    if kind in _FORMULA_TYPES:
        return "formula"
    if kind in _TABLE_TYPES:
        return "table"
    if kind in _FIGURE_TYPES:
        return "figure"
    if kind == "text":
        return "text"
    return "other"


def _block_number(block_id: str) -> int | None:
    match = _BLOCK_NUMBER_RE.search(str(block_id or ""))
    return int(match.group(1)) if match else None


def _valid_box(bbox) -> list[float] | None:
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return None
    try:
        x0, y0, x1, y1 = (float(value) for value in bbox)
    except (TypeError, ValueError):
        return None
    if not (x1 > x0 and y1 > y0):
        return None
    return [round(x0, 3), round(y0, 3), round(x1, 3), round(y1, 3)]


def _rendered_numbers_by_page(page_specs: list[RenderPageSpec]) -> dict[int, set[int]]:
    rendered: dict[int, set[int]] = {}
    for spec in page_specs:
        numbers = rendered.setdefault(spec.page_index, set())
        for block in spec.blocks:
            number = _block_number(block.block_id)
            if number is not None:
                numbers.add(number)
    return rendered


def _load_document(document_path: Path | None) -> dict | None:
    if document_path is None:
        return None
    try:
        payload = json.loads(Path(document_path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return payload if isinstance(payload, dict) else None


def obstacles_from_document(
    document: dict,
    page_specs: list[RenderPageSpec],
) -> dict[int, list[dict]]:
    rendered = _rendered_numbers_by_page(page_specs)
    result: dict[int, list[dict]] = {}
    for page in get_pages(document):
        if not isinstance(page, dict):
            continue
        try:
            page_index = int(page.get("page_index", int(page.get("page", 1)) - 1))
        except (TypeError, ValueError):
            continue
        if page_index not in rendered:
            continue
        numbers = rendered[page_index]
        for block in iter_page_blocks(document, page):
            if not isinstance(block, dict):
                continue
            block_id = str(block.get("block_id") or "")
            number = _block_number(block_id)
            if number is not None and number in numbers:
                continue
            box = _valid_box(block_bbox(block))
            if box is None:
                continue
            page_obstacles = result.setdefault(page_index, [])
            page_obstacles.append(
                {
                    "id": block_id or f"p{page_index + 1:03d}-obstacle-{len(page_obstacles)}",
                    "box": box,
                    "kind": obstacle_kind(block_kind(block)),
                }
            )
    return result


def obstacles_from_translated_items(
    translated_pages: dict[int, list[dict]],
    page_specs: list[RenderPageSpec],
) -> dict[int, list[dict]]:
    rendered = _rendered_numbers_by_page(page_specs)
    result: dict[int, list[dict]] = {}
    for page_index, numbers in rendered.items():
        for item in translated_pages.get(page_index, []) or []:
            item_id = str(item.get("item_id") or "")
            number = _block_number(item_id)
            if number is not None and number in numbers:
                continue
            box = _valid_box(item.get("bbox"))
            if box is None:
                continue
            page_obstacles = result.setdefault(page_index, [])
            page_obstacles.append(
                {
                    "id": item_id or f"p{page_index + 1:03d}-obstacle-{len(page_obstacles)}",
                    "box": box,
                    "kind": obstacle_kind(item.get("block_type", "")),
                }
            )
    return result


def build_obstacles(
    *,
    document_path: Path | None,
    translated_pages: dict[int, list[dict]],
    page_specs: list[RenderPageSpec],
) -> tuple[dict[int, list[dict]], str]:
    """返回 (按页的 obstacles, 来源)。来源是 document_v1 或 translated_items。"""
    document = _load_document(document_path)
    if document is not None:
        try:
            return obstacles_from_document(document, page_specs), "document_v1"
        except RuntimeError:
            pass  # 不是 normalized_document_v1，退回译文条目
    return obstacles_from_translated_items(translated_pages, page_specs), "translated_items"


__all__ = [
    "build_obstacles",
    "obstacle_kind",
    "obstacles_from_document",
    "obstacles_from_translated_items",
]

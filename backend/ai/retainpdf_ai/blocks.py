"""任务产物的块级读取。

真相在任务目录:ocr/normalized/document.v1.json(原文块)与
translated/page-*.json(译文,按 (page_idx, block_idx) 数字索引对齐——
译文 item_id 与规范 block_id 的零填充位数不同,不能按字符串对齐)。
只读,不写任何任务目录内容。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Block:
    page_idx: int
    block_id: str
    source_text: str
    translated_text: str
    bbox: tuple[float, float, float, float] | None
    block_type: str
    asset_id: str
    asset_ids: tuple[str, ...]
    asset_uris: tuple[str, ...]


def load_job_blocks(job_root: Path) -> list[Block]:
    normalized_path = job_root / "ocr" / "normalized" / "document.v1.json"
    document = json.loads(normalized_path.read_text(encoding="utf-8"))
    asset_catalog = document.get("assets") if isinstance(document.get("assets"), dict) else {}

    translated: dict[tuple[int, int], str] = {}
    translated_dir = job_root / "translated"
    if translated_dir.is_dir():
        for path in sorted(translated_dir.glob("page-*.json")):
            try:
                items = json.loads(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                page_idx = _as_int(item.get("page_idx"))
                block_idx = _as_int(item.get("block_idx"))
                text = str(item.get("translated_text") or "").strip()
                if page_idx is None or block_idx is None or not text:
                    continue
                translated[(page_idx, block_idx)] = text

    blocks: list[Block] = []
    for page in document.get("pages") or []:
        page_idx = _as_int(page.get("page_index")) or 0
        for block_idx, block in enumerate(page.get("blocks") or []):
            block_id = str(block.get("block_id") or "")
            source_text = str(block.get("text") or "").strip()
            translated_text = translated.get((page_idx, block_idx), "")
            content = block.get("content") if isinstance(block.get("content"), dict) else {}
            asset_id = str(content.get("asset_id") or "").strip()
            raw_asset_ids = content.get("asset_ids")
            asset_ids = (
                tuple(str(value).strip() for value in raw_asset_ids if str(value).strip())
                if isinstance(raw_asset_ids, list)
                else ()
            )
            if asset_id and asset_id not in asset_ids:
                asset_ids = (asset_id, *asset_ids)
            asset_uris = tuple(_asset_uri(asset_catalog, value) for value in asset_ids)
            if not block_id or (not source_text and not translated_text and not asset_ids):
                continue
            blocks.append(
                Block(
                    page_idx=page_idx,
                    block_id=block_id,
                    source_text=source_text,
                    translated_text=translated_text,
                    bbox=_block_bbox(block),
                    block_type=str(content.get("kind") or block.get("type") or "unknown").strip(),
                    asset_id=asset_id,
                    asset_ids=asset_ids,
                    asset_uris=asset_uris,
                )
            )
    return blocks


def read_page_blocks(
    job_root: Path,
    page_idx: int,
    *,
    around_block_id: str = "",
    max_blocks: int = 12,
) -> list[Block]:
    """取某页的块;给定 around_block_id 时以它为中心取窗口。"""
    page_blocks = [block for block in load_job_blocks(job_root) if block.page_idx == page_idx]
    if not around_block_id:
        return page_blocks[: max(1, max_blocks)]
    center = next(
        (index for index, block in enumerate(page_blocks) if block.block_id == around_block_id),
        None,
    )
    if center is None:
        return page_blocks[: max(1, max_blocks)]
    half = max(1, max_blocks) // 2
    start = max(0, center - half)
    return page_blocks[start : start + max(1, max_blocks)]


def _as_int(value: object) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _block_bbox(block: dict) -> tuple[float, float, float, float] | None:
    geometry = block.get("geometry") if isinstance(block.get("geometry"), dict) else {}
    # Historical Paddle artifacts kept geometry.bbox in provider pixels while
    # block.bbox was already converted to PDF points. New artifacts enforce
    # equality, so compatibility-first reading is safe for both generations.
    value = block.get("bbox") or geometry.get("bbox")
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        bbox = tuple(float(item) for item in value)
    except (TypeError, ValueError):
        return None
    if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
        return None
    return bbox


def _asset_uri(asset_catalog: dict, asset_id: str) -> str:
    record = asset_catalog.get(asset_id)
    if isinstance(record, dict):
        return str(record.get("uri") or "").strip()
    if isinstance(record, str):
        return record.strip()
    return ""

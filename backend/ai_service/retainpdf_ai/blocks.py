"""Đọc dữ liệu ở mức block từ sản phẩm của tác vụ.

Nguồn sự thật nằm trong thư mục tác vụ: ocr/normalized/document.v1.json (block văn bản gốc) và
translated/page-*.json (bản dịch, khớp theo chỉ số số học (page_idx, block_idx) — item_id của
bản dịch và block_id chuẩn có số chữ số 0 đệm khác nhau nên không khớp được theo chuỗi).
Chỉ đọc, không ghi bất cứ thứ gì vào thư mục tác vụ.
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


def load_job_blocks(job_root: Path) -> list[Block]:
    normalized_path = job_root / "ocr" / "normalized" / "document.v1.json"
    document = json.loads(normalized_path.read_text(encoding="utf-8"))

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
            if not block_id or (not source_text and not translated_text):
                continue
            blocks.append(
                Block(
                    page_idx=page_idx,
                    block_id=block_id,
                    source_text=source_text,
                    translated_text=translated_text,
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
    """Lấy các block của một trang; nếu có around_block_id thì lấy cửa sổ quanh block đó."""
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

from __future__ import annotations

import fitz

from services.rendering.layout.model.block_view import render_block_protected_text
from services.rendering.layout.model.models import RenderBlock
from services.rendering.source.background import page_has_large_background_image
from services.rendering.source.items import iter_valid_translated_items
from services.rendering.source.vector_text import collect_vector_text_rects


def should_redact_source_page(page: fitz.Page) -> bool:
    return not page_has_large_background_image(page)


def should_use_cover_only_for_vector_text(page: fitz.Page, translated_items: list[dict]) -> bool:
    target_rects = [rect for rect, _item, _translated_text in iter_valid_translated_items(translated_items)]
    if not target_rects:
        return False
    return bool(collect_vector_text_rects(page, target_rects))


def redaction_items_from_blocks(
    translated_items: list[dict],
    blocks: list[RenderBlock],
) -> list[dict]:
    redaction_items: list[dict] = []
    source_items_by_index = {index: item for index, item in enumerate(translated_items)}
    for block in blocks:
        if len(block.cover_bbox) != 4:
            continue
        source_item: dict = {}
        if block.block_id.startswith("item-"):
            raw_index = block.block_id.removeprefix("item-")
            if raw_index.isdigit():
                source_item = source_items_by_index.get(int(raw_index), {})
        redaction_items.append(redaction_item_from_render_block(block, source_item))
    return redaction_items


def redaction_item_from_render_block(block: RenderBlock, source_item: dict) -> dict:
    protected_text = render_block_protected_text(block)
    return {
        **source_item,
        "item_id": block.block_id,
        "source_item_id": source_item.get("item_id"),
        "source_block_kind": source_item.get("block_kind") or source_item.get("block_type"),
        "block_kind": "render_block",
        "block_type": "render_block",
        "source_text": source_item.get("source_text") or source_item.get("protected_source_text") or block.plain_text,
        "translated_text": block.plain_text,
        "protected_translated_text": protected_text,
        "render_protected_text": protected_text,
        "bbox": list(block.cover_bbox),
        "_render_block_id": block.block_id,
    }

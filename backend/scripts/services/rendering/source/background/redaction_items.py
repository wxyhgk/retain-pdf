from __future__ import annotations

from services.rendering.layout.model.block_view import layout_block_to_render_block
from services.rendering.layout.model.block_view import render_block_protected_text
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.policy.formula_guard import protect_formula_regions_in_redaction_items
from services.rendering.source.background.redaction_plan import redaction_item_from_render_block


def redaction_items_from_layout_blocks(
    translated_items: list[dict],
    blocks: list[RenderLayoutBlock],
) -> list[dict]:
    redaction_items: list[dict] = []
    source_items_by_id = {str(item.get("item_id") or ""): item for item in translated_items}
    source_items_by_index = {index: item for index, item in enumerate(translated_items)}
    for index, block in enumerate(blocks):
        render_block = layout_block_to_render_block(block)
        if len(render_block.cover_bbox) != 4:
            continue
        source_item: dict = {}
        if block.block_id.startswith("item-"):
            raw_id = block.block_id.removeprefix("item-")
            source_item = source_items_by_id.get(raw_id, {})
            if not source_item and raw_id.isdigit():
                source_item = source_items_by_index.get(int(raw_id), {})
        item = redaction_item_from_render_block(render_block, source_item)
        item.update(
            {
                "protected_translated_text": render_block_protected_text(render_block),
                "render_protected_text": render_block_protected_text(render_block),
                "_render_block_index": index,
            }
        )
        redaction_items.append(item)
    return redaction_items

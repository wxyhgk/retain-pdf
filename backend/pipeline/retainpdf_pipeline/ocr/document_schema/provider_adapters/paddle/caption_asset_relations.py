from __future__ import annotations

from copy import deepcopy


_ASSET_METADATA_KEYS = (
    "asset_key",
    "asset_keys",
    "asset_kind",
    "asset_path",
    "asset_paths",
    "asset_resolved",
    "asset_resolved_count",
)


def attach_adjacent_caption_asset_relations(pages: list[dict]) -> None:
    """Attach only unambiguous, immediately adjacent caption relations.

    Paddle exposes captions as independent text blocks.  Keeping the rule to
    the two immediate neighbours avoids guessing across columns or unrelated
    figures.  A caption between two compatible targets is deliberately left
    unbound for a later geometry-aware relation pass.
    """

    for page_index, page in enumerate(pages):
        blocks = list(page.get("blocks", []) or [])
        for index, caption_block in enumerate(blocks):
            target_kind = _caption_target_kind(caption_block)
            if not target_kind:
                continue
            candidates = [
                (neighbor_index, blocks[neighbor_index])
                for neighbor_index in (index - 1, index + 1)
                if 0 <= neighbor_index < len(blocks)
                and _block_kind(blocks[neighbor_index]) == target_kind
            ]
            if len(candidates) != 1:
                continue
            target_index, target_block = candidates[0]
            _attach_relation(
                page_index=page_index,
                caption_block=caption_block,
                target_block=target_block,
                target_direction="previous" if target_index < index else "next",
            )


def _caption_target_kind(block: dict) -> str:
    sub_type = str(block.get("sub_type", "") or "").strip().lower()
    metadata = block.get("metadata", {}) or {}
    explicit_target = str(metadata.get("caption_target", "") or "").strip().lower()
    if sub_type == "table_caption" or explicit_target == "table":
        return "table"
    if sub_type in {"figure_caption", "image_caption"} or explicit_target in {
        "figure",
        "image",
        "chart",
    }:
        return "image"
    return ""


def _block_kind(block: dict) -> str:
    content = block.get("content", {}) or {}
    return str(content.get("kind", block.get("type", "")) or "").strip().lower()


def _canonical_asset_ids(block: dict, *, page_index: int) -> list[str]:
    content = block.get("content", {}) or {}
    raw_asset_ids = content.get("asset_ids", [])
    asset_ids = (
        [str(value).strip() for value in raw_asset_ids if str(value).strip()]
        if isinstance(raw_asset_ids, list)
        else []
    )
    primary = str(content.get("asset_id", "") or "").strip()
    if primary and primary not in asset_ids:
        asset_ids.insert(0, primary)

    metadata = block.get("metadata", {}) or {}
    raw_asset_keys = metadata.get("asset_keys", [])
    if not asset_ids and isinstance(raw_asset_keys, list):
        asset_ids = [str(value).strip() for value in raw_asset_keys if str(value).strip()]
    asset_key = str(metadata.get("asset_key", "") or "").strip()
    if asset_key and asset_key not in asset_ids:
        asset_ids.insert(0, asset_key)
    if str(metadata.get("asset_kind", "") or "").strip() == "markdown_image":
        page_prefix = f"page-{page_index + 1}/"
        asset_ids = [
            asset_id if asset_id.startswith(page_prefix) else f"{page_prefix}{asset_id.lstrip('/')}"
            for asset_id in asset_ids
        ]
    return list(dict.fromkeys(asset_ids))


def _append_unique(values: object, additions: list[str]) -> list[str]:
    existing = (
        [str(value).strip() for value in values if str(value).strip()]
        if isinstance(values, list)
        else []
    )
    return list(dict.fromkeys([*existing, *additions]))


def _attach_relation(
    *,
    page_index: int,
    caption_block: dict,
    target_block: dict,
    target_direction: str,
) -> None:
    caption_id = str(caption_block.get("block_id", "") or "").strip()
    target_id = str(target_block.get("block_id", "") or "").strip()
    caption_text = str(caption_block.get("text", "") or "").strip()
    if not caption_id or not target_id or not caption_text:
        return

    asset_ids = _canonical_asset_ids(target_block, page_index=page_index)
    caption_content = caption_block.setdefault("content", {})
    caption_content["related_block_ids"] = _append_unique(
        caption_content.get("related_block_ids"),
        [target_id],
    )
    if asset_ids:
        caption_content["asset_id"] = asset_ids[0]
        caption_content["asset_ids"] = _append_unique(
            caption_content.get("asset_ids"),
            asset_ids,
        )

    caption_metadata = caption_block.setdefault("metadata", {})
    caption_metadata["caption_target_block_id"] = target_id
    caption_metadata["caption_relation"] = "adjacent"
    caption_metadata["caption_target_direction"] = target_direction
    caption_metadata["caption_asset_ids"] = list(asset_ids)
    if asset_ids:
        target_metadata = target_block.get("metadata", {}) or {}
        for key in _ASSET_METADATA_KEYS:
            if key in target_metadata:
                caption_metadata[key] = deepcopy(target_metadata[key])

    target_content = target_block.setdefault("content", {})
    target_content["caption"] = str(target_content.get("caption", "") or caption_text)
    target_content["captions"] = _append_unique(
        target_content.get("captions"),
        [caption_text],
    )
    target_content["caption_block_ids"] = _append_unique(
        target_content.get("caption_block_ids"),
        [caption_id],
    )

    target_metadata = target_block.setdefault("metadata", {})
    target_metadata["caption_block_id"] = str(
        target_metadata.get("caption_block_id", "") or caption_id
    )
    target_metadata["caption_block_ids"] = _append_unique(
        target_metadata.get("caption_block_ids"),
        [caption_id],
    )
    target_metadata["caption_text"] = str(
        target_metadata.get("caption_text", "") or caption_text
    )
    target_metadata["caption_texts"] = _append_unique(
        target_metadata.get("caption_texts"),
        [caption_text],
    )
    target_metadata["caption_relation"] = "adjacent"


__all__ = [
    "attach_adjacent_caption_asset_relations",
]

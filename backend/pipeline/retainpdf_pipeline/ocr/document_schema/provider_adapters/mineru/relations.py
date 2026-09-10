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


def _append_unique(values: object, additions: list[str]) -> list[str]:
    existing = (
        [str(value).strip() for value in values if str(value).strip()]
        if isinstance(values, list)
        else []
    )
    return list(dict.fromkeys([*existing, *additions]))


def _copy_asset_metadata(source: dict, target: dict) -> None:
    for key in _ASSET_METADATA_KEYS:
        if key in source:
            target[key] = deepcopy(source[key])


def attach_mineru_group_relations(
    *,
    group_type: str,
    target_block: dict,
    related_blocks: list[dict],
) -> None:
    """Attach relations supplied by MinerU's explicit visual/code container."""

    target_id = str(target_block.get("block_id", "") or "").strip()
    if not target_id:
        return
    target_content = target_block.setdefault("content", {})
    target_content.setdefault("kind", target_block.get("type", "unknown"))
    target_metadata = target_block.setdefault("metadata", {})

    for related in related_blocks:
        related_id = str(related.get("block_id", "") or "").strip()
        text = str(related.get("text", "") or "").strip()
        layout_role = str(related.get("layout_role", "") or "").strip()
        if not related_id or layout_role not in {"caption", "footnote"}:
            continue

        related_content = related.setdefault("content", {})
        related_content.setdefault("kind", related.get("type", "text"))
        related_content["related_block_ids"] = _append_unique(
            related_content.get("related_block_ids"), [target_id]
        )
        related_metadata = related.setdefault("metadata", {})
        related_metadata["relation_source"] = "provider_container"
        related_metadata["relation_group_type"] = group_type
        _copy_asset_metadata(target_metadata, related_metadata)

        if layout_role == "caption":
            related_metadata["caption_target_block_id"] = target_id
            related_metadata["caption_relation"] = "provider_container"
            if text:
                target_content["caption"] = str(
                    target_content.get("caption", "") or text
                )
                target_content["captions"] = _append_unique(
                    target_content.get("captions"), [text]
                )
            target_content["caption_block_ids"] = _append_unique(
                target_content.get("caption_block_ids"), [related_id]
            )
            target_metadata["caption_block_ids"] = _append_unique(
                target_metadata.get("caption_block_ids"), [related_id]
            )
        else:
            related_metadata["footnote_target_block_id"] = target_id
            related_metadata["footnote_relation"] = "provider_container"
            if text:
                target_content["footnotes"] = _append_unique(
                    target_content.get("footnotes"), [text]
                )
            target_content["footnote_block_ids"] = _append_unique(
                target_content.get("footnote_block_ids"), [related_id]
            )
            target_metadata["footnote_block_ids"] = _append_unique(
                target_metadata.get("footnote_block_ids"), [related_id]
            )


__all__ = ["attach_mineru_group_relations"]

from __future__ import annotations

"""Render-local item reader (file-contract duplicate).

Duplicated from retainpdf_pipeline.translate.core.item_reader
(stage-decouple: render must not import translate; duplicate wins over cross-package).
"""

from retainpdf_pipeline.render.semantics.canonical_semantics import from_flat_item
from retainpdf_pipeline.render.semantics.canonical_semantics import is_bodylike
from retainpdf_pipeline.render.semantics.canonical_semantics import is_caption
from retainpdf_pipeline.render.semantics.canonical_semantics import is_footnote
from retainpdf_pipeline.render.semantics.canonical_semantics import is_metadata
from retainpdf_pipeline.render.semantics.canonical_semantics import is_plain_text
from retainpdf_pipeline.render.semantics.canonical_semantics import is_reference_entry
from retainpdf_pipeline.render.semantics.canonical_semantics import is_reference_heading
from retainpdf_pipeline.render.semantics.canonical_semantics import is_textual
from retainpdf_pipeline.render.semantics.canonical_semantics import uses_title_style
from retainpdf_pipeline.render.semantics.legacy_aliases import is_legacy_algorithm
from retainpdf_pipeline.render.semantics.legacy_aliases import is_legacy_reference_entry
from retainpdf_pipeline.render.semantics.legacy_aliases import normalized_sub_type


def _first_non_empty_str(*values: object) -> str:
    for value in values:
        normalized = str(value or "").strip()
        if normalized:
            return normalized
    return ""


def item_bbox(item: dict | None) -> list[float]:
    bbox = list((item or {}).get("bbox", []) or [])
    if len(bbox) == 4:
        return bbox
    return [0, 0, 0, 0]


def item_source_text(item: dict | None) -> str:
    source = item or {}
    return str(
        source.get("translation_unit_protected_source_text")
        or source.get("group_protected_source_text")
        or source.get("protected_source_text")
        or source.get("source_text")
        or ""
    )


def item_raw_block_type(item: dict | None) -> str:
    source = item or {}
    return _first_non_empty_str(
        source.get("raw_block_type"),
        source.get("block_type"),
    ).lower()


def item_block_kind(item: dict | None) -> str:
    source = item or {}
    explicit = _first_non_empty_str(source.get("block_kind"))
    if explicit:
        return explicit.lower()
    return _first_non_empty_str(source.get("block_type")).lower() or "unknown"


def item_block_class(item: dict | None) -> str:
    return from_flat_item(item).block_class


def item_content_kind(item: dict | None) -> str:
    return from_flat_item(item).content_kind


def _has_canonical_roles(item: dict | None) -> bool:
    profile = from_flat_item(item)
    return any(
        role not in {"", "unknown"}
        for role in (
            profile.layout_role,
            profile.semantic_role,
            profile.structure_role,
        )
    )


def _has_explicit_block_class(item: dict | None) -> bool:
    return _first_non_empty_str((item or {}).get("block_class")).lower() not in {"", "unknown"}


def item_layout_role(item: dict | None) -> str:
    source = item or {}
    return _first_non_empty_str(source.get("layout_role")).lower()


def item_semantic_role(item: dict | None) -> str:
    source = item or {}
    return _first_non_empty_str(source.get("semantic_role")).lower()


def item_structure_role(item: dict | None) -> str:
    source = item or {}
    return _first_non_empty_str(source.get("structure_role")).lower()


def item_normalized_sub_type(item: dict | None) -> str:
    return normalized_sub_type(item)


def item_effective_role(item: dict | None) -> str:
    return _first_non_empty_str(
        item_layout_role(item),
        item_semantic_role(item),
        item_structure_role(item),
    ).lower()


def item_policy_translate(item: dict | None) -> bool | None:
    return from_flat_item(item).policy_translate


def item_reading_order(item: dict | None) -> int:
    source = item or {}
    value = source.get("reading_order", source.get("block_idx", 0))
    if isinstance(value, int) and not isinstance(value, bool):
        return max(0, value)
    return 0


def item_asset_id(item: dict | None) -> str:
    source = item or {}
    return _first_non_empty_str(source.get("asset_id")).strip()


def item_tags(item: dict | None) -> set[str]:
    return set()


def item_is_caption_like(item: dict | None) -> bool:
    return is_caption(from_flat_item(item))


def item_is_footnote_like(item: dict | None) -> bool:
    return is_footnote(from_flat_item(item))


def item_is_reference_like(item: dict | None) -> bool:
    return is_reference_entry(from_flat_item(item))


def item_is_reference_compatible(item: dict | None) -> bool:
    """Resolve references from canonical roles, with legacy cache aliases last."""

    if item_is_reference_like(item):
        return True
    if _has_explicit_block_class(item) or _has_canonical_roles(item):
        return False
    return is_legacy_reference_entry(item)


def item_is_reference_heading_like(item: dict | None) -> bool:
    return is_reference_heading(from_flat_item(item))


def item_is_algorithm_like(item: dict | None) -> bool:
    if _has_canonical_roles(item):
        return item_semantic_role(item) == "algorithm" or item_structure_role(item) in {"algorithm", "code_block"}
    if _has_explicit_block_class(item) and item_block_class(item) != "code":
        return False
    return is_legacy_algorithm(item)


def item_is_title_like(item: dict | None) -> bool:
    return uses_title_style(from_flat_item(item))


def item_is_metadata_like(item: dict | None) -> bool:
    """Prefer canonical metadata classification and use subtype only for old caches."""

    return is_metadata(from_flat_item(item))


def item_is_textual(item: dict | None) -> bool:
    return is_textual(from_flat_item(item))


def item_is_plain_text_block(item: dict | None) -> bool:
    return is_plain_text(from_flat_item(item))


def item_is_bodylike(item: dict | None) -> bool:
    profile = from_flat_item(item)
    return is_plain_text(profile) and is_bodylike(profile)


__all__ = [
    "item_asset_id",
    "item_bbox",
    "item_block_class",
    "item_block_kind",
    "item_content_kind",
    "item_effective_role",
    "item_is_algorithm_like",
    "item_is_bodylike",
    "item_is_caption_like",
    "item_is_footnote_like",
    "item_is_metadata_like",
    "item_is_plain_text_block",
    "item_is_reference_compatible",
    "item_is_reference_heading_like",
    "item_is_reference_like",
    "item_is_textual",
    "item_is_title_like",
    "item_layout_role",
    "item_normalized_sub_type",
    "item_policy_translate",
    "item_raw_block_type",
    "item_reading_order",
    "item_semantic_role",
    "item_source_text",
    "item_structure_role",
    "item_tags",
]

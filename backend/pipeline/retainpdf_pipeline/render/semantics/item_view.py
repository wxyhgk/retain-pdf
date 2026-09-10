"""Canonical semantic view consumed by rendering.

Canonical document fields always win. Legacy payload interpretation is kept
behind ``legacy_compat`` so rendering algorithms cannot accidentally let stale
provider projections override the normalized document contract.
"""

from __future__ import annotations

from retainpdf_pipeline.render.semantics.canonical_semantics import (
    from_flat_item,
    is_bodylike,
    is_caption,
    is_footnote,
    is_plain_bodylike,
    is_plain_text,
    is_reference_entry,
    is_textual,
    uses_title_style,
)
from retainpdf_pipeline.render.semantics.legacy_compat import (
    legacy_is_document_title,
    legacy_role_values,
)


def _metadata(item: dict | None) -> dict:
    value = (item or {}).get("metadata", {})
    return value if isinstance(value, dict) else {}


def layout_role(item: dict | None) -> str:
    return from_flat_item(item).layout_role


def semantic_role(item: dict | None) -> str:
    return from_flat_item(item).semantic_role


def structure_role(item: dict | None) -> str:
    return from_flat_item(item).structure_role


def has_canonical_roles(item: dict | None) -> bool:
    return any(
        role not in {"", "unknown"}
        for role in (layout_role(item), semantic_role(item), structure_role(item))
    )


def _has_canonical_semantic_fields(item: dict | None) -> bool:
    source = item or {}
    metadata = _metadata(source)
    content = source.get("content", {})
    if isinstance(content, dict) and "kind" in content:
        return True
    if str(source.get("block_class", "") or "").strip().lower() not in {
        "",
        "unknown",
    }:
        return True
    return any(
        str(source.get(key, metadata.get(key, "")) or "").strip().lower()
        not in {"", "unknown"}
        for key in ("layout_role", "semantic_role", "structure_role")
    )


def block_kind(item: dict | None) -> str:
    return from_flat_item(item).content_kind


def block_class(item: dict | None) -> str:
    return from_flat_item(item).block_class


def role_values(item: dict | None) -> frozenset[str]:
    profile = from_flat_item(item)
    fine_roles = frozenset(
        role
        for role in (
            profile.layout_role,
            profile.semantic_role,
            profile.structure_role,
        )
        if role not in {"", "unknown"}
    )
    canonical = fine_roles or frozenset(
        {profile.block_class} if profile.block_class != "unknown" else set()
    )
    if _has_canonical_semantic_fields(item):
        return canonical
    return canonical | legacy_role_values(item)


def is_document_title(item: dict | None) -> bool:
    """Return whether an item is the document title, excluding broad headings."""

    if _has_canonical_semantic_fields(item):
        return layout_role(item) == "title" or structure_role(item) in {
            "document_title",
            "title",
        }
    return legacy_is_document_title(item)


def is_title_like_block(item: dict | None) -> bool:
    return uses_title_style(from_flat_item(item))


def is_caption_like_block(item: dict | None) -> bool:
    return is_caption(from_flat_item(item))


def is_footnote_like_block(item: dict | None) -> bool:
    return is_footnote(from_flat_item(item))


def is_reference_entry_semantic(item: dict | None) -> bool:
    profile = from_flat_item(item)
    if is_reference_entry(profile) or _has_canonical_semantic_fields(item):
        return is_reference_entry(profile)
    return bool(role_values(item) & {"reference_entry", "reference_zone"})


def is_bodylike_block(item: dict | None) -> bool:
    return is_bodylike(from_flat_item(item))


def is_textual_block(item: dict | None) -> bool:
    return is_textual(from_flat_item(item))


def is_plain_text_block(item: dict | None) -> bool:
    profile = from_flat_item(item)
    return is_plain_text(profile) and not is_reference_entry_semantic(item)


def is_plain_bodylike_block(item: dict | None) -> bool:
    return is_plain_bodylike(from_flat_item(item)) and is_plain_text_block(item)


def source_item_kind(item: dict | None) -> str:
    """Stable diagnostic label derived from the canonical rendering view."""

    role = layout_role(item)
    if role not in {"", "unknown"}:
        return role
    broad_class = block_class(item)
    if broad_class != "unknown":
        return broad_class
    return block_kind(item)


__all__ = [
    "block_class",
    "block_kind",
    "has_canonical_roles",
    "is_bodylike_block",
    "is_caption_like_block",
    "is_document_title",
    "is_footnote_like_block",
    "is_plain_bodylike_block",
    "is_plain_text_block",
    "is_reference_entry_semantic",
    "is_textual_block",
    "is_title_like_block",
    "layout_role",
    "role_values",
    "semantic_role",
    "source_item_kind",
    "structure_role",
]

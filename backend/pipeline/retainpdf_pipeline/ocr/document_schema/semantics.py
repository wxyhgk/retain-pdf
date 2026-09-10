"""Deprecated compatibility facade for pre-canonical semantic consumers.

New production code should use :mod:`canonical_semantics`, and provider repair
metadata should be read through :mod:`provider_signals`. Legacy subtype, tag,
derived-role, and raw-label interpretation lives only in :mod:`legacy_compat`.
"""

from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.canonical_semantics import (
    BODYLIKE_LAYOUT_ROLES,
    BODYLIKE_SEMANTIC_ROLES,
    BODYLIKE_STRUCTURE_ROLES,
    from_flat_item,
    is_bodylike,
    is_caption,
    is_footnote,
    is_metadata,
    is_plain_bodylike,
    is_plain_text,
    is_reference_entry,
    is_reference_heading,
    is_textual,
    uses_title_style,
)
from retainpdf_pipeline.ocr.document_schema.classification import (
    resolve_content_kind,
)
from retainpdf_pipeline.ocr.document_schema.legacy_compat import (
    ALGORITHM_ALIASES,
    CAPTION_ALIASES,
    FOOTNOTE_ALIASES,
    REFERENCE_ENTRY_ALIASES,
    REFERENCE_HEADING_ALIASES,
    derived_role,
    is_legacy_algorithm,
    is_legacy_caption,
    is_legacy_footnote,
    is_legacy_metadata,
    is_legacy_reference_entry,
    is_legacy_reference_heading,
    legacy_tags,
    normalize_tags,
    normalized_sub_type,
)
from retainpdf_pipeline.ocr.document_schema.provider_signals import (
    body_repair_applied,
    body_repair_peer_block_id,
    body_repair_role,
)

CAPTION_TAGS = set(CAPTION_ALIASES)
FOOTNOTE_TAGS = set(FOOTNOTE_ALIASES)
REFERENCE_HEADING_TAGS = set(REFERENCE_HEADING_ALIASES)
REFERENCE_ENTRY_TAGS = set(REFERENCE_ENTRY_ALIASES)
ALGORITHM_TAGS = set(ALGORITHM_ALIASES)
CAPTION_BLOCK_TYPES = {
    "figure_caption",
    "image_caption",
    "table_caption",
    "table_footnote",
}
FOOTNOTE_BLOCK_TYPES = {
    "footnote",
    "image_footnote",
    "table_footnote",
    "vision_footnote",
}
TITLE_LIKE_LAYOUT_ROLES = {"title", "heading"}
TITLE_LIKE_STRUCTURE_ROLES = {
    "document_title",
    "title",
    "heading",
    "section_heading",
}
TEXTUAL_LAYOUT_ROLES = {"title", "heading", "paragraph", "list_item", "caption"}


def _profile(payload: dict | None):
    return from_flat_item(payload)


def _metadata(payload: dict | None) -> dict:
    metadata = (payload or {}).get("metadata", {}) or {}
    return metadata if isinstance(metadata, dict) else {}


def _role(payload: dict | None, key: str, *, default: str = "") -> str:
    source = payload or {}
    if key in source:
        return str(source.get(key, "") or default).strip().lower() or default
    return str(_metadata(source).get(key, "") or default).strip().lower() or default


def _has_meaningful_canonical_identity(payload: dict | None) -> bool:
    source = payload or {}
    if str(source.get("block_class", "") or "").strip().lower() not in {
        "",
        "unknown",
    }:
        return True
    metadata = _metadata(source)
    return any(
        str(
            source.get(key, metadata.get(key, ""))
            if key not in source
            else source.get(key, "")
        ).strip().lower()
        not in {"", "unknown"}
        for key in ("layout_role", "semantic_role", "structure_role")
    )


def layout_role(payload: dict | None) -> str:
    return _role(payload, "layout_role")


def semantic_role(payload: dict | None) -> str:
    return _role(payload, "semantic_role")


def structure_role(payload: dict | None) -> str:
    return _role(payload, "structure_role")


def block_kind(payload: dict | None) -> str:
    return resolve_content_kind(payload)


def policy_translate(payload: dict | None) -> bool | None:
    return _profile(payload).policy_translate


def has_any_tag(payload: dict | None, tags: set[str]) -> bool:
    return bool(legacy_tags(payload) & normalize_tags(tags))


def is_caption_semantic(payload: dict | None) -> bool:
    canonical = is_caption(_profile(payload))
    if canonical or _has_meaningful_canonical_identity(payload):
        return canonical
    return is_legacy_caption(payload)


def is_caption_like_block(payload: dict | None) -> bool:
    return is_caption_semantic(payload)


def is_footnote_like_block(payload: dict | None) -> bool:
    canonical = is_footnote(_profile(payload))
    if canonical or _has_meaningful_canonical_identity(payload):
        return canonical
    return is_legacy_footnote(payload)


def is_reference_heading_semantic(payload: dict | None) -> bool:
    canonical = is_reference_heading(_profile(payload))
    if canonical or _has_meaningful_canonical_identity(payload):
        return canonical
    return is_legacy_reference_heading(payload)


def is_reference_entry_semantic(payload: dict | None) -> bool:
    canonical = is_reference_entry(_profile(payload))
    if canonical or _has_meaningful_canonical_identity(payload):
        return canonical
    return is_legacy_reference_entry(payload)


def is_algorithm_semantic(payload: dict | None) -> bool:
    # ``algorithm`` has no canonical taxonomy identity yet. Keep this one
    # deliberately explicit legacy compatibility check instead of treating all
    # canonical code blocks as algorithms.
    return is_legacy_algorithm(payload)


def is_metadata_semantic(payload: dict | None) -> bool:
    canonical = is_metadata(_profile(payload))
    if canonical or _has_meaningful_canonical_identity(payload):
        return canonical
    return is_legacy_metadata(payload)


def is_title_like_block(payload: dict | None) -> bool:
    return uses_title_style(_profile(payload))


def is_body_structure_role(payload: dict | None) -> bool:
    return structure_role(payload) in {"", "body"}


def is_body_like_structure_role(payload: dict | None) -> bool:
    return structure_role(payload) in {"", "body", "example_line"}


def is_bodylike_block(payload: dict | None) -> bool:
    return is_bodylike(_profile(payload))


def is_textual_block(payload: dict | None) -> bool:
    return is_textual(_profile(payload))


def is_plain_text_block(payload: dict | None) -> bool:
    profile = _profile(payload)
    if not is_plain_text(profile):
        return False
    return not (
        is_caption_like_block(payload)
        or is_footnote_like_block(payload)
        or is_reference_entry_semantic(payload)
        or is_title_like_block(payload)
    )


def is_plain_bodylike_block(payload: dict | None) -> bool:
    profile = _profile(payload)
    return (
        is_plain_bodylike(profile)
        and is_plain_text_block(payload)
        and is_bodylike_block(payload)
    )


def build_role_profile(payload: dict | None) -> dict[str, object]:
    source = payload or {}
    profile = _profile(source)
    return {
        "layout_role": profile.layout_role,
        "semantic_role": profile.semantic_role,
        "structure_role": profile.structure_role,
        "normalized_sub_type": normalized_sub_type(source),
        "policy_translate": profile.policy_translate,
        "block_kind": profile.content_kind,
        "block_class": profile.block_class,
        "is_caption_like": is_caption_like_block(source),
        "is_footnote_like": is_footnote_like_block(source),
        "is_reference_heading": is_reference_heading_semantic(source),
        "is_reference_entry": is_reference_entry_semantic(source),
        "is_algorithm": is_algorithm_semantic(source),
        "is_metadata": is_metadata_semantic(source),
        "is_title_like": is_title_like_block(source),
        "is_bodylike": is_bodylike_block(source),
        "is_textual": is_textual_block(source),
        "is_plain_text": is_plain_text_block(source),
        "is_plain_bodylike": is_plain_bodylike_block(source),
    }


__all__ = [
    "ALGORITHM_TAGS",
    "BODYLIKE_LAYOUT_ROLES",
    "BODYLIKE_SEMANTIC_ROLES",
    "BODYLIKE_STRUCTURE_ROLES",
    "CAPTION_BLOCK_TYPES",
    "CAPTION_TAGS",
    "FOOTNOTE_BLOCK_TYPES",
    "FOOTNOTE_TAGS",
    "REFERENCE_ENTRY_TAGS",
    "REFERENCE_HEADING_TAGS",
    "TEXTUAL_LAYOUT_ROLES",
    "TITLE_LIKE_LAYOUT_ROLES",
    "TITLE_LIKE_STRUCTURE_ROLES",
    "block_kind",
    "body_repair_applied",
    "body_repair_peer_block_id",
    "body_repair_role",
    "build_role_profile",
    "derived_role",
    "has_any_tag",
    "is_algorithm_semantic",
    "is_body_like_structure_role",
    "is_body_structure_role",
    "is_bodylike_block",
    "is_caption_like_block",
    "is_caption_semantic",
    "is_footnote_like_block",
    "is_metadata_semantic",
    "is_plain_bodylike_block",
    "is_plain_text_block",
    "is_reference_entry_semantic",
    "is_reference_heading_semantic",
    "is_textual_block",
    "is_title_like_block",
    "layout_role",
    "normalize_tags",
    "normalized_sub_type",
    "policy_translate",
    "semantic_role",
    "structure_role",
]

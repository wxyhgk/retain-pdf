from __future__ import annotations

from collections.abc import Iterable

# Compatibility aliases are intentionally kept out of the canonical vocabulary.
# They describe payload spellings accepted while older readers and stored jobs
# are migrated to ``content.kind`` and ``block_class``.
_CONTENT_KIND_ALIASES = {
    "image_body": "image",
    "figure": "image",
    "chart": "image",
    "table_body": "table",
    "table_html": "table",
    "display_formula": "formula",
    "code_body": "code",
    "code_block": "code",
    "algorithm": "code",
}

_LEGACY_ROLE_BLOCK_CLASSES = {
    "abstract": "title",
    "doc_title": "title",
    "title": "title",
    "heading": "title",
    "paragraph_title": "title",
    "body": "body",
    "table_of_contents": "body",
    "caption": "caption",
    "figure_caption": "caption",
    "figure_title": "caption",
    "image_caption": "caption",
    "table_caption": "caption",
    "code_caption": "caption",
    "footnote": "footnote",
    "image_footnote": "footnote",
    "table_footnote": "footnote",
    "vision_footnote": "footnote",
    "header": "metadata",
    "footer": "metadata",
    "page_number": "metadata",
    "metadata": "metadata",
    "aside_text": "metadata",
    "number": "metadata",
    "formula_number": "metadata",
    "formula": "formula",
    "display_formula": "formula",
    "image": "image",
    "image_body": "image",
    "chart": "image",
    "table": "table",
    "table_body": "table",
    "table_html": "table",
    "code": "code",
    "code_body": "code",
    "code_block": "code",
    "algorithm": "code",
}

CAPTION_ALIASES = frozenset(
    {
        "caption",
        "figure_caption",
        "figure_title",
        "image_caption",
        "table_caption",
        "code_caption",
    }
)
FOOTNOTE_ALIASES = frozenset(
    {"footnote", "image_footnote", "table_footnote", "vision_footnote"}
)
REFERENCE_HEADING_ALIASES = frozenset({"reference_heading"})
REFERENCE_ENTRY_ALIASES = frozenset(
    {"reference_entry", "reference_content", "reference_zone", "ref_text"}
)
ALGORITHM_ALIASES = frozenset({"algorithm"})
METADATA_ALIASES = frozenset(
    {
        "metadata",
        "header",
        "footer",
        "page_number",
        "number",
        "formula_number",
        "aside_text",
    }
)


def _normalized(value: object) -> str:
    return str(value or "").strip().lower()


def normalize_content_kind_alias(value: object) -> str:
    normalized = _normalized(value) or "unknown"
    return _CONTENT_KIND_ALIASES.get(normalized, normalized)


def normalize_tags(tags: Iterable[object] | None) -> set[str]:
    return {
        normalized for tag in (tags or ()) if (normalized := _normalized(tag))
    }


def _metadata(payload: dict | None) -> dict:
    source = payload or {}
    metadata = source.get("metadata", {}) or {}
    return metadata if isinstance(metadata, dict) else {}


def normalized_sub_type(payload: dict | None) -> str:
    source = payload or {}
    metadata = _metadata(source)
    for container in (source, metadata):
        if "normalized_sub_type" in container:
            return _normalized(container.get("normalized_sub_type"))
    for container in (source, metadata):
        if "sub_type" in container:
            return _normalized(container.get("sub_type"))
    return ""


def derived_role(payload: dict | None) -> str:
    source = payload or {}
    derived = source.get("derived", {}) or {}
    if isinstance(derived, dict):
        role = _normalized(derived.get("role"))
        if role:
            return role
    metadata_derived = _metadata(source).get("derived", {}) or {}
    if isinstance(metadata_derived, dict):
        return _normalized(metadata_derived.get("role"))
    return ""


def legacy_tags(payload: dict | None) -> set[str]:
    source = payload or {}
    return normalize_tags(source.get("tags", ())) | normalize_tags(
        _metadata(source).get("tags", ())
    )


def raw_type_alias(payload: dict | None) -> str:
    source = payload or {}
    metadata = _metadata(source)
    provenance = source.get("provenance", {}) or {}
    source_trace = source.get("source", {}) or {}
    if not isinstance(provenance, dict):
        provenance = {}
    if not isinstance(source_trace, dict):
        source_trace = {}
    candidates = (
        source.get("raw_block_type"),
        source.get("raw_label"),
        metadata.get("raw_block_type"),
        metadata.get("raw_label"),
        provenance.get("raw_label"),
        source_trace.get("raw_type"),
        source_trace.get("raw_label"),
        source.get("block_type"),
        source.get("type"),
    )
    return next((value for item in candidates if (value := _normalized(item))), "")


def legacy_aliases(payload: dict | None) -> set[str]:
    aliases = legacy_tags(payload)
    for value in (
        normalized_sub_type(payload),
        derived_role(payload),
        raw_type_alias(payload),
    ):
        if value:
            aliases.add(value)
    return aliases


def resolve_legacy_block_class(payload: dict | None) -> str | None:
    source = payload or {}
    for value in (
        normalized_sub_type(source),
        derived_role(source),
        *sorted(legacy_tags(source)),
        raw_type_alias(source),
    ):
        resolved = _LEGACY_ROLE_BLOCK_CLASSES.get(value)
        if resolved:
            return resolved
    return None


def has_legacy_alias(payload: dict | None, aliases: frozenset[str]) -> bool:
    return bool(legacy_aliases(payload) & aliases)


def is_legacy_caption(payload: dict | None) -> bool:
    return has_legacy_alias(payload, CAPTION_ALIASES)


def is_legacy_footnote(payload: dict | None) -> bool:
    return has_legacy_alias(payload, FOOTNOTE_ALIASES)


def is_legacy_reference_heading(payload: dict | None) -> bool:
    return has_legacy_alias(payload, REFERENCE_HEADING_ALIASES)


def is_legacy_reference_entry(payload: dict | None) -> bool:
    return has_legacy_alias(payload, REFERENCE_ENTRY_ALIASES)


def is_legacy_algorithm(payload: dict | None) -> bool:
    """Preserve the old algorithm identity without adding a canonical class."""

    return has_legacy_alias(payload, ALGORITHM_ALIASES)


def is_legacy_metadata(payload: dict | None) -> bool:
    return has_legacy_alias(payload, METADATA_ALIASES)


__all__ = [
    "ALGORITHM_ALIASES",
    "CAPTION_ALIASES",
    "FOOTNOTE_ALIASES",
    "METADATA_ALIASES",
    "REFERENCE_ENTRY_ALIASES",
    "REFERENCE_HEADING_ALIASES",
    "derived_role",
    "has_legacy_alias",
    "is_legacy_algorithm",
    "is_legacy_caption",
    "is_legacy_footnote",
    "is_legacy_metadata",
    "is_legacy_reference_entry",
    "is_legacy_reference_heading",
    "legacy_aliases",
    "legacy_tags",
    "normalize_content_kind_alias",
    "normalize_tags",
    "normalized_sub_type",
    "raw_type_alias",
    "resolve_legacy_block_class",
]

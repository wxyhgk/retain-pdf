"""The only rendering boundary allowed to interpret legacy semantic fields.

This module deliberately contains no Paddle/provider label catalog. Broad
classification is delegated to the document-schema compatibility resolver;
the remaining helpers only preserve generic historical rendering inputs.
"""

from __future__ import annotations

from retainpdf_pipeline.render.semantics.classification import (
    resolve_block_class,
)
from retainpdf_pipeline.render.semantics.legacy_aliases import (
    legacy_aliases,
    legacy_tags,
    normalized_sub_type,
    raw_type_alias,
)

_SKIP_TRANSLATION_TAGS = frozenset(
    {"skip_translation", "keep_origin", "preserve_source"}
)


def legacy_role_values(item: dict | None) -> frozenset[str]:
    return frozenset(legacy_aliases(item))


def legacy_block_class(item: dict | None) -> str:
    """Resolve broad legacy semantics without maintaining a provider map here."""

    source = item or {}
    return resolve_block_class(source)


def legacy_is_document_title(item: dict | None) -> bool:
    """Recognize only the historical document-title spellings, not headings."""

    return normalized_sub_type(item) in {"doc_title", "title"} or raw_type_alias(
        item
    ) in {"doc_title", "title"}


def legacy_has_skip_translation_tag(item: dict | None) -> bool:
    return bool(legacy_tags(item) & _SKIP_TRANSLATION_TAGS)


__all__ = [
    "legacy_block_class",
    "legacy_has_skip_translation_tag",
    "legacy_is_document_title",
    "legacy_role_values",
]

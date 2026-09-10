from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.legacy_compat import (
    normalize_content_kind_alias,
    resolve_legacy_block_class,
)
from retainpdf_pipeline.ocr.document_schema.vocabulary import BLOCK_CLASSES


def derive_block_class(
    *,
    content_kind: str,
    layout_role: str = "",
    semantic_role: str = "",
    structure_role: str = "",
) -> str:
    """Derive RetainPDF's broad block class from canonical contract fields.

    Provider labels are deliberately absent from this API. Fine-grained meaning
    stays in semantic/structure roles; the returned value is the stable class
    used for broad rendering and editing behavior.
    """

    kind = normalize_content_kind_alias(content_kind)
    layout = str(layout_role or "unknown").strip().lower()
    semantic = str(semantic_role or "unknown").strip().lower()
    structure = str(structure_role or "").strip().lower()

    if kind in {"formula", "image", "table", "code"}:
        return kind
    if kind != "text":
        return "unknown"

    if (
        semantic == "abstract"
        or layout in {"title", "heading"}
        or structure in {"title", "heading", "section_heading", "reference_heading"}
    ):
        return "title"
    if layout == "caption" or structure in {
        "caption",
        "figure_caption",
        "image_caption",
        "table_caption",
        "code_caption",
    }:
        return "caption"
    if layout == "footnote" or structure in {
        "footnote",
        "image_footnote",
        "table_footnote",
    }:
        return "footnote"
    if (
        semantic in {"metadata", "affiliation", "acknowledgement"}
        or layout in {"header", "footer", "page_number"}
        or structure in {"header", "footer", "metadata", "formula_number"}
    ):
        return "metadata"
    return "body"


def is_known_block_class(value: str) -> bool:
    return str(value or "").strip().lower() in BLOCK_CLASSES


def resolve_content_kind(block: dict | None) -> str:
    """Resolve canonical content identity before accepting carrier aliases.

    A present ``content.kind`` is authoritative, including ``unknown``. Flat
    spellings are compatibility carriers and are normalized centrally.
    """

    source = block or {}
    content = source.get("content", {}) or {}
    if isinstance(content, dict) and "kind" in content:
        return normalize_content_kind_alias(content.get("kind"))
    for key in ("block_kind", "type", "block_type"):
        value = str(source.get(key, "") or "").strip()
        if value:
            return normalize_content_kind_alias(value)
    return "unknown"


def _role(source: dict, metadata: dict, key: str) -> str:
    if key in source:
        return str(source.get(key, "") or "").strip().lower()
    return str(metadata.get(key, "") or "").strip().lower()


def resolve_block_class(block: dict | None) -> str:
    source = block or {}
    metadata = source.get("metadata", {}) or {}
    if not isinstance(metadata, dict):
        metadata = {}
    explicit = str(source.get("block_class", "") or "").strip().lower()
    if explicit in BLOCK_CLASSES:
        return explicit
    content = source.get("content", {}) or {}
    has_canonical_content = isinstance(content, dict) and "kind" in content
    content_kind = resolve_content_kind(source)
    if content_kind in {"formula", "image", "table", "code"}:
        return content_kind

    layout_role = _role(source, metadata, "layout_role")
    semantic_role = _role(source, metadata, "semantic_role")
    structure_role = _role(source, metadata, "structure_role")
    has_canonical_role = any(
        value not in {"", "unknown"}
        for value in (layout_role, semantic_role, structure_role)
    )
    if not has_canonical_content and not has_canonical_role:
        legacy_class = resolve_legacy_block_class(source)
        if legacy_class:
            return legacy_class

    return derive_block_class(
        content_kind=content_kind,
        layout_role=layout_role,
        semantic_role=semantic_role,
        structure_role=structure_role,
    )


__all__ = [
    "derive_block_class",
    "is_known_block_class",
    "resolve_block_class",
    "resolve_content_kind",
]

from __future__ import annotations

from dataclasses import asdict, dataclass

from retainpdf_pipeline.ocr.document_schema.classification import (
    derive_block_class,
    resolve_block_class,
    resolve_content_kind,
)
from retainpdf_pipeline.ocr.document_schema.vocabulary import (
    BLOCK_CLASSES,
    CONTENT_KINDS,
)

CAPTION_STRUCTURE_ROLES = frozenset(
    {"caption", "figure_caption", "image_caption", "table_caption", "code_caption"}
)
FOOTNOTE_STRUCTURE_ROLES = frozenset(
    {"footnote", "image_footnote", "table_footnote"}
)
TITLE_STRUCTURE_ROLES = frozenset(
    {"document_title", "title", "heading", "section_heading", "reference_heading"}
)
BODYLIKE_LAYOUT_ROLES = frozenset({"paragraph", "list_item"})
BODYLIKE_SEMANTIC_ROLES = frozenset({"body", "abstract", "table_of_contents"})
BODYLIKE_STRUCTURE_ROLES = frozenset(
    {
        "body",
        "abstract",
        "table_of_contents",
        "example_line",
        "option_header",
        "option_description",
        "example_intro",
    }
)


def _normalized(value: object, *, default: str = "") -> str:
    return str(value or default).strip().lower() or default


def _metadata(payload: dict | None) -> dict:
    metadata = (payload or {}).get("metadata", {}) or {}
    return metadata if isinstance(metadata, dict) else {}


def _flat_role(payload: dict, key: str, *, default: str) -> str:
    if key in payload:
        return _normalized(payload.get(key), default=default)
    return _normalized(_metadata(payload).get(key), default=default)


def _policy_translate(payload: dict | None) -> bool | None:
    source = payload or {}
    if isinstance(source.get("policy_translate"), bool):
        return source["policy_translate"]
    policy = source.get("policy", {}) or {}
    if isinstance(policy, dict) and isinstance(policy.get("translate"), bool):
        return policy["translate"]
    return None


@dataclass(frozen=True)
class BlockSemanticProfile:
    """Canonical, provider-neutral semantic view of one document block."""

    content_kind: str
    block_class: str
    layout_role: str
    semantic_role: str
    structure_role: str
    policy_translate: bool | None = None

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def from_normalized_block(block: dict | None) -> BlockSemanticProfile:
    """Build a strict profile from a normalized document block.

    This entry point rejects drift between the canonical carriers. Stored or
    flattened compatibility payloads should use :func:`from_flat_item`.
    """

    source = block or {}
    content = source.get("content", {}) or {}
    if not isinstance(content, dict) or "kind" not in content:
        raise ValueError("normalized block must declare content.kind")
    content_kind = _normalized(content.get("kind"), default="unknown")
    if content_kind not in CONTENT_KINDS:
        raise ValueError(f"unknown canonical content.kind: {content_kind!r}")

    layout = _normalized(source.get("layout_role"), default="unknown")
    semantic = _normalized(source.get("semantic_role"), default="unknown")
    structure = _normalized(source.get("structure_role"))
    derived_class = derive_block_class(
        content_kind=content_kind,
        layout_role=layout,
        semantic_role=semantic,
        structure_role=structure,
    )
    if "block_class" in source:
        block_class = _normalized(source.get("block_class"), default="unknown")
        if block_class not in BLOCK_CLASSES:
            raise ValueError(f"unknown canonical block_class: {block_class!r}")
        if block_class != derived_class:
            raise ValueError(
                "canonical block_class conflicts with canonical roles: "
                f"block_class={block_class!r} derived={derived_class!r}"
            )
    else:
        block_class = derived_class

    return BlockSemanticProfile(
        content_kind=content_kind,
        block_class=block_class,
        layout_role=layout,
        semantic_role=semantic,
        structure_role=structure,
        policy_translate=_policy_translate(source),
    )


def from_flat_item(item: dict | None) -> BlockSemanticProfile:
    """Build a compatibility profile with canonical-first precedence."""

    source = item or {}
    return BlockSemanticProfile(
        content_kind=resolve_content_kind(source),
        block_class=resolve_block_class(source),
        layout_role=_flat_role(source, "layout_role", default="unknown"),
        semantic_role=_flat_role(source, "semantic_role", default="unknown"),
        structure_role=_flat_role(source, "structure_role", default=""),
        policy_translate=_policy_translate(source),
    )


def has_meaningful_canonical_semantics(profile: BlockSemanticProfile) -> bool:
    return profile.block_class != "unknown" or any(
        role not in {"", "unknown"}
        for role in (
            profile.layout_role,
            profile.semantic_role,
            profile.structure_role,
        )
    )


def is_caption(profile: BlockSemanticProfile) -> bool:
    return (
        profile.block_class == "caption"
        or profile.layout_role == "caption"
        or profile.structure_role in CAPTION_STRUCTURE_ROLES
    )


def is_footnote(profile: BlockSemanticProfile) -> bool:
    return (
        profile.block_class == "footnote"
        or profile.layout_role == "footnote"
        or profile.structure_role in FOOTNOTE_STRUCTURE_ROLES
    )


def is_reference_heading(profile: BlockSemanticProfile) -> bool:
    return profile.structure_role == "reference_heading"


def is_reference_entry(profile: BlockSemanticProfile) -> bool:
    return (
        profile.semantic_role == "reference"
        or profile.structure_role == "reference_entry"
    )


def is_metadata(profile: BlockSemanticProfile) -> bool:
    return profile.block_class == "metadata" or profile.semantic_role == "metadata"


def is_title(profile: BlockSemanticProfile) -> bool:
    """Return the broad RetainPDF title classification.

    ``abstract`` intentionally belongs to the coarse ``title`` block class.
    Consumers choosing typography or translation behavior must use
    :func:`uses_title_style` instead.
    """

    return (
        profile.block_class == "title"
        or profile.layout_role in {"title", "heading"}
        or profile.structure_role in TITLE_STRUCTURE_ROLES
    )


def uses_title_style(profile: BlockSemanticProfile) -> bool:
    """Return whether a text block should receive heading/title behavior.

    Fine-grained canonical roles take precedence over the broad block class so
    an abstract remains ordinary flowing text even though its coarse class is
    ``title``. Class-only legacy payloads retain their historical behavior.
    """

    if profile.content_kind in {"formula", "image", "table", "code"}:
        return False
    if (
        profile.layout_role in {"title", "heading"}
        or profile.structure_role in TITLE_STRUCTURE_ROLES
    ):
        return True
    has_fine_role = any(
        role not in {"", "unknown"}
        for role in (
            profile.layout_role,
            profile.semantic_role,
            profile.structure_role,
        )
    )
    if has_fine_role:
        return False
    return profile.block_class == "title"


def is_bodylike(profile: BlockSemanticProfile) -> bool:
    if profile.content_kind != "text":
        return False
    if profile.semantic_role == "abstract":
        return (
            profile.layout_role in {"", "unknown", "paragraph", "list_item"}
            and profile.structure_role in {"", "body", "abstract"}
        )
    if profile.block_class != "body":
        return False
    return not (is_reference_entry(profile) or is_reference_heading(profile))


def is_textual(profile: BlockSemanticProfile) -> bool:
    return profile.content_kind == "text"


def is_plain_text(profile: BlockSemanticProfile) -> bool:
    return is_textual(profile) and not (
        is_caption(profile)
        or is_footnote(profile)
        or is_reference_entry(profile)
        or uses_title_style(profile)
    )


def is_plain_bodylike(profile: BlockSemanticProfile) -> bool:
    return is_plain_text(profile) and is_bodylike(profile)


__all__ = [
    "BODYLIKE_LAYOUT_ROLES",
    "BODYLIKE_SEMANTIC_ROLES",
    "BODYLIKE_STRUCTURE_ROLES",
    "CAPTION_STRUCTURE_ROLES",
    "FOOTNOTE_STRUCTURE_ROLES",
    "TITLE_STRUCTURE_ROLES",
    "BlockSemanticProfile",
    "from_flat_item",
    "from_normalized_block",
    "has_meaningful_canonical_semantics",
    "is_bodylike",
    "is_caption",
    "is_footnote",
    "is_metadata",
    "is_plain_bodylike",
    "is_plain_text",
    "is_reference_entry",
    "is_reference_heading",
    "is_textual",
    "is_title",
    "uses_title_style",
]

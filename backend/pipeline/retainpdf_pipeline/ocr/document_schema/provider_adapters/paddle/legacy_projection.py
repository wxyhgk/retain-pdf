from __future__ import annotations

from dataclasses import dataclass
from typing import Any

LegacyBlockKind = tuple[str, str, list[str], dict[str, Any]]


@dataclass(frozen=True)
class LegacyBlockProjection:
    """Compatibility projection for the current document.v1 block fields."""

    block_type: str
    sub_type: str
    tags: tuple[str, ...] = ()
    metadata: tuple[tuple[str, Any], ...] = ()

    def build(self) -> LegacyBlockKind:
        return self.block_type, self.sub_type, list(self.tags), dict(self.metadata)


_LEGACY_PROJECTIONS = {
    "doc_title": LegacyBlockProjection("text", "title", ("title",)),
    "abstract": LegacyBlockProjection(
        "text",
        "body",
        ("abstract",),
        (("source_text_role", "abstract"),),
    ),
    "text": LegacyBlockProjection("text", "body"),
    "paragraph_title": LegacyBlockProjection("text", "heading", ("heading",)),
    "content": LegacyBlockProjection(
        "text",
        "table_of_contents",
        ("table_of_contents", "toc"),
    ),
    "reference_content": LegacyBlockProjection(
        "text",
        "reference_entry",
        ("reference_entry", "reference_zone", "skip_translation"),
    ),
    "formula_number": LegacyBlockProjection(
        "text",
        "formula_number",
        ("formula_number", "skip_translation"),
    ),
    "header": LegacyBlockProjection("text", "header", ("skip_translation",)),
    "footer": LegacyBlockProjection("text", "footer", ("skip_translation",)),
    "footnote": LegacyBlockProjection(
        "text",
        "footnote",
        ("footnote", "skip_translation"),
    ),
    "aside_text": LegacyBlockProjection(
        "text",
        "metadata",
        ("metadata", "skip_translation"),
    ),
    "number": LegacyBlockProjection("text", "page_number", ("skip_translation",)),
    "figure_title": LegacyBlockProjection(
        "text",
        "figure_caption",
        ("caption", "figure_caption"),
        (("caption_target", "figure"),),
    ),
    "table": LegacyBlockProjection("table", "table_html", ("table",)),
    "chart": LegacyBlockProjection(
        "image", "image_body", ("image", "skip_translation")
    ),
    "header_image": LegacyBlockProjection(
        "image", "image_body", ("image", "skip_translation")
    ),
    "footer_image": LegacyBlockProjection(
        "image", "image_body", ("image", "skip_translation")
    ),
    "image": LegacyBlockProjection(
        "image", "image_body", ("image", "skip_translation")
    ),
    "algorithm": LegacyBlockProjection("code", "code_block", ("code",)),
    "display_formula": LegacyBlockProjection(
        "formula", "display_formula", ("formula",)
    ),
    # Compatibility alias observed in older provider payloads.
    "formula": LegacyBlockProjection("formula", "display_formula", ("formula",)),
    "vision_footnote": LegacyBlockProjection(
        "text",
        "footnote",
        ("footnote",),
        (("footnote_target", "unknown"),),
    ),
}

_UNKNOWN_PROJECTION = LegacyBlockProjection("unknown", "", ("unknown",))


def project_legacy_block_kind(raw_label: str) -> LegacyBlockKind:
    label = str(raw_label or "").strip().lower()
    return _LEGACY_PROJECTIONS.get(label, _UNKNOWN_PROJECTION).build()


__all__ = [
    "LegacyBlockKind",
    "LegacyBlockProjection",
    "project_legacy_block_kind",
]

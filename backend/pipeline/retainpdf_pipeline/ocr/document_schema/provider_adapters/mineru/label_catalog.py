from __future__ import annotations

from dataclasses import dataclass

MINERU_MIDDLE_TAXONOMY_PROFILE = "mineru.middle.current"

HIERARCHY_CONTAINER = "container"
HIERARCHY_BLOCK = "block"


@dataclass(frozen=True)
class MinerULabelDefinition:
    """MinerU provider facts, kept separate from RetainPDF policy."""

    provider_label: str
    element_type: str
    hierarchy: str = HIERARCHY_BLOCK
    content_carrier: str = "text"
    relation_intents: tuple[str, ...] = ()


def _block(
    label: str,
    element_type: str,
    content_carrier: str = "text",
    *,
    relation_intents: tuple[str, ...] = (),
) -> MinerULabelDefinition:
    return MinerULabelDefinition(
        provider_label=label,
        element_type=element_type,
        content_carrier=content_carrier,
        relation_intents=relation_intents,
    )


def _container(
    label: str,
    element_type: str,
    content_carrier: str,
) -> MinerULabelDefinition:
    return MinerULabelDefinition(
        provider_label=label,
        element_type=element_type,
        hierarchy=HIERARCHY_CONTAINER,
        content_carrier=content_carrier,
        relation_intents=("contains",),
    )


# Current MinerU BlockType values. The catalog describes the provider output;
# RetainPDF's coarse content/role projection lives in projection.py.
_DEFINITIONS = (
    _container("image", "image_group", "image"),
    _container("table", "table_group", "table"),
    _container("chart", "chart_group", "image"),
    _block("image_body", "image", "image"),
    _block("table_body", "table", "table"),
    _block("chart_body", "chart", "image"),
    _block("caption", "caption"),
    _block("image_caption", "image_caption", relation_intents=("caption_of",)),
    _block("table_caption", "table_caption", relation_intents=("caption_of",)),
    _block("chart_caption", "chart_caption", relation_intents=("caption_of",)),
    _block("algorithm_caption", "algorithm_caption", relation_intents=("caption_of",)),
    _block("footnote", "footnote"),
    _block("image_footnote", "image_footnote", relation_intents=("note_of",)),
    _block("table_footnote", "table_footnote", relation_intents=("note_of",)),
    _block("chart_footnote", "chart_footnote", relation_intents=("note_of",)),
    _block("text", "paragraph"),
    _block("title", "heading"),
    _block("interline_equation", "display_formula", "formula"),
    _block("equation", "display_formula", "formula"),
    _container("list", "list", "text"),
    _container("index", "index", "text"),
    _block("discarded", "discarded", "none"),
    _container("code", "code", "code"),
    _block("code_body", "code", "code"),
    _block("code_caption", "code_caption", relation_intents=("caption_of",)),
    _block("code_footnote", "code_footnote", relation_intents=("note_of",)),
    _block("algorithm", "algorithm", "code"),
    _block("ref_text", "reference_entry"),
    _block("phonetic", "phonetic"),
    _block("header", "header"),
    _block("footer", "footer"),
    _block("page_number", "page_number"),
    _block("aside_text", "aside"),
    _block("page_footnote", "page_footnote"),
    _block("abstract", "abstract"),
    _block("doc_title", "document_title"),
    _block("paragraph_title", "section_heading"),
    _block("vertical_text", "paragraph"),
    _block("header_image", "header_image", "image"),
    _block("footer_image", "footer_image", "image"),
    _block("formula_number", "formula_number"),
)

_CATALOG = {definition.provider_label: definition for definition in _DEFINITIONS}

MINERU_MIDDLE_BLOCK_LABELS = tuple(_CATALOG)
MINERU_MIDDLE_SPAN_LABELS = (
    "image",
    "table",
    "chart",
    "text",
    "inline_equation",
    "interline_equation",
    "equation",
    "hyperlink",
)

MINERU_TEXT_AGGREGATE_CONTAINERS = frozenset({"list", "index"})


def get_mineru_label_definition(raw_label: str) -> MinerULabelDefinition | None:
    return _CATALOG.get(str(raw_label or "").strip().lower())


def is_mineru_structural_container(raw_label: str) -> bool:
    definition = get_mineru_label_definition(raw_label)
    return definition is not None and definition.hierarchy == HIERARCHY_CONTAINER


__all__ = [
    "HIERARCHY_BLOCK",
    "HIERARCHY_CONTAINER",
    "MINERU_MIDDLE_BLOCK_LABELS",
    "MINERU_MIDDLE_SPAN_LABELS",
    "MINERU_MIDDLE_TAXONOMY_PROFILE",
    "MINERU_TEXT_AGGREGATE_CONTAINERS",
    "MinerULabelDefinition",
    "get_mineru_label_definition",
    "is_mineru_structural_container",
]

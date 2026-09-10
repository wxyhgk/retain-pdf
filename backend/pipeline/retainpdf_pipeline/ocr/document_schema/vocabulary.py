from __future__ import annotations

# Closed contract vocabularies. Keep these in parity with document.v1.schema.json.
CONTENT_KINDS = (
    "text",
    "image",
    "table",
    "formula",
    "code",
    "unknown",
)

# ``type`` is a compatibility projection of ``content.kind``.
BLOCK_TYPES = CONTENT_KINDS

# ``formula`` is retained for display-formula block segments and historical
# compatibility. New inline math emitted inside text blocks uses
# ``inline_formula`` explicitly.
SEGMENT_TYPES = (
    "text",
    "inline_formula",
    "formula",
)

# Broad RetainPDF behavior classes. These are intentionally provider-neutral;
# detailed document meaning belongs in layout/semantic/structure roles.
BLOCK_CLASSES = (
    "title",
    "body",
    "formula",
    "image",
    "table",
    "code",
    "caption",
    "footnote",
    "metadata",
    "unknown",
)

LAYOUT_ROLES = (
    "title",
    "heading",
    "paragraph",
    "list_item",
    "caption",
    "header",
    "footer",
    "footnote",
    "page_number",
    "toc",
    "unknown",
)

SEMANTIC_ROLES = (
    "body",
    "abstract",
    "reference",
    "metadata",
    "affiliation",
    "acknowledgement",
    "table_of_contents",
    "unknown",
)

# ``structure_role`` remains an open extension point in document.v1.1. This
# tuple records roles emitted or interpreted by current first-party code; it is
# intentionally not used as a validation enum until a versioned contract can
# define extension behavior.
STRUCTURE_ROLES = (
    "",
    "body",
    "abstract",
    "document_title",
    "title",
    "heading",
    "section_heading",
    "caption",
    "figure_caption",
    "image_caption",
    "table_caption",
    "code_caption",
    "footnote",
    "image_footnote",
    "table_footnote",
    "header",
    "footer",
    "metadata",
    "formula_number",
    "reference_heading",
    "reference_entry",
    "table_of_contents",
    "example_line",
    "example_intro",
    "option_header",
    "option_description",
)


__all__ = [
    "BLOCK_CLASSES",
    "BLOCK_TYPES",
    "CONTENT_KINDS",
    "LAYOUT_ROLES",
    "SEGMENT_TYPES",
    "SEMANTIC_ROLES",
    "STRUCTURE_ROLES",
]

from __future__ import annotations

from services.document_schema.semantics import structure_role


STYLE_HINTS_BY_ROLE = {
    "abstract": "This block is an abstract sentence or paragraph. Translate it as compact academic summary prose.",
    "heading": "This block is a section heading. Translate it as a short academic heading, not as a full sentence.",
    "title": "This block is a document or section title. Translate it as a concise formal title.",
    "image_caption": "This block is a figure caption. Keep caption style concise; preserve figure numbering/letters and visual references.",
    "table_caption": "This block is a table caption. Keep caption style concise; preserve table numbering and parameter symbols.",
    "code_caption": "This block is a code/listing caption. Keep listing identifiers and code names unchanged where appropriate.",
    "caption": "This block is a caption. Keep it concise and caption-like rather than paragraph-like.",
    "table_footnote": "This block is a table footnote. Keep it brief and note-like; preserve symbols, superscripts, and markers.",
    "image_footnote": "This block is an image footnote. Keep it brief and note-like; preserve symbols, superscripts, and markers.",
    "footnote": "This block is a footnote. Keep it brief and note-like rather than expanding it into body prose.",
}


def structure_style_hint(metadata: dict | None) -> str:
    role = structure_role(metadata or {})
    return STYLE_HINTS_BY_ROLE.get(role, "")


__all__ = ["structure_style_hint"]

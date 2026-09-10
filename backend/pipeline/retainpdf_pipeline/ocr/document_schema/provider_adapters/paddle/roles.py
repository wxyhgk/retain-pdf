from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PaddleBlockRoles:
    layout_role: str = "unknown"
    semantic_role: str = "unknown"
    structure_role: str = ""


_ROLES_BY_SUBTYPE = {
    "title": PaddleBlockRoles(layout_role="title", structure_role="title"),
    "heading": PaddleBlockRoles(layout_role="heading", structure_role="heading"),
    "body": PaddleBlockRoles(
        layout_role="paragraph",
        semantic_role="body",
        structure_role="body",
    ),
    "table_of_contents": PaddleBlockRoles(
        layout_role="toc",
        semantic_role="table_of_contents",
        structure_role="table_of_contents",
    ),
    "header": PaddleBlockRoles(layout_role="header", semantic_role="metadata"),
    "footer": PaddleBlockRoles(layout_role="footer", semantic_role="metadata"),
    "page_number": PaddleBlockRoles(
        layout_role="page_number", semantic_role="metadata"
    ),
    "metadata": PaddleBlockRoles(semantic_role="metadata"),
    "formula_number": PaddleBlockRoles(
        semantic_role="metadata",
        structure_role="formula_number",
    ),
    "reference_entry": PaddleBlockRoles(
        semantic_role="reference",
        structure_role="reference_entry",
    ),
    "figure_caption": PaddleBlockRoles(
        layout_role="caption",
        structure_role="figure_caption",
    ),
    "caption": PaddleBlockRoles(layout_role="caption", structure_role="caption"),
    "image_caption": PaddleBlockRoles(layout_role="caption", structure_role="caption"),
    "table_caption": PaddleBlockRoles(
        layout_role="caption",
        structure_role="table_caption",
    ),
    "code_caption": PaddleBlockRoles(structure_role="caption"),
    "footnote": PaddleBlockRoles(layout_role="footnote", structure_role="footnote"),
    "image_footnote": PaddleBlockRoles(
        layout_role="footnote",
        structure_role="footnote",
    ),
    "table_footnote": PaddleBlockRoles(
        layout_role="footnote",
        structure_role="footnote",
    ),
}

_ROLES_BY_RAW_LABEL = {
    "doc_title": PaddleBlockRoles(
        layout_role="title",
        structure_role="document_title",
    ),
    "abstract": PaddleBlockRoles(
        layout_role="paragraph",
        semantic_role="abstract",
        structure_role="body",
    ),
    "footnote": PaddleBlockRoles(layout_role="footnote", structure_role="footnote"),
}


def _merge_roles(
    base: PaddleBlockRoles, override: PaddleBlockRoles | None
) -> PaddleBlockRoles:
    if override is None:
        return base
    return PaddleBlockRoles(
        layout_role=override.layout_role
        if override.layout_role != "unknown"
        else base.layout_role,
        semantic_role=(
            override.semantic_role
            if override.semantic_role != "unknown"
            else base.semantic_role
        ),
        structure_role=override.structure_role or base.structure_role,
    )


def derive_paddle_block_roles(
    *,
    raw_label: str,
    block_type: str,
    sub_type: str,
) -> PaddleBlockRoles:
    if block_type != "text":
        return PaddleBlockRoles()
    label = str(raw_label or "").strip().lower()
    base = _ROLES_BY_SUBTYPE.get(sub_type, PaddleBlockRoles())
    return _merge_roles(base, _ROLES_BY_RAW_LABEL.get(label))


__all__ = ["PaddleBlockRoles", "derive_paddle_block_roles"]

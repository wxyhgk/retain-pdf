from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MinerUBlockProjection:
    content_kind: str
    sub_type: str
    layout_role: str = "unknown"
    semantic_role: str = "unknown"
    structure_role: str = ""
    translate: bool = False
    translate_reason: str = "provider_non_body:unknown"
    tags: tuple[str, ...] = ()


def _text(
    sub_type: str,
    *,
    layout_role: str,
    semantic_role: str,
    structure_role: str,
    translate: bool,
    reason: str,
    tags: tuple[str, ...] = (),
) -> MinerUBlockProjection:
    return MinerUBlockProjection(
        content_kind="text",
        sub_type=sub_type,
        layout_role=layout_role,
        semantic_role=semantic_role,
        structure_role=structure_role,
        translate=translate,
        translate_reason=reason,
        tags=tags,
    )


_BODY = _text(
    "body",
    layout_role="paragraph",
    semantic_role="body",
    structure_role="body",
    translate=True,
    reason="provider_body_whitelist:text",
)
_HEADING = _text(
    "heading",
    layout_role="heading",
    semantic_role="unknown",
    structure_role="heading",
    translate=True,
    reason="provider_heading_candidate",
    tags=("heading",),
)
_TITLE = _text(
    "title",
    layout_role="title",
    semantic_role="unknown",
    structure_role="document_title",
    translate=True,
    reason="provider_title_candidate",
    tags=("title",),
)
_ABSTRACT = _text(
    "body",
    layout_role="paragraph",
    semantic_role="abstract",
    structure_role="body",
    translate=True,
    reason="provider_body_whitelist:abstract",
    tags=("abstract",),
)
_LIST = _text(
    "body",
    layout_role="list_item",
    semantic_role="body",
    structure_role="body",
    translate=True,
    reason="provider_body_whitelist:list",
    tags=("list",),
)
_REFERENCE = _text(
    "reference_entry",
    layout_role="paragraph",
    semantic_role="reference",
    structure_role="reference_entry",
    translate=False,
    reason="provider_non_body:reference_entry",
    tags=("reference_entry", "reference_zone", "skip_translation"),
)


def _caption(raw_type: str) -> MinerUBlockProjection:
    structure_role = {
        "image_caption": "figure_caption",
        "table_caption": "table_caption",
        "chart_caption": "figure_caption",
        "code_caption": "code_caption",
        "algorithm_caption": "code_caption",
    }.get(raw_type, "caption")
    return _text(
        raw_type,
        layout_role="caption",
        semantic_role="unknown",
        structure_role=structure_role,
        translate=True,
        reason=f"provider_caption_whitelist:{raw_type}",
        tags=("caption", raw_type),
    )


def _footnote(raw_type: str) -> MinerUBlockProjection:
    visual = raw_type in {
        "image_footnote",
        "table_footnote",
        "chart_footnote",
        "code_footnote",
    }
    return _text(
        raw_type,
        layout_role="footnote",
        semantic_role="metadata",
        structure_role="footnote",
        translate=visual,
        reason=(
            f"provider_footnote_whitelist:{raw_type}"
            if visual
            else f"provider_non_body:{raw_type}"
        ),
        tags=("footnote", raw_type, *(() if visual else ("skip_translation",))),
    )


def _metadata(raw_type: str, layout_role: str = "unknown") -> MinerUBlockProjection:
    return _text(
        "page_number" if raw_type == "page_number" else "metadata",
        layout_role=layout_role,
        semantic_role="metadata",
        structure_role="metadata",
        translate=False,
        reason=f"provider_non_body:{raw_type}",
        tags=("metadata", "skip_translation"),
    )


def project_mineru_block(
    raw_type: str,
    *,
    raw_sub_type: str = "",
    has_text: bool = False,
) -> MinerUBlockProjection:
    label = str(raw_type or "").strip().lower()
    sub_type = str(raw_sub_type or "").strip().lower()

    if label in {"text", "paragraph", "vertical_text"}:
        return _BODY
    if label == "abstract":
        return _ABSTRACT
    if label == "title":
        return _HEADING
    if label == "doc_title":
        return _TITLE
    if label == "paragraph_title":
        return _HEADING
    if label in {"list", "index"}:
        return _REFERENCE if sub_type in {"ref_text", "reference_list"} else _LIST
    if label == "ref_text":
        return _REFERENCE
    if label in {
        "caption",
        "image_caption",
        "table_caption",
        "chart_caption",
        "code_caption",
        "algorithm_caption",
    }:
        return _caption(label)
    if label in {
        "footnote",
        "image_footnote",
        "table_footnote",
        "chart_footnote",
        "code_footnote",
        "page_footnote",
    }:
        return _footnote(label)
    if label == "header":
        return _metadata(label, "header")
    if label == "footer":
        return _metadata(label, "footer")
    if label == "page_number":
        return _metadata(label, "page_number")
    if label in {"aside_text", "phonetic", "formula_number", "discarded"}:
        return _metadata(label)
    if label in {"interline_equation", "equation", "equation_interline"}:
        return MinerUBlockProjection(
            content_kind="formula",
            sub_type="display_formula",
            translate=False,
            translate_reason="provider_non_text:formula",
            tags=("formula",),
        )
    if label in {
        "image",
        "image_body",
        "chart",
        "chart_body",
        "header_image",
        "footer_image",
    }:
        return MinerUBlockProjection(
            content_kind="image",
            sub_type="figure",
            translate=False,
            translate_reason="provider_non_text:image",
            tags=("image", "skip_translation"),
        )
    if label in {"table", "table_body"}:
        return MinerUBlockProjection(
            content_kind="table",
            sub_type="table_body",
            translate=False,
            translate_reason="provider_non_text:table",
            tags=("table", "skip_translation"),
        )
    if label in {"code", "code_body", "algorithm"} or sub_type == "algorithm":
        return MinerUBlockProjection(
            content_kind="code",
            sub_type="code_block",
            translate=False,
            translate_reason="provider_non_text:code",
            tags=("code", "skip_translation"),
        )
    if has_text:
        return _metadata(label or "unknown")
    return MinerUBlockProjection(
        content_kind="unknown",
        sub_type="",
        translate=False,
        translate_reason=f"provider_unknown:{label or 'missing'}",
        tags=("unknown",),
    )


__all__ = ["MinerUBlockProjection", "project_mineru_block"]

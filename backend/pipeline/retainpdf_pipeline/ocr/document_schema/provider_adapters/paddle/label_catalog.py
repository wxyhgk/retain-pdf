from __future__ import annotations

from dataclasses import dataclass

PADDLE_TAXONOMY_PROFILE_V2 = "paddle.pp_doclayout_v2.25"
PADDLE_TAXONOMY_PROFILE_V3 = "paddle.pp_doclayout_v3.25"
DEFAULT_PADDLE_TAXONOMY_PROFILE = PADDLE_TAXONOMY_PROFILE_V3

PLANE_LAYOUT_DETECTION = "layout_detection"
PLANE_PARSING = "parsing"

GRANULARITY_BLOCK = "block"
GRANULARITY_INLINE_SPAN = "inline_span"
GRANULARITY_REGION = "region"


@dataclass(frozen=True)
class PaddleLabelDefinition:
    """Provider taxonomy facts, independent from RetainPDF processing policy."""

    provider_label: str
    element_type: str
    canonical_granularity: str
    content_carrier: str
    allowed_planes: tuple[str, ...]
    writing_mode: str = ""
    placement: str = ""
    formula_display: str = ""
    relation_intents: tuple[str, ...] = ()


def _block(
    provider_label: str,
    element_type: str,
    content_carrier: str,
    *,
    writing_mode: str = "",
    placement: str = "",
    formula_display: str = "",
    relation_intents: tuple[str, ...] = (),
) -> PaddleLabelDefinition:
    return PaddleLabelDefinition(
        provider_label=provider_label,
        element_type=element_type,
        canonical_granularity=GRANULARITY_BLOCK,
        content_carrier=content_carrier,
        allowed_planes=(PLANE_LAYOUT_DETECTION, PLANE_PARSING),
        writing_mode=writing_mode,
        placement=placement,
        formula_display=formula_display,
        relation_intents=relation_intents,
    )


_OFFICIAL_LABEL_DEFINITIONS = (
    _block("abstract", "abstract", "text"),
    _block("algorithm", "algorithm", "code"),
    _block("aside_text", "aside", "text"),
    _block(
        "chart",
        "chart",
        "image",
        relation_intents=("caption_target", "note_target"),
    ),
    _block("content", "table_of_contents", "text", relation_intents=("contains",)),
    _block(
        "display_formula",
        "display_formula",
        "formula",
        formula_display="block",
        relation_intents=("formula_number_target",),
    ),
    _block("doc_title", "document_title", "text"),
    _block("figure_title", "caption", "text", relation_intents=("caption_of",)),
    _block("footer", "footer", "text", placement="footer"),
    _block("footer_image", "footer_image", "image", placement="footer"),
    _block("footnote", "footnote", "text", relation_intents=("note_of",)),
    _block(
        "formula_number",
        "formula_number",
        "text",
        relation_intents=("formula_number_of",),
    ),
    _block("header", "header", "text", placement="header"),
    _block("header_image", "header_image", "image", placement="header"),
    _block(
        "image",
        "image",
        "image",
        relation_intents=("caption_target", "note_target"),
    ),
    PaddleLabelDefinition(
        provider_label="inline_formula",
        element_type="inline_formula",
        canonical_granularity=GRANULARITY_INLINE_SPAN,
        content_carrier="formula",
        allowed_planes=(PLANE_LAYOUT_DETECTION, PLANE_PARSING),
        formula_display="inline",
        relation_intents=("embedded_in",),
    ),
    _block("number", "page_number", "text"),
    _block("paragraph_title", "section_heading", "text"),
    PaddleLabelDefinition(
        provider_label="reference",
        element_type="reference_section",
        canonical_granularity=GRANULARITY_REGION,
        content_carrier="none",
        allowed_planes=(PLANE_LAYOUT_DETECTION, PLANE_PARSING),
        relation_intents=("contains",),
    ),
    _block(
        "reference_content", "reference_entry", "text", relation_intents=("part_of",)
    ),
    _block("seal", "seal", "image"),
    _block(
        "table",
        "table",
        "table",
        relation_intents=("caption_target", "note_target"),
    ),
    _block("text", "paragraph", "text"),
    _block("vertical_text", "paragraph", "text", writing_mode="vertical_unknown"),
    _block("vision_footnote", "visual_footnote", "text", relation_intents=("note_of",)),
)

PADDLE_OFFICIAL_LAYOUT_LABELS = tuple(
    definition.provider_label for definition in _OFFICIAL_LABEL_DEFINITIONS
)

_PROFILE_CATALOGS = {
    PADDLE_TAXONOMY_PROFILE_V2: {
        definition.provider_label: definition
        for definition in _OFFICIAL_LABEL_DEFINITIONS
    },
    PADDLE_TAXONOMY_PROFILE_V3: {
        definition.provider_label: definition
        for definition in _OFFICIAL_LABEL_DEFINITIONS
    },
}


def get_paddle_label_definition(
    raw_label: str,
    *,
    profile: str = DEFAULT_PADDLE_TAXONOMY_PROFILE,
) -> PaddleLabelDefinition | None:
    catalog = _PROFILE_CATALOGS.get(profile)
    if catalog is None:
        raise ValueError(f"unsupported Paddle taxonomy profile: {profile}")
    return catalog.get(str(raw_label or "").strip().lower())


__all__ = [
    "DEFAULT_PADDLE_TAXONOMY_PROFILE",
    "GRANULARITY_BLOCK",
    "GRANULARITY_INLINE_SPAN",
    "GRANULARITY_REGION",
    "PADDLE_OFFICIAL_LAYOUT_LABELS",
    "PADDLE_TAXONOMY_PROFILE_V2",
    "PADDLE_TAXONOMY_PROFILE_V3",
    "PLANE_LAYOUT_DETECTION",
    "PLANE_PARSING",
    "PaddleLabelDefinition",
    "get_paddle_label_definition",
]

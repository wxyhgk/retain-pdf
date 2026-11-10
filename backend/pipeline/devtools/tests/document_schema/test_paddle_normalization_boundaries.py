from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.block_labels import (
    map_block_kind,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.roles import (
    derive_paddle_block_roles,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.translation_policy import (
    derive_paddle_translation_policy,
)

EXPECTED_OFFICIAL_LABELS = (
    "abstract",
    "algorithm",
    "aside_text",
    "chart",
    "content",
    "display_formula",
    "doc_title",
    "figure_title",
    "footer",
    "footer_image",
    "footnote",
    "formula_number",
    "header",
    "header_image",
    "image",
    "inline_formula",
    "number",
    "paragraph_title",
    "reference",
    "reference_content",
    "seal",
    "table",
    "text",
    "vertical_text",
    "vision_footnote",
)


def test_legacy_projection_keeps_current_mapping_for_official_labels() -> None:
    expected = {
        "abstract": ("text", "body", ["abstract"], {"source_text_role": "abstract"}),
        "algorithm": ("code", "code_block", ["code"], {}),
        "aside_text": ("text", "metadata", ["metadata", "skip_translation"], {}),
        "chart": ("image", "image_body", ["image", "skip_translation"], {}),
        "content": ("text", "table_of_contents", ["table_of_contents", "toc"], {}),
        "display_formula": ("formula", "display_formula", ["formula"], {}),
        "doc_title": ("text", "title", ["title"], {}),
        "figure_title": (
            "text",
            "figure_caption",
            ["caption", "figure_caption"],
            {"caption_target": "figure"},
        ),
        "footer": ("text", "footer", ["skip_translation"], {}),
        "footer_image": ("image", "image_body", ["image", "skip_translation"], {}),
        "footnote": ("text", "footnote", ["footnote", "skip_translation"], {}),
        "formula_number": (
            "text",
            "formula_number",
            ["formula_number", "skip_translation"],
            {},
        ),
        "header": ("text", "header", ["skip_translation"], {}),
        "header_image": ("image", "image_body", ["image", "skip_translation"], {}),
        "image": ("image", "image_body", ["image", "skip_translation"], {}),
        "inline_formula": ("unknown", "", ["unknown"], {}),
        "number": ("text", "page_number", ["skip_translation"], {}),
        "paragraph_title": ("text", "heading", ["heading"], {}),
        "reference": ("unknown", "", ["unknown"], {}),
        "reference_content": (
            "text",
            "reference_entry",
            ["reference_entry", "reference_zone", "skip_translation"],
            {},
        ),
        "seal": ("unknown", "", ["unknown"], {}),
        "table": ("table", "table_html", ["table"], {}),
        "text": ("text", "body", [], {}),
        "vertical_text": ("unknown", "", ["unknown"], {}),
        "vision_footnote": (
            "text",
            "footnote",
            ["footnote"],
            {"footnote_target": "unknown"},
        ),
    }

    assert {
        label: map_block_kind(label) for label in EXPECTED_OFFICIAL_LABELS
    } == expected
    assert map_block_kind("formula") == (
        "formula",
        "display_formula",
        ["formula"],
        {},
    )
    assert map_block_kind("future_provider_label") == (
        "unknown",
        "",
        ["unknown"],
        {},
    )


def test_legacy_projection_returns_fresh_mutable_values() -> None:
    first = map_block_kind("figure_title")
    first[2].append("mutated")
    first[3]["mutated"] = True

    second = map_block_kind("figure_title")
    assert "mutated" not in second[2]
    assert "mutated" not in second[3]


def test_roles_and_translation_policy_are_derived_independently() -> None:
    abstract_roles = derive_paddle_block_roles(
        raw_label="abstract",
        block_type="text",
        sub_type="body",
    )
    abstract_policy = derive_paddle_translation_policy(
        raw_label="abstract",
        block_type="text",
        sub_type="body",
    )
    assert abstract_roles.layout_role == "paragraph"
    assert abstract_roles.semantic_role == "abstract"
    assert abstract_roles.structure_role == "body"
    assert abstract_policy.as_document_policy() == {
        "translate": True,
        "translate_reason": "provider_body_whitelist:abstract",
    }

    aside_roles = derive_paddle_block_roles(
        raw_label="aside_text",
        block_type="text",
        sub_type="metadata",
    )
    aside_policy = derive_paddle_translation_policy(
        raw_label="aside_text",
        block_type="text",
        sub_type="metadata",
    )
    assert aside_roles.semantic_role == "metadata"
    assert aside_policy.as_document_policy() == {
        "translate": False,
        "translate_reason": "provider_non_body:metadata",
    }

    vision_policy = derive_paddle_translation_policy(
        raw_label="vision_footnote",
        block_type="text",
        sub_type="footnote",
    )
    assert vision_policy.as_document_policy() == {
        "translate": True,
        "translate_reason": "provider_footnote_whitelist:vision_footnote",
    }

    formula_roles = derive_paddle_block_roles(
        raw_label="display_formula",
        block_type="formula",
        sub_type="display_formula",
    )
    formula_policy = derive_paddle_translation_policy(
        raw_label="display_formula",
        block_type="formula",
        sub_type="display_formula",
    )
    assert formula_roles.layout_role == "unknown"
    assert formula_policy.as_document_policy() == {
        "translate": False,
        "translate_reason": "provider_non_text:formula",
    }

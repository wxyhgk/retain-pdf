import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.ocr.document_schema.classification import (
    derive_block_class,
    resolve_block_class,
)
from retainpdf_pipeline.ocr.document_schema.consumer_reader import block_class
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.block_builder import (
    build_block_record,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.roles import (
    derive_paddle_block_roles,
)


@pytest.mark.parametrize(
    ("content_kind", "layout_role", "semantic_role", "structure_role", "expected"),
    (
        ("text", "paragraph", "body", "body", "body"),
        ("text", "paragraph", "abstract", "body", "title"),
        ("text", "heading", "unknown", "heading", "title"),
        ("text", "paragraph", "reference", "reference_entry", "body"),
        ("text", "caption", "unknown", "figure_caption", "caption"),
        ("text", "footnote", "unknown", "table_footnote", "footnote"),
        ("text", "paragraph", "metadata", "formula_number", "metadata"),
        ("formula", "unknown", "unknown", "", "formula"),
        ("image", "unknown", "unknown", "", "image"),
        ("table", "unknown", "unknown", "", "table"),
        ("code", "unknown", "unknown", "", "code"),
    ),
)
def test_block_classification_is_provider_neutral_and_broad(
    content_kind: str,
    layout_role: str,
    semantic_role: str,
    structure_role: str,
    expected: str,
) -> None:
    assert (
        derive_block_class(
            content_kind=content_kind,
            layout_role=layout_role,
            semantic_role=semantic_role,
            structure_role=structure_role,
        )
        == expected
    )


def test_formula_number_is_text_metadata_not_a_formula_block() -> None:
    roles = derive_paddle_block_roles(
        raw_label="formula_number",
        block_type="text",
        sub_type="formula_number",
    )

    assert roles.semantic_role == "metadata"
    assert roles.structure_role == "formula_number"
    assert (
        derive_block_class(
            content_kind="text",
            layout_role=roles.layout_role,
            semantic_role=roles.semantic_role,
            structure_role=roles.structure_role,
        )
        == "metadata"
    )


def test_block_builder_uses_content_kind_as_the_authoritative_type() -> None:
    record = build_block_record(
        {
            "block_id": "p001-b0000",
            "content_kind": "formula",
            "content": {"kind": "formula", "text": "x^2"},
            "text": "x^2",
        }
    )

    assert record["content"]["kind"] == "formula"
    assert record["type"] == "formula"
    assert record["block_class"] == "formula"


def test_block_builder_rejects_conflicting_content_type_aliases() -> None:
    with pytest.raises(ValueError, match="block_type must match content_kind"):
        build_block_record(
            {
                "content_kind": "formula",
                "block_type": "text",
                "content": {"kind": "formula"},
            }
        )


def test_block_class_can_be_derived_for_legacy_documents() -> None:
    assert (
        resolve_block_class(
            {
                "type": "text",
                "layout_role": "paragraph",
                "semantic_role": "abstract",
                "structure_role": "body",
            }
        )
        == "title"
    )


@pytest.mark.parametrize(
    ("sub_type", "expected"),
    (
        ("title", "title"),
        ("display_formula", "formula"),
        ("formula_number", "metadata"),
        ("figure_caption", "caption"),
    ),
)
def test_block_class_legacy_sub_type_fallback_is_centralized(
    sub_type: str,
    expected: str,
) -> None:
    legacy_item = {
        "block_kind": "text",
        "normalized_sub_type": sub_type,
    }

    assert resolve_block_class(legacy_item) == expected
    assert block_class(legacy_item) == expected


def test_canonical_roles_override_stale_legacy_sub_type() -> None:
    assert (
        resolve_block_class(
            {
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "normalized_sub_type": "display_formula",
            }
        )
        == "body"
    )


@pytest.mark.parametrize(
    "legacy_item",
    (
        {"block_type": "formula"},
        {"raw_block_type": "display_formula"},
    ),
)
def test_legacy_formula_payload_shapes_still_resolve(legacy_item: dict) -> None:
    assert resolve_block_class(legacy_item) == "formula"


def test_legacy_metadata_roles_are_a_compatibility_fallback() -> None:
    assert (
        resolve_block_class(
            {
                "block_type": "text",
                "metadata": {
                    "semantic_role": "abstract",
                    "structure_role": "body",
                },
            }
        )
        == "title"
    )

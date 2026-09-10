import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.ocr.document_schema.canonical_semantics import (
    BlockSemanticProfile,
    from_flat_item,
    from_normalized_block,
    is_bodylike,
    is_caption,
    is_plain_text,
    is_title,
    uses_title_style,
)
from retainpdf_pipeline.ocr.document_schema.classification import (
    resolve_block_class,
    resolve_content_kind,
)
from retainpdf_pipeline.ocr.document_schema.provider_signals import (
    body_repair_applied,
    body_repair_peer_block_id,
    body_repair_role,
)
from retainpdf_pipeline.ocr.document_schema.semantics import (
    is_algorithm_semantic,
    is_bodylike_block,
    is_caption_like_block,
    is_footnote_like_block,
)


def test_normalized_profile_rejects_conflicting_canonical_block_class() -> None:
    with pytest.raises(ValueError, match="block_class conflicts"):
        from_normalized_block(
            {
                "content": {"kind": "text"},
                "block_class": "caption",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
            }
        )


def test_canonical_fields_override_conflicting_legacy_aliases() -> None:
    payload = {
        "content": {"kind": "text"},
        "block_class": "body",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "normalized_sub_type": "display_formula",
        "tags": ["caption", "footnote"],
        "derived": {"role": "figure_caption"},
        "raw_block_type": "table_html",
    }

    assert resolve_content_kind(payload) == "text"
    assert resolve_block_class(payload) == "body"
    assert is_caption_like_block(payload) is False
    assert is_footnote_like_block(payload) is False


@pytest.mark.parametrize(
    ("payload", "expected"),
    (
        (
            {
                "content": {"kind": "text"},
                "block_class": "body",
                "layout_role": "unknown",
                "semantic_role": "unknown",
                "structure_role": "",
            },
            True,
        ),
        (
            {
                "content": {"kind": "image"},
                "block_class": "image",
                "layout_role": "unknown",
                "semantic_role": "unknown",
                "structure_role": "",
            },
            False,
        ),
        (
            {
                "content": {"kind": "code"},
                "block_class": "code",
                "layout_role": "unknown",
                "semantic_role": "unknown",
                "structure_role": "",
            },
            False,
        ),
    ),
)
def test_empty_roles_do_not_make_non_text_blocks_bodylike(
    payload: dict,
    expected: bool,
) -> None:
    profile = from_normalized_block(payload)

    assert is_bodylike(profile) is expected
    assert is_bodylike_block(payload) is expected


def test_class_only_caption_is_recognized_by_flat_compatibility_reader() -> None:
    profile = from_flat_item({"block_class": "caption"})

    assert profile.block_class == "caption"
    assert is_caption(profile) is True
    assert is_caption_like_block({"block_class": "caption"}) is True


def test_abstract_keeps_broad_title_class_but_uses_body_text_behavior() -> None:
    profile = from_flat_item(
        {
            "content": {"kind": "text"},
            "block_class": "title",
            "layout_role": "paragraph",
            "semantic_role": "abstract",
            "structure_role": "body",
        }
    )

    assert is_title(profile) is True
    assert uses_title_style(profile) is False
    assert is_bodylike(profile) is True
    assert is_plain_text(profile) is True


def test_class_only_legacy_title_retains_title_behavior() -> None:
    profile = from_flat_item({"block_kind": "text", "block_class": "title"})

    assert uses_title_style(profile) is True


def test_nested_and_flat_canonical_carriers_build_the_same_profile() -> None:
    nested = {
        "content": {"kind": "text"},
        "block_class": "caption",
        "layout_role": "caption",
        "semantic_role": "unknown",
        "structure_role": "table_caption",
        "policy": {"translate": True},
    }
    flat = {
        "block_kind": "text",
        "block_class": "caption",
        "layout_role": "caption",
        "semantic_role": "unknown",
        "structure_role": "table_caption",
        "policy_translate": True,
    }

    assert from_normalized_block(nested) == from_flat_item(flat)
    assert from_flat_item(flat) == BlockSemanticProfile(
        content_kind="text",
        block_class="caption",
        layout_role="caption",
        semantic_role="unknown",
        structure_role="table_caption",
        policy_translate=True,
    )


@pytest.mark.parametrize(
    ("carrier", "expected_kind"),
    (
        ("image_body", "image"),
        ("table_html", "table"),
        ("code_block", "code"),
        ("display_formula", "formula"),
    ),
)
def test_legacy_block_carrier_aliases_are_normalized(
    carrier: str,
    expected_kind: str,
) -> None:
    payload = {"block_type": carrier}

    assert resolve_content_kind(payload) == expected_kind
    assert resolve_block_class(payload) == expected_kind


def test_inline_formula_span_alias_is_never_promoted_to_formula_block() -> None:
    payload = {"block_type": "inline_formula"}

    assert resolve_content_kind(payload) == "inline_formula"
    assert resolve_block_class(payload) != "formula"


def test_algorithm_identity_remains_an_explicit_legacy_compatibility_signal() -> None:
    canonical_code = {"content": {"kind": "code"}, "block_class": "code"}

    assert is_algorithm_semantic(canonical_code) is False
    assert is_algorithm_semantic({"raw_block_type": "algorithm"}) is True
    assert is_algorithm_semantic({"block_type": "algorithm"}) is True
    assert is_algorithm_semantic({"normalized_sub_type": "algorithm"}) is True


def test_provider_body_repair_signals_accept_canonical_and_old_names() -> None:
    canonical = {
        "body_repair_applied": True,
        "body_repair_role": "Donor",
        "body_repair_peer_block_id": "p001-b0002",
    }
    legacy = {
        "provider_body_repair_applied": True,
        "provider_body_repair_role": "Slot",
        "provider_suspected_peer_block_id": "p001-b0001",
    }

    assert body_repair_applied(canonical) is True
    assert body_repair_role(canonical) == "donor"
    assert body_repair_peer_block_id(canonical) == "p001-b0002"
    assert body_repair_applied(legacy) is True
    assert body_repair_role(legacy) == "slot"
    assert body_repair_peer_block_id(legacy) == "p001-b0001"

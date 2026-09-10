import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.render.layout.model.render_text import (
    should_skip_display_math_render,
)
from retainpdf_pipeline.render.layout.payload.render_item import (
    should_render_source_block,
)
from retainpdf_pipeline.render.policy.cleanup_policy import (
    item_has_formula_region,
    item_is_marked_non_translated,
)
from retainpdf_pipeline.render.semantics.item_view import (
    block_class,
    is_document_title,
    is_title_like_block,
)
from retainpdf_pipeline.render.source_cleanup.planning.item_classifier import (
    item_allows_forced_text_strip,
)


def test_rendering_uses_explicit_block_class_for_display_formula() -> None:
    item = {
        "block_class": "formula",
        "block_kind": "unknown",
        "protected_source_text": "x^2",
        "should_translate": False,
    }

    assert item_has_formula_region(item) is True
    assert should_skip_display_math_render(item) is True


def test_rendering_keeps_legacy_display_formula_sub_type_compatible() -> None:
    item = {
        "block_kind": "text",
        "normalized_sub_type": "display_formula",
        "protected_source_text": "x^2",
        "should_translate": True,
    }

    assert item_has_formula_region(item) is True
    assert should_render_source_block(item) is True


def test_rendering_does_not_let_stale_sub_type_override_canonical_roles() -> None:
    item = {
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "normalized_sub_type": "display_formula",
    }

    assert item_has_formula_region(item) is False


def test_cleanup_uses_canonical_footnote_role_before_legacy_sub_type() -> None:
    item = {
        "block_kind": "text",
        "layout_role": "footnote",
        "semantic_role": "metadata",
        "structure_role": "table_footnote",
        "normalized_sub_type": "body",
    }

    assert item_allows_forced_text_strip(item) is True


def test_cleanup_accepts_canonical_block_class_without_fine_roles() -> None:
    assert item_allows_forced_text_strip(
        {"block_kind": "text", "block_class": "caption"}
    ) is True


@pytest.mark.parametrize(
    ("legacy_fields", "expected_class"),
    [
        ({"normalized_sub_type": "title"}, "title"),
        ({"normalized_sub_type": "figure_caption"}, "caption"),
        ({"normalized_sub_type": "table_footnote"}, "footnote"),
        ({"normalized_sub_type": "display_formula"}, "formula"),
        ({"tags": ["metadata"]}, "metadata"),
    ],
)
def test_rendering_keeps_legacy_only_semantics_compatible(
    legacy_fields: dict,
    expected_class: str,
) -> None:
    item = {"block_kind": "text", **legacy_fields}

    assert block_class(item) == expected_class


def test_stale_legacy_fields_cannot_change_canonical_render_decisions() -> None:
    canonical = {
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "final_status": "translated",
        "decision": "translate",
        "should_translate": True,
        "translated_text": "正文",
    }
    stale_legacy = {
        **canonical,
        "normalized_sub_type": "display_formula",
        "raw_block_type": "doc_title",
        "tags": ["skip_translation", "figure_caption"],
    }

    def render_decisions(item: dict) -> tuple[object, ...]:
        return (
            block_class(item),
            item_has_formula_region(item),
            is_document_title(item),
            item_is_marked_non_translated(item),
            item_allows_forced_text_strip(item),
        )

    assert render_decisions(stale_legacy) == render_decisions(canonical)


def test_document_title_sampling_is_narrower_than_broad_title_class() -> None:
    # Mirrors the current normalized corpus distinction: 29 document titles,
    # plus 403 headings and 25 abstracts in the broad title class. Abstracts
    # use ordinary body typography despite that coarse classification.
    items = [
        *(
            {
                "block_kind": "text",
                "layout_role": "title",
                "semantic_role": "body",
                "structure_role": "document_title",
            }
            for _ in range(29)
        ),
        *(
            {
                "block_kind": "text",
                "layout_role": "heading",
                "semantic_role": "body",
                "structure_role": "section_heading",
            }
            for _ in range(403)
        ),
        *(
            {
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "abstract",
                "structure_role": "abstract",
            }
            for _ in range(25)
        ),
    ]

    assert sum(is_title_like_block(item) for item in items) == 432
    assert sum(is_document_title(item) for item in items) == 29


def test_abstract_is_not_title_like_for_rendering() -> None:
    item = {
        "block_kind": "text",
        "block_class": "title",
        "layout_role": "paragraph",
        "semantic_role": "abstract",
        "structure_role": "body",
    }

    assert block_class(item) == "title"
    assert is_title_like_block(item) is False


def test_legacy_only_document_title_keeps_exact_compatibility() -> None:
    assert is_document_title(
        {"block_kind": "text", "normalized_sub_type": "doc_title"}
    ) is True
    assert is_document_title(
        {"block_kind": "text", "normalized_sub_type": "heading"}
    ) is False


def test_canonical_document_title_role_is_recognized_without_layout_role() -> None:
    assert is_document_title(
        {
            "block_kind": "text",
            "layout_role": "unknown",
            "semantic_role": "unknown",
            "structure_role": "document_title",
        }
    ) is True


def test_legacy_document_title_ignores_empty_canonical_mirrors() -> None:
    assert is_document_title(
        {
            "block_kind": "text",
            "block_class": "unknown",
            "layout_role": "unknown",
            "semantic_role": "",
            "structure_role": "",
            "normalized_sub_type": "doc_title",
        }
    ) is True


@pytest.mark.parametrize(
    ("item", "expected"),
    [
        (
            {
                "final_status": "translated",
                "decision": "skip_translation",
                "should_translate": False,
                "tags": ["skip_translation"],
            },
            False,
        ),
        (
            {
                "decision": "translate",
                "should_translate": False,
                "tags": ["skip_translation"],
            },
            False,
        ),
        (
            {"should_translate": True, "tags": ["skip_translation"]},
            False,
        ),
        ({"tags": ["skip_translation"]}, True),
        (
            {
                "final_status": "skipped",
                "decision": "translate",
                "should_translate": True,
            },
            True,
        ),
    ],
)
def test_cleanup_non_translation_precedence(item: dict, expected: bool) -> None:
    assert item_is_marked_non_translated(item) is expected

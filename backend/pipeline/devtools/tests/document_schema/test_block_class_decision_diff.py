import sys
from pathlib import Path

import pytest

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema.decision_diff import (
    ALLOWLIST_SCHEMA,
    build_block_class_decision_diff,
    canonical_block_class,
    canonical_predicate_vector,
    legacy_block_class,
    legacy_predicate_vector,
    load_allowlist_payload,
)


def _document(*blocks: dict) -> dict:
    return {
        "schema": "normalized_document_v1",
        "document_id": "decision-diff-test",
        "source": {"provider": "test"},
        "pages": [
            {
                "page_index": 0,
                "blocks": list(blocks),
            }
        ],
    }


def _text_block(
    block_id: str,
    *,
    sub_type: str = "body",
    block_class: str = "body",
    layout_role: str = "paragraph",
    semantic_role: str = "body",
    structure_role: str = "body",
) -> dict:
    return {
        "block_id": block_id,
        "type": "text",
        "sub_type": sub_type,
        "block_class": block_class,
        "layout_role": layout_role,
        "semantic_role": semantic_role,
        "structure_role": structure_role,
        "content": {"kind": "text", "text": block_id},
    }


def test_legacy_decision_does_not_read_new_class_or_roles() -> None:
    block = _text_block(
        "abstract",
        block_class="title",
        semantic_role="abstract",
    )

    assert legacy_block_class(block) == "body"
    assert canonical_block_class(block) == "title"


def test_abstract_class_allowlist_does_not_implicitly_allow_predicate_change() -> None:
    abstract = _text_block(
        "abstract",
        block_class="title",
        semantic_role="abstract",
    )
    stable_body = _text_block("body")

    report = build_block_class_decision_diff(
        [("abstract.json", _document(abstract, stable_body))]
    )

    assert report["status"] == "fail"
    assert report["block_count"] == 2
    assert report["change_count"] == 1
    assert report["allowed_change_count"] == 1
    assert report["unexpected_change_count"] == 0
    assert report["transition_counts"] == {"body->title": 1}
    assert report["changes"][0]["allow_rule"] == "abstract_is_title"
    assert report["predicate_change_count"] == 1
    assert report["allowed_predicate_change_count"] == 0
    assert report["unexpected_predicate_change_count"] == 1
    assert report["predicate_changes"][0]["predicate"] == "body_candidate"
    assert report["predicate_changes"][0]["allowed"] is False


def test_abstract_predicate_change_requires_an_explicit_predicate_rule() -> None:
    abstract = _text_block(
        "abstract",
        block_class="title",
        semantic_role="abstract",
    )

    report = build_block_class_decision_diff(
        [("abstract.json", _document(abstract))],
        extra_allow_rules=(
            {
                "name": "reviewed-abstract-body-candidate",
                "change_kind": "predicate",
                "predicate": "body_candidate",
                "document_id": "decision-diff-test",
                "block_id": "abstract",
                "old_value": "true",
                "new_value": "false",
                "reason": "Reviewed semantic narrowing for abstracts",
            },
        ),
    )

    assert report["status"] == "pass"
    assert report["allowed_change_count"] == 1
    assert report["allowed_predicate_change_count"] == 1
    assert report["unexpected_predicate_change_count"] == 0


def test_unreviewed_class_change_fails_the_gate() -> None:
    stale_title = _text_block(
        "stale-title",
        sub_type="title",
        block_class="body",
        layout_role="paragraph",
    )

    report = build_block_class_decision_diff([("stale.json", _document(stale_title))])

    assert report["status"] == "fail"
    assert report["unexpected_change_count"] == 1
    assert report["changes"][0]["allowed"] is False


def test_declared_class_conflict_fails_even_when_transition_is_allowed() -> None:
    stale_abstract = _text_block(
        "stale-abstract",
        block_class="body",
        semantic_role="abstract",
    )

    report = build_block_class_decision_diff(
        [("stale-abstract.json", _document(stale_abstract))]
    )

    assert report["change_count"] == 1
    assert report["allowed_change_count"] == 1
    assert report["contract_conflict_count"] == 1
    assert report["status"] == "fail"
    assert report["contract_conflicts"][0]["declared_block_class"] == "body"


def test_reviewed_exact_change_can_be_allowlisted() -> None:
    stale_title = _text_block(
        "stale-title",
        sub_type="title",
        block_class="body",
        layout_role="paragraph",
    )
    rules = load_allowlist_payload(
        {
            "schema": ALLOWLIST_SCHEMA,
            "rules": [
                {
                    "name": "reviewed-test-change",
                    "document_id": "decision-diff-test",
                    "block_id": "stale-title",
                    "old_class": "title",
                    "new_class": "body",
                    "reason": "Reviewed synthetic regression case",
                },
                {
                    "name": "reviewed-title-predicate",
                    "predicate": "document_title",
                    "document_id": "decision-diff-test",
                    "block_id": "stale-title",
                    "reason": "Reviewed synthetic document-title change",
                },
                {
                    "name": "reviewed-body-predicate",
                    "predicate": "body_candidate",
                    "document_id": "decision-diff-test",
                    "block_id": "stale-title",
                    "reason": "Reviewed synthetic body-candidate change",
                },
            ],
        }
    )

    report = build_block_class_decision_diff(
        [("stale.json", _document(stale_title))],
        extra_allow_rules=rules,
    )

    assert report["status"] == "pass"
    assert report["allowed_change_count"] == 1
    assert report["allowed_predicate_change_count"] == 2
    assert report["changes"][0]["allow_rule"] == "reviewed-test-change"


def test_document_title_predicate_can_change_without_a_block_class_change() -> None:
    stale_title = _text_block(
        "heading",
        sub_type="title",
        block_class="title",
        layout_role="heading",
        semantic_role="unknown",
        structure_role="heading",
    )

    report = build_block_class_decision_diff([("heading.json", _document(stale_title))])

    assert report["change_count"] == 0
    assert report["predicate_change_count"] == 1
    assert report["unexpected_predicate_change_count"] == 1
    assert report["predicate_changes"][0]["predicate"] == "document_title"
    assert report["predicate_changes"][0]["old_value"] is True
    assert report["predicate_changes"][0]["new_value"] is False
    assert report["status"] == "fail"


def test_algorithm_requires_a_canonical_role_to_match_the_legacy_identity() -> None:
    algorithm = {
        "block_id": "algorithm",
        "type": "code",
        "sub_type": "code_block",
        "block_class": "code",
        "layout_role": "unknown",
        "semantic_role": "unknown",
        "structure_role": "",
        "content": {"kind": "code", "text": "return x"},
        "provenance": {"raw_label": "algorithm"},
    }

    assert legacy_predicate_vector(algorithm)["algorithm"] is True
    assert canonical_predicate_vector(algorithm)["algorithm"] is False

    report = build_block_class_decision_diff(
        [("algorithm.json", _document(algorithm))]
    )

    assert report["change_count"] == 0
    assert report["predicate_transition_counts"] == {"algorithm:true->false": 1}
    assert report["unexpected_predicate_changes"][0]["predicate"] == "algorithm"


@pytest.mark.parametrize(
    ("predicate", "canonical_fields"),
    (
        (
            "caption",
            {
                "block_class": "caption",
                "layout_role": "caption",
                "semantic_role": "unknown",
                "structure_role": "figure_caption",
            },
        ),
        (
            "footnote",
            {
                "block_class": "footnote",
                "layout_role": "footnote",
                "semantic_role": "unknown",
                "structure_role": "footnote",
            },
        ),
        (
            "reference",
            {
                "block_class": "body",
                "layout_role": "paragraph",
                "semantic_role": "reference",
                "structure_role": "reference_entry",
            },
        ),
    ),
)
def test_canonical_predicate_vector_detects_semantics_missing_from_legacy_projection(
    predicate: str,
    canonical_fields: dict,
) -> None:
    block = _text_block("semantic", sub_type="body")
    block.update(canonical_fields)

    assert legacy_predicate_vector(block)[predicate] is False
    assert canonical_predicate_vector(block)[predicate] is True


def test_allowlist_rules_require_reason_and_a_constraint() -> None:
    with pytest.raises(ValueError, match="include a reason"):
        load_allowlist_payload(
            {
                "schema": ALLOWLIST_SCHEMA,
                "rules": [{"old_class": "body", "new_class": "title"}],
            }
        )

    with pytest.raises(ValueError, match="constrain at least one"):
        load_allowlist_payload(
            {
                "schema": ALLOWLIST_SCHEMA,
                "rules": [{"name": "too-broad", "reason": "No match fields"}],
            }
        )

    with pytest.raises(ValueError, match="constrain at least one"):
        load_allowlist_payload(
            {
                "schema": ALLOWLIST_SCHEMA,
                "rules": [
                    {
                        "document_id": "*",
                        "reason": "A wildcard alone is not a meaningful review boundary",
                    }
                ],
            }
        )

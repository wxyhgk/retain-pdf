import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.continuation import orchestrator


def test_continuation_review_short_circuits_high_confidence_pairs() -> None:
    flat_payload = [
        {
            "item_id": "a",
            "page_idx": 0,
            "block_type": "text",
            "protected_source_text": "This sentence continues with",
            "bbox": [10, 10, 200, 30],
        },
        {
            "item_id": "b",
            "page_idx": 1,
            "block_type": "text",
            "protected_source_text": "and additional evidence from the experiment.",
            "bbox": [10, 10, 200, 30],
        },
        {
            "item_id": "c",
            "page_idx": 1,
            "block_type": "text",
            "protected_source_text": "Conclusion.",
            "bbox": [220, 10, 320, 30],
        },
        {
            "item_id": "d",
            "page_idx": 1,
            "block_type": "text",
            "protected_source_text": "Methods",
            "bbox": [10, 50, 120, 70],
        },
    ]
    pairs = [
        {"prev_item_id": "a", "next_item_id": "b"},
        {"prev_item_id": "c", "next_item_id": "d"},
    ]
    auto_join, review = orchestrator._split_high_confidence_continuation_pairs(
        flat_payload,
        pairs,
    )

    assert auto_join == [("a", "b")]
    assert review == []


def test_continuation_review_keeps_mid_confidence_pairs_for_review() -> None:
    flat_payload = [
        {
            "item_id": "a",
            "page_idx": 0,
            "block_type": "text",
            "protected_source_text": "This paragraph ends with a complete noun phrase",
            "bbox": [10, 10, 220, 30],
        },
        {
            "item_id": "b",
            "page_idx": 1,
            "block_type": "text",
            "protected_source_text": "Results are summarized below.",
            "bbox": [10, 10, 240, 30],
        },
    ]
    pairs = [{"prev_item_id": "a", "next_item_id": "b"}]

    auto_join, review = orchestrator._split_high_confidence_continuation_pairs(
        flat_payload,
        pairs,
    )

    assert auto_join == []
    assert review == pairs

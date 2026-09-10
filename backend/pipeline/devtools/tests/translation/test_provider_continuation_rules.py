from retainpdf_pipeline.translate.services.continuation import state
from retainpdf_pipeline.translate.services.continuation.orchestrator import _filter_boundary_candidate_pairs

from continuation_test_support import payload_item as _payload_item


def test_payload_builder_preserves_defaults_and_returns_fresh_items() -> None:
    bbox = [0, 0, 100, 20]
    first = _payload_item(item_id="a", page_idx=0, text="source", bbox=bbox)
    second = _payload_item(item_id="a", page_idx=0, text="source", bbox=bbox)

    assert first == second
    assert first is not second
    assert first["bbox"] is bbox
    assert first["ocr_continuation_reading_order"] == -1
    assert first["ocr_continuation_source"] == ""
    assert first["layout_boundary_role"] == ""
    assert first["body_repair_applied"] is False
    assert first["provider_body_repair_applied"] is False
    first["continuation_group"] = "changed"
    assert "continuation_group" not in second


def test_boundary_review_skips_body_repair_items() -> None:
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="The present work attempts to explain,",
            bbox=[0, 0, 100, 20],
            layout_mode="double",
            layout_zone="left_column",
            layout_boundary_role="tail",
            provider_body_repair_applied=True,
        ),
        _payload_item(
            item_id="b",
            page_idx=0,
            text="perhaps vaguely but completely based on the obtained results.",
            bbox=[120, 0, 220, 20],
            layout_mode="double",
            layout_zone="right_column",
            layout_boundary_role="head",
            provider_body_repair_applied=True,
        ),
    ]
    pairs = [
        {
            "prev_item_id": "a",
            "next_item_id": "b",
            "prev_text": payload[0]["protected_source_text"],
            "next_text": payload[1]["protected_source_text"],
            "prev_page_idx": 0,
            "next_page_idx": 0,
            "prev_bbox": payload[0]["bbox"],
            "next_bbox": payload[1]["bbox"],
        }
    ]

    assert _filter_boundary_candidate_pairs(payload, pairs) == []


def test_provider_intra_page_join_takes_priority_and_rule_fallback_still_runs() -> None:
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="left column sentence",
            bbox=[0, 0, 100, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-page-001-group-12",
            ocr_scope="intra_page",
            ocr_order=0,
        ),
        _payload_item(
            item_id="b",
            page_idx=0,
            text="right column continuation",
            bbox=[120, 0, 220, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-page-001-group-12",
            ocr_scope="intra_page",
            ocr_order=1,
        ),
        _payload_item(
            item_id="c",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 40, 180, 60],
        ),
        _payload_item(
            item_id="d",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
        ),
    ]

    annotated = state.annotate_continuation_context(payload)
    summary = state.summarize_continuation_decisions(payload)

    assert annotated == 4
    assert payload[0]["continuation_decision"] == "provider_joined"
    assert payload[1]["continuation_decision"] == "provider_joined"
    assert payload[0]["continuation_group"] == "provider-paddle-page-001-group-12"
    assert payload[2]["continuation_decision"] == "joined"
    assert payload[3]["continuation_decision"] == "joined"
    assert summary["joined_items"] == 4
    assert summary["provider_joined_items"] == 2
    assert summary["rule_joined_items"] == 2


def test_provider_cross_page_boundary_pair_is_consumed() -> None:
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == "provider_joined"
    assert payload[0]["continuation_group"] == "provider-paddle-global-abc"

from retainpdf_pipeline.translate.services.continuation import state

from continuation_test_support import payload_item as _payload_item


def test_provider_cross_page_hint_without_boundary_roles_falls_back_to_rules() -> None:
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
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == "joined"
    assert payload[1]["continuation_decision"] == "joined"
    assert payload[0]["continuation_group"] != "provider-paddle-global-abc"


def test_rule_cross_page_pair_landing_on_next_page_middle_goes_to_review() -> None:
    # Policy (fix/continuation-body-only): cross-page continuation joins body
    # blocks tail -> head. Landing on a middle block no longer joins silently
    # (that is how mis-tagged captions got fused into paragraphs); the pair is
    # left to LLM review instead. Renamed from
    # test_rule_cross_page_pair_can_land_on_next_page_middle_when_text_continues.
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="The paragraph continues with",
            bbox=[320, 700, 560, 760],
            layout_mode="double",
            layout_zone="right_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="term. In fact, this is a later paragraph on the next page.",
            bbox=[60, 260, 300, 320],
            layout_mode="double",
            layout_zone="left_column",
            layout_boundary_role="middle",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == "candidate_break"
    assert payload[1]["continuation_decision"] == "candidate_break"
    assert payload[0]["continuation_candidate_next_id"] == "b"
    assert payload[1]["continuation_candidate_prev_id"] == "a"
    assert payload[0]["continuation_group"] == ""


def test_provider_cross_page_hint_skipping_pages_is_not_consumed() -> None:
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
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=2,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == ""
    assert payload[1]["continuation_decision"] == ""
    assert payload[0]["continuation_group"] == ""


def test_provider_cross_page_double_column_left_tail_is_not_consumed() -> None:
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 0, 100, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_mode="double",
            layout_zone="left_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 100, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_mode="double",
            layout_zone="left_column",
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] != "provider_joined"
    assert payload[0]["continuation_group"] != "provider-paddle-global-abc"


def test_provider_cross_page_short_fragments_are_not_consumed() -> None:
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="A",
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
            text="B",
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

    assert payload[0]["continuation_decision"] != "provider_joined"
    assert payload[0]["continuation_group"] != "provider-paddle-global-abc"


def test_vision_footnote_is_not_eligible_for_provider_or_rule_continuation() -> None:
    payload = [
        _payload_item(
            item_id="body",
            page_idx=0,
            text="This body sentence continues with",
            bbox=[0, 0, 180, 20],
        ),
        _payload_item(
            item_id="footnote-a",
            page_idx=0,
            text="footnote note continues with",
            bbox=[0, 30, 180, 45],
            ocr_source="provider",
            ocr_group_id="provider-paddle-footnote",
            ocr_scope="intra_page",
            ocr_order=0,
        ),
        _payload_item(
            item_id="footnote-b",
            page_idx=0,
            text="and details in the lower note.",
            bbox=[190, 30, 360, 45],
            ocr_source="provider",
            ocr_group_id="provider-paddle-footnote",
            ocr_scope="intra_page",
            ocr_order=1,
        ),
        _payload_item(
            item_id="body-next",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
        ),
    ]
    for item in payload[1:3]:
        item.update(
            {
                "layout_role": "footnote",
                "semantic_role": "metadata",
                "structure_role": "footnote",
                "raw_block_type": "vision_footnote",
                "normalized_sub_type": "table_footnote",
            }
        )

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == "joined"
    assert payload[3]["continuation_decision"] == "joined"
    assert payload[1]["continuation_decision"] == ""
    assert payload[2]["continuation_decision"] == ""
    assert payload[1]["continuation_group"] == ""
    assert payload[2]["continuation_group"] == ""
    assert payload[0]["continuation_candidate_next_id"] != "footnote-a"
    assert payload[2]["continuation_candidate_next_id"] != "body-next"


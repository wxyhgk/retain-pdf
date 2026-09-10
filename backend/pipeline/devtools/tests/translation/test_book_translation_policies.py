import sys
import tempfile
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.workflow.page_policies import finalize_page_payloads
from retainpdf_pipeline.translate.services.continuation.orchestrator import annotate_layout_zones_by_page


def _page_payload_item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    bbox: list[float],
    group_id: str,
    order: int,
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "normalized_sub_type": "",
        "bbox": bbox,
        "source_text": text,
        "protected_source_text": text,
        "formula_map": [],
        "classification_label": "",
        "should_translate": True,
        "ocr_continuation_source": "provider",
        "ocr_continuation_group_id": group_id,
        "ocr_continuation_role": "head" if order == 0 else "tail",
        "ocr_continuation_scope": "cross_page",
        "ocr_continuation_reading_order": order,
        "layout_mode": "",
        "layout_split_x": 0.0,
        "layout_zone": "",
        "layout_zone_rank": -1,
        "layout_zone_size": 0,
        "layout_boundary_role": "",
        "continuation_group": "",
        "continuation_prev_text": "",
        "continuation_next_text": "",
        "continuation_decision": "",
        "continuation_candidate_prev_id": "",
        "continuation_candidate_next_id": "",
        "translation_unit_id": item_id,
        "translation_unit_kind": "single",
        "translation_unit_member_ids": [item_id],
        "translation_unit_protected_source_text": text,
        "translation_unit_formula_map": [],
    }


def test_provider_double_column_hints_win_over_full_width_blocks() -> None:
    page_payloads = {
        0: [
            _page_payload_item(
                item_id="p001-title",
                page_idx=0,
                text="A full width article title",
                bbox=[56, 117, 561, 172],
                group_id="",
                order=0,
            ),
            _page_payload_item(
                item_id="p001-left-a",
                page_idx=0,
                text="Left column abstract body.",
                bbox=[66, 258, 310, 379],
                group_id="",
                order=1,
            ),
            _page_payload_item(
                item_id="p001-full-abstract",
                page_idx=0,
                text="A full width abstract continuation.",
                bbox=[66, 379, 558, 469],
                group_id="",
                order=2,
            ),
            _page_payload_item(
                item_id="p001-left-b",
                page_idx=0,
                text="Left column introduction tail.",
                bbox=[56, 655, 303, 758],
                group_id="",
                order=3,
            ),
            _page_payload_item(
                item_id="p001-right-a",
                page_idx=0,
                text="Right column introduction head.",
                bbox=[320, 491, 566, 548],
                group_id="",
                order=4,
            ),
            _page_payload_item(
                item_id="p001-right-b",
                page_idx=0,
                text="Right column following body.",
                bbox=[320, 548, 567, 723],
                group_id="",
                order=5,
            ),
        ],
    }
    provider_guesses = {
        "p001-title": "full",
        "p001-left-a": "left",
        "p001-full-abstract": "full",
        "p001-left-b": "left",
        "p001-right-a": "right",
        "p001-right-b": "right",
    }
    for item in page_payloads[0]:
        item["provider_column_layout_mode"] = "double"
        item["provider_column_index_guess"] = provider_guesses[item["item_id"]]

    annotate_layout_zones_by_page(page_payloads)

    zones = {item["item_id"]: item["layout_zone"] for item in page_payloads[0]}
    assert {item["layout_mode"] for item in page_payloads[0]} == {"double"}
    assert zones["p001-title"] == "full_width"
    assert zones["p001-full-abstract"] == "full_width"
    assert zones["p001-left-a"] == "left_column"
    assert zones["p001-left-b"] == "left_column"
    assert zones["p001-right-a"] == "right_column"
    assert zones["p001-right-b"] == "right_column"


def test_finalize_page_payloads_annotates_layout_before_cross_page_provider_join() -> None:
    group_id = "provider-generic-global-1"
    page_payloads = {
        0: [
            _page_payload_item(
                item_id="p001-b000",
                page_idx=0,
                text="This sentence continues with enough context",
                bbox=[0, 0, 180, 20],
                group_id=group_id,
                order=0,
            )
        ],
        1: [
            _page_payload_item(
                item_id="p002-b000",
                page_idx=1,
                text="and additional evidence from the next page.",
                bbox=[0, 0, 180, 20],
                group_id=group_id,
                order=1,
            )
        ],
    }

    with tempfile.TemporaryDirectory() as tmp:
        translation_paths = {
            0: Path(tmp) / "page-001.json",
            1: Path(tmp) / "page-002.json",
        }
        summary = finalize_page_payloads(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
        )

    assert summary["provider_joined_items"] == 2
    assert page_payloads[0][0]["layout_zone"] == "single_column"
    assert page_payloads[1][0]["layout_zone"] == "single_column"
    assert page_payloads[0][0]["continuation_decision"] == "provider_joined"
    assert page_payloads[1][0]["continuation_decision"] == "provider_joined"
    assert page_payloads[0][0]["continuation_group"] == group_id


def test_finalize_page_payloads_does_not_join_figure_caption_with_body_text() -> None:
    page_payloads = {
        2: [
            {
                "item_id": "p003-b008",
                "page_idx": 2,
                "block_idx": 8,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "paragraph",
                "semantic_role": "body",
                "structure_role": "body",
                "policy_translate": True,
                "raw_block_type": "text",
                "normalized_sub_type": "",
                "bbox": [60, 240, 270, 360],
                "source_text": "This is a body paragraph that ends with the",
                "protected_source_text": "This is a body paragraph that ends with the",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_split_x": 300.0,
                "layout_zone": "",
                "layout_zone_rank": -1,
                "layout_zone_size": 0,
                "layout_boundary_role": "",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "",
                "translation_unit_id": "p003-b008",
                "translation_unit_kind": "single",
                "translation_unit_member_ids": ["p003-b008"],
                "translation_unit_protected_source_text": "This is a body paragraph that ends with the",
                "translation_unit_formula_map": [],
            },
            {
                "item_id": "p003-b010",
                "page_idx": 2,
                "block_idx": 10,
                "block_type": "text",
                "block_kind": "text",
                "layout_role": "caption",
                "semantic_role": "caption",
                "structure_role": "figure_caption",
                "policy_translate": True,
                "raw_block_type": "figure_title",
                "normalized_sub_type": "figure_caption",
                "bbox": [330, 240, 550, 300],
                "source_text": "FIG. 3. Final electronic structure spectrum.",
                "protected_source_text": "FIG. 3. Final electronic structure spectrum.",
                "formula_map": [],
                "classification_label": "",
                "should_translate": True,
                "layout_mode": "double",
                "layout_split_x": 300.0,
                "layout_zone": "",
                "layout_zone_rank": -1,
                "layout_zone_size": 0,
                "layout_boundary_role": "",
                "continuation_group": "",
                "continuation_prev_text": "",
                "continuation_next_text": "",
                "continuation_decision": "",
                "continuation_candidate_prev_id": "",
                "continuation_candidate_next_id": "",
                "translation_unit_id": "p003-b010",
                "translation_unit_kind": "single",
                "translation_unit_member_ids": ["p003-b010"],
                "translation_unit_protected_source_text": "FIG. 3. Final electronic structure spectrum.",
                "translation_unit_formula_map": [],
            },
        ],
    }

    with tempfile.TemporaryDirectory() as tmp:
        translation_paths = {2: Path(tmp) / "page-003.json"}
        summary = finalize_page_payloads(
            page_payloads=page_payloads,
            translation_paths=translation_paths,
        )

    body, caption = page_payloads[2]
    assert summary["joined_items"] == 0
    assert body["continuation_group"] == ""
    assert body["continuation_candidate_next_id"] == ""
    assert caption["continuation_group"] == ""
    assert caption["continuation_candidate_prev_id"] == ""
    assert caption["translation_unit_id"] == "p003-b010"

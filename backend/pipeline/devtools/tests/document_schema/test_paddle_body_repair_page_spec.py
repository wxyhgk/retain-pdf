import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec


def test_paddle_page_spec_repairs_first_empty_right_slot_from_left_carryover() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1191,
                "height": 1600,
                "model_settings": {"enable_body_repair": True},
                "parsing_res_list": [
                    {"block_label": "text", "block_content": "left intro text", "block_bbox": [106, 895, 584, 943]},
                    {"block_label": "text", "block_content": "left middle text", "block_bbox": [106, 944, 585, 1087]},
                    {
                        "block_label": "text",
                        "block_content": (
                            "Differences were found between Thioindigo and Indigo and the donor paragraph keeps "
                            "running into the next column because the sentence is still open and ends with"
                        ),
                        "block_bbox": [105, 1255, 586, 1473],
                    },
                    {"block_label": "text", "block_content": "", "block_bbox": [603, 895, 1082, 967]},
                    {
                        "block_label": "text",
                        "block_content": "For Dichloroindigo the next right column paragraph starts here.",
                        "block_bbox": [603, 968, 1083, 1111],
                    },
                    {
                        "block_label": "text",
                        "block_content": "Another right column paragraph remains intact.",
                        "block_bbox": [602, 1112, 1083, 1422],
                    },
                ],
                "layout_det_res": {"boxes": []},
            },
            "markdown": {"text": "", "images": {}},
            "outputImages": {},
            "inputImage": "",
        },
        page_index=0,
        page_meta={"width": 1191, "height": 1600},
        preprocessed_image="",
    )

    blocks = page_spec["blocks"]
    donor = blocks[2]
    slot = blocks[3]

    assert donor["metadata"]["provider_body_repair_applied"] is True
    assert donor["metadata"]["provider_body_repair_strategy"] == "column_carryover"
    assert slot["metadata"]["provider_body_repair_applied"] is True
    assert slot["metadata"]["provider_body_repair_strategy"] == "column_carryover"
    assert donor["metadata"]["body_repair_applied"] is True
    assert donor["metadata"]["body_repair_strategy"] == "column_carryover"
    assert slot["metadata"]["body_repair_applied"] is True
    assert slot["metadata"]["body_repair_strategy"] == "column_carryover"
    assert donor["text"] != ""
    assert slot["text"] != ""
    assert page_spec["metadata"]["body_repair_pair_count"] == 1


def test_paddle_page_spec_skips_body_repair_when_merge_layout_blocks_is_disabled() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1191,
                "height": 1600,
                "model_settings": {"merge_layout_blocks": False},
                "parsing_res_list": [
                    {"block_label": "text", "block_content": "left intro text", "block_bbox": [106, 895, 584, 943]},
                    {"block_label": "text", "block_content": "left middle text", "block_bbox": [106, 944, 585, 1087]},
                    {
                        "block_label": "text",
                        "block_content": (
                            "Differences were found between Thioindigo and Indigo and the donor paragraph keeps "
                            "running into the next column because the sentence is still open and ends with"
                        ),
                        "block_bbox": [105, 1255, 586, 1473],
                    },
                    {"block_label": "text", "block_content": "", "block_bbox": [603, 895, 1082, 967]},
                    {
                        "block_label": "text",
                        "block_content": "For Dichloroindigo the next right column paragraph starts here.",
                        "block_bbox": [603, 968, 1083, 1111],
                    },
                    {
                        "block_label": "text",
                        "block_content": "Another right column paragraph remains intact.",
                        "block_bbox": [602, 1112, 1083, 1422],
                    },
                ],
                "layout_det_res": {"boxes": []},
            },
            "markdown": {"text": "", "images": {}},
            "outputImages": {},
            "inputImage": "",
        },
        page_index=0,
        page_meta={"width": 1191, "height": 1600},
        preprocessed_image="",
    )

    assert page_spec["metadata"]["body_repair_pair_count"] == 0
    assert page_spec["metadata"]["body_repair_block_count"] == 0
    assert page_spec["metadata"]["body_repair_pairs"] == []
    assert page_spec["blocks"][2]["text"].endswith("ends with")
    assert page_spec["blocks"][3]["text"] == ""


def test_paddle_page_spec_prefers_last_left_body_for_first_right_empty_slot() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1191,
                "height": 1600,
                "model_settings": {"enable_body_repair": True},
                "parsing_res_list": [
                    {"block_label": "text", "block_content": "left support text", "block_bbox": [120, 761, 833, 789]},
                    {
                        "block_label": "text",
                        "block_content": (
                            "Substituent effects on molecules have always been a subject of study because it is our goal "
                            "to modify molecules based on our needs. A way in which to study this phenomenon is to analyze "
                            "the effects of substituents on the spectra of molecules. Solvent [1], substituent [2] and "
                            "synthesis effects [3], as well as combinations of these effects [4], have been shown."
                        ),
                        "block_bbox": [106, 847, 585, 1016],
                    },
                    {
                        "block_label": "text",
                        "block_content": (
                            "Theoretical studies of the effects of substituents on absorption and emission spectra [8-16] "
                            "have been performed, including studies on the indigo molecule [17]. The present work attempts "
                            "to explain, perhaps vaguely but completely based on the obtained results, the effects observed "
                            "when the absorption and emission spectra of indigo are compared."
                        ),
                        "block_bbox": [107, 1209, 585, 1306],
                    },
                    {"block_label": "text", "block_content": "", "block_bbox": [602, 823, 1081, 898]},
                    {
                        "block_label": "paragraph_title",
                        "block_content": "Theory and computational details",
                        "block_bbox": [604, 925, 927, 949],
                    },
                    {
                        "block_label": "text",
                        "block_content": "GAUSSVIEW 03 software was used to generate the molecular structures.",
                        "block_bbox": [602, 950, 1083, 1334],
                    },
                ],
                "layout_det_res": {"boxes": []},
            },
            "markdown": {"text": "", "images": {}},
            "outputImages": {},
            "inputImage": "",
        },
        page_index=0,
        page_meta={"width": 1191, "height": 1600},
        preprocessed_image="",
    )

    blocks = page_spec["blocks"]
    left_middle = blocks[1]
    donor = blocks[2]
    slot = blocks[3]

    assert left_middle["text"].endswith("have been shown.")
    assert donor["metadata"]["provider_body_repair_applied"] is True
    assert donor["metadata"]["provider_body_repair_strategy"] == "column_carryover"
    assert donor["metadata"]["provider_suspected_peer_block_id"] == "p001-b0003"
    assert slot["metadata"]["provider_body_repair_applied"] is True
    assert slot["metadata"]["provider_body_repair_strategy"] == "column_carryover"
    assert donor["metadata"]["body_repair_applied"] is True
    assert donor["metadata"]["body_repair_strategy"] == "column_carryover"
    assert donor["metadata"]["body_repair_peer_block_id"] == "p001-b0003"
    assert slot["metadata"]["body_repair_applied"] is True
    assert slot["metadata"]["body_repair_strategy"] == "column_carryover"
    assert "but completely based on the obtained results" in slot["text"]


def test_paddle_page_spec_keeps_unsafe_split_unrepaired() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1200,
                "height": 1600,
                "model_settings": {"enable_body_repair": True},
                "parsing_res_list": [
                    {"block_label": "text", "block_content": "left support text", "block_bbox": [100, 100, 360, 160]},
                    {"block_label": "text", "block_content": "ABCDEFGHIJKLMN", "block_bbox": [100, 220, 380, 300]},
                    {"block_label": "text", "block_content": "", "block_bbox": [760, 220, 1040, 300]},
                    {"block_label": "text", "block_content": "right support text", "block_bbox": [760, 360, 1040, 430]},
                    {
                        "block_label": "text",
                        "block_content": "another right support text",
                        "block_bbox": [760, 480, 1040, 550],
                    },
                ],
                "layout_det_res": {"boxes": []},
            },
            "markdown": {"text": "", "images": {}},
            "outputImages": {},
            "inputImage": "",
        },
        page_index=0,
        page_meta={"width": 1200, "height": 1600},
        preprocessed_image="",
    )

    blocks = page_spec["blocks"]
    absorber = blocks[1]["metadata"]
    empty_peer = blocks[2]["metadata"]

    assert blocks[1]["text"] == "ABCDEFGHIJKLMN"
    assert blocks[2]["text"] == ""
    assert absorber["provider_cross_column_merge_suspected"] is True
    assert absorber["provider_peer_block_absorbed_text"] is True
    assert absorber["provider_body_repair_attempted"] is True
    assert absorber["provider_body_repair_applied"] is False
    assert absorber["provider_body_repair_reason"] == "unsafe_split"
    assert absorber["cross_column_merge_suspected"] is True
    assert absorber["peer_block_absorbed_text"] is True
    assert absorber["body_repair_attempted"] is True
    assert absorber["body_repair_applied"] is False
    assert empty_peer["provider_text_missing_but_bbox_present"] is True
    assert empty_peer["provider_body_repair_attempted"] is True
    assert empty_peer["provider_body_repair_applied"] is False
    assert empty_peer["text_missing_but_bbox_present"] is True
    assert empty_peer["body_repair_attempted"] is True
    assert empty_peer["body_repair_applied"] is False


def test_paddle_page_spec_does_not_repair_non_body_blocks() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1200,
                "height": 1600,
                "parsing_res_list": [
                    {
                        "block_label": "header",
                        "block_content": "left header merged with right",
                        "block_bbox": [100, 60, 360, 100],
                    },
                    {"block_label": "header", "block_content": "", "block_bbox": [760, 60, 1040, 100]},
                    {"block_label": "text", "block_content": "left support text", "block_bbox": [100, 180, 360, 250]},
                    {"block_label": "text", "block_content": "right support text", "block_bbox": [760, 180, 1040, 250]},
                    {
                        "block_label": "text",
                        "block_content": "another right support text",
                        "block_bbox": [760, 320, 1040, 390],
                    },
                ],
                "layout_det_res": {"boxes": []},
            },
            "markdown": {"text": "", "images": {}},
            "outputImages": {},
            "inputImage": "",
        },
        page_index=0,
        page_meta={"width": 1200, "height": 1600},
        preprocessed_image="",
    )

    blocks = page_spec["blocks"]
    assert blocks[0]["text"] == "left header merged with right"
    assert blocks[1]["text"] == ""
    assert blocks[0]["metadata"].get("provider_body_repair_applied") is None
    assert blocks[1]["metadata"].get("provider_body_repair_applied") is None

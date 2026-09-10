import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = REPO_SCRIPTS_ROOT.parent
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.adapter import build_paddle_document


PADDLE_FIXTURE_JSON = REPO_ROOT / "rust_api" / "src" / "ocr_provider" / "paddle" / "json_full.json"


def test_paddle_document_suppresses_provider_continuation_after_body_repair() -> None:
    payload = {
        "dataInfo": {"pages": [{"width": 1191, "height": 1600}]},
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "width": 1191,
                    "height": 1600,
                    "model_settings": {"enable_body_repair": True},
                    "parsing_res_list": [
                        {
                            "block_label": "text",
                            "block_content": "left support text",
                            "block_bbox": [120, 761, 833, 789],
                            "group_id": 10,
                            "block_order": 10,
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
                            "group_id": 14,
                            "block_order": 13,
                        },
                        {
                            "block_label": "text",
                            "block_content": "",
                            "block_bbox": [602, 823, 1081, 898],
                            "group_id": 14,
                            "block_order": 14,
                        },
                        {
                            "block_label": "text",
                            "block_content": "GAUSSVIEW 03 software was used to generate the molecular structures.",
                            "block_bbox": [602, 950, 1083, 1334],
                            "group_id": 15,
                            "block_order": 15,
                        },
                    ],
                    "layout_det_res": {"boxes": []},
                },
                "markdown": {"text": "", "images": {}},
            }
        ],
        "preprocessedImages": [""],
    }

    document = build_paddle_document(
        payload=payload,
        document_id="paddle-repair-continuation",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )
    blocks = document["pages"][0]["blocks"]

    assert blocks[1]["metadata"]["provider_body_repair_applied"] is True
    assert blocks[2]["metadata"]["provider_body_repair_applied"] is True
    assert blocks[1]["metadata"]["body_repair_applied"] is True
    assert blocks[2]["metadata"]["body_repair_applied"] is True
    assert blocks[1]["continuation_hint"]["group_id"] == ""
    assert blocks[2]["continuation_hint"]["group_id"] == ""
    assert blocks[1]["metadata"]["provider_continuation_suppressed"] is True
    assert blocks[1]["metadata"]["provider_continuation_suppressed_reason"] == "body_repair_applied"
    assert blocks[1]["metadata"]["continuation_suppressed"] is True
    assert blocks[1]["metadata"]["continuation_suppressed_reason"] == "body_repair_applied"

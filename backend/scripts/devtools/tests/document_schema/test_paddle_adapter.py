import json
import subprocess
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = REPO_SCRIPTS_ROOT.parent
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from services.document_schema import adapt_path_to_document_v1_with_report
from services.document_schema.provider_adapters.paddle import looks_like_paddle_layout
from services.document_schema.provider_adapters.paddle.column_signals import (
    analyze_page_column_signals,
)
from services.document_schema.provider_adapters.paddle.body_repair import repair_body_cross_column_blocks
from services.document_schema.provider_adapters.paddle.content_extract import build_lines
from services.document_schema.provider_adapters.paddle.page_reader import build_page_spec
from services.document_schema.provider_adapters.paddle.adapter import build_paddle_document
from services.document_schema.provider_adapters.paddle.relations import classify_page_blocks
from services.translation.ocr.json_extractor import extract_text_items
from foundation.shared.job_dirs import ensure_job_dirs
from foundation.shared.job_dirs import resolve_job_dirs


PADDLE_FIXTURE_JSON = REPO_ROOT / "rust_api" / "src" / "ocr_provider" / "paddle" / "json_full.json"
PADDLE_SCI_FIXTURE_JSON = REPO_ROOT / "rust_api" / "src" / "ocr_provider" / "paddle" / "json_sci.json"
PADDLE_FIXTURE_PDF = REPO_ROOT / "rust_api" / "src" / "ocr_provider" / "paddle" / "paddle_ocr_json_split.pdf"
NORMALIZE_ENTRYPOINT = REPO_SCRIPTS_ROOT / "entrypoints" / "run_normalize_ocr.py"


def test_paddle_adapter_builds_document_v1_from_sample() -> None:
    payload = json.loads(PADDLE_FIXTURE_JSON.read_text(encoding="utf-8"))

    assert looks_like_paddle_layout(payload) is True

    document, report = adapt_path_to_document_v1_with_report(
        source_json_path=PADDLE_FIXTURE_JSON,
        document_id="paddle-sample-doc",
        provider="paddle",
        provider_version="PaddleOCR-VL",
    )

    assert document["schema"] == "normalized_document_v1"
    assert document["source"]["provider"] == "paddle"
    assert document["doc_id"] == "paddle-sample-doc"
    assert isinstance(document["assets"], dict)
    assert document["page_count"] >= 1
    assert document["pages"][0]["blocks"]
    assert document["pages"][0]["page"] == 1
    first_block = document["pages"][0]["blocks"][0]
    assert "reading_order" in first_block
    assert "geometry" in first_block
    assert "content" in first_block
    assert "layout_role" in first_block
    assert "semantic_role" in first_block
    assert "policy" in first_block
    assert "provenance" in first_block
    assert report["provider"] == "paddle"
    assert report["detected_provider"] == "paddle"
    assert report["provider_signals"]["provider"] == "paddle"
    assert "suspicious_cross_column_merge_pages" in report["provider_signals"]


def test_run_normalize_ocr_supports_paddle_provider(tmp_path: Path) -> None:
    job_root = tmp_path / "20260416-paddle-normalize"
    ensure_job_dirs(resolve_job_dirs(job_root))
    specs_dir = job_root / "specs"
    specs_dir.mkdir(parents=True, exist_ok=True)
    spec_path = specs_dir / "normalize.spec.json"

    spec_path.write_text(
        json.dumps(
            {
                "schema_version": "normalize.stage.v1",
                "stage": "normalize",
                "job": {
                    "job_id": job_root.name,
                    "job_root": str(job_root),
                    "workflow": "ocr",
                },
                "inputs": {
                    "provider": "paddle",
                    "source_json": str(PADDLE_FIXTURE_JSON),
                    "source_pdf": str(PADDLE_FIXTURE_PDF),
                    "provider_version": "PaddleOCR-VL",
                    "provider_result_json": str(PADDLE_FIXTURE_JSON),
                    "provider_zip": "",
                    "provider_raw_dir": "",
                },
                "params": {},
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    completed = subprocess.run(
        [sys.executable, str(NORMALIZE_ENTRYPOINT), "--spec", str(spec_path)],
        check=True,
        capture_output=True,
        text=True,
    )

    normalized_json = job_root / "ocr" / "normalized" / "document.v1.json"
    normalized_report = job_root / "ocr" / "normalized" / "document.v1.report.json"
    assert normalized_json.exists()
    assert normalized_report.exists()

    normalized_payload = json.loads(normalized_json.read_text(encoding="utf-8"))
    normalized_report_payload = json.loads(normalized_report.read_text(encoding="utf-8"))

    assert normalized_payload["source"]["provider"] == "paddle"
    assert "assets" in normalized_payload
    assert normalized_payload["pages"][0]["page"] == 1
    assert normalized_payload["page_count"] >= 1
    assert normalized_report_payload["provider"] == "paddle"
    assert "schema version: document.v1" in completed.stdout


def test_paddle_column_signals_ignore_header_footer_false_positives() -> None:
    signals = analyze_page_column_signals(
        parsing_res_list=[
            {
                "block_label": "header",
                "block_content": "Left header text",
                "block_bbox": [100, 60, 360, 100],
            },
            {
                "block_label": "header_image",
                "block_content": "",
                "block_bbox": [760, 60, 1040, 120],
            },
            {
                "block_label": "footer_image",
                "block_content": "",
                "block_bbox": [120, 1400, 320, 1460],
            },
            {
                "block_label": "footer",
                "block_content": "Right footer text",
                "block_bbox": [360, 1400, 1040, 1460],
            },
        ],
        page_width=1200,
    )

    assert signals["suspected_count"] == 0
    assert signals["suspected_orders"] == []


def test_paddle_column_signals_detect_sparse_double_column_empty_slot() -> None:
    signals = analyze_page_column_signals(
        parsing_res_list=[
            {
                "block_label": "figure_title",
                "block_content": "Figure 2 sample caption",
                "block_bbox": [120, 1282, 1019, 1323],
            },
            {
                "block_label": "text",
                "block_content": "This result is in accordance with the fact that however the donor sentence remains unfinished",
                "block_bbox": [107, 1373, 585, 1472],
            },
            {
                "block_label": "text",
                "block_content": "",
                "block_bbox": [602, 1373, 1083, 1473],
            },
        ],
        page_width=1191,
    )

    assert signals["column_layout_mode"] == "double"
    assert signals["suspected_orders"] == [1, 2]


def test_paddle_page_spec_marks_empty_bbox_and_absorber_blocks() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1200,
                "height": 1600,
                "model_settings": {"enable_body_repair": True},
                "parsing_res_list": [
                    {
                        "block_label": "text",
                        "block_content": "left support text",
                        "block_bbox": [100, 100, 360, 160],
                    },
                    {
                        "block_label": "text",
                        "block_content": "left merged text absorbed from right column",
                        "block_bbox": [100, 220, 380, 300],
                    },
                    {
                        "block_label": "text",
                        "block_content": "",
                        "block_bbox": [760, 220, 1040, 300],
                    },
                    {
                        "block_label": "text",
                        "block_content": "right support text",
                        "block_bbox": [760, 360, 1040, 430],
                    },
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
    page_metadata = page_spec["metadata"]

    assert blocks[1]["text"] == "left merged text absorbed"
    assert blocks[2]["text"] == "from right column"

    assert absorber["provider_body_repair_attempted"] is True
    assert absorber["provider_body_repair_applied"] is True
    assert absorber["provider_body_repair_role"] == "absorber"
    assert absorber["provider_suspected_peer_block_id"] == "p001-b0002"
    assert absorber["body_repair_attempted"] is True
    assert absorber["body_repair_applied"] is True
    assert absorber["body_repair_role"] == "absorber"
    assert absorber["body_repair_peer_block_id"] == "p001-b0002"

    assert empty_peer["provider_body_repair_attempted"] is True
    assert empty_peer["provider_body_repair_applied"] is True
    assert empty_peer["provider_body_repair_role"] == "peer"
    assert empty_peer["provider_suspected_peer_block_id"] == "p001-b0001"
    assert empty_peer["body_repair_attempted"] is True
    assert empty_peer["body_repair_applied"] is True
    assert empty_peer["body_repair_role"] == "peer"
    assert empty_peer["body_repair_peer_block_id"] == "p001-b0001"

    assert page_metadata["suspected_cross_column_merge_block_count"] == 0
    assert page_metadata["text_missing_but_bbox_present_count"] == 0
    assert page_metadata["peer_block_absorbed_text_count"] == 0
    assert page_metadata["body_repair_pair_count"] == 1
    assert page_metadata["body_repair_block_count"] == 2
    assert page_metadata["body_repair_block_ids"] == ["p001-b0001", "p001-b0002"]


def test_paddle_page_spec_marks_text_title_and_vision_footnote_translation_candidates() -> None:
    page_payload = {
        "prunedResult": {
            "width": 1200,
            "height": 1600,
            "parsing_res_list": [
                {
                    "block_label": "text",
                    "block_content": "Body paragraph text.",
                    "block_bbox": [100, 100, 420, 160],
                },
                {
                    "block_label": "abstract",
                    "block_content": "Abstract paragraph text.",
                    "block_bbox": [100, 180, 420, 240],
                },
                {
                    "block_label": "paragraph_title",
                    "block_content": "Introduction",
                    "block_bbox": [100, 260, 420, 300],
                },
                {
                    "block_label": "vision_footnote",
                    "block_content": "Note: Values are averaged over three runs.",
                    "block_bbox": [100, 320, 420, 360],
                },
                {
                    "block_label": "footnote",
                    "block_content": "Ordinary provider footnote.",
                    "block_bbox": [100, 380, 420, 420],
                },
                {
                    "block_label": "footer",
                    "block_content": "Page footer",
                    "block_bbox": [100, 1480, 420, 1520],
                },
            ],
            "layout_det_res": {"boxes": []},
        },
        "markdown": {"text": "", "images": {}},
        "outputImages": {},
        "inputImage": "",
    }
    page_spec = build_page_spec(
        page_payload=page_payload,
        page_index=0,
        page_meta={"width": 1200, "height": 1600},
        preprocessed_image="",
    )

    text_block, abstract_block, heading_block, vision_footnote_block, footnote_block, footer_block = page_spec["blocks"]
    assert text_block["policy"] == {"translate": True, "translate_reason": "provider_body_whitelist:body"}
    assert text_block["structure_role"] == "body"
    assert text_block["semantic_role"] == "body"
    assert abstract_block["policy"] == {"translate": True, "translate_reason": "provider_body_whitelist:abstract"}
    assert abstract_block["structure_role"] == "body"
    assert abstract_block["semantic_role"] == "abstract"
    assert heading_block["policy"] == {"translate": True, "translate_reason": "provider_heading_candidate"}
    assert heading_block["structure_role"] == "heading"
    assert vision_footnote_block["policy"] == {
        "translate": True,
        "translate_reason": "provider_footnote_whitelist:vision_footnote",
    }
    assert vision_footnote_block["structure_role"] == "footnote"
    assert footnote_block["policy"] == {"translate": False, "translate_reason": "provider_non_body:footnote"}
    assert footnote_block["structure_role"] == "footnote"
    assert footer_block["policy"]["translate"] is False

    document = build_paddle_document(
        {
            "layoutParsingResults": [page_payload],
            "dataInfo": {"pages": [{"width": 1200, "height": 1600}]},
            "preprocessedImages": [""],
        },
        document_id="body-policy-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )
    items = extract_text_items(document, 0)

    assert [item.text for item in items] == [
        "Body paragraph text.",
        "Abstract paragraph text.",
        "Introduction",
        "Note: Values are averaged over three runs.",
    ]


def test_paddle_json_sci_empty_text_slots_stay_on_text_only_repair_path() -> None:
    payload = json.loads(PADDLE_SCI_FIXTURE_JSON.read_text(encoding="utf-8"))
    repaired_pages: dict[int, list[dict]] = {}
    empty_slot_pages: dict[int, list[int]] = {}

    for page_index, page_payload in enumerate(payload["layoutParsingResults"], start=1):
        page_meta = payload["dataInfo"]["pages"][page_index - 1]
        page_spec = build_page_spec(
            page_payload=page_payload,
            page_index=page_index - 1,
            page_meta=page_meta,
            preprocessed_image=payload["preprocessedImages"][page_index - 1],
        )
        page_blocks = page_payload["prunedResult"]["parsing_res_list"]
        empty_orders = [
            order
            for order, block in enumerate(page_blocks)
            if block.get("block_label") == "text" and not str(block.get("block_content", "") or "").strip()
        ]
        if empty_orders:
            empty_slot_pages[page_index] = empty_orders
        if page_spec["metadata"]["body_repair_pairs"]:
            repaired_pages[page_index] = list(page_spec["metadata"]["body_repair_pairs"])
            for pair in page_spec["metadata"]["body_repair_pairs"]:
                absorber = page_blocks[pair["absorber_order"]]
                peer = page_blocks[pair["peer_order"]]
                assert absorber.get("block_label") == "text"
                assert peer.get("block_label") == "text"

    assert empty_slot_pages == {
        1: [17],
        2: [6],
        3: [12],
        4: [16],
        6: [18],
        9: [16],
        11: [8],
        14: [10],
        15: [8],
        16: [12],
    }
    assert repaired_pages == {}


def test_paddle_json_sci_front_matter_text_does_not_become_body() -> None:
    payload = json.loads(PADDLE_SCI_FIXTURE_JSON.read_text(encoding="utf-8"))
    page_blocks = payload["layoutParsingResults"][0]["prunedResult"]["parsing_res_list"]
    classified = classify_page_blocks(page_blocks)

    assert classified[8][:2] == ("text", "metadata")
    assert classified[9][:2] == ("text", "metadata")
    assert classified[10][:2] == ("text", "metadata")
    assert classified[11][:2] == ("text", "body")
    assert classified[14][:2] == ("text", "heading")
    assert classified[15][:2] == ("text", "body")


def test_paddle_classifies_metadata_text_cues_before_translation() -> None:
    classified = classify_page_blocks(
        [
            {"block_label": "text", "block_content": "The authors declare that they have no competing interests."},
            {"block_label": "text", "block_content": "This work was funded by Consejo Nacional de Ciencia y Tecnologia."},
            {"block_label": "text", "block_content": "Received: 6 April 2012 Accepted: 19 June 2012 Published: 18 July 2012"},
            {"block_label": "text", "block_content": "Cite this article as: Example Journal 2012, 6:70"},
            {"block_label": "text", "block_content": "Submit your manuscript here: http://example.test/manuscript/"},
            {"block_label": "text", "block_content": "Normal body paragraph should remain in body classification."},
        ]
    )

    assert classified[0][:2] == ("text", "metadata")
    assert classified[1][:2] == ("text", "metadata")
    assert classified[2][:2] == ("text", "metadata")
    assert classified[3][:2] == ("text", "metadata")
    assert classified[4][:2] == ("text", "metadata")
    assert classified[5][:2] == ("text", "body")


def test_paddle_does_not_treat_body_bullets_as_metadata() -> None:
    classified = classify_page_blocks(
        [
            {
                "block_label": "text",
                "block_content": (
                    "• Knowledge: In assessments of broad world knowledge, DeepSeek-V4-Pro-Max "
                    "significantly outperforms leading open-source models on the SimpleQA benchmark."
                ),
            },
            {
                "block_label": "text",
                "block_content": (
                    "• Reasoning: Through the expansion of reasoning tokens, DeepSeek-V4-Pro-Max "
                    "demonstrates superior performance relative to GPT-5.2 on standard reasoning benchmarks."
                ),
            },
            {
                "block_label": "text",
                "block_content": "• Keywords: document parsing; translation; layout analysis",
            },
        ]
    )

    assert classified[0][:2] == ("text", "body")
    assert classified[1][:2] == ("text", "body")
    assert classified[2][:2] == ("text", "metadata")


def test_paddle_limits_metadata_bullet_by_word_count() -> None:
    classified = classify_page_blocks(
        [
            {
                "block_label": "text",
                "block_content": (
                    "• Keywords: a b c d e f g h i j k l m n o p q r s t u v w x y z "
                    "this is already too long to be treated as a tiny metadata fragment"
                ),
            },
            {
                "block_label": "text",
                "block_content": "• DOI: 10.1000/xyz123",
            },
        ]
    )

    assert classified[0][:2] == ("text", "body")
    assert classified[1][:2] == ("text", "metadata")


def test_paddle_metadata_cues_must_appear_at_start() -> None:
    classified = classify_page_blocks(
        [
            {
                "block_label": "text",
                "block_content": (
                    "This paragraph discusses benchmark setup and mentions keywords: translation, "
                    "layout, parsing in the middle of normal body text."
                ),
            },
            {
                "block_label": "text",
                "block_content": (
                    "The appendix also references doi: 10.1000/xyz123 inside a longer explanatory sentence."
                ),
            },
            {
                "block_label": "text",
                "block_content": "Keywords: translation; layout; parsing",
            },
            {
                "block_label": "text",
                "block_content": "• Keywords: translation; layout; parsing",
            },
        ]
    )

    assert classified[0][:2] == ("text", "body")
    assert classified[1][:2] == ("text", "body")
    assert classified[2][:2] == ("text", "metadata")
    assert classified[3][:2] == ("text", "metadata")


def test_paddle_figure_title_maps_to_figure_caption() -> None:
    classified = classify_page_blocks(
        [
            {"block_label": "figure_title", "block_content": "Figure 3: Overall pipeline."},
            {"block_label": "figure_title", "block_content": "Table note: Results improve after reranking."},
        ]
    )

    assert classified[0] == ("text", "figure_caption", ["caption", "figure_caption"], {"caption_target": "figure"})
    assert classified[1] == ("text", "figure_caption", ["caption", "figure_caption"], {"caption_target": "figure"})


def test_paddle_figure_title_is_translatable() -> None:
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {"block_label": "figure_title", "block_content": "Figure 1. Example caption."},
                    ]
                },
                "markdown": {"text": "", "images": {}},
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    from services.document_schema.provider_adapters.paddle.page_reader import build_page_spec

    block = build_page_spec(page_payload=payload["layoutParsingResults"][0], page_index=0, page_meta={}, preprocessed_image="")["blocks"][0]
    assert block.get("sub_type") == "figure_caption"
    assert block.get("policy", {}).get("translate") is True


def test_paddle_figure_caption_enters_translation_items() -> None:
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {"block_label": "figure_title", "block_content": "Figure 1. Example caption."},
                    ]
                },
                "markdown": {"text": "", "images": {}},
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    from services.document_schema.provider_adapters.paddle.page_reader import build_page_spec
    page_spec = build_page_spec(page_payload=payload["layoutParsingResults"][0], page_index=0, page_meta={}, preprocessed_image="")
    assert page_spec["blocks"][0]["sub_type"] == "figure_caption"
    assert page_spec["blocks"][0]["policy"]["translate"] is True


def test_paddle_doc_title_enters_translation_items_as_optional_title_candidate() -> None:
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {"block_label": "doc_title", "block_content": "Document Title"},
                    ]
                },
                "markdown": {"text": "", "images": {}},
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    document = build_paddle_document(
        payload,
        document_id="title-policy-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    block = document["pages"][0]["blocks"][0]
    assert block["sub_type"] == "title"
    assert block["structure_role"] == "title"
    assert block["policy"] == {"translate": True, "translate_reason": "provider_title_candidate"}
    assert [item.text for item in extract_text_items(document, 0)] == ["Document Title"]


def test_paddle_classifies_ancillary_tail_headings_as_metadata() -> None:
    classified = classify_page_blocks(
        [
            {"block_label": "paragraph_title", "block_content": "Competing interests"},
            {"block_label": "paragraph_title", "block_content": "Acknowledgments"},
            {"block_label": "paragraph_title", "block_content": "References"},
            {"block_label": "paragraph_title", "block_content": "Introduction"},
        ]
    )

    assert classified[0][:2] == ("text", "metadata")
    assert classified[1][:2] == ("text", "metadata")
    assert classified[2][:2] == ("text", "metadata")
    assert classified[3][:2] == ("text", "heading")


def test_paddle_page_spec_repairs_first_empty_right_slot_from_left_carryover() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1191,
                "height": 1600,
                "model_settings": {"enable_body_repair": True},
                "parsing_res_list": [
                    {
                        "block_label": "text",
                        "block_content": "left intro text",
                        "block_bbox": [106, 895, 584, 943],
                    },
                    {
                        "block_label": "text",
                        "block_content": "left middle text",
                        "block_bbox": [106, 944, 585, 1087],
                    },
                    {
                        "block_label": "text",
                        "block_content": (
                            "Differences were found between Thioindigo and Indigo and the donor paragraph keeps "
                            "running into the next column because the sentence is still open and ends with"
                        ),
                        "block_bbox": [105, 1255, 586, 1473],
                    },
                    {
                        "block_label": "text",
                        "block_content": "",
                        "block_bbox": [603, 895, 1082, 967],
                    },
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
                "model_settings": {
                    "merge_layout_blocks": False,
                },
                "parsing_res_list": [
                    {
                        "block_label": "text",
                        "block_content": "left intro text",
                        "block_bbox": [106, 895, 584, 943],
                    },
                    {
                        "block_label": "text",
                        "block_content": "left middle text",
                        "block_bbox": [106, 944, 585, 1087],
                    },
                    {
                        "block_label": "text",
                        "block_content": (
                            "Differences were found between Thioindigo and Indigo and the donor paragraph keeps "
                            "running into the next column because the sentence is still open and ends with"
                        ),
                        "block_bbox": [105, 1255, 586, 1473],
                    },
                    {
                        "block_label": "text",
                        "block_content": "",
                        "block_bbox": [603, 895, 1082, 967],
                    },
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
                    {
                        "block_label": "text",
                        "block_content": "left support text",
                        "block_bbox": [120, 761, 833, 789],
                    },
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
                    {
                        "block_label": "text",
                        "block_content": "",
                        "block_bbox": [602, 823, 1081, 898],
                    },
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


def test_paddle_page_spec_keeps_unsafe_split_unrepaired() -> None:
    page_spec = build_page_spec(
        page_payload={
            "prunedResult": {
                "width": 1200,
                "height": 1600,
                "model_settings": {"enable_body_repair": True},
                "parsing_res_list": [
                    {
                        "block_label": "text",
                        "block_content": "left support text",
                        "block_bbox": [100, 100, 360, 160],
                    },
                    {
                        "block_label": "text",
                        "block_content": "ABCDEFGHIJKLMN",
                        "block_bbox": [100, 220, 380, 300],
                    },
                    {
                        "block_label": "text",
                        "block_content": "",
                        "block_bbox": [760, 220, 1040, 300],
                    },
                    {
                        "block_label": "text",
                        "block_content": "right support text",
                        "block_bbox": [760, 360, 1040, 430],
                    },
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
                    {
                        "block_label": "header",
                        "block_content": "",
                        "block_bbox": [760, 60, 1040, 100],
                    },
                    {
                        "block_label": "text",
                        "block_content": "left support text",
                        "block_bbox": [100, 180, 360, 250],
                    },
                    {
                        "block_label": "text",
                        "block_content": "right support text",
                        "block_bbox": [760, 180, 1040, 250],
                    },
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


def test_paddle_body_repair_requires_raw_label_text_even_if_kind_is_body() -> None:
    parsing_res_list = [
        {
            "block_label": "paragraph_title",
            "block_content": "left merged heading from right side",
            "block_bbox": [100, 220, 380, 300],
        },
        {
            "block_label": "paragraph_title",
            "block_content": "",
            "block_bbox": [760, 220, 1040, 300],
        },
        {
            "block_label": "text",
            "block_content": "right support text",
            "block_bbox": [760, 360, 1040, 430],
        },
        {
            "block_label": "text",
            "block_content": "another right support text",
            "block_bbox": [760, 480, 1040, 550],
        },
    ]
    column_signals = analyze_page_column_signals(
        parsing_res_list=parsing_res_list,
        page_width=1200,
    )

    repaired_blocks, repair_metadata, repair_summary = repair_body_cross_column_blocks(
        parsing_res_list=parsing_res_list,
        column_signals=column_signals,
    )

    assert repaired_blocks[0]["block_content"] == "left merged heading from right side"
    assert repaired_blocks[1]["block_content"] == ""
    assert repair_metadata == {}
    assert repair_summary["body_repair_pair_count"] == 0


def test_paddle_body_repair_ignores_tiny_empty_text_slots() -> None:
    parsing_res_list = [
        {
            "block_label": "text",
            "block_content": "A donor sentence that is long enough to tempt a repair but should stay intact.",
            "block_bbox": [107, 1209, 585, 1306],
        },
        {
            "block_label": "text",
            "block_content": "",
            "block_bbox": [617, 1402, 983, 1422],
        },
        {
            "block_label": "text",
            "block_content": "right support text",
            "block_bbox": [603, 968, 1083, 1111],
        },
        {
            "block_label": "text",
            "block_content": "another right support text",
            "block_bbox": [602, 1112, 1083, 1422],
        },
    ]
    column_signals = analyze_page_column_signals(
        parsing_res_list=parsing_res_list,
        page_width=1191,
    )

    repaired_blocks, repair_metadata, repair_summary = repair_body_cross_column_blocks(
        parsing_res_list=parsing_res_list,
        column_signals=column_signals,
    )

    assert repaired_blocks[0]["block_content"].startswith("A donor sentence")
    assert repaired_blocks[1]["block_content"] == ""
    assert repair_metadata == {}
    assert repair_summary["body_repair_pair_count"] == 0


def test_paddle_body_repair_ignores_empty_slot_without_same_column_body_context() -> None:
    parsing_res_list = [
        {
            "block_label": "text",
            "block_content": "A donor sentence that is long enough to tempt a repair across columns and keep running for a while.",
            "block_bbox": [107, 1209, 585, 1306],
        },
        {
            "block_label": "text",
            "block_content": "",
            "block_bbox": [603, 823, 1082, 920],
        },
        {
            "block_label": "text",
            "block_content": "Short badge",
            "block_bbox": [618, 1451, 778, 1469],
        },
        {
            "block_label": "text",
            "block_content": "Submit here",
            "block_bbox": [618, 1469, 855, 1486],
        },
    ]
    column_signals = analyze_page_column_signals(
        parsing_res_list=parsing_res_list,
        page_width=1191,
    )

    repaired_blocks, repair_metadata, repair_summary = repair_body_cross_column_blocks(
        parsing_res_list=parsing_res_list,
        column_signals=column_signals,
    )

    assert repaired_blocks[0]["block_content"].startswith("A donor sentence")
    assert repaired_blocks[1]["block_content"] == ""
    assert repair_metadata.get(0, {}).get("provider_body_repair_applied") is None
    assert repair_metadata.get(1, {}).get("provider_body_repair_applied") is None
    assert repair_summary["body_repair_pair_count"] == 0


def test_paddle_body_repair_ignores_front_matter_text_before_body_heading() -> None:
    parsing_res_list = [
        {
            "block_label": "doc_title",
            "block_content": "Document Title",
            "block_bbox": [100, 200, 900, 300],
        },
        {
            "block_label": "paragraph_title",
            "block_content": "Abstract",
            "block_bbox": [120, 430, 220, 455],
        },
        {
            "block_label": "abstract",
            "block_content": "Abstract content block.",
            "block_bbox": [120, 470, 980, 740],
        },
        {
            "block_label": "text",
            "block_content": "Keywords: Indigo, DFT",
            "block_bbox": [120, 761, 833, 789],
        },
        {
            "block_label": "text",
            "block_content": "",
            "block_bbox": [602, 823, 1081, 898],
        },
        {
            "block_label": "paragraph_title",
            "block_content": "Introduction",
            "block_bbox": [108, 824, 232, 845],
        },
        {
            "block_label": "text",
            "block_content": "Body paragraph starts here and should be the first repairable body block.",
            "block_bbox": [106, 847, 585, 1016],
        },
    ]
    column_signals = analyze_page_column_signals(
        parsing_res_list=parsing_res_list,
        page_width=1191,
    )

    repaired_blocks, repair_metadata, repair_summary = repair_body_cross_column_blocks(
        parsing_res_list=parsing_res_list,
        column_signals=column_signals,
    )

    assert repaired_blocks[3]["block_content"] == "Keywords: Indigo, DFT"
    assert repaired_blocks[4]["block_content"] == ""
    assert repair_metadata == {}
    assert repair_summary["body_repair_pair_count"] == 0


def test_paddle_build_lines_splits_tall_body_block_into_pseudo_lines() -> None:
    bbox = [53.48, 640.259, 292.39, 699.736]
    text = (
        "Theoretical studies of the effects of substituents on absorption and emission spectra have "
        "been performed, including studies on the indigo molecule and related compounds."
    )

    lines = build_lines(
        bbox=bbox,
        segments=[],
        text=text,
        raw_label="text",
        block_type="text",
        sub_type="body",
    )

    assert len(lines) >= 3
    assert all(len(line.get("bbox", [])) == 4 for line in lines)
    assert all(line["spans"] for line in lines)
    assert "Theoretical studies" in lines[0]["spans"][0]["text"]

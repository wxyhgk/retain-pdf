import json
import subprocess
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle import looks_like_paddle_layout
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import (
    analyze_page_column_signals,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.body_repair import repair_body_cross_column_blocks
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import build_lines
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.payload_reader import (
    data_info_is_complete,
    iter_page_specs,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.adapter import build_paddle_document
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.relations import classify_page_blocks
from retainpdf_pipeline.translate.core.ocr.json_extractor import extract_text_items
from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from devtools.tests.document_schema.fixtures.registry import PADDLE_FIXTURES_ROOT


PADDLE_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_full.json"
PADDLE_SCI_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_sci.json"
PADDLE_FIXTURE_PDF = PADDLE_FIXTURES_ROOT / "paddle_ocr_json_split.pdf"
NORMALIZE_ENTRYPOINT = REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "entrypoints" / "run_normalize_ocr.py"


def test_legacy_jsonl_infers_incomplete_page_metadata_from_count_mismatch() -> None:
    payload = {
        "_meta": {"source": "paddle_jsonl"},
        "dataInfo": {"pages": [{"width": 999, "height": 999}]},
        "layoutParsingResults": [
            {"prunedResult": {"width": 1200, "height": 1600, "parsing_res_list": []}},
            {"prunedResult": {"width": 1400, "height": 1800, "parsing_res_list": []}},
        ],
    }

    assert data_info_is_complete(payload) is False
    page_specs = iter_page_specs(payload)
    assert [(page["width"], page["height"]) for page in page_specs] == [
        (1200.0, 1600.0),
        (1400.0, 1800.0),
    ]


def test_legacy_jsonl_keeps_page_metadata_when_counts_match() -> None:
    payload = {
        "_meta": {"source": "paddle_jsonl"},
        "dataInfo": {"pages": [{"width": 1191, "height": 1684}]},
        "layoutParsingResults": [
            {"prunedResult": {"width": 1200, "height": 1600, "parsing_res_list": []}},
        ],
    }

    assert data_info_is_complete(payload) is True
    [page_spec] = iter_page_specs(payload)
    assert (page_spec["width"], page_spec["height"]) == (1191.0, 1684.0)

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


def test_paddle_content_label_becomes_translatable_toc() -> None:
    page_payload = {
        "prunedResult": {
            "width": 1200,
            "height": 1600,
            "parsing_res_list": [
                {
                    "block_label": "content",
                    "block_content": (
                        "1 Introduction ..... 1\n"
                        "2 Foundations of Density Functional Theory ..... 11\n"
                        "2.1 Hohenberg-Kohn Theorem ..... 11"
                    ),
                    "block_bbox": [100, 200, 780, 290],
                },
            ],
            "layout_det_res": {"boxes": []},
        },
        "markdown": {"text": "", "images": {}},
        "outputImages": {},
        "inputImage": "",
    }

    document = build_paddle_document(
        {
            "layoutParsingResults": [page_payload],
            "dataInfo": {"pages": [{"width": 1200, "height": 1600}]},
            "preprocessedImages": [""],
        },
        document_id="toc-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )
    block = document["pages"][0]["blocks"][0]

    assert block["layout_role"] == "toc"
    assert block["semantic_role"] == "table_of_contents"
    assert block["structure_role"] == "table_of_contents"
    assert block["policy"] == {"translate": True, "translate_reason": "provider_toc_whitelist:content"}
    assert block["content"]["text_flow"] == "preserve_lines"
    assert block["content"]["toc_entries"][1]["number"] == "2"
    assert block["content"]["toc_entries"][1]["title"] == "Foundations of Density Functional Theory"
    assert block["content"]["toc_entries"][1]["page_label"] == "11"

    items = extract_text_items(document, 0)

    assert len(items) == 1
    assert items[0].structure_role == "table_of_contents"
    assert items[0].toc_entries


def test_paddle_body_numbered_line_block_preserves_text_flow() -> None:
    page_payload = {
        "prunedResult": {
            "width": 1200,
            "height": 1600,
            "parsing_res_list": [
                {
                    "block_label": "text",
                    "block_content": (
                        "1. University of California, Berkeley\n"
                        "2. Independent Contributor\n"
                        "3. Stanford University\n"
                        "4. University of Michigan"
                    ),
                    "block_bbox": [100, 200, 360, 260],
                },
            ],
            "layout_det_res": {"boxes": []},
        },
        "markdown": {"text": "", "images": {}},
        "outputImages": {},
        "inputImage": "",
    }

    document = build_paddle_document(
        {
            "layoutParsingResults": [page_payload],
            "dataInfo": {"pages": [{"width": 1200, "height": 1600}]},
            "preprocessedImages": [""],
        },
        document_id="numbered-lines-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )
    block = document["pages"][0]["blocks"][0]

    assert block["semantic_role"] == "body"
    assert block["content"]["line_texts"] == [
        "1. University of California, Berkeley",
        "2. Independent Contributor",
        "3. Stanford University",
        "4. University of Michigan",
    ]
    assert block["content"]["text_flow"] == "preserve_lines"

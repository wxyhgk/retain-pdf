import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import (
    analyze_page_column_signals,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.body_repair import repair_body_cross_column_blocks
from devtools.tests.document_schema.fixtures.registry import PADDLE_FIXTURES_ROOT


PADDLE_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_full.json"
PADDLE_SCI_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_sci.json"
PADDLE_FIXTURE_PDF = PADDLE_FIXTURES_ROOT / "paddle_ocr_json_split.pdf"
NORMALIZE_ENTRYPOINT = REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "entrypoints" / "run_normalize_ocr.py"


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

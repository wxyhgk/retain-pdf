import json
import subprocess
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_PADDLE
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle import looks_like_paddle_layout
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.column_signals import (
    analyze_page_column_signals,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.body_repair import repair_body_cross_column_blocks
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import (
    assign_inline_formula_bboxes,
    build_lines,
    build_segments,
    inherit_missing_segment_bboxes,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.adapter import build_paddle_document
from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.relations import classify_page_blocks
from retainpdf_pipeline.ocr.ocr_provider.paddle_normalize import rescale_document_geometry_to_pdf
from retainpdf_pipeline.translate.core.ocr.json_extractor import extract_text_items
from retainpdf_pipeline.foundation.shared.job_dirs import ensure_job_dirs
from retainpdf_pipeline.foundation.shared.job_dirs import resolve_job_dirs
from devtools.tests.document_schema.fixtures.registry import PADDLE_FIXTURES_ROOT


PADDLE_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_full.json"
PADDLE_SCI_FIXTURE_JSON = PADDLE_FIXTURES_ROOT / "json_sci.json"
PADDLE_FIXTURE_PDF = PADDLE_FIXTURES_ROOT / "paddle_ocr_json_split.pdf"
NORMALIZE_ENTRYPOINT = REPO_SCRIPTS_ROOT / "retainpdf_pipeline" / "entrypoints" / "run_normalize_ocr.py"

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


def test_paddle_figure_title_distinguishes_table_caption() -> None:
    classified = classify_page_blocks(
        [
            {"block_label": "figure_title", "block_content": "Figure 3: Overall pipeline."},
            {"block_label": "figure_title", "block_content": "Table note: Results improve after reranking."},
        ]
    )

    assert classified[0] == ("text", "figure_caption", ["caption", "figure_caption"], {"caption_target": "figure"})
    assert classified[1] == ("text", "table_caption", ["caption", "table_caption"], {"caption_target": "table"})


def test_paddle_html_wrapped_table_title_maps_to_table_caption() -> None:
    classified = classify_page_blocks(
        [
            {
                "block_label": "figure_title",
                "block_content": '<div style="text-align:center">TABLE 5: Results</div>',
            }
        ]
    )

    assert classified[0] == (
        "text",
        "table_caption",
        ["caption", "table_caption"],
        {"caption_target": "table"},
    )


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

    from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec

    block = build_page_spec(page_payload=payload["layoutParsingResults"][0], page_index=0, page_meta={}, preprocessed_image="")["blocks"][0]
    assert block.get("sub_type") == "figure_caption"
    assert block.get("policy", {}).get("translate") is True


def test_paddle_empty_image_block_uses_markdown_image_bbox_as_asset_link() -> None:
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {
                            "block_label": "image",
                            "block_content": "",
                            "block_bbox": [76, 136, 563, 481],
                        },
                    ]
                },
                "markdown": {
                    "text": "",
                    "images": {
                        "imgs/img_in_chart_box_76_136_563_481.jpg": "https://example.test/chart.jpg"
                    },
                },
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="image-asset-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    block = document["pages"][0]["blocks"][0]
    asset_id = "page-1/imgs/img_in_chart_box_76_136_563_481.jpg"
    assert block["content"]["asset_id"] == asset_id
    assert document["assets"][asset_id]["uri"] == (
        "md/images/page-1/imgs/img_in_chart_box_76_136_563_481.jpg"
    )
    assert "asset_url" not in block["metadata"]


def test_paddle_adjacent_figure_caption_has_bidirectional_asset_relation() -> None:
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {
                            "block_label": "image",
                            "block_content": "",
                            "block_bbox": [100, 200, 900, 700],
                        },
                        {
                            "block_label": "figure_title",
                            "block_content": "Figure 1. Exact adjacent caption.",
                            "block_bbox": [100, 720, 900, 780],
                        },
                    ]
                },
                "markdown": {
                    "text": "",
                    "images": {
                        "imgs/img_in_image_box_100_200_900_700.png": (
                            "https://example.test/figure.png"
                        )
                    },
                },
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }
    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="adjacent-caption-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    image_block, caption_block = document["pages"][0]["blocks"]
    asset_id = "page-1/imgs/img_in_image_box_100_200_900_700.png"
    assert caption_block["content"]["asset_id"] == asset_id
    assert caption_block["content"]["asset_ids"] == [asset_id]
    assert caption_block["content"]["related_block_ids"] == [image_block["block_id"]]
    assert caption_block["metadata"]["caption_target_block_id"] == image_block["block_id"]
    assert caption_block["metadata"]["caption_target_direction"] == "previous"
    assert image_block["content"]["caption"] == "Figure 1. Exact adjacent caption."
    assert image_block["content"]["caption_block_ids"] == [caption_block["block_id"]]
    assert document["assets"][asset_id]["caption"] == "Figure 1. Exact adjacent caption."
    assert document["assets"][asset_id]["caption_block_ids"] == [caption_block["block_id"]]


def test_paddle_caption_before_asset_table_preserves_asset_uri_and_reverse_caption() -> None:
    image_path = "imgs/structure.png"
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {
                            "block_label": "figure_title",
                            "block_content": "Table 1. Embedded structure.",
                            "block_bbox": [100, 150, 900, 190],
                        },
                        {
                            "block_label": "table",
                            "block_content": f'<table><tr><td><img src="{image_path}" /></td></tr></table>',
                            "block_bbox": [100, 200, 900, 800],
                        },
                    ]
                },
                "markdown": {
                    "text": "",
                    "images": {image_path: "https://example.test/structure.png"},
                },
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="table-caption-before-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    caption_block, table_block = document["pages"][0]["blocks"]
    asset_id = f"page-1/{image_path}"
    assert caption_block["sub_type"] == "table_caption"
    assert caption_block["structure_role"] == "table_caption"
    assert caption_block["policy"] == {
        "translate": True,
        "translate_reason": "provider_caption_whitelist:table_caption",
    }
    assert caption_block["content"]["asset_ids"] == [asset_id]
    assert caption_block["content"]["related_block_ids"] == [table_block["block_id"]]
    assert caption_block["metadata"]["caption_target_direction"] == "next"
    assert table_block["content"]["caption"] == "Table 1. Embedded structure."
    assert document["assets"][asset_id]["uri"] == f"md/images/page-1/{image_path}"
    assert document["assets"][asset_id]["caption"] == "Table 1. Embedded structure."


def test_paddle_caption_between_two_assets_stays_unbound() -> None:
    image_paths = [
        "imgs/img_in_image_box_100_100_400_400.png",
        "imgs/img_in_image_box_600_100_900_400.png",
    ]
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {"block_label": "image", "block_content": "", "block_bbox": [100, 100, 400, 400]},
                        {
                            "block_label": "figure_title",
                            "block_content": "Figure 2. Ambiguous neighbouring panels.",
                            "block_bbox": [100, 420, 900, 470],
                        },
                        {"block_label": "image", "block_content": "", "block_bbox": [600, 100, 900, 400]},
                    ]
                },
                "markdown": {
                    "text": "",
                    "images": {
                        image_paths[0]: "https://example.test/left.png",
                        image_paths[1]: "https://example.test/right.png",
                    },
                },
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="ambiguous-caption-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    left_block, caption_block, right_block = document["pages"][0]["blocks"]
    assert "asset_ids" not in caption_block["content"]
    assert "related_block_ids" not in caption_block["content"]
    assert "caption_target_block_id" not in caption_block["metadata"]
    assert "caption" not in left_block["content"]
    assert "caption" not in right_block["content"]


def test_paddle_table_block_preserves_every_embedded_image_asset() -> None:
    image_paths = [
        "imgs/structure-a.png",
        "imgs/structure-b.png",
        "imgs/structure-c.png",
    ]
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {
                            "block_label": "table",
                            "block_content": "".join(
                                f'<img src="{path}" />' for path in image_paths
                            ),
                            "block_bbox": [100, 200, 900, 800],
                        },
                    ]
                },
                "markdown": {
                    "text": "",
                    "images": {path: f"https://example.test/{index}.png" for index, path in enumerate(image_paths)},
                },
            }
        ],
        "dataInfo": {"pages": [{"width": 1200, "height": 1600}], "type": "paddle"},
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="multi-asset-table-doc",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    block = document["pages"][0]["blocks"][0]
    asset_ids = [f"page-1/{path}" for path in image_paths]
    assert block["content"]["asset_id"] == asset_ids[0]
    assert block["content"]["asset_ids"] == asset_ids
    assert list(document["assets"]) == asset_ids
    assert [document["assets"][asset_id]["uri"] for asset_id in asset_ids] == [
        f"md/images/page-1/{path}" for path in image_paths
    ]


def test_paddle_outer_image_block_keeps_overlapping_provider_crops() -> None:
    image_paths = [
        "imgs/img_in_image_box_92_217_1387_1113.jpg",
        "imgs/img_in_image_box_1097_177_1386_1116.jpg",
        "imgs/img_in_image_box_128_311_1018_749.jpg",
    ]
    payload = {
        "layoutParsingResults": [
            {
                "prunedResult": {
                    "parsing_res_list": [
                        {
                            "block_label": "image",
                            "block_content": "",
                            "block_bbox": [92, 217, 1387, 1113],
                        }
                    ]
                },
                "markdown": {
                    "text": "",
                    "images": {path: f"https://example.test/{index}.jpg" for index, path in enumerate(image_paths)},
                },
            }
        ],
        "dataInfo": {"pages": [{"width": 1500, "height": 1200}], "type": "paddle"},
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="overlapping-assets",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    expected_ids = [f"page-1/{path}" for path in image_paths]
    assert document["pages"][0]["blocks"][0]["content"]["asset_ids"] == expected_ids
    assert list(document["assets"]) == expected_ids


def test_paddle_repeated_page_local_filename_has_distinct_canonical_asset_ids() -> None:
    image_path = "imgs/repeated-header.png"
    page_payload = {
        "prunedResult": {
            "parsing_res_list": [
                {
                    "block_label": "header_image",
                    "block_content": f'<img src="{image_path}" />',
                    "block_bbox": [100, 10, 300, 80],
                }
            ]
        },
        "markdown": {"text": "", "images": {image_path: "https://example.test/header.png"}},
    }
    payload = {
        "layoutParsingResults": [page_payload, page_payload],
        "dataInfo": {
            "pages": [{"width": 1200, "height": 1600}, {"width": 1200, "height": 1600}],
            "type": "paddle",
        },
    }

    document = adapt_payload_to_document_v1(
        payload=payload,
        provider=PROVIDER_PADDLE,
        document_id="repeated-page-assets",
        source_json_path=PADDLE_FIXTURE_JSON,
        provider_version="PaddleOCR-VL",
    )

    assert list(document["assets"]) == [
        f"page-1/{image_path}",
        f"page-2/{image_path}",
    ]
    assert document["pages"][0]["blocks"][0]["content"]["asset_id"] == f"page-1/{image_path}"
    assert document["pages"][1]["blocks"][0]["content"]["asset_id"] == f"page-2/{image_path}"


def test_paddle_inline_formula_is_preserved_for_nonliteral_text_label() -> None:
    segments = build_segments(
        "The abstract uses $E = mc^2$ as an example.",
        "abstract",
    )

    assert [segment["type"] for segment in segments] == [
        "text",
        "inline_formula",
        "text",
    ]
    assert segments[1]["text"] == "E = mc^2"


def test_paddle_mixed_text_splits_display_and_inline_dollar_math() -> None:
    segments = build_segments(
        "Before $$E = mc^2$$, then $x + y$ after.",
        "text",
    )

    assert [segment["type"] for segment in segments] == [
        "text",
        "inline_formula",
        "text",
        "inline_formula",
        "text",
    ]
    assert [
        segment["text"]
        for segment in segments
        if segment["type"] == "inline_formula"
    ] == [
        "E = mc^2",
        "x + y",
    ]


def test_paddle_spaced_short_math_and_segment_bbox_are_not_lost() -> None:
    segments = build_segments("Oxygen $ ^{17} $ and SiO $ _2 $", "reference_content")
    lines = build_lines(
        bbox=[10.0, 20.0, 210.0, 50.0],
        segments=segments,
        text="Oxygen $ ^{17} $ and SiO $ _2 $",
        raw_label="reference_content",
        block_type="text",
        sub_type="reference_entry",
    )
    inherit_missing_segment_bboxes(
        bbox=[10.0, 20.0, 210.0, 50.0],
        segments=segments,
        lines=lines,
    )

    assert [
        segment["text"]
        for segment in segments
        if segment["type"] == "inline_formula"
    ] == [
        "^{17}",
        "_2",
    ]
    assert all(segment["bbox"] == [10.0, 20.0, 210.0, 50.0] for segment in segments)
    assert all(segment["bbox_precision"] == "block" for segment in segments)
    assert lines[0]["bbox_precision"] == "block_fallback"
    assert all(span["bbox_precision"] == "line" for span in lines[0]["spans"])
    assert lines[0]["spans"][0] is not segments[0]


def test_paddle_inline_formula_uses_provider_layout_bbox_only_for_exact_pairing() -> None:
    segments = build_segments("A $x$ and $y$", "text")
    trace = assign_inline_formula_bboxes(
        segments=segments,
        block_bbox=[10.0, 20.0, 210.0, 80.0],
        layout_box_lookup={
            (30.0, 30.0, 45.0, 48.0): {
                "label": "inline_formula",
                "coordinate": [30.0, 30.0, 45.0, 48.0],
                "score": 0.91,
            },
            (130.0, 50.0, 148.0, 70.0): {
                "label": "inline_formula",
                "coordinate": [130.0, 50.0, 148.0, 70.0],
                "score": 0.87,
            },
        },
    )

    formulas = [
        segment for segment in segments if segment["type"] == "inline_formula"
    ]
    assert [segment["bbox"] for segment in formulas] == [
        [30.0, 30.0, 45.0, 48.0],
        [130.0, 50.0, 148.0, 70.0],
    ]
    assert all(segment["bbox_precision"] == "provider_layout" for segment in formulas)
    assert trace["provider_inline_formula_bbox_count"] == 2
    assert trace["provider_inline_formula_bbox_complete"] is True

    unmatched = build_segments("A $x$ and $y$", "text")
    incomplete_trace = assign_inline_formula_bboxes(
        segments=unmatched,
        block_bbox=[10.0, 20.0, 210.0, 80.0],
        layout_box_lookup={
            (30.0, 30.0, 45.0, 48.0): {
                "label": "inline_formula",
                "coordinate": [30.0, 30.0, 45.0, 48.0],
            }
        },
    )
    assert all(segment["bbox"] == [0, 0, 0, 0] for segment in unmatched)
    assert incomplete_trace["provider_inline_formula_bbox_count"] == 0
    assert incomplete_trace["provider_inline_formula_bbox_complete"] is False


def test_paddle_rescale_keeps_compatibility_and_contract_bbox_in_sync(tmp_path: Path) -> None:
    import fitz

    pdf_path = tmp_path / "source.pdf"
    pdf = fitz.open()
    pdf.new_page(width=600, height=800)
    pdf.save(pdf_path)
    pdf.close()
    document = {
        "pages": [
            {
                "width": 1200,
                "height": 1600,
                "blocks": [
                    {
                        "bbox": [100, 200, 500, 600],
                        "geometry": {"bbox": [100, 200, 500, 600]},
                        "lines": [],
                        "segments": [],
                        "source": {"raw_bbox": [100, 200, 500, 600], "raw_unit": "px"},
                        "metadata": {"raw_polygon": [[100, 200], [500, 600]]},
                    }
                ],
            }
        ]
    }

    rescale_document_geometry_to_pdf(document, pdf_path)

    block = document["pages"][0]["blocks"][0]
    assert block["bbox"] == [50.0, 100.0, 250.0, 300.0]
    assert block["geometry"]["bbox"] == block["bbox"]
    assert block["source"]["raw_bbox"] == [100, 200, 500, 600]
    assert block["source"]["raw_unit"] == "px"
    assert block["metadata"]["raw_polygon"] == [[100, 200], [500, 600]]


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

    from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.page_reader import build_page_spec
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
    assert block["structure_role"] == "document_title"
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

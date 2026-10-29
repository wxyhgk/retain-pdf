"""Paddle 适配器的行内公式与几何：公式不丢、显示/行内 $ 拆分、公式 bbox 配对，以及缩放时各份 bbox 保持一致。

从 test_paddle_metadata_and_captions.py（现名 test_paddle_metadata_classification.py）整块拆出，用例本身未改。
"""

from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.content_extract import (
    assign_inline_formula_bboxes,
    build_lines,
    build_segments,
    inherit_missing_segment_bboxes,
)
from retainpdf_pipeline.ocr.document_schema.pdf_geometry import rescale_document_geometry_to_pdf
from devtools.tests.pdf_fixtures import write_pdf


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

    pdf_path = tmp_path / "source.pdf"
    write_pdf(pdf_path, width=600, height=800)
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


def test_scale_bbox_preserves_nesting() -> None:
    from retainpdf_pipeline.ocr.document_schema.pdf_geometry import scale_bbox

    outer = [527.0, 39.0, 547.0, 51.0]
    inner = [527.244, 39.041, 546.253, 50.053]
    for scale_x, scale_y in ((1.0, 1.0), (0.5, 0.5), (2.0, 2.0), (1.7, 2.3), (0.13, 0.29)):
        scaled_outer = scale_bbox(list(outer), scale_x, scale_y)
        scaled_inner = scale_bbox(list(inner), scale_x, scale_y)
        assert scaled_inner[0] >= scaled_outer[0]
        assert scaled_inner[1] >= scaled_outer[1]
        assert scaled_inner[2] <= scaled_outer[2]
        assert scaled_inner[3] <= scaled_outer[3]

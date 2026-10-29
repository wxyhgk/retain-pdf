"""把略微超出页边的框夹回页内；超得多的不动，让校验照样报错。"""

from __future__ import annotations

from retainpdf_pipeline.ocr.document_schema.page_bounds import clamp_page_overflow


def _document(block_bbox, *, line_bbox=None, span_bbox=None, segment_bbox=None, width=600.0, height=800.0) -> dict:
    line_bbox = line_bbox or block_bbox
    block = {
        "bbox": list(block_bbox),
        "geometry": {"bbox": list(block_bbox)},
        "lines": [{"bbox": list(line_bbox), "spans": [{"bbox": list(span_bbox or line_bbox), "text": "x"}]}],
        "segments": [{"bbox": list(segment_bbox or line_bbox), "text": "x"}],
        "metadata": {},
    }
    return {"pages": [{"width": width, "height": height, "blocks": [block]}], "derived": {}}


def test_a_block_a_little_past_the_right_edge_is_clamped_with_its_lines():
    document = _document([500, 100, 602, 130], line_bbox=[500, 100, 602, 115], span_bbox=[550, 100, 602, 115])
    assert clamp_page_overflow(document) == 1
    block = document["pages"][0]["blocks"][0]
    assert block["bbox"] == block["geometry"]["bbox"] == [500, 100, 600, 130]
    assert block["lines"][0]["bbox"] == [500, 100, 600, 115]
    assert block["lines"][0]["spans"][0]["bbox"] == [550, 100, 600, 115]
    assert block["segments"][0]["bbox"] == [500, 100, 600, 115]
    assert block["metadata"]["page_overflow_clamped"] == {"original_bbox": [500, 100, 602, 130]}
    assert document["derived"]["page_overflow_clamped_block_count"] == 1


def test_negative_coordinates_a_little_past_the_top_left_are_clamped():
    document = _document([-3, -2, 100, 40])
    assert clamp_page_overflow(document) == 1
    assert document["pages"][0]["blocks"][0]["bbox"] == [0.0, 0.0, 100, 40]


def test_a_block_far_past_the_edge_is_left_for_validation_to_report():
    # 超出 30（页宽的 5%）：多半是单位或配页错了，不藏起来。
    document = _document([500, 100, 630, 130])
    assert clamp_page_overflow(document) == 0
    assert document["pages"][0]["blocks"][0]["bbox"] == [500, 100, 630, 130]
    assert "page_overflow_clamped_block_count" not in document["derived"]


def test_blocks_inside_the_page_are_not_touched_at_all():
    document = _document([10, 10, 600, 800])
    assert clamp_page_overflow(document) == 0
    assert document["pages"][0]["blocks"][0]["metadata"] == {}
    assert document["derived"] == {}

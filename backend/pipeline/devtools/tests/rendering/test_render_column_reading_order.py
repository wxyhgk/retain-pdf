"""Regression tests for render cross-column / cross-page P0 trio.

Covers (render-local only):
1. Reading-order-first sorting: global sorted((y, x)) interleaves the right
   column top into the left column; sort helpers must prefer reading_order /
   layout_zone_rank with bbox (y, x) as in-column fallback (and keep legacy
   order when no reading_order is present).
2. Cross-page group zip alignment: prepare must order group members by
   reading order before splitting capacities/chunks, so chunk assignment is
   invariant to input order.
3. Two-member narrow-tail capacity: _continuation_adjusted_capacities must
   relax the narrow member for len == 2 (same ratios/formula as len >= 3).
"""

import sys
from pathlib import Path


REPO_PIPELINE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_PIPELINE_ROOT))

from retainpdf_pipeline.render.layout.payload.body_common import same_body_column
from retainpdf_pipeline.render.layout.payload.prepare import _continuation_adjusted_capacities
from retainpdf_pipeline.render.layout.payload.prepare import prepare_render_payloads_by_page
from retainpdf_pipeline.render.layout.payload.reading_sort import same_text_column
from retainpdf_pipeline.render.layout.payload.reading_sort import sort_payloads_by_reading_order


def _payload(item_id, bbox, reading_order=None, zone_rank=None):
    item = {"item_id": item_id, "bbox": list(bbox)}
    if reading_order is not None:
        item["reading_order"] = reading_order
    if zone_rank is not None:
        item["layout_zone_rank"] = zone_rank
    return {"item": item, "inner_bbox": list(bbox)}


def test_reading_order_sort_beats_global_yx_on_two_columns() -> None:
    payloads = [
        _payload("L1", [40, 40, 180, 88], reading_order=0, zone_rank=0),
        _payload("L2", [40, 96, 180, 144], reading_order=1, zone_rank=1),
        _payload("R1", [320, 50, 460, 98], reading_order=2, zone_rank=2),
        _payload("R2", [320, 106, 460, 154], reading_order=3, zone_rank=3),
    ]
    legacy = sorted(payloads, key=lambda p: (p["inner_bbox"][1], p["inner_bbox"][0]))
    assert [p["item"]["item_id"] for p in legacy] == ["L1", "R1", "L2", "R2"]
    fixed = sort_payloads_by_reading_order(payloads)
    assert [p["item"]["item_id"] for p in fixed] == ["L1", "L2", "R1", "R2"]


def test_sort_falls_back_to_legacy_order_without_reading_order() -> None:
    payloads = [
        _payload("L1", [40, 40, 180, 88]),
        _payload("L2", [40, 96, 180, 144]),
        _payload("R1", [320, 50, 460, 98]),
    ]
    legacy = sorted(payloads, key=lambda p: (p["inner_bbox"][1], p["inner_bbox"][0]))
    fixed = sort_payloads_by_reading_order(payloads)
    assert [p["item"]["item_id"] for p in fixed] == [p["item"]["item_id"] for p in legacy]


def test_same_column_unified_to_geometry_rule() -> None:
    left_top = _payload("L1", [40, 40, 180, 88])
    left_next = _payload("L2", [40, 96, 180, 144])
    right_top = _payload("R1", [320, 50, 460, 98])
    assert same_body_column(left_top, left_next, page_text_width_med=140.0) is True
    assert same_body_column(left_top, right_top, page_text_width_med=140.0) is False
    assert same_text_column(left_top["inner_bbox"], left_next["inner_bbox"], page_width=600.0) is True
    assert same_text_column(left_top["inner_bbox"], right_top["inner_bbox"], page_width=600.0) is False


def test_two_member_narrow_tail_capacity_relaxed() -> None:
    tail = {"bbox": [40, 700, 150, 730]}  # narrow (110pt)
    head = {"bbox": [40, 80, 300, 135]}  # wide (260pt)
    adjusted = _continuation_adjusted_capacities([tail, head], [100.0, 100.0])
    assert adjusted[0] < 100.0
    assert adjusted[1] == 100.0


def _group_pages(reverse: bool) -> dict[int, list[dict]]:
    aggregate = "甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥" * 12
    assert len(aggregate) > 200
    members = [
        {
            "item_id": "p001-wide",
            "page_idx": 0,
            "bbox": [40, 100, 540, 220],
            "block_type": "text",
            "math_mode": "direct_typst",
            "reading_order": 0,
            "layout_zone_rank": 0,
            "translation_unit_id": "__cg__:cg-order",
            "translation_unit_kind": "group",
            "continuation_group": "cg-order",
            "protected_source_text": "source one " * 40,
            "translation_unit_protected_source_text": "source one " * 40 + "source two " * 10,
            "translation_unit_protected_translated_text": aggregate,
            "translation_unit_formula_map": [],
            "protected_translated_text": aggregate,
            "translated_text": aggregate,
        },
        {
            "item_id": "p001-narrow",
            "page_idx": 0,
            "bbox": [40, 240, 180, 300],
            "block_type": "text",
            "math_mode": "direct_typst",
            "reading_order": 1,
            "layout_zone_rank": 1,
            "translation_unit_id": "__cg__:cg-order",
            "translation_unit_kind": "group",
            "continuation_group": "cg-order",
            "protected_source_text": "source two " * 10,
            "translation_unit_protected_source_text": "source one " * 40 + "source two " * 10,
            "translation_unit_protected_translated_text": aggregate,
            "translation_unit_formula_map": [],
            "protected_translated_text": aggregate,
            "translated_text": aggregate,
        },
    ]
    if reverse:
        members = list(reversed(members))
    return {0: members}


def test_prepare_group_zip_is_invariant_to_input_order() -> None:
    first_run = prepare_render_payloads_by_page(_group_pages(reverse=False))
    second_run = prepare_render_payloads_by_page(_group_pages(reverse=True))
    by_id_first = {item["item_id"]: item["render_protected_text"] for item in first_run[0]}
    by_id_second = {item["item_id"]: item["render_protected_text"] for item in second_run[0]}
    assert set(by_id_first) == {"p001-wide", "p001-narrow"}
    assert by_id_first == by_id_second
    # Sanity: the aggregate was actually split across the two boxes.
    assert by_id_first["p001-wide"] != by_id_first["p001-narrow"]
    assert all(text.strip() for text in by_id_first.values())

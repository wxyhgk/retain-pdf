"""一块和谁一起翻只有一个先后：摘要组（translation_group_id）优先，其次接续组（continuation_group）。

以前分桶（group_key）、起单元号（seed_orchestration_metadata）先看摘要组，translation_units._effective_group_unit_id
先看接续组；一块要是两个都有，会分进摘要组的桶、单元号却按接续组起（2026-11-02 整理时查出）。"""

from __future__ import annotations

from retainpdf_translation.core.item_reader import item_is_aggregate_geometry_member
from retainpdf_translation.core.payload.parts import translation_units
from retainpdf_translation.core.payload.parts.common import effective_group_id
from retainpdf_translation.core.payload.parts.common import group_key
from retainpdf_translation.core.payload.parts.common import group_unit_id
from retainpdf_translation.core.payload.parts.common import seed_orchestration_metadata


def _item(**fields) -> dict:
    return {"item_id": "p001-b001", "classification_label": "", "should_translate": True, "protected_source_text": "x", **fields}


def test_every_entry_point_puts_the_abstract_group_first() -> None:
    both = _item(translation_group_id="abstract:p001-b001", continuation_group="cg-001-001")
    assert effective_group_id(both) == ("translation", "abstract:p001-b001")
    assert group_key(both) == "translation:abstract:p001-b001"
    seeded = dict(both)
    seed_orchestration_metadata(seeded)
    assert seeded["translation_unit_id"] == group_unit_id("abstract:p001-b001")
    assert translation_units._effective_group_unit_id([dict(both)]) == group_unit_id("abstract:p001-b001")


def test_continuation_only_and_no_group() -> None:
    only = _item(continuation_group="cg-001-001")
    assert effective_group_id(only) == ("continuation", "cg-001-001")
    assert translation_units._effective_group_unit_id([only]) == group_unit_id("cg-001-001")
    assert effective_group_id(_item()) == ("", "")


def test_aggregate_geometry_member() -> None:
    assert item_is_aggregate_geometry_member({"translation_group_strategy": " aggregate_geometry "})
    assert not item_is_aggregate_geometry_member({"translation_group_strategy": ""})
    assert not item_is_aggregate_geometry_member(None)

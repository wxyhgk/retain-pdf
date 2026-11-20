from __future__ import annotations

from unittest import mock


from retainpdf_translation.llm.shared.control_context import build_translation_control_context
from retainpdf_translation_classic.llm.shared.orchestration.route_selection import select_single_item_route


def test_route_selector_short_circuits_direct_typst_before_heavy_formula_split() -> None:
    item = {
        "item_id": "p001-b001",
        "block_type": "text",
        "math_mode": "direct_typst",
        "protected_source_text": r"Observe $\mathrm{Ph(i-PrO)SiH_2}$ and more text.",
        "translation_unit_protected_source_text": r"Observe $\mathrm{Ph(i-PrO)SiH_2}$ and more text.",
    }

    with mock.patch(
        "retainpdf_translation_classic.llm.shared.orchestration.route_selection.heavy_formula_split_reason",
        side_effect=AssertionError("direct_typst should not inspect heavy formula split"),
    ):
        route = select_single_item_route(item, context=build_translation_control_context())

    assert route.direct_typst is True
    assert route.heavy_formula_split_reason == ""
    assert route.formula_segment_route == "none"
    assert route.prefer_tagged_placeholder_first is False


def test_route_selector_treats_structured_technical_hint_as_plain_translatable_text() -> None:
    item = {
        "item_id": "p002-b003",
        "block_type": "text",
        "math_mode": "placeholder",
        "source_text": "Default: 0\nType: <INT>",
        "protected_source_text": "Default: 0\nType: <INT>",
        "translation_style_hint": "这是技术文档中的结构化条目，请保持排版稳定。",
        "translation_structure_kind": "structured_technical_block",
    }

    route = select_single_item_route(item, context=build_translation_control_context())

    assert route.direct_typst is False
    assert route.heavy_formula_split_reason == ""
    assert route.formula_segment_route == "none"
    assert route.prefer_tagged_placeholder_first is False

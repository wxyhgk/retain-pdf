"""Regression: continuation must survive missing page indices and dual-column gutters."""

from __future__ import annotations

from importlib import import_module
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def _load_continuation_modules():
    return (
        import_module("retainpdf_pipeline.translate.services.continuation.rules"),
        import_module("retainpdf_pipeline.translate.services.continuation.state"),
    )


def test_continuation_imports_preserve_cached_module_identity() -> None:
    package = import_module("retainpdf_pipeline.translate.services.continuation")
    rules, state = _load_continuation_modules()
    path_before = list(sys.path)
    loaded_rules, loaded_state = _load_continuation_modules()
    assert loaded_rules is rules is package.rules
    assert loaded_state is state is package.state
    assert sys.modules[package.__name__] is package
    assert sys.path == path_before


def _body(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    bbox: list[float],
    layout_zone: str = "",
    layout_boundary_role: str = "",
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "normalized_sub_type": "body",
        "bbox": bbox,
        "protected_source_text": text,
        "source_text": text,
        "layout_mode": "double" if layout_zone in {"left_column", "right_column"} else "",
        "layout_zone": layout_zone,
        "layout_boundary_role": layout_boundary_role,
        "ocr_continuation_source": "provider",
        "ocr_continuation_role": "single",
        "ocr_continuation_scope": "intra_page",
        "ocr_continuation_group_id": f"provider-{item_id}",
        "ocr_continuation_reading_order": 0,
    }


def test_annotate_continues_after_missing_page_index_gap() -> None:
    """A gap like page 4 → page 6 must not abort the rest of the book."""
    _rules, state = _load_continuation_modules()
    payload = [
        _body(
            item_id="p005-b010",
            page_idx=4,
            text="Early paragraph ends cleanly on page five.",
            bbox=[40.0, 100.0, 290.0, 160.0],
            layout_zone="left_column",
            layout_boundary_role="tail",
        ),
        # page_idx 5 intentionally missing (figure-only / no translation items)
        _body(
            item_id="p007-b014",
            page_idx=6,
            text=(
                "Unlike directed ortho-lithiation, lithium-halogen exchange proceeded under mild conditions. "
                "Although triazole functional groups were tolerated under"
            ),
            bbox=[300.0, 395.0, 555.0, 455.0],
            layout_zone="right_column",
            layout_boundary_role="tail",
        ),
        _body(
            item_id="p008-b009",
            page_idx=7,
            text=(
                "standard conditions, the related yields were rather low "
                "(5% for B1, 22% for B2-OH, and 6% for B3)."
            ),
            bbox=[300.0, 200.0, 555.0, 280.0],
            layout_zone="right_column",
            layout_boundary_role="head",
        ),
    ]

    annotated = state.annotate_continuation_context(payload)
    assert annotated >= 2
    by_id = {item["item_id"]: item for item in payload}
    assert by_id["p007-b014"]["continuation_decision"] == state.RULE_JOIN_DECISION
    assert by_id["p008-b009"]["continuation_decision"] == state.RULE_JOIN_DECISION
    assert by_id["p007-b014"]["continuation_group"] == by_id["p008-b009"]["continuation_group"]
    assert by_id["p007-b014"]["continuation_group"]


def test_dual_column_narrow_gutter_left_to_right_joins() -> None:
    """SCI dual-column gutters can be <8pt; zone-based L→R must still join."""
    rules, state = _load_continuation_modules()
    left = _body(
        item_id="p007-b009",
        page_idx=6,
        text=(
            'In the case of DOBNA-Helix, borylation proceeded regioselectively, '
            'with the less distorted isomer formed in only 2%'
        ),
        # Narrow gutter: right edge 293.9, next left edge 298.9 (gap ~5pt)
        bbox=[38.985, 394.761, 293.889, 455.724],
        layout_zone="left_column",
        layout_boundary_role="middle",
    )
    right = _body(
        item_id="p007-b010",
        page_idx=6,
        text=(
            "yield. This result suggests that electronic effects (i.e. HOMO distribution) "
            "are more important than steric ones under the optimised conditions."
        ),
        bbox=[298.888, 48.471, 554.791, 83.449],
        layout_zone="right_column",
        layout_boundary_role="head",
    )

    assert rules.is_same_page_cross_column_pair(left, right)
    assert rules.likely_pair_geometry(left, right)
    assert rules.pair_decision(left, right) == "join"

    annotated = state.annotate_continuation_context([left, right])
    assert annotated == 2
    assert left["continuation_decision"] == state.RULE_JOIN_DECISION
    assert right["continuation_decision"] == state.RULE_JOIN_DECISION
    assert left["continuation_group"] == right["continuation_group"]


def test_ends_like_continuation_recognizes_under_and_only() -> None:
    rules, _state = _load_continuation_modules()
    assert rules.ends_like_continuation("groups were tolerated under")
    assert rules.ends_like_continuation("isomer formed in only 2%")
    assert rules.starts_like_continuation("standard conditions, the yields were low.")
    assert rules.starts_like_continuation("yield. This result suggests electronic effects.")


def test_does_not_join_incomplete_sentence_to_section_heading() -> None:
    rules, state = _load_continuation_modules()
    prev = _body(
        item_id="p009-b013",
        page_idx=8,
        text=(
            "For example, OLEDs containing DOBNA-Ph and DOBNA-Ph-3 as host materials "
            "exhibited performances superior to that of"
        ),
        bbox=[300.0, 500.0, 555.0, 560.0],
        layout_zone="right_column",
        layout_boundary_role="tail",
    )
    nxt = _body(
        item_id="p010-b006",
        page_idx=9,
        text=(
            "2.2.1 One-pot borylation of triarylamine precursors. The one-pot "
            "borylation-based synthesis of DOBNA proposed in 2015 highlights the potential."
        ),
        bbox=[40.0, 100.0, 290.0, 220.0],
        layout_zone="left_column",
        layout_boundary_role="head",
    )
    assert rules.starts_like_section_number(nxt["protected_source_text"])
    assert rules.pair_decision(prev, nxt) == "break"
    state.annotate_continuation_context([prev, nxt])
    assert prev.get("continuation_decision") != state.RULE_JOIN_DECISION
    assert nxt.get("continuation_decision") != state.RULE_JOIN_DECISION

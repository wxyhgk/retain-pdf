"""Cross-column/cross-page continuation joins body blocks only.

Regression for the Nickel paper case (job 20260903114317-fc554b, cg-023-007):
a dangling paragraph tail ("...there have been no examples of") was joined
with a mis-tagged figure caption ("Scheme 18. ..."), the translator then
borrowed "Scheme 18" to complete the half sentence, and rendering fused two
independent paragraphs into one.
"""

from importlib import import_module
import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def _load_state_module():
    return (
        import_module("retainpdf_pipeline.translate.services.continuation.rules"),
        import_module("retainpdf_pipeline.translate.services.continuation.state"),
    )


def test_continuation_imports_preserve_cached_module_identity() -> None:
    package = import_module("retainpdf_pipeline.translate.services.continuation")
    rules, state = _load_state_module()
    path_before = list(sys.path)
    loaded_rules, loaded_state = _load_state_module()
    assert loaded_rules is rules is package.rules
    assert loaded_state is state is package.state
    assert sys.modules[package.__name__] is package
    assert sys.path == path_before


def _payload_item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    layout_boundary_role: str = "",
    layout_mode: str = "single",
    layout_zone: str = "single_column",
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
        "normalized_sub_type": "",
        "bbox": [70, 100, 525, 200],
        "protected_source_text": text,
        "ocr_continuation_source": "",
        "ocr_continuation_group_id": "",
        "ocr_continuation_scope": "",
        "ocr_continuation_reading_order": -1,
        "layout_mode": layout_mode,
        "layout_zone": layout_zone,
        "layout_boundary_role": layout_boundary_role,
    }


def test_caption_titles_detected_by_text_shape() -> None:
    rules, _ = _load_state_module()
    captions = [
        "Scheme 18. Intermolecular Reductive Alkylarylation of Alkenes and the Mechanistic Proposal",
        "Figure 1. Reaction scope of the dicarbofunctionalization.",
        "Fig. 2 Substrate scope.",
        "Table 2. Optimization of reaction conditions.",
        "TABLE VI. COMPARISON.",
        "Algorithm 1. Training loop.",
        "图 1 反应机理示意图",
        "表 2 条件优化",
        "附图 S3. 表征数据",
    ]
    for text in captions:
        assert rules.starts_like_caption_title(text), text
    bodies = [
        "Table salt is widely used as an additive in these reactions.",
        "The scheme of the reaction was proposed in earlier work.",
        "Existing enantioselective dicarbofunctionalization reactions are initiated (Scheme 18).",
        "Schemes are useful tools for mechanistic discussion.",
    ]
    for text in bodies:
        assert not rules.starts_like_caption_title(text), text


def test_caption_mistagged_as_body_is_not_eligible() -> None:
    rules, _ = _load_state_module()
    caption = _payload_item(
        item_id="cap",
        page_idx=23,
        text="Scheme 18. Intermolecular Reductive Alkylarylation of Alkenes and the Mechanistic Proposal",
    )
    assert rules.eligible(caption) is False
    body = _payload_item(
        item_id="body",
        page_idx=23,
        text="Existing enantioselective dicarbofunctionalization reactions are initiated by oxidative addition.",
    )
    assert rules.eligible(body) is True


def test_nickel_case_tail_does_not_join_caption() -> None:
    _, state = _load_state_module()
    payload = [
        _payload_item(
            item_id="p023-b006",
            page_idx=22,
            text="Therefore, there have been no examples of",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="p024-b006",
            page_idx=23,
            text="Scheme 18. Intermolecular Reductive Alkylarylation of Alkenes and the Mechanistic Proposal",
            layout_boundary_role="tail",
        ),
    ]
    state.annotate_continuation_context(payload)
    assert payload[0].get("continuation_group", "") == ""
    assert payload[1].get("continuation_group", "") == ""
    assert payload[0].get("continuation_decision", "") != "joined"


def test_true_cross_page_body_continuation_still_joins() -> None:
    _, state = _load_state_module()
    payload = [
        _payload_item(
            item_id="p023-b006",
            page_idx=22,
            text="Therefore, there have been no examples of",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="p024-b003",
            page_idx=23,
            text="asymmetric alkylarylation for an alkene with a pendent electrophile, likely due to the difficulty.",
            layout_boundary_role="head",
        ),
    ]
    state.annotate_continuation_context(payload)
    assert payload[0].get("continuation_group", "") != ""
    assert payload[0]["continuation_group"] == payload[1]["continuation_group"]
    assert payload[0].get("continuation_decision") == "joined"


def test_cross_page_tail_to_tail_downgraded_to_candidate() -> None:
    _, state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="Therefore, there have been no examples of",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="bromide salts were examined under the standard conditions yesterday",
            layout_boundary_role="tail",
        ),
    ]
    state.annotate_continuation_context(payload)
    assert payload[0].get("continuation_group", "") == ""
    assert payload[1].get("continuation_group", "") == ""
    assert payload[0].get("continuation_decision") == "candidate_break"


def test_unannotated_roles_keep_historical_join() -> None:
    _, state = _load_state_module()
    payload = [
        _payload_item(item_id="a", page_idx=0, text="Therefore, there have been no examples of"),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="bromide salts were examined under the standard conditions yesterday",
        ),
    ]
    state.annotate_continuation_context(payload)
    assert payload[0].get("continuation_group", "") != ""
    assert payload[0]["continuation_group"] == payload[1]["continuation_group"]

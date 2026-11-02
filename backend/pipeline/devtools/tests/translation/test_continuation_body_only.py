"""Cross-column/cross-page continuation joins body blocks only.

Regression for the Nickel paper case (job 20260903114317-fc554b, cg-023-007):
a dangling paragraph tail ("...there have been no examples of") was joined
with a mis-tagged figure caption ("Scheme 18. ..."), the translator then
borrowed "Scheme 18" to complete the half sentence, and rendering fused two
independent paragraphs into one.
"""

from importlib import import_module
import sys


def _load_state_module():
    return (
        import_module("retainpdf_translation.services.continuation.rules"),
        import_module("retainpdf_translation.services.continuation.state"),
    )


def test_continuation_imports_preserve_cached_module_identity() -> None:
    package = import_module("retainpdf_translation.services.continuation")
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


def test_a_sentence_that_starts_with_a_table_or_figure_label_is_body() -> None:
    # 2026-11-02 481 页的书第 212 页 "Table 3.17 shows …" 被当成图注，跨页接不上。
    rules, _ = _load_state_module()
    for text in [
        "Table 3.17 shows the calculated and experimental results for the first ionization potential.",
        "Figure 3.12 shows all the orbital energies of water.",
        "Fig. 2 compares the two methods.",
        "Table II lists the parameters.",
    ]:
        assert not rules.starts_like_caption_title(text), text
    for text in [
        "Table 3.17 The lowest ionization potentials (a.u.) of the ten-electron series",
        "Figure 3.11 6-31G** orbital energies of the ten-electron series.",
        "Figure 3.10 Orbital energies of N2",
    ]:
        assert rules.starts_like_caption_title(text), text


def _three_pages(middle: list[dict]) -> list[dict]:
    return [
        _payload_item(item_id="p212-b004", page_idx=211, text="Figure 3.11 shows all the occupied orbitals for this series. The lowest"),
        *middle,
        _payload_item(item_id="p214-b000", page_idx=213, text="molecular orbital is essentially the 1s inner-shell atomic orbital."),
    ]


def test_a_paragraph_continues_over_a_page_of_tables_and_figures() -> None:
    # 第 212 页最后一段翻过一整页的表 3.17、图 3.11（只有图注、脚注）到第 214 页接着写。
    _, state = _load_state_module()
    payload = _three_pages([
        _payload_item(item_id="p213-b000", page_idx=212, text="Table 3.17 The lowest ionization potentials (a.u.) of the ten-electron series"),
        _payload_item(item_id="p213-b004", page_idx=212, text="Figure 3.11 6-31G** orbital energies of the ten-electron series."),
    ])
    state.annotate_continuation_context(payload)
    by_id = {item["item_id"]: item for item in payload}
    assert by_id["p212-b004"]["continuation_group"]
    assert by_id["p212-b004"]["continuation_group"] == by_id["p214-b000"]["continuation_group"]
    assert not by_id["p213-b000"]["continuation_group"]


def test_a_page_with_a_heading_or_body_in_between_breaks_the_paragraph() -> None:
    # 中间是一章的开篇页（标题 + 正文），或者整页不在（没选、没识别出东西）：不接。
    _, state = _load_state_module()
    title = _payload_item(item_id="p213-b000", page_idx=212, text="THE ONE-PARTICLE MANY-BODY GREEN'S FUNCTION")
    title["layout_role"] = "title"
    title["structure_role"] = "document_title"
    title["semantic_role"] = "unknown"
    body = _payload_item(item_id="p213-b001", page_idx=212, text="Green's function techniques are one of the most powerful tools.")
    body["translation_group_strategy"] = "aggregate_geometry"  # 摘要组：不能接续，但它是正文
    for middle in ([title, body], []):
        payload = _three_pages([dict(item) for item in middle])
        state.annotate_continuation_context(payload)
        by_id = {item["item_id"]: item for item in payload}
        assert not by_id["p212-b004"]["continuation_group"], middle

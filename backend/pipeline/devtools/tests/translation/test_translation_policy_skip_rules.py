import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.policy.payload_rules.legacy_policy_mutations import apply_cjk_source_keep_origin
from retainpdf_pipeline.translate.services.policy.payload_rules.policy_mutations import reset_policy_state
from retainpdf_pipeline.translate.services.policy.payload_rules.policy_mutations import apply_title_skip
from retainpdf_pipeline.translate.services.policy.payload_rules.policy_defaults import foundational_skip_defaults
from retainpdf_pipeline.translate.services.policy.config import build_translation_policy_config
from retainpdf_pipeline.translate.services.policy.flow import apply_translation_policies


def _translation_item(**overrides) -> dict:
    source = overrides.pop("source_text", "Body text")
    item = {
        "item_id": "p001-b001",
        "page_idx": 0,
        "block_idx": 1,
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "policy_translate": True,
        "raw_block_type": "text",
        "normalized_sub_type": "",
        "source_text": source,
        "protected_source_text": source,
        "metadata": {"structure_role": "body"},
        "classification_label": "",
        "should_translate": True,
        "skip_reason": "",
        "translation_unit_kind": "single",
        "translation_unit_protected_source_text": source,
        "translation_unit_formula_map": [],
        "formula_map": [],
        "mixed_original_protected_source_text": "",
        "translation_unit_protected_translated_text": "",
        "translation_unit_translated_text": "",
        "protected_translated_text": "",
        "translated_text": "",
        "group_protected_translated_text": "",
        "group_translated_text": "",
        "final_status": "",
        "layout_zone": "",
    }
    item.update(overrides)
    if "protected_source_text" not in overrides:
        item["protected_source_text"] = item["source_text"]
    if "translation_unit_protected_source_text" not in overrides:
        item["translation_unit_protected_source_text"] = item["protected_source_text"]
    return item


def test_foundational_skip_uses_canonical_class_with_legacy_table_parity() -> None:
    canonical = {
        "block_type": "table",
        "block_kind": "table",
        "block_class": "table",
        "raw_block_type": "",
    }
    legacy = {
        "block_type": "table_body",
        "block_kind": "table_body",
        "raw_block_type": "table_body",
        "structure_role": "body",
    }

    assert foundational_skip_defaults(canonical) == ("skip_table_body", "skip_table_body")
    assert foundational_skip_defaults(legacy) == ("skip_table_body", "skip_table_body")


def test_foundational_skip_preserves_legacy_code_reason() -> None:
    canonical = {"block_type": "code", "block_kind": "code", "block_class": "code"}
    legacy = {"block_type": "code_body", "block_kind": "code_body", "raw_block_type": "code_body"}

    assert foundational_skip_defaults(canonical) == ("code", "code")
    assert foundational_skip_defaults(legacy) == ("code", "code")


def test_foundational_skip_does_not_let_stale_table_alias_override_canonical_body() -> None:
    item = _translation_item(
        block_class="body",
        raw_block_type="table_body",
        normalized_sub_type="table_html",
    )

    assert foundational_skip_defaults(item) is None


def _apply_default_policy(payload: list[dict], *, page_idx: int = 0) -> None:
    apply_translation_policies(
        payload=payload,
        mode="sci",
        classify_batch_size=8,
        workers=1,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        skip_title_translation=False,
        page_idx=page_idx,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
        policy_config=build_translation_policy_config(
            mode="sci",
            skip_title_translation=False,
            enable_reference_zone_skip=False,
        ),
    )


def test_apply_title_skip_preserves_source_text_for_render_fallback() -> None:
    payload = [
        _translation_item(
            item_id="p001-b000",
            block_type="title",
            layout_role="title",
            semantic_role="unknown",
            structure_role="title",
            policy_translate=False,
            raw_block_type="title",
            normalized_sub_type="title",
            source_text="Introduction",
            metadata={
                "content_kind": "text",
                "layout_role": "title",
                "semantic_role": "unknown",
                "structure_role": "title",
                "policy_translate": False,
            },
        )
    ]

    skipped = apply_title_skip(payload)

    assert skipped == 1
    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_title"
    assert payload[0]["translated_text"] == "Introduction"
    assert payload[0]["protected_translated_text"] == "Introduction"


def test_apply_translation_policies_translates_title_by_default_with_title_rule_hint() -> None:
    payload = [
        _translation_item(
            item_id="p001-b000",
            block_type="text",
            layout_role="title",
            semantic_role="unknown",
            structure_role="title",
            policy_translate=True,
            raw_block_type="doc_title",
            normalized_sub_type="title",
            source_text="Document Title",
            metadata={
                "layout_role": "title",
                "semantic_role": "unknown",
                "structure_role": "title",
                "policy_translate": True,
            },
        )
    ]

    _apply_default_policy(payload)

    assert payload[0]["should_translate"] is True
    assert payload[0]["skip_reason"] == ""
    assert "Title rule:" in payload[0]["translation_style_hint"]
    assert "document domain" in payload[0]["translation_style_hint"]
    assert "matched terminology" in payload[0]["translation_style_hint"]


def test_apply_translation_policies_treats_abstract_as_body_text() -> None:
    payload = [
        _translation_item(
            item_id="p001-b015",
            block_type="text",
            block_class="title",
            layout_role="paragraph",
            semantic_role="abstract",
            structure_role="body",
            policy_translate=True,
            raw_block_type="abstract",
            normalized_sub_type="body",
            source_text="ABSTRACT: This is ordinary flowing abstract text.",
            metadata={
                "layout_role": "paragraph",
                "semantic_role": "abstract",
                "structure_role": "body",
                "policy_translate": True,
            },
        )
    ]

    assert apply_title_skip(payload) == 0
    _apply_default_policy(payload)

    assert payload[0]["should_translate"] is True
    assert "Title rule:" not in payload[0].get("translation_style_hint", "")


def test_apply_translation_policies_skips_title_when_config_enabled() -> None:
    payload = [
        _translation_item(
            item_id="p001-b000",
            block_type="text",
            layout_role="title",
            semantic_role="unknown",
            structure_role="title",
            policy_translate=True,
            raw_block_type="doc_title",
            normalized_sub_type="title",
            source_text="Document Title",
            metadata={
                "layout_role": "title",
                "semantic_role": "unknown",
                "structure_role": "title",
                "policy_translate": True,
            },
        )
    ]

    apply_translation_policies(
        payload=payload,
        mode="sci",
        classify_batch_size=8,
        workers=1,
        api_key="",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        skip_title_translation=True,
        page_idx=0,
        sci_cutoff_page_idx=None,
        sci_cutoff_block_idx=None,
    )

    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_title"
    assert payload[0]["translated_text"] == "Document Title"


def test_apply_cjk_source_keep_origin_skips_cjk_body_text() -> None:
    cjk_text = "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。"
    payload = [_translation_item(item_id="p036-b015", page_idx=35, block_idx=15, source_text=cjk_text)]

    skipped = apply_cjk_source_keep_origin(payload)

    assert skipped == 1
    assert payload[0]["classification_label"] == "skip_cjk_source_body"
    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_cjk_source_body"
    assert payload[0]["translated_text"] == cjk_text
    assert payload[0]["protected_translated_text"] == cjk_text
    assert payload[0]["final_status"] == "kept_origin"


def test_apply_translation_policies_does_not_skip_cjk_body_text_by_default() -> None:
    cjk_text = "综上，本文系统综述了DFT计算在光催化领域中的广泛应用，并为未来开发高效稳定催化剂提供参考。"
    payload = [_translation_item(item_id="p001-b000", block_idx=0, source_text=cjk_text)]

    _apply_default_policy(payload)

    assert payload[0]["should_translate"] is True
    assert payload[0]["skip_reason"] == ""
    assert payload[0]["classification_label"] == ""


def test_reset_policy_state_skips_table_body_by_default() -> None:
    payload = [
        _translation_item(
            item_id="p004-b003",
            page_idx=3,
            block_idx=3,
            block_type="table_body",
            block_kind="table_body",
            layout_role="",
            semantic_role="",
            structure_role="",
            policy_translate=None,
            raw_block_type="table_body",
            source_text="<table><tr><td>Indigo</td><td>Absorption</td></tr></table>",
            metadata={"structure_role": "body", "normalized_sub_type": "table_html"},
            final_status="translated",
            layout_zone="non_flow",
        )
    ]

    reset_policy_state(payload)

    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_table_body"
    assert payload[0]["classification_label"] == "skip_table_body"
    assert payload[0]["final_status"] == "kept_origin"


def test_reset_policy_state_skips_non_body_text_blocks_by_default() -> None:
    payload = [
        _translation_item(
            item_id="p004-b002",
            page_idx=3,
            block_idx=2,
            block_type="table_caption",
            block_kind="table_caption",
            layout_role="caption",
            semantic_role="caption",
            structure_role="table_caption",
            policy_translate=False,
            raw_block_type="table_caption",
            normalized_sub_type="table_caption",
            source_text="Table 1 Calculation results",
            metadata={"structure_role": "table_caption", "normalized_sub_type": "table_caption"},
            layout_zone="non_flow",
        ),
        _translation_item(
            item_id="p005-b004",
            page_idx=4,
            block_idx=4,
            block_type="table_footnote",
            block_kind="table_footnote",
            layout_role="caption",
            semantic_role="",
            structure_role="table_footnote",
            policy_translate=False,
            raw_block_type="table_footnote",
            normalized_sub_type="table_footnote",
            source_text="Absorption and emission transitions are also shown.",
            metadata={"structure_role": "table_footnote", "normalized_sub_type": "table_footnote"},
            layout_zone="non_flow",
        ),
        _translation_item(
            item_id="p005-b005",
            page_idx=4,
            block_idx=5,
            layout_role="",
            semantic_role="",
            structure_role="header",
            policy_translate=False,
            normalized_sub_type="header",
            source_text="Journal of Fluorescence 2024, 19, 100-110",
            metadata={"structure_role": "header", "normalized_sub_type": "header"},
            layout_zone="non_flow",
        ),
    ]

    reset_policy_state(payload)

    assert [(item["should_translate"], item["skip_reason"], item["classification_label"]) for item in payload] == [
        (False, "skip_table_caption", "skip_table_caption"),
        (False, "skip_table_footnote", "skip_table_footnote"),
        (False, "skip_text", "skip_text"),
    ]


def test_apply_translation_policies_translates_figure_caption_by_default() -> None:
    payload = [
        _translation_item(
            item_id="p004-b002",
            page_idx=3,
            block_idx=2,
            layout_role="caption",
            semantic_role="caption",
            structure_role="figure_caption",
            raw_block_type="text",
            normalized_sub_type="figure_caption",
            source_text="Figure 3: Overall pipeline.",
            metadata={"structure_role": "figure_caption", "normalized_sub_type": "figure_caption"},
            layout_zone="non_flow",
        )
    ]

    _apply_default_policy(payload, page_idx=3)

    assert payload[0]["should_translate"] is True
    assert payload[0]["skip_reason"] == ""
    assert payload[0]["classification_label"] == ""

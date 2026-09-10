import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.classification.rule_engine import should_include
from retainpdf_pipeline.translate.services.policy.payload_rules.policy_mutations import apply_classification_labels


def test_apply_classification_labels_marks_model_no_trans_as_keep_origin() -> None:
    payload = [
        {
            "item_id": "p008-b005",
            "block_type": "text",
            "block_kind": "text",
            "source_text": "|- POSCAR\n|- info.json\n|- overlap.h5",
            "protected_source_text": "|- POSCAR\n|- info.json\n|- overlap.h5",
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "translation_unit_protected_translated_text": "旧译文",
            "translation_unit_translated_text": "旧译文",
            "protected_translated_text": "旧译文",
            "translated_text": "旧译文",
            "group_protected_translated_text": "旧译文",
            "group_translated_text": "旧译文",
            "final_status": "",
        }
    ]

    classified = apply_classification_labels(payload, {"p008-b005": "code"})

    assert classified == 1
    assert payload[0]["classification_label"] == "skip_model_keep_origin"
    assert payload[0]["should_translate"] is False
    assert payload[0]["skip_reason"] == "skip_model_keep_origin"
    assert payload[0]["translated_text"] == ""
    assert payload[0]["final_status"] == "kept_origin"


def test_apply_classification_labels_does_not_skip_translatable_figure_caption() -> None:
    payload = [
        {
            "item_id": "p003-b004",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "caption",
            "semantic_role": "metadata",
            "structure_role": "figure_caption",
            "policy_translate": True,
            "raw_block_type": "text",
            "normalized_sub_type": "figure_caption",
            "source_text": "FIG. 2 (color online). Temperature weighted scattering function vs energy.",
            "protected_source_text": "FIG. 2 (color online). Temperature weighted scattering function vs energy.",
            "metadata": {"structure_role": "figure_caption", "policy_translate": True},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "final_status": "",
        }
    ]

    classified = apply_classification_labels(payload, {"p003-b004": "no_trans"})

    assert classified == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""
    assert payload[0]["skip_reason"] == ""


def test_apply_classification_labels_does_not_skip_long_body_text() -> None:
    source = (
        "The analysis of the spectrum as a function of the temperature allows more insight into "
        "the formation of spin wave excitations and their temperature-dependent linewidths across "
        "multiple reciprocal-space positions."
    )
    payload = [
        {
            "item_id": "p002-b010",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": source,
            "protected_source_text": source,
            "metadata": {"structure_role": "body", "policy_translate": True},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "final_status": "",
        }
    ]

    classified = apply_classification_labels(payload, {"p002-b010": "no_trans"})

    assert classified == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""


def test_apply_classification_labels_does_not_skip_body_continuation_fragment() -> None:
    payload = [
        {
            "item_id": "p005-b002",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": "and nuclear attraction elements",
            "protected_source_text": "and nuclear attraction elements",
            "metadata": {"structure_role": "body", "policy_translate": True},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "final_status": "",
            "continuation_group": "cg-004-002",
        }
    ]

    classified = apply_classification_labels(payload, {"p005-b002": "no_trans"})

    assert classified == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""


def test_apply_classification_labels_does_not_skip_short_body_connector() -> None:
    payload = [
        {
            "item_id": "p005-b008",
            "block_type": "text",
            "block_kind": "text",
            "layout_role": "paragraph",
            "semantic_role": "body",
            "structure_role": "body",
            "policy_translate": True,
            "source_text": "and",
            "protected_source_text": "and",
            "metadata": {"structure_role": "body", "policy_translate": True},
            "classification_label": "",
            "should_translate": True,
            "skip_reason": "",
            "final_status": "",
        }
    ]

    classified = apply_classification_labels(payload, {"p005-b008": "no_trans"})

    assert classified == 0
    assert payload[0]["should_translate"] is True
    assert payload[0]["classification_label"] == ""


def test_no_trans_classifier_excludes_long_body_candidates() -> None:
    item = {
        "item_id": "p002-b010",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "should_translate": True,
        "classification_label": "",
        "source_text": (
            "The analysis of the spectrum as a function of the temperature allows more insight into "
            "the formation of spin wave excitations and their temperature-dependent linewidths across "
            "multiple reciprocal-space positions."
        ),
    }

    assert should_include(item) is False


def test_no_trans_classifier_excludes_body_continuation_fragment() -> None:
    item = {
        "item_id": "p005-b002",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "should_translate": True,
        "classification_label": "",
        "source_text": "and nuclear attraction elements",
        "continuation_group": "cg-004-002",
    }

    assert should_include(item) is False


def test_no_trans_classifier_excludes_short_body_connector() -> None:
    item = {
        "item_id": "p005-b008",
        "block_type": "text",
        "block_kind": "text",
        "layout_role": "paragraph",
        "semantic_role": "body",
        "structure_role": "body",
        "should_translate": True,
        "classification_label": "",
        "source_text": "and",
    }

    assert should_include(item) is False

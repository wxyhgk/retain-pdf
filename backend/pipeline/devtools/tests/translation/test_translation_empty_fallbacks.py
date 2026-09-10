import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.llm.shared.orchestration.common import should_keep_origin_on_empty_translation
from retainpdf_pipeline.translate.llm.shared.orchestration.intentional_keep_origin import (
    keep_origin_payload_for_empty_translation,
)


def test_short_non_body_empty_translation_degrades_to_keep_origin() -> None:
    payload = keep_origin_payload_for_empty_translation(
        {
            "item_id": "p012-b022",
            "page_idx": 11,
            "block_type": "image_caption",
            "layout_zone": "non_flow",
            "metadata": {"structure_role": "caption"},
        }
    )

    assert payload["p012-b022"]["decision"] == "keep_origin"
    assert payload["p012-b022"]["final_status"] == "kept_origin"
    assert (
        payload["p012-b022"]["translation_diagnostics"]["degradation_reason"]
        == "empty_translation_non_body_label"
    )


def test_empty_translation_body_biography_does_not_keep_origin() -> None:
    assert not should_keep_origin_on_empty_translation(
        {
            "item_id": "p011-b017",
            "page_idx": 10,
            "block_type": "text",
            "metadata": {"structure_role": "body"},
            "translation_unit_protected_source_text": (
                "Samantha A. Green received her B.S. from Emory University in 2013, conducting research under "
                "Professor Huw Davies, after which she completed a postbaccalaureate fellowship at the NIH under "
                "Dr. Marta Catalfamo. Currently she is a graduate student in the Shenvi research group at The "
                "Scripps Research Institute investigating new MHAT methods."
            ),
        }
    )

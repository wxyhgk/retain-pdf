import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.policy import metadata_filter


def test_editorial_metadata_token_is_not_force_skipped_anymore() -> None:
    assert not metadata_filter.looks_like_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": "CrossMark",
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 0,
            "lines": [{"spans": [{"content": "CrossMark"}]}],
        }
    )


def test_short_first_page_header_fragment_is_not_force_skipped_by_metadata_filter() -> None:
    assert not metadata_filter.looks_like_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": "Energy property",
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 0,
            "bbox": [48, 421, 105, 431],
            "lines": [{"spans": [{"content": "Energy property"}]}],
        }
    )


def test_biography_prose_is_not_treated_as_nontranslatable_metadata() -> None:
    assert not metadata_filter.looks_like_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": (
                "Samantha A. Green received her B.S. from Emory University in 2013, conducting research under "
                "Professor Huw Davies, after which she completed a postbaccalaureate fellowship at the NIH under "
                "Dr. Marta Catalfamo. Currently she is a graduate student in the Shenvi research group at The "
                "Scripps Research Institute investigating new MHAT methods."
            ),
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 10,
            "lines": [{"spans": [{"content": "bio"}]}],
        }
    )


def test_biography_prose_is_not_treated_as_safe_nontranslatable_metadata() -> None:
    assert not metadata_filter.looks_like_safe_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": (
                "Samantha A. Green received her B.S. from Emory University in 2013, conducting research under "
                "Professor Huw Davies, after which she completed a postbaccalaureate fellowship at the NIH under "
                "Dr. Marta Catalfamo. Currently she is a graduate student in the Shenvi research group at The "
                "Scripps Research Institute investigating new MHAT methods."
            ),
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 10,
            "lines": [{"spans": [{"content": "bio"}]}],
        }
    )


def test_author_list_is_not_force_skipped_by_metadata_filter() -> None:
    assert not metadata_filter.looks_like_safe_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": "John A. Smith, Jane B. Doe, Alan C. Brown†, Maria D. White*",
            "should_translate": True,
            "metadata": {"structure_role": "metadata"},
            "page_idx": 0,
            "lines": [{"spans": [{"content": "authors"}]}],
        }
    )


def test_pure_email_fragment_is_treated_as_safe_nontranslatable_metadata() -> None:
    assert metadata_filter.looks_like_safe_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": "author@example.edu",
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 0,
            "lines": [{"spans": [{"content": "author@example.edu"}]}],
        }
    )


def test_short_copyright_tail_is_treated_as_safe_nontranslatable_metadata() -> None:
    assert metadata_filter.looks_like_safe_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": "© UBS 2026. The key symbol and UBS are among the registered and unregistered trademarks of UBS. All rights reserved.",
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 22,
            "lines": [{"spans": [{"content": "copyright"}]}],
        }
    )


def test_long_disclaimer_with_all_rights_reserved_is_not_treated_as_hard_metadata() -> None:
    assert not metadata_filter.looks_like_hard_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": (
                "UBS specifically prohibits the redistribution of this document in whole or in part without the written permission of UBS "
                "and in any event UBS accepts no liability whatsoever for any redistribution of this document or its contents or the "
                "actions of third parties in this respect. Images may depict objects or elements that are protected by third party "
                "copyright, trademarks and other intellectual property rights. © UBS 2026. The key symbol and UBS are among the "
                "registered and unregistered trademarks of UBS. All rights reserved."
            ),
            "should_translate": True,
            "metadata": {"structure_role": "body"},
            "page_idx": 18,
            "lines": [{"spans": [{"content": "disclaimer"}]}],
        }
    )


def test_section_symbol_body_text_is_not_treated_as_author_metadata() -> None:
    assert not metadata_filter.looks_like_safe_nontranslatable_metadata(
        {
            "block_type": "text",
            "source_text": (
                "To overcome these challenges, we propose a simple adaptation approach that bridges these "
                "discrepancies. We unify their modeling objectives (§3.2) and address the architectural "
                "differences by breaking the causal masking bias in AR models through attention mask annealing (§3.3)."
            ),
            "should_translate": True,
            "metadata": {"structure_role": "body", "normalized_sub_type": "body", "ocr_sub_type": "body"},
            "page_idx": 1,
            "lines": [{"spans": [{"content": "body"}]}],
        }
    )

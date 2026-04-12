"""Policy subsystem for translation payload filtering and mode control."""

from services.translation.policy.body_text_filter import find_narrow_body_noise_item_ids
from services.translation.policy.config import TranslationPolicyConfig
from services.translation.policy.config import build_book_translation_policy_config
from services.translation.policy.config import build_translation_policy_config
from services.translation.policy.config import extract_ocr_preview_text
from services.translation.policy.config import should_apply_after_last_title_cutoff
from services.translation.policy.config import should_apply_reference_tail_skip
from services.translation.policy.config import should_apply_candidate_continuation_review
from services.translation.policy.config import should_apply_metadata_fragment_skip
from services.translation.policy.config import should_apply_narrow_body_noise_skip
from services.translation.policy.config import should_apply_reference_zone_skip
from services.translation.policy.config import should_infer_domain_context
from services.translation.policy.config import should_skip_title_translation
from services.translation.policy.metadata_filter import find_metadata_fragment_item_ids
from services.translation.policy.reference_section import resolve_reference_cutoff
from services.translation.policy.metadata_filter import should_skip_metadata_fragment

__all__ = [
    "TranslationPolicyConfig",
    "apply_translation_policies",
    "build_book_translation_policy_config",
    "build_translation_policy_config",
    "extract_ocr_preview_text",
    "find_metadata_fragment_item_ids",
    "find_narrow_body_noise_item_ids",
    "resolve_reference_cutoff",
    "should_apply_after_last_title_cutoff",
    "should_apply_reference_tail_skip",
    "should_apply_candidate_continuation_review",
    "should_apply_metadata_fragment_skip",
    "should_apply_narrow_body_noise_skip",
    "should_apply_reference_zone_skip",
    "should_infer_domain_context",
    "should_skip_metadata_fragment",
    "should_skip_title_translation",
]


def __getattr__(name: str):
    if name == "apply_translation_policies":
        from services.translation.policy.flow import apply_translation_policies

        return apply_translation_policies
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

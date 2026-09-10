from __future__ import annotations

import re

from retainpdf_pipeline.translate.core.item_reader import item_is_reference_compatible
from retainpdf_pipeline.translate.services.policy.literal_block_rules import shared_literal_block_label
from retainpdf_pipeline.translate.services.policy.metadata_filter import find_metadata_fragment_item_ids
from retainpdf_pipeline.translate.services.policy.soft_hints import natural_word_count

from .legacy_policy_checks import NUMBERED_REFERENCE_ENTRY_RE
from .legacy_policy_checks import NUMBERED_SUMMARY_RE
from .legacy_policy_checks import REFERENCE_ENTRY_RE
from .legacy_policy_checks import english_words
from .legacy_policy_checks import looks_like_cjk_dominant_body_text
from .legacy_policy_checks import prose_cue_match
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_policy_skip
from retainpdf_pipeline.translate.core.payload.parts.policy_state import mark_translation_required
from retainpdf_pipeline.translate.core.payload.parts.policy_state import preserve_source_as_translation


def _is_ref_text_like(item: dict) -> bool:
    return item_is_reference_compatible(item)



def apply_cjk_source_keep_origin(payload: list[dict]) -> int:
    skipped = 0
    for item in payload:
        if not item.get("should_translate", True):
            continue
        if not looks_like_cjk_dominant_body_text(item):
            continue
        mark_policy_skip(item, "skip_cjk_source_body")
        preserve_source_as_translation(item)
        skipped += 1
    return skipped


def apply_shared_literal_block_policy(payload: list[dict]) -> dict[str, int]:
    code_skipped = 0
    translate_forced = 0
    for item in payload:
        if not item.get("should_translate", True):
            continue
        label = shared_literal_block_label(item)
        if label == "code":
            mark_policy_skip(item, "code")
            code_skipped += 1
            continue
        if label == "translate_literal":
            mark_translation_required(item, label="translate_literal")
            translate_forced += 1
    return {
        "shared_literal_code_skipped": code_skipped,
        "shared_literal_code_region_skipped": 0,
        "shared_literal_image_region_skipped": 0,
        "shared_literal_translate_forced": translate_forced,
    }


def apply_ref_text_skip(payload: list[dict]) -> int:
    def _should_preserve_ref_text_for_translation(item: dict) -> bool:
        source_text = str(item.get("protected_source_text") or item.get("source_text") or "").strip()
        if not source_text:
            return False
        if REFERENCE_ENTRY_RE.match(source_text):
            return False
        if NUMBERED_REFERENCE_ENTRY_RE.match(source_text):
            return False
        if source_text.lower().startswith(("references", "bibliography")):
            return False
        if " et al." in source_text or re.search(r"\b\d{4}\b", source_text):
            return False
        word_count = len(english_words(source_text))
        if word_count < 12:
            return False
        if NUMBERED_SUMMARY_RE.match(source_text):
            return bool(prose_cue_match(source_text))
        if source_text.endswith((".", "。", "!", "?", ";", "；", ":")) and natural_word_count(source_text) >= 12:
            return True
        return False

    skipped = 0
    for item in payload:
        if not _is_ref_text_like(item):
            continue
        if not item.get("should_translate", True):
            continue
        if _should_preserve_ref_text_for_translation(item):
            continue
        mark_policy_skip(item, "skip_ref_text")
        skipped += 1
    return skipped


def apply_metadata_fragment_skip(payload: list[dict], *, page_idx: int, max_page_idx: int) -> int:
    if page_idx > max_page_idx:
        return 0
    skip_ids = find_metadata_fragment_item_ids(payload)
    if not skip_ids:
        return 0
    skipped = 0
    for item in payload:
        item_id = item.get("item_id", "")
        if item_id not in skip_ids:
            continue
        if not item.get("should_translate", True):
            continue
        mark_policy_skip(item, "skip_metadata_fragment")
        skipped += 1
    return skipped


__all__ = [
    "apply_cjk_source_keep_origin",
    "apply_metadata_fragment_skip",
    "apply_ref_text_skip",
    "apply_shared_literal_block_policy",
    "looks_like_cjk_dominant_body_text",
]

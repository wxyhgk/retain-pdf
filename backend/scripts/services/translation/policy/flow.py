from __future__ import annotations

from services.translation.payload import ops as payload_ops
from services.translation.policy.config import TranslationPolicyConfig
from services.translation.policy.config import build_translation_policy_config

def _load_classifier():
    try:
        from services.translation.classification.page_classifier import classify_payload_items

        return classify_payload_items
    except Exception:
        from services.translation.classification.page_classifier import classify_payload_items

        return classify_payload_items


def apply_translation_policies(
    *,
    payload: list[dict],
    mode: str,
    classify_batch_size: int,
    workers: int,
    api_key: str,
    model: str,
    base_url: str,
    skip_title_translation: bool,
    page_idx: int,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
) -> tuple[int, dict[str, int]]:
    classify_payload_items = _load_classifier()

    if policy_config is None:
        policy_config = build_translation_policy_config(
            mode=mode,
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
        )

    payload_ops.reset_policy_state(payload)
    classified_items = 0
    ref_text_skipped = payload_ops.apply_ref_text_skip(payload)
    reference_zone_skipped = (
        payload_ops.apply_reference_zone_skip(
            payload,
            page_idx=page_idx,
            cutoff_page_idx=policy_config.sci_cutoff_page_idx,
            cutoff_block_idx=policy_config.sci_cutoff_block_idx,
        )
        if policy_config.enable_reference_zone_skip
        else 0
    )
    shared_literal_summary = payload_ops.apply_shared_literal_block_policy(payload)
    mixed_literal_summary = payload_ops.apply_mixed_literal_split_policy(
        payload,
        api_key=api_key,
        model=model,
        base_url=base_url,
        workers=max(1, workers),
        rule_guidance=policy_config.rule_guidance,
    )
    metadata_fragment_skipped = (
        payload_ops.apply_metadata_fragment_skip(
            payload,
            page_idx=page_idx,
            max_page_idx=policy_config.metadata_fragment_max_page_idx,
        )
        if policy_config.enable_metadata_fragment_skip
        else 0
    )
    narrow_body_skipped = 0
    skip_summary = {
        "title_skipped": 0,
        "reference_tail_skipped": 0,
        "tail_skipped": 0,
        "ref_text_skipped": ref_text_skipped,
        "reference_zone_skipped": reference_zone_skipped,
        "narrow_body_skipped": narrow_body_skipped,
        "metadata_fragment_skipped": metadata_fragment_skipped,
        "shared_literal_code_skipped": shared_literal_summary["shared_literal_code_skipped"],
        "shared_literal_code_region_skipped": shared_literal_summary["shared_literal_code_region_skipped"],
        "shared_literal_image_region_skipped": shared_literal_summary["shared_literal_image_region_skipped"],
        "shared_literal_translate_forced": shared_literal_summary["shared_literal_translate_forced"],
        "mixed_keep_all": mixed_literal_summary["mixed_keep_all"],
        "mixed_translate_all": mixed_literal_summary["mixed_translate_all"],
        "mixed_translate_tail": mixed_literal_summary["mixed_translate_tail"],
    }

    if policy_config.mode == "precise":
        labels = classify_payload_items(
            payload,
            api_key=api_key,
            model=model,
            base_url=base_url,
            batch_size=classify_batch_size,
            rule_guidance=policy_config.rule_guidance,
            request_label=f"classification page {page_idx + 1}",
        )
        classified_items = payload_ops.apply_classification_labels(payload, labels)

    if policy_config.enable_reference_tail_skip:
        title_skipped = payload_ops.apply_title_skip(payload)
        reference_tail_skipped = payload_ops.apply_reference_tail_skip(
            payload,
            page_idx=page_idx,
            cutoff_page_idx=policy_config.sci_cutoff_page_idx,
            cutoff_block_idx=policy_config.sci_cutoff_block_idx,
        )
        skip_summary = {
            "title_skipped": title_skipped,
            "reference_tail_skipped": reference_tail_skipped,
            "tail_skipped": reference_tail_skipped,
            "ref_text_skipped": ref_text_skipped,
            "reference_zone_skipped": reference_zone_skipped,
            "narrow_body_skipped": narrow_body_skipped,
            "metadata_fragment_skipped": metadata_fragment_skipped,
            "shared_literal_code_skipped": shared_literal_summary["shared_literal_code_skipped"],
            "shared_literal_code_region_skipped": shared_literal_summary["shared_literal_code_region_skipped"],
            "shared_literal_image_region_skipped": shared_literal_summary["shared_literal_image_region_skipped"],
            "shared_literal_translate_forced": shared_literal_summary["shared_literal_translate_forced"],
            "mixed_keep_all": mixed_literal_summary["mixed_keep_all"],
            "mixed_translate_all": mixed_literal_summary["mixed_translate_all"],
            "mixed_translate_tail": mixed_literal_summary["mixed_translate_tail"],
        }
    elif policy_config.enable_title_skip:
        skip_summary = {
            "title_skipped": payload_ops.apply_title_skip(payload),
            "reference_tail_skipped": 0,
            "tail_skipped": 0,
            "ref_text_skipped": ref_text_skipped,
            "reference_zone_skipped": reference_zone_skipped,
            "narrow_body_skipped": skip_summary["narrow_body_skipped"],
            "metadata_fragment_skipped": metadata_fragment_skipped,
            "shared_literal_code_skipped": shared_literal_summary["shared_literal_code_skipped"],
            "shared_literal_code_region_skipped": shared_literal_summary["shared_literal_code_region_skipped"],
            "shared_literal_image_region_skipped": shared_literal_summary["shared_literal_image_region_skipped"],
            "shared_literal_translate_forced": shared_literal_summary["shared_literal_translate_forced"],
            "mixed_keep_all": mixed_literal_summary["mixed_keep_all"],
            "mixed_translate_all": mixed_literal_summary["mixed_translate_all"],
            "mixed_translate_tail": mixed_literal_summary["mixed_translate_tail"],
        }

    return classified_items, skip_summary


__all__ = ["apply_translation_policies"]

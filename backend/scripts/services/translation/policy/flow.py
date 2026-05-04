from __future__ import annotations

from services.translation.context import TranslationDocumentContext
from services.translation.payload import ops as payload_ops
from services.translation.policy.config import TranslationPolicyConfig
from services.translation.policy.config import build_translation_policy_config
from services.translation.policy.planner import TranslationPlanner


def _build_skip_summary(
    *,
    title_skipped: int,
    reference_tail_skipped: int,
) -> dict[str, int]:
    return {
        "title_skipped": title_skipped,
        "reference_tail_skipped": reference_tail_skipped,
        "tail_skipped": reference_tail_skipped,
        "ref_text_skipped": 0,
        "reference_zone_skipped": 0,
        # Deprecated compatibility field. Narrow-body skip logic is disabled.
        "narrow_body_skipped": 0,
        "metadata_fragment_skipped": 0,
        "shared_literal_code_skipped": 0,
        "shared_literal_code_region_skipped": 0,
        "shared_literal_image_region_skipped": 0,
        "shared_literal_translate_forced": 0,
        "mixed_keep_all": 0,
        "mixed_translate_all": 0,
        "mixed_translate_tail": 0,
    }


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
    if policy_config is None:
        policy_config = build_translation_policy_config(
            mode=mode,
            skip_title_translation=skip_title_translation,
            sci_cutoff_page_idx=sci_cutoff_page_idx,
            sci_cutoff_block_idx=sci_cutoff_block_idx,
        )

    payload_ops.reset_policy_state(payload)
    classified_items = 0
    skip_summary = _build_skip_summary(
        title_skipped=0,
        reference_tail_skipped=0,
    )

    if policy_config.enable_page_no_trans_classification:
        try:
            planner = TranslationPlanner(
                TranslationDocumentContext(
                    mode=mode,
                    rule_guidance=policy_config.rule_guidance,
                )
            )
            labels = planner.classify_no_trans(
                payload,
                api_key=api_key,
                model=model,
                base_url=base_url,
                batch_size=classify_batch_size,
                request_label=f"classification page {page_idx + 1}",
            )
        except Exception as exc:
            print(
                f"classification page {page_idx + 1}: skipped after {type(exc).__name__}: {exc}",
                flush=True,
            )
            labels = {}
        classified_items = payload_ops.apply_classification_labels(payload, labels)

    if policy_config.enable_reference_tail_skip:
        title_skipped = payload_ops.apply_title_skip(payload)
        reference_tail_skipped = payload_ops.apply_reference_tail_skip(
            payload,
            page_idx=page_idx,
            cutoff_page_idx=policy_config.sci_cutoff_page_idx,
            cutoff_block_idx=policy_config.sci_cutoff_block_idx,
        )
        skip_summary = _build_skip_summary(
            title_skipped=title_skipped,
            reference_tail_skipped=reference_tail_skipped,
        )
    elif policy_config.enable_title_skip:
        skip_summary = _build_skip_summary(
            title_skipped=payload_ops.apply_title_skip(payload),
            reference_tail_skipped=0,
        )

    return classified_items, skip_summary


__all__ = ["apply_translation_policies"]

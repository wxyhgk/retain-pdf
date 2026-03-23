from __future__ import annotations

from importlib import util
from pathlib import Path

from translation.policy.config import TranslationPolicyConfig
from translation.policy.config import build_translation_policy_config


_TRANSLATION_DIR = Path(__file__).resolve().parents[1]


def _load_module_from_path(module_name: str, relative_path: str):
    module_path = _TRANSLATION_DIR / relative_path
    spec = util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {module_name} from {module_path}")
    module = util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_payload_ops():
    for module_name, relative_path in (
        ("translation.payload_ops", "payload_ops.py"),
        ("translation.payload.ops", "payload/ops.py"),
    ):
        try:
            if module_name == "translation.payload_ops":
                from translation import payload_ops as module  # type: ignore
                return module
            return _load_module_from_path(module_name, relative_path)
        except Exception:
            continue
    raise ImportError("Unable to load payload operation helpers.")


def _load_classifier():
    try:
        from translation.classification.page_classifier import classify_payload_items

        return classify_payload_items
    except Exception:
        module = _load_module_from_path("translation.classification.page_classifier", "classification/page_classifier.py")
        return module.classify_payload_items


def apply_translation_policies(
    *,
    payload: list[dict],
    mode: str,
    classify_batch_size: int,
    api_key: str,
    model: str,
    base_url: str,
    skip_title_translation: bool,
    page_idx: int,
    sci_cutoff_page_idx: int | None,
    sci_cutoff_block_idx: int | None,
    policy_config: TranslationPolicyConfig | None = None,
) -> tuple[int, dict[str, int]]:
    payload_ops = _load_payload_ops()
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
    metadata_fragment_skipped = (
        payload_ops.apply_metadata_fragment_skip(
            payload,
            page_idx=page_idx,
            max_page_idx=policy_config.metadata_fragment_max_page_idx,
        )
        if policy_config.enable_metadata_fragment_skip
        else 0
    )
    narrow_body_skipped = payload_ops.apply_narrow_body_text_skip(payload) if policy_config.enable_narrow_body_noise_skip else 0
    skip_summary = {
        "title_skipped": 0,
        "tail_skipped": 0,
        "narrow_body_skipped": narrow_body_skipped,
        "metadata_fragment_skipped": metadata_fragment_skipped,
    }

    if policy_config.mode == "precise":
        labels = classify_payload_items(
            payload,
            api_key=api_key,
            model=model,
            base_url=base_url,
            batch_size=classify_batch_size,
        )
        classified_items = payload_ops.apply_classification_labels(payload, labels)

    if policy_config.enable_after_last_title_cutoff:
        title_skipped = payload_ops.apply_title_skip(payload)
        tail_skipped = payload_ops.apply_after_last_title_skip(
            payload,
            page_idx=page_idx,
            cutoff_page_idx=policy_config.sci_cutoff_page_idx,
            cutoff_block_idx=policy_config.sci_cutoff_block_idx,
        )
        skip_summary = {
            "title_skipped": title_skipped,
            "tail_skipped": tail_skipped,
            "narrow_body_skipped": narrow_body_skipped,
            "metadata_fragment_skipped": metadata_fragment_skipped,
        }
    elif policy_config.enable_title_skip:
        skip_summary = {
            "title_skipped": payload_ops.apply_title_skip(payload),
            "tail_skipped": 0,
            "narrow_body_skipped": skip_summary["narrow_body_skipped"],
            "metadata_fragment_skipped": metadata_fragment_skipped,
        }

    return classified_items, skip_summary


__all__ = ["apply_translation_policies"]

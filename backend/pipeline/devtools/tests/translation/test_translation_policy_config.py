from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.translate.services.policy.config import build_translation_policy_config


def test_policy_config_defaults_keep_legacy_skip_rules_disabled() -> None:
    config = build_translation_policy_config(mode="sci", skip_title_translation=False)

    assert config.enable_narrow_body_noise_skip is False
    assert config.enable_metadata_fragment_skip is False


def test_policy_config_honors_explicit_true_skip_rule_overrides() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_narrow_body_noise_skip=True,
        enable_metadata_fragment_skip=True,
    )

    assert config.enable_narrow_body_noise_skip is True
    assert config.enable_metadata_fragment_skip is True


def test_policy_config_honors_explicit_false_skip_rule_overrides() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_narrow_body_noise_skip=False,
        enable_metadata_fragment_skip=False,
    )

    assert config.enable_narrow_body_noise_skip is False
    assert config.enable_metadata_fragment_skip is False


def test_policy_config_mixes_override_and_default_skip_rule_values() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_narrow_body_noise_skip=True,
    )

    assert config.enable_narrow_body_noise_skip is True
    assert config.enable_metadata_fragment_skip is False


def test_policy_config_keeps_metadata_fragment_page_idx_contract() -> None:
    default_config = build_translation_policy_config(mode="sci", skip_title_translation=False)
    overridden_config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        metadata_fragment_max_page_idx=3,
    )

    assert default_config.metadata_fragment_max_page_idx == 8
    assert overridden_config.metadata_fragment_max_page_idx == 3


def test_policy_config_honors_skip_title_translation_false() -> None:
    config = build_translation_policy_config(mode="sci", skip_title_translation=False)
    assert config.enable_title_skip is False


def test_policy_config_honors_skip_title_translation_true() -> None:
    config = build_translation_policy_config(mode="sci", skip_title_translation=True)
    assert config.enable_title_skip is True


def test_policy_config_keeps_page_no_trans_classification_opt_in() -> None:
    sci_config = build_translation_policy_config(mode="sci", skip_title_translation=False)
    precise_config = build_translation_policy_config(mode="precise", skip_title_translation=False)
    fast_config = build_translation_policy_config(mode="fast", skip_title_translation=False)

    assert sci_config.enable_page_no_trans_classification is False
    assert precise_config.enable_page_no_trans_classification is False
    assert fast_config.enable_page_no_trans_classification is False


def test_policy_config_honors_page_no_trans_classification_override() -> None:
    config = build_translation_policy_config(
        mode="sci",
        skip_title_translation=False,
        enable_page_no_trans_classification=False,
    )

    assert config.enable_page_no_trans_classification is False

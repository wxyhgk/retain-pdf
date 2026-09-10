from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

from retainpdf_pipeline.translate.llm.shared.provider_runtime import ACTIVE_PROVIDER
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import PROVIDER_CAPABILITIES
from retainpdf_pipeline.translate.llm.shared.provider_registry import resolve_active_provider_runtime


def test_active_provider_runtime_uses_deepseek_v4_flash_default() -> None:
    runtime = resolve_active_provider_runtime()

    assert ACTIVE_PROVIDER == "deepseek"
    assert runtime.provider_id == "deepseek"
    assert DEFAULT_MODEL == "deepseek-v4-flash"
    assert runtime.default_model == "deepseek-v4-flash"
    assert DEFAULT_BASE_URL == "https://api.deepseek.com/v1"


def test_provider_runtime_declares_translation_capabilities() -> None:
    runtime = resolve_active_provider_runtime()

    assert runtime.capabilities == PROVIDER_CAPABILITIES
    assert runtime.capabilities.plain_text is True
    assert runtime.capabilities.unstructured_plain_text is True
    assert runtime.capabilities.tagged_text is True
    assert runtime.capabilities.structured_decision is True
    assert runtime.capabilities.batch_once is True

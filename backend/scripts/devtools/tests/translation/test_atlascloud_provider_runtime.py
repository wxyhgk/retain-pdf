from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

import pytest

from services.translation.llm.shared.provider_registry import ATLASCLOUD_RUNTIME
from services.translation.llm.shared.provider_registry import DEEPSEEK_RUNTIME
from services.translation.llm.shared.provider_registry import DEFAULT_PROVIDER_ID
from services.translation.llm.shared.provider_registry import PROVIDER_SELECTION_ENV
from services.translation.llm.shared.provider_registry import resolve_active_provider_runtime


def test_default_provider_selection_stays_deepseek(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(PROVIDER_SELECTION_ENV, raising=False)
    runtime = resolve_active_provider_runtime()
    assert DEFAULT_PROVIDER_ID == "deepseek"
    assert runtime.provider_id == "deepseek"


def test_atlascloud_runtime_declares_openai_compatible_defaults() -> None:
    assert ATLASCLOUD_RUNTIME.provider_id == "atlascloud"
    assert ATLASCLOUD_RUNTIME.provider_family == "openai_compatible"
    assert ATLASCLOUD_RUNTIME.default_base_url == "https://api.atlascloud.ai/v1"
    assert ATLASCLOUD_RUNTIME.default_model == "deepseek-ai/deepseek-v4-pro"
    assert ATLASCLOUD_RUNTIME.default_api_key_env == "ATLASCLOUD_API_KEY"


def test_atlascloud_reuses_shared_openai_compatible_transport() -> None:
    # Atlas Cloud is OpenAI-compatible and intentionally reuses the shared
    # transport/translation handlers rather than duplicating them.
    assert ATLASCLOUD_RUNTIME.request_chat_content is DEEPSEEK_RUNTIME.request_chat_content
    assert ATLASCLOUD_RUNTIME.build_headers is DEEPSEEK_RUNTIME.build_headers
    assert ATLASCLOUD_RUNTIME.chat_completions_url is DEEPSEEK_RUNTIME.chat_completions_url
    assert ATLASCLOUD_RUNTIME.normalize_base_url is DEEPSEEK_RUNTIME.normalize_base_url
    assert ATLASCLOUD_RUNTIME.translate_batch_once is DEEPSEEK_RUNTIME.translate_batch_once
    # Credential resolution is provider-specific (different env var / file).
    assert ATLASCLOUD_RUNTIME.get_api_key is not DEEPSEEK_RUNTIME.get_api_key


def test_provider_selection_env_switches_to_atlascloud(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(PROVIDER_SELECTION_ENV, "atlascloud")
    runtime = resolve_active_provider_runtime()
    assert runtime.provider_id == "atlascloud"
    assert runtime is ATLASCLOUD_RUNTIME


def test_provider_selection_env_is_case_insensitive(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(PROVIDER_SELECTION_ENV, "  AtlasCloud  ")
    assert resolve_active_provider_runtime().provider_id == "atlascloud"


def test_unknown_provider_selection_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(PROVIDER_SELECTION_ENV, "does-not-exist")
    with pytest.raises(ValueError):
        resolve_active_provider_runtime()

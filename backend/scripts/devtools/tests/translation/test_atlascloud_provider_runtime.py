from __future__ import annotations

import sys
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))

import pytest
import requests

from services.translation.llm.providers import atlascloud
from services.translation.llm.providers.deepseek.client import is_transport_error
from services.translation.llm.shared.provider_registry import ATLASCLOUD_RUNTIME
from services.translation.llm.shared.provider_registry import DEEPSEEK_RUNTIME
from services.translation.llm.shared.provider_registry import DEFAULT_PROVIDER_ID
from services.translation.llm.shared.provider_registry import PROVIDER_SELECTION_ENV
from services.translation.llm.shared.provider_registry import resolve_active_provider_runtime


def _http_error(status_code: int) -> requests.HTTPError:
    response = requests.Response()
    response.status_code = status_code
    return requests.HTTPError(f"{status_code} error", response=response)


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


# --- Review item 1: third-party API error-code handling --------------------

@pytest.mark.parametrize("status_code", [408, 429, 500, 502, 503, 504])
def test_transient_status_codes_are_retryable(status_code: int) -> None:
    # The shared transport (inherited by Atlas Cloud) retries these codes.
    assert status_code in atlascloud.client.RETRYABLE_STATUS_CODES
    assert is_transport_error(_http_error(status_code)) is True


@pytest.mark.parametrize("status_code", [400, 401, 403, 404, 422])
def test_client_error_status_codes_are_not_retried(status_code: int) -> None:
    assert status_code not in atlascloud.client.RETRYABLE_STATUS_CODES
    assert is_transport_error(_http_error(status_code)) is False


def test_is_rate_limited_detects_429() -> None:
    assert atlascloud.is_rate_limited(_http_error(429)) is True
    assert atlascloud.is_rate_limited(_http_error(502)) is False
    assert atlascloud.is_rate_limited(requests.ConnectionError("boom")) is False


def test_describe_api_error_gives_stable_reason_with_retry_hint() -> None:
    assert "429" in atlascloud.describe_api_error(_http_error(429))
    assert "retryable" in atlascloud.describe_api_error(_http_error(502))
    assert "non-retryable" in atlascloud.describe_api_error(_http_error(401))
    # Transport-level failures (no HTTP response) still classify cleanly.
    assert "network error" in atlascloud.describe_api_error(requests.Timeout("slow"))


# --- Review item 2: usage accounting ---------------------------------------

def test_extract_usage_reads_openai_compatible_usage() -> None:
    usage = atlascloud.extract_usage(
        {"usage": {"prompt_tokens": 9, "completion_tokens": 27, "total_tokens": 36}}
    )
    assert usage == {"prompt_tokens": 9, "completion_tokens": 27, "total_tokens": 36}


def test_extract_usage_backfills_total_when_missing() -> None:
    usage = atlascloud.extract_usage({"usage": {"prompt_tokens": 5, "completion_tokens": 7}})
    assert usage["total_tokens"] == 12


def test_extract_usage_is_safe_when_usage_absent() -> None:
    assert atlascloud.extract_usage({}) == {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    }

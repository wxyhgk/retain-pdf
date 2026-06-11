from __future__ import annotations

import os
from dataclasses import dataclass

from services.translation.llm.providers.atlascloud.client import DEFAULT_API_KEY_ENV as ATLASCLOUD_DEFAULT_API_KEY_ENV
from services.translation.llm.providers.atlascloud.client import DEFAULT_BASE_URL as ATLASCLOUD_DEFAULT_BASE_URL
from services.translation.llm.providers.atlascloud.client import DEFAULT_MODEL as ATLASCLOUD_DEFAULT_MODEL
from services.translation.llm.providers.atlascloud.client import get_api_key as atlascloud_get_api_key
from services.translation.llm.providers.deepseek.client import DEFAULT_API_KEY_ENV as DEEPSEEK_DEFAULT_API_KEY_ENV
from services.translation.llm.providers.deepseek.client import DEFAULT_BASE_URL as DEEPSEEK_DEFAULT_BASE_URL
from services.translation.llm.providers.deepseek.client import DEFAULT_MODEL as DEEPSEEK_DEFAULT_MODEL
from services.translation.llm.providers.deepseek.client import build_headers as deepseek_build_headers
from services.translation.llm.providers.deepseek.client import chat_completions_url as deepseek_chat_completions_url
from services.translation.llm.providers.deepseek.client import get_api_key as deepseek_get_api_key
from services.translation.llm.providers.deepseek.client import get_session as deepseek_get_session
from services.translation.llm.providers.deepseek.client import is_transport_error as deepseek_is_transport_error
from services.translation.llm.providers.deepseek.client import normalize_base_url as deepseek_normalize_base_url
from services.translation.llm.providers.deepseek.client import request_chat_content as deepseek_request_chat_content
from services.translation.llm.providers.deepseek.translation_client import parse_translation_payload as deepseek_parse_translation_payload
from services.translation.llm.providers.deepseek.translation_client import translate_batch_once as deepseek_translate_batch_once
from services.translation.llm.providers.deepseek.translation_client import translate_single_item_plain_text as deepseek_translate_single_item_plain_text
from services.translation.llm.providers.deepseek.translation_client import (
    translate_single_item_plain_text_unstructured as deepseek_translate_single_item_plain_text_unstructured,
)
from services.translation.llm.providers.deepseek.translation_client import (
    translate_continuation_group_members as deepseek_translate_continuation_group_members,
)
from services.translation.llm.providers.deepseek.translation_client import translate_single_item_tagged_text as deepseek_translate_single_item_tagged_text
from services.translation.llm.providers.deepseek.translation_client import translate_single_item_with_decision as deepseek_translate_single_item_with_decision
from services.translation.llm.shared.provider_protocol import ChatCompletionsUrlFn
from services.translation.llm.shared.provider_protocol import GetApiKeyFn
from services.translation.llm.shared.provider_protocol import HeadersBuilderFn
from services.translation.llm.shared.provider_protocol import NormalizeBaseUrlFn
from services.translation.llm.shared.provider_protocol import ParseTranslationPayloadFn
from services.translation.llm.shared.provider_protocol import SessionFactoryFn
from services.translation.llm.shared.provider_protocol import TranslationProviderCapabilities
from services.translation.llm.shared.provider_protocol import TranslationProviderRuntimeProtocol
from services.translation.llm.shared.provider_protocol import TranslateBatchFn
from services.translation.llm.shared.provider_protocol import TranslateSingleFn
from services.translation.llm.shared.provider_protocol import TransportErrorFn
from services.translation.llm.shared.provider_protocol import TransportRequestFn


@dataclass(frozen=True)
class TranslationProviderRuntime:
    provider_id: str
    provider_family: str
    default_api_key_env: str
    default_model: str
    default_base_url: str
    capabilities: TranslationProviderCapabilities
    build_headers: HeadersBuilderFn
    chat_completions_url: ChatCompletionsUrlFn
    get_api_key: GetApiKeyFn
    get_session: SessionFactoryFn
    is_transport_error: TransportErrorFn
    normalize_base_url: NormalizeBaseUrlFn
    request_chat_content: TransportRequestFn
    parse_translation_payload: ParseTranslationPayloadFn
    translate_batch_once: TranslateBatchFn
    translate_single_item_plain_text: TranslateSingleFn
    translate_single_item_plain_text_unstructured: TranslateSingleFn
    translate_continuation_group_members: TranslateSingleFn
    translate_single_item_tagged_text: TranslateSingleFn
    translate_single_item_with_decision: TranslateSingleFn


DEEPSEEK_RUNTIME = TranslationProviderRuntime(
    provider_id="deepseek",
    provider_family="deepseek_official",
    default_api_key_env=DEEPSEEK_DEFAULT_API_KEY_ENV,
    default_model=DEEPSEEK_DEFAULT_MODEL,
    default_base_url=DEEPSEEK_DEFAULT_BASE_URL,
    capabilities=TranslationProviderCapabilities(),
    build_headers=deepseek_build_headers,
    chat_completions_url=deepseek_chat_completions_url,
    get_api_key=deepseek_get_api_key,
    get_session=deepseek_get_session,
    is_transport_error=deepseek_is_transport_error,
    normalize_base_url=deepseek_normalize_base_url,
    request_chat_content=deepseek_request_chat_content,
    parse_translation_payload=deepseek_parse_translation_payload,
    translate_batch_once=deepseek_translate_batch_once,
    translate_single_item_plain_text=deepseek_translate_single_item_plain_text,
    translate_single_item_plain_text_unstructured=deepseek_translate_single_item_plain_text_unstructured,
    translate_continuation_group_members=deepseek_translate_continuation_group_members,
    translate_single_item_tagged_text=deepseek_translate_single_item_tagged_text,
    translate_single_item_with_decision=deepseek_translate_single_item_with_decision,
)


# Atlas Cloud exposes an OpenAI-compatible chat completions endpoint, so it
# reuses the same provider-neutral transport and translation handlers as the
# DeepSeek runtime and only overrides provider identity and defaults.
ATLASCLOUD_RUNTIME = TranslationProviderRuntime(
    provider_id="atlascloud",
    provider_family="openai_compatible",
    default_api_key_env=ATLASCLOUD_DEFAULT_API_KEY_ENV,
    default_model=ATLASCLOUD_DEFAULT_MODEL,
    default_base_url=ATLASCLOUD_DEFAULT_BASE_URL,
    capabilities=TranslationProviderCapabilities(),
    build_headers=deepseek_build_headers,
    chat_completions_url=deepseek_chat_completions_url,
    get_api_key=atlascloud_get_api_key,
    get_session=deepseek_get_session,
    is_transport_error=deepseek_is_transport_error,
    normalize_base_url=deepseek_normalize_base_url,
    request_chat_content=deepseek_request_chat_content,
    parse_translation_payload=deepseek_parse_translation_payload,
    translate_batch_once=deepseek_translate_batch_once,
    translate_single_item_plain_text=deepseek_translate_single_item_plain_text,
    translate_single_item_plain_text_unstructured=deepseek_translate_single_item_plain_text_unstructured,
    translate_continuation_group_members=deepseek_translate_continuation_group_members,
    translate_single_item_tagged_text=deepseek_translate_single_item_tagged_text,
    translate_single_item_with_decision=deepseek_translate_single_item_with_decision,
)


PROVIDER_SELECTION_ENV = "RETAIN_TRANSLATION_PROVIDER"
DEFAULT_PROVIDER_ID = "deepseek"
_PROVIDER_RUNTIMES: dict[str, TranslationProviderRuntime] = {
    DEEPSEEK_RUNTIME.provider_id: DEEPSEEK_RUNTIME,
    ATLASCLOUD_RUNTIME.provider_id: ATLASCLOUD_RUNTIME,
}


def resolve_active_provider_runtime() -> TranslationProviderRuntimeProtocol:
    selected = os.environ.get(PROVIDER_SELECTION_ENV, "").strip().lower()
    if not selected:
        return _PROVIDER_RUNTIMES[DEFAULT_PROVIDER_ID]
    runtime = _PROVIDER_RUNTIMES.get(selected)
    if runtime is None:
        known = ", ".join(sorted(_PROVIDER_RUNTIMES))
        raise ValueError(
            f"Unknown translation provider '{selected}' from {PROVIDER_SELECTION_ENV}. Known providers: {known}."
        )
    return runtime


__all__ = [
    "ATLASCLOUD_RUNTIME",
    "DEEPSEEK_RUNTIME",
    "DEFAULT_PROVIDER_ID",
    "PROVIDER_SELECTION_ENV",
    "TranslationProviderRuntime",
    "TranslationProviderCapabilities",
    "TranslationProviderRuntimeProtocol",
    "resolve_active_provider_runtime",
]

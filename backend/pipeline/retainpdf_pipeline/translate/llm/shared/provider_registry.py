from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.translate.llm.providers.deepseek.client import DEFAULT_API_KEY_ENV as DEEPSEEK_DEFAULT_API_KEY_ENV
from retainpdf_pipeline.translate.llm.providers.deepseek.client import DEFAULT_BASE_URL as DEEPSEEK_DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.providers.deepseek.client import DEFAULT_MODEL as DEEPSEEK_DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.providers.deepseek.client import build_headers as deepseek_build_headers
from retainpdf_pipeline.translate.llm.providers.deepseek.client import chat_completions_url as deepseek_chat_completions_url
from retainpdf_pipeline.translate.llm.providers.deepseek.client import get_api_key as deepseek_get_api_key
from retainpdf_pipeline.translate.llm.providers.deepseek.client import get_session as deepseek_get_session
from retainpdf_pipeline.translate.llm.providers.deepseek.client import is_transport_error as deepseek_is_transport_error
from retainpdf_pipeline.translate.llm.providers.deepseek.client import normalize_base_url as deepseek_normalize_base_url
from retainpdf_pipeline.translate.llm.providers.deepseek.client import request_chat_content as deepseek_request_chat_content
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import parse_translation_payload as deepseek_parse_translation_payload
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import translate_batch_once as deepseek_translate_batch_once
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import translate_single_item_plain_text as deepseek_translate_single_item_plain_text
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import (
    translate_single_item_plain_text_unstructured as deepseek_translate_single_item_plain_text_unstructured,
)
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import (
    translate_continuation_group_members as deepseek_translate_continuation_group_members,
)
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import translate_single_item_tagged_text as deepseek_translate_single_item_tagged_text
from retainpdf_pipeline.translate.llm.providers.deepseek.translation_client import translate_single_item_with_decision as deepseek_translate_single_item_with_decision
from retainpdf_pipeline.translate.llm.shared.provider_protocol import ChatCompletionsUrlFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import GetApiKeyFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import HeadersBuilderFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import NormalizeBaseUrlFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import ParseTranslationPayloadFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import SessionFactoryFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import TranslationProviderCapabilities
from retainpdf_pipeline.translate.llm.shared.provider_protocol import TranslationProviderRuntimeProtocol
from retainpdf_pipeline.translate.llm.shared.provider_protocol import TranslateBatchFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import TranslateSingleFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import TransportErrorFn
from retainpdf_pipeline.translate.llm.shared.provider_protocol import TransportRequestFn


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


def resolve_active_provider_runtime() -> TranslationProviderRuntimeProtocol:
    return DEEPSEEK_RUNTIME


__all__ = [
    "DEEPSEEK_RUNTIME",
    "TranslationProviderRuntime",
    "TranslationProviderCapabilities",
    "TranslationProviderRuntimeProtocol",
    "resolve_active_provider_runtime",
]

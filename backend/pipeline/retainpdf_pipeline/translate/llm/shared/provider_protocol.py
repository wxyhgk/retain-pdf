from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol

import requests


TransportRequestFn = Callable[..., str]
TranslateBatchFn = Callable[..., dict[str, dict[str, str]]]
TranslateSingleFn = Callable[..., dict[str, dict[str, str]]]
ParseTranslationPayloadFn = Callable[[str], dict[str, dict[str, str]]]
GetApiKeyFn = Callable[..., str]
NormalizeBaseUrlFn = Callable[[str], str]
TransportErrorFn = Callable[[Exception], bool]
HeadersBuilderFn = Callable[[str], dict[str, str]]
ChatCompletionsUrlFn = Callable[[str], str]
SessionFactoryFn = Callable[[], requests.Session]


@dataclass(frozen=True)
class TranslationProviderCapabilities:
    plain_text: bool = True
    unstructured_plain_text: bool = True
    tagged_text: bool = True
    structured_decision: bool = True
    structured_group_members: bool = True
    batch_once: bool = True


class TranslationProviderRuntimeProtocol(Protocol):
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


__all__ = [
    "ChatCompletionsUrlFn",
    "GetApiKeyFn",
    "HeadersBuilderFn",
    "NormalizeBaseUrlFn",
    "ParseTranslationPayloadFn",
    "SessionFactoryFn",
    "TranslationProviderCapabilities",
    "TranslationProviderRuntimeProtocol",
    "TranslateBatchFn",
    "TranslateSingleFn",
    "TransportErrorFn",
    "TransportRequestFn",
]

from __future__ import annotations

from dataclasses import dataclass

from retainpdf_translation.llm.providers.deepseek.client import DEFAULT_API_KEY_ENV as DEEPSEEK_DEFAULT_API_KEY_ENV
from retainpdf_translation.llm.providers.deepseek.client import DEFAULT_BASE_URL as DEEPSEEK_DEFAULT_BASE_URL
from retainpdf_translation.llm.providers.deepseek.client import DEFAULT_MODEL as DEEPSEEK_DEFAULT_MODEL
from retainpdf_translation.llm.providers.deepseek.client import build_headers as deepseek_build_headers
from retainpdf_translation.llm.providers.deepseek.client import chat_completions_url as deepseek_chat_completions_url
from retainpdf_translation.llm.providers.deepseek.client import get_api_key as deepseek_get_api_key
from retainpdf_translation.llm.providers.deepseek.client import get_session as deepseek_get_session
from retainpdf_translation.llm.providers.deepseek.client import is_transport_error as deepseek_is_transport_error
from retainpdf_translation.llm.providers.deepseek.client import normalize_base_url as deepseek_normalize_base_url
from retainpdf_translation.llm.providers.deepseek.client import request_chat_content as deepseek_request_chat_content
from retainpdf_translation.llm.shared.provider_protocol import ChatCompletionsUrlFn
from retainpdf_translation.llm.shared.provider_protocol import GetApiKeyFn
from retainpdf_translation.llm.shared.provider_protocol import HeadersBuilderFn
from retainpdf_translation.llm.shared.provider_protocol import NormalizeBaseUrlFn
from retainpdf_translation.llm.shared.provider_protocol import SessionFactoryFn
from retainpdf_translation.llm.shared.provider_protocol import TranslationProviderCapabilities
from retainpdf_translation.llm.shared.provider_protocol import TranslationProviderRuntimeProtocol
from retainpdf_translation.llm.shared.provider_protocol import TransportErrorFn
from retainpdf_translation.llm.shared.provider_protocol import TransportRequestFn


@dataclass(frozen=True)
class TranslationProviderRuntime:
    # 只有发请求的部分；旧引擎拼请求、解析译文的函数在普通翻译那边（llm/providers/deepseek/translation_client.py），
    # 编排代码直接从那里取（2026-11-20 拆包：以前捆在这里，底座就得 import 普通翻译）
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

from __future__ import annotations

"""Stable adapter from shared orchestration to the active translation provider."""

from retainpdf_pipeline.translate.llm.shared.provider_registry import resolve_active_provider_runtime
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_json_text
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_single_item_translation_text
from retainpdf_pipeline.translate.llm.shared.response_parsing import unwrap_translation_shell


_RUNTIME = resolve_active_provider_runtime()

ACTIVE_PROVIDER = _RUNTIME.provider_id
ACTIVE_PROVIDER_FAMILY = _RUNTIME.provider_family
DEFAULT_API_KEY_ENV = _RUNTIME.default_api_key_env
DEFAULT_MODEL = _RUNTIME.default_model
DEFAULT_BASE_URL = _RUNTIME.default_base_url
PROVIDER_CAPABILITIES = _RUNTIME.capabilities
build_headers = _RUNTIME.build_headers
chat_completions_url = _RUNTIME.chat_completions_url
get_api_key = _RUNTIME.get_api_key
get_session = _RUNTIME.get_session
is_transport_error = _RUNTIME.is_transport_error
normalize_base_url = _RUNTIME.normalize_base_url
request_chat_content = _RUNTIME.request_chat_content
parse_translation_payload = _RUNTIME.parse_translation_payload
translate_batch_once = _RUNTIME.translate_batch_once
translate_single_item_plain_text = _RUNTIME.translate_single_item_plain_text
translate_single_item_plain_text_unstructured = _RUNTIME.translate_single_item_plain_text_unstructured
translate_continuation_group_members = _RUNTIME.translate_continuation_group_members
translate_single_item_tagged_text = _RUNTIME.translate_single_item_tagged_text
translate_single_item_with_decision = _RUNTIME.translate_single_item_with_decision

__all__ = [
    "ACTIVE_PROVIDER",
    "ACTIVE_PROVIDER_FAMILY",
    "DEFAULT_API_KEY_ENV",
    "DEFAULT_BASE_URL",
    "DEFAULT_MODEL",
    "PROVIDER_CAPABILITIES",
    "build_headers",
    "chat_completions_url",
    "extract_json_text",
    "extract_single_item_translation_text",
    "get_api_key",
    "get_session",
    "is_transport_error",
    "normalize_base_url",
    "parse_translation_payload",
    "request_chat_content",
    "translate_batch_once",
    "translate_continuation_group_members",
    "translate_single_item_plain_text",
    "translate_single_item_plain_text_unstructured",
    "translate_single_item_tagged_text",
    "translate_single_item_with_decision",
    "unwrap_translation_shell",
]

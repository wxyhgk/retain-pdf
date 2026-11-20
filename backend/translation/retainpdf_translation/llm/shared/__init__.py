from __future__ import annotations

from importlib import import_module


_EXPORTS = {
    "FORMULA_SEGMENT_STRATEGY_VERSION": ("retainpdf_translation_classic.llm.shared.cache", "FORMULA_SEGMENT_STRATEGY_VERSION"),
    "PLAIN_TEXT_STRATEGY_VERSION": ("retainpdf_translation_classic.llm.shared.cache", "PLAIN_TEXT_STRATEGY_VERSION"),
    "TRANSLATION_PROTOCOL_VERSION": ("retainpdf_translation_classic.llm.shared.cache", "TRANSLATION_PROTOCOL_VERSION"),
    "cache_key_for_item": ("retainpdf_translation_classic.llm.shared.cache", "cache_key_for_item"),
    "load_cached_translation": ("retainpdf_translation_classic.llm.shared.cache", "load_cached_translation"),
    "split_cached_batch": ("retainpdf_translation_classic.llm.shared.cache", "split_cached_batch"),
    "store_cached_batch": ("retainpdf_translation_classic.llm.shared.cache", "store_cached_batch"),
    "store_cached_translation": ("retainpdf_translation_classic.llm.shared.cache", "store_cached_translation"),
    "BatchPolicy": ("retainpdf_translation.llm.shared.control_context", "BatchPolicy"),
    "EngineProfile": ("retainpdf_translation.llm.shared.control_context", "EngineProfile"),
    "FallbackPolicy": ("retainpdf_translation.llm.shared.control_context", "FallbackPolicy"),
    "PlaceholderPolicy": ("retainpdf_translation.llm.shared.control_context", "PlaceholderPolicy"),
    "RetrievalEvidence": ("retainpdf_translation.llm.shared.control_context", "RetrievalEvidence"),
    "SegmentationPolicy": ("retainpdf_translation.llm.shared.control_context", "SegmentationPolicy"),
    "TimeoutPolicy": ("retainpdf_translation.llm.shared.control_context", "TimeoutPolicy"),
    "TranslationControlContext": ("retainpdf_translation.llm.shared.control_context", "TranslationControlContext"),
    "build_translation_control_context": ("retainpdf_translation.llm.shared.control_context", "build_translation_control_context"),
    "resolve_engine_profile": ("retainpdf_translation.llm.shared.control_context", "resolve_engine_profile"),
    "CONTINUATION_REVIEW_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "CONTINUATION_REVIEW_RESPONSE_SCHEMA"),
    "DOMAIN_CONTEXT_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "DOMAIN_CONTEXT_RESPONSE_SCHEMA"),
    "FORMULA_SEGMENT_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "FORMULA_SEGMENT_RESPONSE_SCHEMA"),
    "GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA"),
    "TRANSLATION_BATCH_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "TRANSLATION_BATCH_RESPONSE_SCHEMA"),
    "TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA"),
    "TRANSLATION_SINGLE_TEXT_RESPONSE_SCHEMA": ("retainpdf_translation.llm.shared.structured_models", "TRANSLATION_SINGLE_TEXT_RESPONSE_SCHEMA"),
    "extract_string_fields": ("retainpdf_translation.llm.shared.structured_output", "extract_string_fields"),
    "parse_structured_json": ("retainpdf_translation.llm.shared.structured_output", "parse_structured_json"),
    "parse_continuation_review_response": ("retainpdf_translation.llm.shared.structured_parsers", "parse_continuation_review_response"),
    "parse_domain_context_response": ("retainpdf_translation.llm.shared.structured_parsers", "parse_domain_context_response"),
    "parse_garbled_reconstruction_response": ("retainpdf_translation.llm.shared.structured_parsers", "parse_garbled_reconstruction_response"),
    "ACTIVE_PROVIDER": ("retainpdf_translation.llm.shared.provider_runtime", "ACTIVE_PROVIDER"),
    "ACTIVE_PROVIDER_FAMILY": ("retainpdf_translation.llm.shared.provider_runtime", "ACTIVE_PROVIDER_FAMILY"),
    "extract_json_text": ("retainpdf_translation.llm.shared.response_parsing", "extract_json_text"),
    "extract_single_item_translation_text": ("retainpdf_translation.llm.shared.response_parsing", "extract_single_item_translation_text"),
    "unwrap_translation_shell": ("retainpdf_translation.llm.shared.response_parsing", "unwrap_translation_shell"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    target = _EXPORTS.get(name)
    if target is None:
        raise AttributeError(name)
    module_name, attr_name = target
    module = import_module(module_name)
    value = getattr(module, attr_name)
    globals()[name] = value
    return value

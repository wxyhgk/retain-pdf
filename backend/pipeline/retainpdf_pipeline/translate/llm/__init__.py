from __future__ import annotations

from importlib import import_module


_EXPORTS = {
    "DEFAULT_API_KEY_ENV": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "DEFAULT_API_KEY_ENV"),
    "DEFAULT_BASE_URL": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "DEFAULT_BASE_URL"),
    "DEFAULT_MODEL": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "DEFAULT_MODEL"),
    "build_headers": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "build_headers"),
    "build_messages": ("retainpdf_pipeline.translate.llm.shared.prompt_building", "build_messages"),
    "build_single_item_fallback_messages": (
        "retainpdf_pipeline.translate.llm.shared.prompt_building",
        "build_single_item_fallback_messages",
    ),
    "chat_completions_url": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "chat_completions_url"),
    "extract_json_text": ("retainpdf_pipeline.translate.llm.shared.response_parsing", "extract_json_text"),
    "extract_pdf_preview_text": ("retainpdf_pipeline.translate.llm.domain_context", "extract_pdf_preview_text"),
    "get_api_key": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "get_api_key"),
    "get_session": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "get_session"),
    "infer_domain_context": ("retainpdf_pipeline.translate.llm.domain_context", "infer_domain_context"),
    "infer_domain_context_from_preview_text": (
        "retainpdf_pipeline.translate.llm.domain_context",
        "infer_domain_context_from_preview_text",
    ),
    "normalize_base_url": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "normalize_base_url"),
    "request_chat_content": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "request_chat_content"),
    "save_domain_context": ("retainpdf_pipeline.translate.llm.domain_context", "save_domain_context"),
    "translate_batch": ("retainpdf_pipeline.translate.llm.shared.orchestration", "translate_batch"),
    "translate_items_to_text_map": ("retainpdf_pipeline.translate.llm.shared.orchestration", "translate_items_to_text_map"),
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

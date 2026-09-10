"""Stable translation integration surface for other backend subsystems.

Runtime pipeline, OCR provider, and rendering code should import translation
contracts from this package instead of reaching into translation internals.
Exports are lazy to avoid import cycles between translation and rendering.
"""

from __future__ import annotations

from importlib import import_module


_EXPORTS = {
    "write_translation_debug_index": ("retainpdf_pipeline.translate.artifacts", "write_translation_debug_index"),
    "write_translation_diagnostics": ("retainpdf_pipeline.translate.artifacts", "write_translation_diagnostics"),
    "blocking_untranslated_items": ("retainpdf_pipeline.translate.artifacts", "blocking_untranslated_items"),
    "enforce_no_blocking_review_errors": ("retainpdf_pipeline.translate.artifacts", "enforce_no_blocking_review_errors"),
    "is_blocking_untranslated": ("retainpdf_pipeline.translate.artifacts.status", "is_blocking_untranslated"),
    "item_final_status": ("retainpdf_pipeline.translate.artifacts.status", "item_final_status"),
    "item_asset_id": ("retainpdf_pipeline.translate.core.item_reader", "item_asset_id"),
    "item_bbox": ("retainpdf_pipeline.translate.core.item_reader", "item_bbox"),
    "item_block_class": ("retainpdf_pipeline.translate.core.item_reader", "item_block_class"),
    "item_block_kind": ("retainpdf_pipeline.translate.core.item_reader", "item_block_kind"),
    "item_content_kind": ("retainpdf_pipeline.translate.core.item_reader", "item_content_kind"),
    "item_effective_role": ("retainpdf_pipeline.translate.core.item_reader", "item_effective_role"),
    "item_is_algorithm_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_algorithm_like"),
    "item_is_bodylike": ("retainpdf_pipeline.translate.core.item_reader", "item_is_bodylike"),
    "item_is_caption_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_caption_like"),
    "item_is_footnote_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_footnote_like"),
    "item_is_metadata_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_metadata_like"),
    "item_is_plain_text_block": ("retainpdf_pipeline.translate.core.item_reader", "item_is_plain_text_block"),
    "item_is_reference_compatible": ("retainpdf_pipeline.translate.core.item_reader", "item_is_reference_compatible"),
    "item_is_reference_heading_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_reference_heading_like"),
    "item_is_reference_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_reference_like"),
    "item_is_textual": ("retainpdf_pipeline.translate.core.item_reader", "item_is_textual"),
    "item_is_title_like": ("retainpdf_pipeline.translate.core.item_reader", "item_is_title_like"),
    "item_layout_role": ("retainpdf_pipeline.translate.core.item_reader", "item_layout_role"),
    "item_normalized_sub_type": ("retainpdf_pipeline.translate.core.item_reader", "item_normalized_sub_type"),
    "item_policy_translate": ("retainpdf_pipeline.translate.core.item_reader", "item_policy_translate"),
    "item_raw_block_type": ("retainpdf_pipeline.translate.core.item_reader", "item_raw_block_type"),
    "item_reading_order": ("retainpdf_pipeline.translate.core.item_reader", "item_reading_order"),
    "item_semantic_role": ("retainpdf_pipeline.translate.core.item_reader", "item_semantic_role"),
    "item_source_text": ("retainpdf_pipeline.translate.core.item_reader", "item_source_text"),
    "item_structure_role": ("retainpdf_pipeline.translate.core.item_reader", "item_structure_role"),
    "item_tags": ("retainpdf_pipeline.translate.core.item_reader", "item_tags"),
    "load_translation_manifest": ("retainpdf_pipeline.translate.core.payload", "load_translation_manifest"),
    "load_translation_manifest_file": ("retainpdf_pipeline.translate.core.payload", "load_translation_manifest_file"),
    "load_translations": ("retainpdf_pipeline.translate.core.payload", "load_translations"),
    "migrate_translations": ("retainpdf_pipeline.translate.core.payload", "migrate_translations"),
    "ensure_translation_template": ("retainpdf_pipeline.translate.core.payload", "ensure_translation_template"),
    "PROTECTED_TOKEN_RE": ("retainpdf_pipeline.translate.core.payload", "PROTECTED_TOKEN_RE"),
    "protect_inline_formulas": ("retainpdf_pipeline.translate.core.payload", "protect_inline_formulas"),
    "re_protect_restored_formulas": ("retainpdf_pipeline.translate.core.payload", "re_protect_restored_formulas"),
    "restore_protected_tokens": ("retainpdf_pipeline.translate.core.payload", "restore_protected_tokens"),
    "TRANSLATION_MANIFEST_FILE_NAME": ("retainpdf_pipeline.translate.core.payload", "TRANSLATION_MANIFEST_FILE_NAME"),
    "translation_manifest_path": ("retainpdf_pipeline.translate.core.payload", "translation_manifest_path"),
    "protected_map_from_formula_map": (
        "retainpdf_pipeline.translate.core.payload.formula_protection",
        "protected_map_from_formula_map",
    ),
    "GlossaryEntry": ("retainpdf_pipeline.translate.core.terms", "GlossaryEntry"),
    "parse_glossary_json": ("retainpdf_pipeline.translate.core.terms", "parse_glossary_json"),
    "extract_text_items": ("retainpdf_pipeline.translate.core.ocr.json_extractor", "extract_text_items"),
    "get_page_count": ("retainpdf_pipeline.translate.core.ocr.json_extractor", "get_page_count"),
    "load_ocr_json": ("retainpdf_pipeline.translate.core.ocr.json_extractor", "load_ocr_json"),
    "build_translation_record": ("retainpdf_pipeline.translate.core.payload.template_records", "build_translation_record"),
    "DEFAULT_BASE_URL": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "DEFAULT_BASE_URL"),
    "DEFAULT_MODEL": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "DEFAULT_MODEL"),
    "get_api_key": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "get_api_key"),
    "normalize_base_url": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "normalize_base_url"),
    "request_chat_content": ("retainpdf_pipeline.translate.llm.shared.provider_runtime", "request_chat_content"),
    "extract_json_text": ("retainpdf_pipeline.translate.llm.shared.response_parsing", "extract_json_text"),
    "TranslationExecutionRequest": ("retainpdf_pipeline.translate.workflow", "TranslationExecutionRequest"),
    "execute_translation_request": ("retainpdf_pipeline.translate.workflow", "execute_translation_request"),
    "resolve_page_range": ("retainpdf_pipeline.translate.workflow.page_range", "resolve_page_range"),
    "recover_blocking_untranslated_items": (
        "retainpdf_pipeline.translate.services.finalization",
        "recover_blocking_untranslated_items",
    ),
    "translate_items_to_path": ("retainpdf_pipeline.translate.workflow", "translate_items_to_path"),
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

"""Stable translation integration surface for other backend subsystems.

Runtime pipeline, OCR provider, and rendering code should import translation
contracts from this package instead of reaching into translation internals.
Exports are lazy to avoid import cycles between translation and rendering.
"""

from __future__ import annotations

from importlib import import_module


_EXPORTS = {
    "write_translation_debug_index": ("retainpdf_translation.artifacts", "write_translation_debug_index"),
    "write_translation_diagnostics": ("retainpdf_translation.artifacts", "write_translation_diagnostics"),
    "refresh_translation_qa_after_render": (
        "retainpdf_translation.services.quality.qa",
        "refresh_translation_qa_after_render",
    ),
    "blocking_untranslated_items": ("retainpdf_translation.artifacts", "blocking_untranslated_items"),
    "enforce_no_blocking_review_errors": ("retainpdf_translation.artifacts", "enforce_no_blocking_review_errors"),
    "is_blocking_untranslated": ("retainpdf_translation.artifacts.status", "is_blocking_untranslated"),
    "item_final_status": ("retainpdf_translation.artifacts.status", "item_final_status"),
    "item_asset_id": ("retainpdf_translation.core.item_reader", "item_asset_id"),
    "item_bbox": ("retainpdf_translation.core.item_reader", "item_bbox"),
    "item_block_class": ("retainpdf_translation.core.item_reader", "item_block_class"),
    "item_block_kind": ("retainpdf_translation.core.item_reader", "item_block_kind"),
    "item_content_kind": ("retainpdf_translation.core.item_reader", "item_content_kind"),
    "item_effective_role": ("retainpdf_translation.core.item_reader", "item_effective_role"),
    "item_is_algorithm_like": ("retainpdf_translation.core.item_reader", "item_is_algorithm_like"),
    "item_is_bodylike": ("retainpdf_translation.core.item_reader", "item_is_bodylike"),
    "item_is_caption_like": ("retainpdf_translation.core.item_reader", "item_is_caption_like"),
    "item_is_footnote_like": ("retainpdf_translation.core.item_reader", "item_is_footnote_like"),
    "item_is_metadata_like": ("retainpdf_translation.core.item_reader", "item_is_metadata_like"),
    "item_is_plain_text_block": ("retainpdf_translation.core.item_reader", "item_is_plain_text_block"),
    "item_is_reference_compatible": ("retainpdf_translation.core.item_reader", "item_is_reference_compatible"),
    "item_is_reference_heading_like": ("retainpdf_translation.core.item_reader", "item_is_reference_heading_like"),
    "item_is_reference_like": ("retainpdf_translation.core.item_reader", "item_is_reference_like"),
    "item_is_textual": ("retainpdf_translation.core.item_reader", "item_is_textual"),
    "item_is_title_like": ("retainpdf_translation.core.item_reader", "item_is_title_like"),
    "item_layout_role": ("retainpdf_translation.core.item_reader", "item_layout_role"),
    "item_normalized_sub_type": ("retainpdf_translation.core.item_reader", "item_normalized_sub_type"),
    "item_policy_translate": ("retainpdf_translation.core.item_reader", "item_policy_translate"),
    "item_raw_block_type": ("retainpdf_translation.core.item_reader", "item_raw_block_type"),
    "item_reading_order": ("retainpdf_translation.core.item_reader", "item_reading_order"),
    "item_semantic_role": ("retainpdf_translation.core.item_reader", "item_semantic_role"),
    "item_source_text": ("retainpdf_translation.core.item_reader", "item_source_text"),
    "item_structure_role": ("retainpdf_translation.core.item_reader", "item_structure_role"),
    "item_tags": ("retainpdf_translation.core.item_reader", "item_tags"),
    "load_translation_manifest": ("retainpdf_translation.core.payload", "load_translation_manifest"),
    "load_translation_manifest_file": ("retainpdf_translation.core.payload", "load_translation_manifest_file"),
    "load_translations": ("retainpdf_translation.core.payload", "load_translations"),
    "migrate_translations": ("retainpdf_translation.core.payload", "migrate_translations"),
    "ensure_translation_template": ("retainpdf_translation.core.payload", "ensure_translation_template"),
    "PROTECTED_TOKEN_RE": ("retainpdf_translation.core.payload", "PROTECTED_TOKEN_RE"),
    "protect_inline_formulas": ("retainpdf_translation.core.payload", "protect_inline_formulas"),
    "re_protect_restored_formulas": ("retainpdf_translation.core.payload", "re_protect_restored_formulas"),
    "restore_protected_tokens": ("retainpdf_translation.core.payload", "restore_protected_tokens"),
    "TRANSLATION_MANIFEST_FILE_NAME": ("retainpdf_translation.core.payload", "TRANSLATION_MANIFEST_FILE_NAME"),
    "translation_manifest_path": ("retainpdf_translation.core.payload", "translation_manifest_path"),
    "protected_map_from_formula_map": (
        "retainpdf_translation.core.payload.formula_protection",
        "protected_map_from_formula_map",
    ),
    "GlossaryEntry": ("retainpdf_translation.core.terms", "GlossaryEntry"),
    "parse_glossary_json": ("retainpdf_translation.core.terms", "parse_glossary_json"),
    "extract_text_items": ("retainpdf_translation.core.ocr.json_extractor", "extract_text_items"),
    "get_page_count": ("retainpdf_translation.core.ocr.json_extractor", "get_page_count"),
    "load_ocr_json": ("retainpdf_translation.core.ocr.json_extractor", "load_ocr_json"),
    "build_translation_record": ("retainpdf_translation.core.payload.template_records", "build_translation_record"),
    "DEFAULT_BASE_URL": ("retainpdf_translation.llm.shared.provider_runtime", "DEFAULT_BASE_URL"),
    "DEFAULT_MODEL": ("retainpdf_translation.llm.shared.provider_runtime", "DEFAULT_MODEL"),
    "get_api_key": ("retainpdf_translation.llm.shared.provider_runtime", "get_api_key"),
    "normalize_base_url": ("retainpdf_translation.llm.shared.provider_runtime", "normalize_base_url"),
    "request_chat_content": ("retainpdf_translation.llm.shared.provider_runtime", "request_chat_content"),
    "register_stage_connections": ("retainpdf_translation.llm.shared.model_wire", "register_stage_connections"),
    "extract_json_text": ("retainpdf_translation.llm.shared.response_parsing", "extract_json_text"),
    "TranslationExecutionRequest": ("retainpdf_translation.workflow", "TranslationExecutionRequest"),
    "execute_translation_request": ("retainpdf_translation.workflow", "execute_translation_request"),
    "resolve_page_range": ("retainpdf_translation.workflow.page_range", "resolve_page_range"),
    "recover_blocking_untranslated_items": (
        "retainpdf_translation.services.finalization",
        "recover_blocking_untranslated_items",
    ),
    "prepare_relocated_translation_copy": (
        "retainpdf_translation.workflow.recovery",
        "prepare_relocated_translation_copy",
    ),
    "RevisionOutcome": ("retainpdf_translation.workflow.revision", "RevisionOutcome"),
    "RevisionRequest": ("retainpdf_translation.workflow.revision", "RevisionRequest"),
    "revise_translation_item": (
        "retainpdf_translation.workflow.revision",
        "revise_translation_item",
    ),
    "run_refine_for_render": (
        "retainpdf_translation.workflow.refine",
        "run_refine_for_render",
    ),
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

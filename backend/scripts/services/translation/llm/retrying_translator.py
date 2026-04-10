from __future__ import annotations

from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.control_context import TranslationControlContext
from services.translation.llm.control_context import build_translation_control_context
from services.translation.llm.deepseek_client import request_chat_content
from services.translation.llm.fallbacks import translate_items_plain_text as _translate_items_plain_text_impl
from services.translation.llm.fallbacks import translate_single_item_plain_text_with_retries as _translate_single_item_plain_text_with_retries_impl
from services.translation.llm.fallbacks import translate_single_item_stable_placeholder_text as _translate_single_item_stable_placeholder_text_impl
from services.translation.llm.placeholder_guard import INTERNAL_PLACEHOLDER_DEGRADED_REASON
from services.translation.llm.placeholder_guard import KEEP_ORIGIN_LABEL
from services.translation.llm.placeholder_guard import PlaceholderInventoryError
from services.translation.llm.placeholder_guard import SuspiciousKeepOriginError
from services.translation.llm.placeholder_guard import UnexpectedPlaceholderError
from services.translation.llm.placeholder_guard import canonicalize_batch_result as _canonicalize_batch_result
from services.translation.llm.placeholder_guard import has_formula_placeholders as _has_formula_placeholders
from services.translation.llm.placeholder_guard import internal_keep_origin_result as _internal_keep_origin_result
from services.translation.llm.placeholder_guard import is_internal_placeholder_degraded as _is_internal_placeholder_degraded
from services.translation.llm.placeholder_guard import log_placeholder_failure as _log_placeholder_failure
from services.translation.llm.placeholder_guard import normalize_decision as _normalize_decision
from services.translation.llm.placeholder_guard import placeholder_sequence as _placeholder_sequence
from services.translation.llm.placeholder_guard import result_entry as _result_entry
from services.translation.llm.placeholder_guard import unit_source_text as _unit_source_text
from services.translation.llm.placeholder_guard import validate_batch_result as _validate_batch_result
from services.translation.llm.segment_routing import SegmentTranslationFormatError
from services.translation.llm.segment_routing import formula_segment_translation_route as _formula_segment_translation_route_impl
from services.translation.llm.segment_routing import translate_single_item_formula_segment_text_with_retries as _translate_single_item_formula_segment_text_with_retries_impl
from services.translation.llm.segment_routing import translate_single_item_formula_segment_windows_with_retries as _translate_single_item_formula_segment_windows_with_retries_impl
from services.translation.llm.translation_client import parse_translation_payload as _parse_translation_payload
from services.translation.llm.translation_client import translate_batch_once as _translate_batch_once_impl
from services.translation.llm.translation_client import translate_single_item_plain_text as _translate_single_item_plain_text_impl
from services.translation.llm.translation_client import translate_single_item_tagged_text as _translate_single_item_tagged_text_impl
from services.translation.llm.translation_client import translate_single_item_with_decision as _translate_single_item_with_decision_impl


def _build_context(*, mode: str, domain_guidance: str, request_label: str, context: TranslationControlContext | None = None):
    if context is not None:
        return context.with_request_label(request_label)
    return build_translation_control_context(
        mode=mode,
        domain_guidance=domain_guidance,
        request_label=request_label,
    )


def _formula_segment_translation_route(item: dict) -> str:
    return _formula_segment_translation_route_impl(item)


def _should_use_formula_segment_translation(item: dict) -> bool:
    return _formula_segment_translation_route(item) == "single"


def _translate_single_item_formula_segment_text_with_retries(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, dict[str, str]]:
    return _translate_single_item_formula_segment_text_with_retries_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
    )


def _translate_single_item_formula_segment_windows_with_retries(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, dict[str, str]]:
    return _translate_single_item_formula_segment_windows_with_retries_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
    )


def _translate_single_item_plain_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
) -> dict[str, dict[str, str]]:
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_single_item_plain_text_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        mode=mode,
        diagnostics=diagnostics,
    )


def _translate_single_item_tagged_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
) -> dict[str, dict[str, str]]:
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_single_item_tagged_text_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        diagnostics=diagnostics,
    )


def _translate_single_item_stable_placeholder_text(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    context = _build_context(mode="fast", domain_guidance=domain_guidance, request_label=request_label, context=context)
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_single_item_stable_placeholder_text_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
    )


def _translate_single_item_plain_text_with_retries(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    context = _build_context(mode=mode, domain_guidance=domain_guidance, request_label=request_label, context=context)
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_single_item_plain_text_with_retries_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
    )


def _translate_items_plain_text(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    context = _build_context(mode=mode, domain_guidance=domain_guidance, request_label=request_label, context=context)
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_items_plain_text_impl(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
    )


def _translate_single_item_with_decision(
    item: dict,
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_single_item_with_decision_impl(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=(context.merged_guidance if context is not None else domain_guidance),
        mode=mode,
        diagnostics=diagnostics,
    )


def _translate_batch_once(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    diagnostics = TranslationDiagnosticsCollector()
    return _translate_batch_once_impl(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=(context.merged_guidance if context is not None else domain_guidance),
        mode=context.mode if context is not None else mode,
        diagnostics=diagnostics,
    )


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    return _translate_items_plain_text(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=domain_guidance,
        mode=mode,
        context=context,
    )


def translate_items_to_text_map(
    items: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, str]:
    translated = translate_batch(
        items,
        api_key=api_key,
        model=model,
        base_url=base_url,
        domain_guidance=domain_guidance,
        mode=mode,
        context=context,
    )
    return {item_id: result.get("translated_text", "") for item_id, result in translated.items()}

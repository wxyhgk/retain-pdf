from __future__ import annotations

import time
from typing import Callable

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.placeholder_transform import item_with_placeholder_aliases
from retainpdf_pipeline.translate.llm.placeholder_transform import item_with_runtime_hard_glossary
from retainpdf_pipeline.translate.llm.placeholder_transform import placeholder_alias_maps
from retainpdf_pipeline.translate.llm.placeholder_transform import placeholder_stability_guidance
from retainpdf_pipeline.translate.llm.placeholder_transform import restore_placeholder_aliases
from retainpdf_pipeline.translate.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration.common import single_item_http_retry_attempts
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_transport_retry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import plain_text_timeout_seconds
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_tagged_text
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence


TaggedResult = dict[str, dict[str, str]]


def translate_stable_placeholder_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> TaggedResult:
    item = item_with_runtime_hard_glossary(item, context.glossary_entries)
    original_to_alias, alias_to_original = placeholder_alias_maps(item)
    aliased_item = item_with_placeholder_aliases(item, original_to_alias)
    aliased_sequence = placeholder_sequence(
        aliased_item.get("translation_unit_protected_source_text")
        or aliased_item.get("group_protected_source_text")
        or aliased_item.get("protected_source_text")
        or aliased_item.get("source_text")
        or ""
    )
    stability_guidance = placeholder_stability_guidance(aliased_item, aliased_sequence)
    merged_guidance = "\n\n".join(part for part in [context.merged_guidance, stability_guidance.strip()] if part)
    result = translate_single_item_tagged_text(
        aliased_item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        domain_guidance=merged_guidance,
        target_language_name=context.target_language_name,
        diagnostics=diagnostics,
        timeout_s=plain_text_timeout_seconds(item, context=context),
        http_retry_attempts=single_item_http_retry_attempts(
            item,
            context=context,
            transport_tail_retry=False,
        ),
    )
    restored = restore_placeholder_aliases(result, alias_to_original)
    restored = restore_runtime_term_tokens(restored, item=item)
    restored = canonicalize_batch_result([item], restored)
    restored = attach_result_metadata(
        restored,
        item=item,
        context=context,
        route_path=["block_level"],
        output_mode_path=["tagged"],
    )
    validate_batch_result([item], restored, diagnostics=diagnostics)
    return restored


def try_tagged_placeholder_path(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    allow_transport_tail_defer: bool,
    label_suffix: str = "tagged",
    attach_metadata: bool = True,
    handle_transport_error: bool = True,
    stable_placeholder_text_fn: Callable[..., TaggedResult],
    is_transport_error_fn: Callable[[Exception], bool],
) -> TaggedResult:
    tagged_started = time.perf_counter()
    try:
        if request_label:
            print(f"{request_label}: direct tagged single-item path for placeholder stability", flush=True)
        result = stable_placeholder_text_fn(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=f"{request_label} {label_suffix}" if request_label else "",
            context=context,
            diagnostics=diagnostics,
        )
        if request_label:
            print(f"{request_label}: tagged single-item ok in {time.perf_counter() - tagged_started:.2f}s", flush=True)
        if not attach_metadata:
            return result
        return attach_result_metadata(
            restore_runtime_term_tokens(result, item=item),
            item=item,
            context=context,
            route_path=route_path,
            output_mode_path=["tagged"],
        )
    except Exception as exc:
        if handle_transport_error and is_transport_error_fn(exc):
            if request_label:
                print(
                    f"{request_label}: tagged transport failure after {time.perf_counter() - tagged_started:.2f}s, mark failed: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if allow_transport_tail_defer:
                defer_transport_retry(
                    item,
                    route_path=route_path,
                    cause=exc,
                    request_label=request_label,
                    diagnostics=diagnostics,
                )
            return terminal_payloads.translation_failed_payload_for_transport(
                item,
                context=context,
                route_path=route_path + ["failed"],
                degradation_reason="tagged_transport_failure",
                error_code="TRANSPORT_ERROR",
            )
        raise

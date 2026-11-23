from __future__ import annotations

import time

from retainpdf_translation.artifacts import TranslationDiagnosticsCollector
from retainpdf_translation_classic.llm.result_validator import validate_batch_result
from retainpdf_translation_classic.llm.placeholder_diagnostics import log_placeholder_failure
from retainpdf_translation_classic.llm.placeholder_transform import item_with_runtime_hard_glossary
from retainpdf_translation_classic.llm.result_canonicalizer import canonicalize_batch_result
from retainpdf_translation.llm.validation.errors import EmptyTranslationError
from retainpdf_translation.llm.validation.errors import EnglishResidueError
from retainpdf_translation.llm.validation.errors import MathDelimiterError
from retainpdf_translation.llm.validation.errors import PlaceholderInventoryError
from retainpdf_translation.llm.validation.errors import TranslationProtocolError
from retainpdf_translation.llm.validation.errors import UnexpectedPlaceholderError
from retainpdf_translation_classic.llm.shared.cache import split_cached_batch
from retainpdf_translation_classic.llm.shared.cache import store_cached_batch
from retainpdf_translation_classic.llm.shared.orchestration.batched_plain import translate_items_plain_text as _translate_items_plain_text
from retainpdf_translation.llm.shared.control_context import TranslationControlContext
from retainpdf_translation_classic.llm.shared.orchestration.formula_segment_path import try_formula_segment_path
from retainpdf_translation_classic.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_translation_classic.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_translation_classic.llm.shared.orchestration.output_limit_failures import model_output_incomplete_payload
from retainpdf_translation_classic.llm.shared.orchestration.output_limit_failures import request_too_long_payload
from retainpdf_translation.llm.shared.output_limits import ModelOutputIncomplete
from retainpdf_translation.llm.shared.output_limits import UpstreamRequestTooLong
from retainpdf_translation_classic.llm.shared.orchestration.plain_text_retry import PlainTextRetryRuntime
from retainpdf_translation_classic.llm.shared.orchestration.plain_text_retry import run_plain_text_attempts
from retainpdf_translation_classic.llm.shared.orchestration.route_selection import select_single_item_route
from retainpdf_translation_classic.llm.shared.orchestration.segment_routing import translate_single_item_formula_segment_text_with_retries
from retainpdf_translation_classic.llm.shared.orchestration.sentence_level import sentence_level_fallback
from retainpdf_translation_classic.llm.shared.orchestration.single_item_deps import SingleItemFlowDeps
from retainpdf_translation_classic.llm.shared.orchestration.single_item_routes import translate_direct_typst_route
from retainpdf_translation_classic.llm.shared.orchestration.single_item_routes import translate_heavy_formula_route
from retainpdf_translation_classic.llm.shared.orchestration.single_item_routes import try_tagged_placeholder_route
from retainpdf_translation_classic.llm.shared.orchestration.tagged_placeholder import translate_stable_placeholder_text
from retainpdf_translation_classic.llm.shared.orchestration.transport import plain_text_timeout_seconds
from retainpdf_translation.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_translation.llm.shared.provider_runtime import DEFAULT_MODEL
from retainpdf_translation.llm.shared.provider_runtime import is_transport_error
from retainpdf_translation_classic.llm.providers.deepseek.translation_client import translate_batch_once
from retainpdf_translation_classic.llm.providers.deepseek.translation_client import translate_single_item_plain_text
from retainpdf_translation_classic.llm.providers.deepseek.translation_client import translate_single_item_plain_text_unstructured
from retainpdf_translation.llm.shared.provider_runtime import unwrap_translation_shell
from retainpdf_translation.llm.shared.upstream_resilience import is_content_rejection
import retainpdf_translation_classic.llm.shared.orchestration.terminal_payloads as terminal_payloads


def _sentence_level_fallback(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    translate_plain_fn=None,
    translate_unstructured_fn=None,
) -> dict[str, dict[str, str]]:
    try:
        return sentence_level_fallback(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            translate_plain_fn=translate_plain_fn or translate_single_item_plain_text,
            translate_unstructured_fn=translate_unstructured_fn or translate_single_item_plain_text_unstructured,
        )
    except Exception as exc:
        if exc.__class__.__name__ == "EnglishResidueError" and not isinstance(exc, EnglishResidueError):
            raise EnglishResidueError(
                str(item.get("item_id", "") or ""),
                source_text=str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or ""),
                translated_text=str(getattr(exc, "translated_text", "") or ""),
            ) from exc
        raise


DEFAULT_SENTENCE_LEVEL_FALLBACK = _sentence_level_fallback


def _default_flow_deps() -> SingleItemFlowDeps:
    return SingleItemFlowDeps(
        translate_plain_fn=translate_single_item_plain_text,
        translate_unstructured_fn=translate_single_item_plain_text_unstructured,
        formula_segment_translator_fn=translate_single_item_formula_segment_text_with_retries,
        stable_placeholder_text_fn=translate_single_item_stable_placeholder_text,
        sentence_level_fallback_fn=_sentence_level_fallback,
        validate_batch_result_fn=validate_batch_result,
        single_item_translator_fn=translate_single_item_plain_text_with_retries,
    )


def translate_single_item_stable_placeholder_text(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    return translate_stable_placeholder_text(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
    )


def translate_single_item_plain_text_with_retries(
    item: dict,
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    allow_transport_tail_defer: bool = False,
    deps: SingleItemFlowDeps | None = None,
) -> dict[str, dict[str, str]]:
    """单块翻译的入口，不往上抛这几类：
    - 服务商内容审核没过（``UpstreamContentRejected``）：这一块保留原文、不再重试，翻译诊断记「内容审核未过」
      （批量请求被拦时，批量路径本来就退到逐块，只有触发拦截的块落到这里）；
    - 各条路径都没收下的「回答不完整」记这一块失败、「单次请求太长」保留原文记死信（output_limit_failures）。"""
    try:
        return _translate_single_item_plain_text_with_retries(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            allow_transport_tail_defer=allow_transport_tail_defer,
            deps=deps,
        )
    except UpstreamRequestTooLong as exc:
        return request_too_long_payload(
            item, exc, context=context, diagnostics=diagnostics, request_label=request_label
        )
    except ModelOutputIncomplete as exc:
        return model_output_incomplete_payload(
            item, exc, context=context, diagnostics=diagnostics, request_label=request_label
        )
    except Exception as exc:
        if not is_content_rejection(exc):
            raise
        if request_label:
            print(f"{request_label}: upstream content moderation rejected this block, keep source text: {exc}", flush=True)
        if diagnostics is not None:
            diagnostics.emit(
                kind="upstream_content_rejected",
                item_id=str(item.get("item_id", "") or ""),
                page_idx=item.get("page_idx"),
                severity="warning",
                message="内容审核未过：服务商拦截了这一块，已保留原文，不再重试",
                retryable=False,
                details={"provider_code": str(getattr(exc, "provider_code", "") or ""), "http_status": getattr(exc, "status_code", None)},
            )
        return terminal_payloads.content_rejected_payload(item, exc=exc, context=context.scoped_to_item(item))


def _translate_single_item_plain_text_with_retries(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool,
    deps: SingleItemFlowDeps | None,
) -> dict[str, dict[str, str]]:
    context = context.scoped_to_item(item)
    item = item_with_runtime_hard_glossary(item, context.glossary_entries)
    # 逐条匹配的术语指引经 item 注入 user 消息(见 prompt_protocols),
    # 不进 system 消息——否则每条请求前缀都不同,前缀缓存全部失效。
    scoped_terms_guidance = context.terms_guidance
    if scoped_terms_guidance:
        item["_scoped_terms_guidance"] = scoped_terms_guidance
    flow_deps = deps or _default_flow_deps()
    single_item_translator = flow_deps.single_item_translator_fn or translate_single_item_plain_text_with_retries
    route = select_single_item_route(item, context=context)
    if route.direct_typst:
        return translate_direct_typst_route(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            allow_transport_tail_defer=allow_transport_tail_defer,
            translator=single_item_translator,
            translate_plain_fn=flow_deps.translate_plain_fn,
            translate_unstructured_fn=flow_deps.translate_unstructured_fn,
            sentence_level_fallback_fn=flow_deps.sentence_level_fallback_fn,
            validate_batch_result_fn=flow_deps.validate_batch_result_fn,
        )

    split_reason = route.heavy_formula_split_reason
    if split_reason:
        if request_label:
            print(f"{request_label}: split heavy formula block before formula routing reason={split_reason}", flush=True)
        split_result = translate_heavy_formula_route(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            split_reason=split_reason,
            translate_single_item_fn=single_item_translator,
        )
        if split_result is not None:
            return attach_result_metadata(
                restore_runtime_term_tokens(split_result, item=item),
                item=item,
                context=context,
                route_path=["block_level", "heavy_formula_split"],
                output_mode_path=["plain_text"],
                degradation_reason=split_reason,
            )

    plain_timeout_s = plain_text_timeout_seconds(
        item,
        context=context,
        transport_tail_retry=not allow_transport_tail_defer,
    )
    route_prefix = ["block_level"]

    if route.formula_segment_route == "single":
        formula_result = try_formula_segment_path(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            allow_transport_tail_defer=allow_transport_tail_defer,
            is_transport_error_fn=is_transport_error,
            formula_segment_translator_fn=flow_deps.formula_segment_translator_fn,
        )
        if formula_result is not None:
            return formula_result

    if route.prefer_tagged_placeholder_first:
        tagged_started = time.perf_counter()
        try:
            return try_tagged_placeholder_route(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                route_path=route_prefix + ["tagged_placeholder_first"],
                allow_transport_tail_defer=allow_transport_tail_defer,
                label_suffix="tagged-first",
                stable_placeholder_text_fn=flow_deps.stable_placeholder_text_fn,
            )
        except Exception as exc:
            if is_content_rejection(exc):
                # 内容审核没过：换一条路再发一遍也一样被拦
                raise
            if request_label:
                print(
                    f"{request_label}: tagged-first path failed after {time.perf_counter() - tagged_started:.2f}s, fallback to plain-text path: {type(exc).__name__}: {exc}",
                    flush=True,
                )

    runtime = PlainTextRetryRuntime(
        translate_plain_fn=flow_deps.translate_plain_fn,
        translate_unstructured_fn=flow_deps.translate_unstructured_fn,
        tagged_placeholder_path_fn=try_tagged_placeholder_route,
        sentence_level_fallback_fn=flow_deps.sentence_level_fallback_fn,
        canonicalize_batch_result_fn=canonicalize_batch_result,
        validate_batch_result_fn=flow_deps.validate_batch_result_fn,
        unwrap_translation_shell_fn=unwrap_translation_shell,
        log_placeholder_failure_fn=log_placeholder_failure,
        is_transport_error_fn=is_transport_error,
    )
    return run_plain_text_attempts(
        item,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        allow_transport_tail_defer=allow_transport_tail_defer,
        plain_timeout_s=plain_timeout_s,
        route_prefix=route_prefix,
        runtime=runtime,
    )


def translate_items_plain_text(
    batch: list[dict],
    *,
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    context: TranslationControlContext,
    diagnostics: TranslationDiagnosticsCollector | None = None,
) -> dict[str, dict[str, str]]:
    context = context.scoped_to_batch(batch)
    return _translate_items_plain_text(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=context,
        diagnostics=diagnostics,
        single_item_translator=translate_single_item_plain_text_with_retries,
        split_cached_batch_fn=split_cached_batch,
        store_cached_batch_fn=store_cached_batch,
        translate_batch_once_fn=translate_batch_once,
    )

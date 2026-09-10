from __future__ import annotations

import json
import time

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.result_validator import validate_batch_result
from retainpdf_pipeline.translate.llm.shared.orchestration.common import is_continuation_or_group_unit
from retainpdf_pipeline.translate.llm.shared.orchestration.common import sentence_level_fallback_allowed
from retainpdf_pipeline.translate.llm.shared.orchestration.common import single_item_http_retry_attempts
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_long_text import should_split_direct_typst_long_text
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_long_text import translate_direct_typst_long_text_chunks
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_repair import try_repair_direct_typst_math_delimiters
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_salvage import try_salvage_direct_typst_protocol_shell_error
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import attach_result_metadata
from retainpdf_pipeline.translate.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery import handle_direct_typst_validation_failure
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery import is_named_validation_exception
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery import sentence_level_fallback_or_terminal_failure
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import defer_transport_retry
from retainpdf_pipeline.translate.llm.shared.orchestration.transport import plain_text_timeout_seconds
from retainpdf_pipeline.translate.llm.shared.provider_runtime import is_transport_error
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_plain_text
from retainpdf_pipeline.translate.llm.shared.provider_runtime import translate_single_item_plain_text_unstructured
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text


def translate_direct_typst_plain_text_with_retries(
    item: dict,
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    allow_transport_tail_defer: bool = False,
    translator,
    translate_plain_fn=None,
    translate_unstructured_fn=None,
    sentence_level_fallback_fn=None,
    repair_math_delimiters_fn=try_repair_direct_typst_math_delimiters,
    validate_batch_result_fn=validate_batch_result,
) -> dict[str, dict[str, str]]:
    translate_plain = translate_plain_fn or translate_single_item_plain_text
    translate_unstructured = translate_unstructured_fn or translate_single_item_plain_text_unstructured

    if should_split_direct_typst_long_text(item):
        if request_label:
            print(f"{request_label}: direct_typst long-text split before remote translation", flush=True)
        split_result = translate_direct_typst_long_text_chunks(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            translator=translator,
        )
        if split_result is not None:
            return attach_result_metadata(
                restore_runtime_term_tokens(split_result, item=item),
                item=item,
                context=context,
                route_path=["block_level", "direct_typst", "long_text_split"],
                output_mode_path=["plain_text"],
                degradation_reason=split_result[item["item_id"]]
                .get("translation_diagnostics", {})
                .get("degradation_reason", "direct_typst_long_text_split"),
            )

    plain_attempts = context.fallback_policy.plain_text_attempts
    plain_timeout_s = plain_text_timeout_seconds(
        item,
        context=context,
        transport_tail_retry=not allow_transport_tail_defer,
    )
    # 定界符修复要求模型重写整段文本,20s 档超时对长块是极限值(实测
    # NMR 长块修复需要 ~19s,连续 4 次踩超时白烧 80s)。修复调用统一
    # 用 transport tail 档超时。
    repair_timeout_s = max(
        plain_timeout_s,
        int(getattr(context.timeout_policy, "transport_tail_retry_seconds", plain_timeout_s)),
    )
    route_prefix = ["block_level", "direct_typst"]
    last_error: Exception | None = None

    for attempt in range(1, plain_attempts + 1):
        started = time.perf_counter()
        try:
            if request_label:
                print(
                    f"{request_label}: direct_typst plain-text attempt {attempt}/{plain_attempts} item={item['item_id']}",
                    flush=True,
                )
            result = translate_plain(
                item,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=f"{request_label} req#{attempt}" if request_label else "",
                domain_guidance=context.prompt_system_guidance,
                mode=context.mode,
                target_language_name=context.target_language_name,
                diagnostics=diagnostics,
                timeout_s=plain_timeout_s,
                http_retry_attempts=single_item_http_retry_attempts(
                    item,
                    context=context,
                    transport_tail_retry=False,
                ),
            )
            result = restore_runtime_term_tokens(result, item=item)
            result = attach_result_metadata(
                result,
                item=item,
                context=context,
                route_path=route_prefix,
                output_mode_path=["plain_text"],
            )
            if request_label:
                print(f"{request_label}: direct_typst plain-text ok in {time.perf_counter() - started:.2f}s", flush=True)
            return result
        except Exception as exc:
            if not is_named_validation_exception(
                exc,
                "EmptyTranslationError",
                "EnglishResidueError",
                "MathDelimiterError",
                "TranslationProtocolError",
                "TruncatedTranslationError",
            ):
                if isinstance(exc, (ValueError, KeyError, json.JSONDecodeError)):
                    last_error = exc
                    if request_label:
                        print(
                            f"{request_label}: direct_typst plain-text parse failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                            flush=True,
                        )
                    if attempt >= plain_attempts:
                        raise
                    time.sleep(min(8, 2 * attempt))
                    continue
                if not is_transport_error(exc):
                    raise
                last_error = exc
                if request_label:
                    print(
                        f"{request_label}: direct_typst transport failure after {time.perf_counter() - started:.2f}s, mark failed: {type(exc).__name__}: {exc}",
                        flush=True,
                    )
                if allow_transport_tail_defer:
                    defer_transport_retry(
                        item,
                        route_path=route_prefix,
                        cause=exc,
                        request_label=request_label,
                        diagnostics=diagnostics,
                    )
                return terminal_payloads.translation_failed_payload_for_transport(
                    item,
                    context=context,
                    route_path=route_prefix + ["failed"],
                    degradation_reason="transport_timeout_budget_exceeded",
                    error_code="TRANSPORT_ERROR",
                )

            last_error = exc
            if request_label:
                print(
                    f"{request_label}: direct_typst plain-text failed attempt {attempt}/{plain_attempts} after {time.perf_counter() - started:.2f}s: {type(exc).__name__}: {exc}",
                    flush=True,
                )
            if attempt < plain_attempts:
                if is_named_validation_exception(exc, "TranslationProtocolError"):
                    salvaged = try_salvage_direct_typst_protocol_shell_error(
                        item,
                        exc=exc,
                        context=context,
                        diagnostics=diagnostics,
                        route_path=route_prefix + ["protocol_shell_unwrap"],
                        output_mode_path=["plain_text"],
                        allow_partial_accept=is_continuation_or_group_unit(item),
                        validate_batch_result_fn=validate_batch_result_fn,
                    )
                    if salvaged is not None:
                        if request_label:
                            print(f"{request_label}: direct_typst protocol shell salvaged successfully", flush=True)
                        return salvaged
                if is_named_validation_exception(exc, "MathDelimiterError"):
                    try:
                        repaired = repair_math_delimiters_fn(
                            item,
                            exc=exc,
                            api_key=api_key,
                            model=model,
                            base_url=base_url,
                            request_label=request_label,
                            context=context,
                            diagnostics=diagnostics,
                            route_path=route_prefix + ["typst_repair"],
                            output_mode_path=["plain_text"],
                            timeout_s=repair_timeout_s,
                            validate_batch_result_fn=validate_batch_result_fn,
                        )
                        if repaired is not None:
                            if request_label:
                                print(f"{request_label}: direct_typst math delimiter repaired successfully", flush=True)
                            return repaired
                    except Exception as repair_exc:
                        if request_label:
                            print(
                                f"{request_label}: direct_typst math delimiter repair failed attempt {attempt}/{plain_attempts}: {type(repair_exc).__name__}: {repair_exc}",
                                flush=True,
                            )
                time.sleep(min(8, 2 * attempt))
                continue

            handled_result, last_error = handle_direct_typst_validation_failure(
                item,
                exc=exc,
                route_prefix=route_prefix,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                validate_batch_result_fn=validate_batch_result_fn,
                allow_transport_tail_defer=allow_transport_tail_defer,
                translate_plain=translate_plain,
                translate_unstructured=translate_unstructured,
                sentence_level_fallback_fn=sentence_level_fallback_fn,
                repair_math_delimiters_fn=repair_math_delimiters_fn,
                api_key=api_key,
                model=model,
                base_url=base_url,
            )
            if handled_result is not None:
                return handled_result

    if last_error is not None:
        if is_named_validation_exception(last_error, "TranslationProtocolError"):
            return terminal_payloads.translation_failed_payload_for_validation(
                item,
                context=context,
                route_path=route_prefix + ["failed"],
                degradation_reason="protocol_shell_repeated",
                error_code="PROTOCOL_SHELL",
            )
        raise last_error
    raise RuntimeError("Direct Typst plain-text translation failed without an exception.")

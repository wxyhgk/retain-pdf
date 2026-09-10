from __future__ import annotations

import time

from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import handle_raw_transport_failure as _handle_raw_transport_failure
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import is_named_validation_exception
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import (
    sentence_level_fallback_or_terminal_failure,
)
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import try_math_delimiter_repair as _try_math_delimiter_repair
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import try_protocol_shell_salvage as _try_protocol_shell_salvage
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_actions import try_raw_plain_text as _try_raw_plain_text
from retainpdf_pipeline.translate.llm.shared.orchestration.direct_typst_recovery_handlers import handle_raw_validation_failure as _handle_raw_validation_failure
from retainpdf_pipeline.translate.llm.shared.provider_runtime import is_transport_error


def handle_direct_typst_validation_failure(
    item: dict,
    *,
    exc: Exception,
    route_prefix: list[str],
    request_label: str,
    context,
    diagnostics,
    validate_batch_result_fn,
    allow_transport_tail_defer: bool,
    translate_plain,
    translate_unstructured,
    sentence_level_fallback_fn,
    repair_math_delimiters_fn,
    api_key: str,
    model: str,
    base_url: str,
) -> tuple[dict[str, dict[str, str]] | None, Exception]:
    last_error = exc
    if request_label:
        print(
            f"{request_label}: direct_typst plain-text failed: {type(exc).__name__}: {exc}",
            flush=True,
        )
    if is_named_validation_exception(exc, "TranslationProtocolError"):
        salvaged = _try_protocol_shell_salvage(
            item,
            exc=exc,
            context=context,
            diagnostics=diagnostics,
            route_path=route_prefix + ["protocol_shell_unwrap"],
            request_label=request_label,
            validate_batch_result_fn=validate_batch_result_fn,
        )
        if salvaged is not None:
            return salvaged, last_error
    if is_named_validation_exception(exc, "MathDelimiterError"):
        repaired = _try_math_delimiter_repair(
            item,
            exc=exc,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_path=route_prefix + ["typst_repair"],
            allow_transport_tail_defer=allow_transport_tail_defer,
            repair_math_delimiters_fn=repair_math_delimiters_fn,
            validate_batch_result_fn=validate_batch_result_fn,
            success_message="direct_typst math delimiter repaired successfully",
            failure_message="direct_typst math delimiter repair failed",
        )
        if repaired is not None:
            return repaired, last_error

    raw_started = time.perf_counter()
    try:
        return _try_raw_plain_text(
            item,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_prefix=route_prefix,
            allow_transport_tail_defer=allow_transport_tail_defer,
            translate_unstructured=translate_unstructured,
        )
    except Exception as raw_exc:
        if not is_named_validation_exception(
            raw_exc,
            "EmptyTranslationError",
            "EnglishResidueError",
            "MathDelimiterError",
            "TranslationProtocolError",
        ):
            if not is_transport_error(raw_exc):
                raise
            return _handle_raw_transport_failure(
                item,
                raw_exc=raw_exc,
                raw_started=raw_started,
                api_key=api_key,
                model=model,
                base_url=base_url,
                request_label=request_label,
                context=context,
                diagnostics=diagnostics,
                route_prefix=route_prefix,
                allow_transport_tail_defer=allow_transport_tail_defer,
                translate_plain=translate_plain,
                translate_unstructured=translate_unstructured,
                sentence_level_fallback_fn=sentence_level_fallback_fn,
            )
        return _handle_raw_validation_failure(
            item,
            raw_exc=raw_exc,
            raw_started=raw_started,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            context=context,
            diagnostics=diagnostics,
            route_prefix=route_prefix,
            allow_transport_tail_defer=allow_transport_tail_defer,
            translate_plain=translate_plain,
            translate_unstructured=translate_unstructured,
            sentence_level_fallback_fn=sentence_level_fallback_fn,
            repair_math_delimiters_fn=repair_math_delimiters_fn,
            validate_batch_result_fn=validate_batch_result_fn,
        )


__all__ = [
    "handle_direct_typst_validation_failure",
    "is_named_validation_exception",
    "sentence_level_fallback_or_terminal_failure",
]

sentence_level_fallback_or_keep_origin = sentence_level_fallback_or_terminal_failure

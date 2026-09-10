from __future__ import annotations

from retainpdf_pipeline.translate.artifacts import TranslationDiagnosticsCollector
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context
import retainpdf_pipeline.translate.llm.shared.orchestration.fallbacks as fallbacks
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_BASE_URL
from retainpdf_pipeline.translate.llm.shared.provider_runtime import DEFAULT_MODEL


def translate_batch(
    batch: list[dict],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    request_label: str = "",
    domain_guidance: str = "",
    mode: str = "fast",
    context: TranslationControlContext | None = None,
) -> dict[str, dict[str, str]]:
    resolved_context = (
        context.with_request_label(request_label)
        if context is not None
        else build_translation_control_context(
            mode=mode,
            domain_guidance=domain_guidance,
            request_label=request_label,
        )
    )
    diagnostics = TranslationDiagnosticsCollector()
    return fallbacks.translate_items_plain_text(
        batch,
        api_key=api_key,
        model=model,
        base_url=base_url,
        request_label=request_label,
        context=resolved_context,
        diagnostics=diagnostics,
    )


def translate_items_to_text_map(
    items: list[dict],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
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


__all__ = [
    "translate_batch",
    "translate_items_to_text_map",
]

from __future__ import annotations

from foundation.shared.prompt_loader import load_prompt
from services.translation.diagnostics import TranslationDiagnosticsCollector
from services.translation.llm.placeholder_guard import canonicalize_batch_result
from services.translation.llm.placeholder_guard import MathDelimiterError
from services.translation.llm.placeholder_guard import result_entry
from services.translation.llm.placeholder_guard import validate_batch_result
from services.translation.llm.shared.orchestration.metadata import attach_result_metadata
from services.translation.llm.shared.orchestration.metadata import restore_runtime_term_tokens
from services.translation.llm.shared.provider_runtime import request_chat_content


def _source_text(item: dict) -> str:
    return str(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def build_direct_typst_repair_messages(
    item: dict,
    *,
    broken_translation: str,
    error_message: str,
    domain_guidance: str = "",
) -> list[dict[str, str]]:
    system_prompt = load_prompt("translation_typst_repair.txt")
    if domain_guidance.strip():
        system_prompt = f"{system_prompt}\n\n文档术语和风格约束：\n{domain_guidance.strip()}"
    user_prompt = "\n".join(
        [
            "原文：",
            _source_text(item),
            "",
            "当前译文：",
            str(broken_translation or "").strip(),
            "",
            "校验错误：",
            str(error_message or "").strip(),
            "",
            "请只输出修复后的译文正文：",
        ]
    ).strip()
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def try_repair_direct_typst_math_delimiters(
    item: dict,
    *,
    exc: MathDelimiterError,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    context,
    diagnostics: TranslationDiagnosticsCollector | None,
    route_path: list[str],
    output_mode_path: list[str],
    timeout_s: int,
    request_chat_content_fn=request_chat_content,
    validate_batch_result_fn=validate_batch_result,
) -> dict[str, dict[str, str]] | None:
    broken_translation = str(getattr(exc, "translated_text", "") or "").strip()
    if not broken_translation:
        return None
    content = request_chat_content_fn(
        build_direct_typst_repair_messages(
            item,
            broken_translation=broken_translation,
            error_message=str(exc),
            domain_guidance=getattr(context, "merged_guidance", "") or "",
        ),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=None,
        timeout=timeout_s,
        request_label=f"{request_label} repair" if request_label else "",
    )
    repaired_text = str(content or "").strip()
    if not repaired_text:
        return None
    result = {str(item.get("item_id", "") or ""): result_entry("translate", repaired_text)}
    result = canonicalize_batch_result([item], result)
    validate_batch_result_fn([item], result, diagnostics=diagnostics)
    result = restore_runtime_term_tokens(result, item=item)
    return attach_result_metadata(
        result,
        item=item,
        context=context,
        route_path=route_path,
        output_mode_path=output_mode_path,
        degradation_reason="typst_math_repaired",
    )

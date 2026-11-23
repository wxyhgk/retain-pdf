"""单块翻译碰到「回答不完整」「单次请求太长」时的收口（见 ``retainpdf_translation.llm.shared.output_limits``）。

- 回答不完整（截断、被内容过滤）：这一块记失败（``retry_required``），和别的没翻成的块一样等收尾补救再试，
  补救也不成就保留原文记死信。不把异常往上抛：顺序跑批（workers=1）时异常会让整份翻译失败。
- 单次请求太长：单块已经是最小的一份，再发也一样长，直接保留原文记死信（``dead_letter_queue``，不挡导出，
  任务完成时提示「有 N 个块保留原文」，用户能看到、能重翻）。

两种都在块的诊断里写明原因（``degradation_reason``、``error_trace``）。
"""

from __future__ import annotations

from retainpdf_translation.artifacts import TranslationDiagnosticsCollector
from retainpdf_translation.llm.shared.output_limits import CONTENT_FILTER
from retainpdf_translation.llm.shared.output_limits import ModelOutputIncomplete
from retainpdf_translation.llm.shared.output_limits import UpstreamRequestTooLong
import retainpdf_translation_classic.llm.shared.orchestration.terminal_payloads as terminal_payloads


def model_output_incomplete_payload(
    item: dict,
    exc: ModelOutputIncomplete,
    *,
    context=None,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    request_label: str = "",
) -> dict[str, dict[str, str]]:
    taxonomy = "refusal" if exc.kind == CONTENT_FILTER else "protocol"
    if request_label:
        print(f"{request_label}: model output incomplete, mark item failed: {exc}", flush=True)
    if diagnostics is not None:
        diagnostics.emit(
            kind="model_output_incomplete",
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="warning",
            message=str(exc),
            retryable=True,
            details={"kind": exc.kind, "field": exc.field, "reason": exc.reason},
        )
    return terminal_payloads.translation_failed_payload(
        item,
        context=context,
        route_path=["block_level", "model_output_incomplete", "failed"],
        degradation_reason=f"model_output_{exc.kind}",
        error_taxonomy=taxonomy,
        error_trace=[
            {
                "type": taxonomy,
                "code": "MODEL_OUTPUT_INCOMPLETE",
                "kind": exc.kind,
                "reason": f"{exc.field}={exc.reason}",
                "message": str(exc),
            }
        ],
        fallback_to="retry_required",
    )


def request_too_long_payload(
    item: dict,
    exc: UpstreamRequestTooLong,
    *,
    context=None,
    diagnostics: TranslationDiagnosticsCollector | None = None,
    request_label: str = "",
) -> dict[str, dict[str, str]]:
    if request_label:
        print(f"{request_label}: single item request still too long, keep origin: {exc.provider_code}", flush=True)
    if diagnostics is not None:
        diagnostics.emit(
            kind="request_too_long_kept_origin",
            item_id=str(item.get("item_id", "") or ""),
            page_idx=item.get("page_idx"),
            severity="error",
            message=f"单块请求仍然太长（HTTP {exc.status_code}，{exc.provider_code}），这一块保留原文",
            retryable=False,
            details={"http_status": exc.status_code, "provider_code": exc.provider_code},
        )
    return terminal_payloads.translation_failed_payload(
        item,
        context=context,
        route_path=["block_level", "request_too_long", "failed"],
        degradation_reason="request_too_long",
        error_taxonomy="protocol",
        error_trace=[
            {
                "type": "protocol",
                "code": "REQUEST_TOO_LONG",
                "http_status": exc.status_code,
                "provider_code": exc.provider_code,
                "message": "单次请求太长（超过模型上下文或请求体上限），单块已是最小，保留原文",
            }
        ],
        fallback_to="dead_letter_queue",
        dead_letter=True,
    )


__all__ = ["model_output_incomplete_payload", "request_too_long_payload"]

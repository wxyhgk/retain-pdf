from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Callable
from retainpdf_pipeline.translate.llm.shared.executor_context import raise_if_batch_failed, raise_if_executor_failed

from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.orchestration import translate_batch as default_translate_batch
import retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads as terminal_payloads
from retainpdf_pipeline.translate.llm.shared.provider_runtime import is_transport_error
from retainpdf_pipeline.translate.services.memory import JobMemoryStore
from retainpdf_pipeline.translate.services.context.execution_context import context_with_memory_guidance
from retainpdf_pipeline.translate.services.context.execution_context import domain_guidance_with_retrieved_memory

TranslateBatchFn = Callable[..., dict[str, dict[str, str]]]


def _failed_results_for_transport_batch(
    batch: list[dict],
    *,
    degradation_reason: str = "batch_transport_timeout_budget_exceeded",
) -> dict[str, dict[str, str]]:
    degraded: dict[str, dict[str, str]] = {}
    for item in batch:
        degraded.update(
            terminal_payloads.translation_failed_payload_for_transport(
                item,
                route_path=["block_level", "batched_plain", "failed"],
                degradation_reason=degradation_reason,
                error_code="BATCH_TRANSPORT_ERROR",
            )
        )
    return degraded


_keep_origin_results_for_transport_batch = _failed_results_for_transport_batch


def _translate_batch_or_keep_origin(
    batch: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str,
    domain_guidance: str,
    mode: str,
    context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None = None,
    translate_fn: TranslateBatchFn = default_translate_batch,
) -> dict[str, dict[str, str]]:
    raise_if_executor_failed()
    effective_context = context_with_memory_guidance(
        context,
        domain_guidance=domain_guidance,
        memory_store=memory_store,
        batch=batch,
        mode=mode,
        request_label=request_label,
    )
    effective_domain_guidance = domain_guidance_with_retrieved_memory(
        domain_guidance,
        memory_store,
        batch,
        memory_mode=str(getattr(effective_context, "memory_mode", "matched")),
    )
    try:
        result = translate_fn(
            batch,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=request_label,
            domain_guidance=effective_domain_guidance,
            mode=mode,
            context=effective_context,
        )
        raise_if_batch_failed(batch)
        return result
    except Exception as exc:
        if not is_transport_error(exc):
            raise
        if request_label:
            print(
                f"{request_label}: transport failure, mark batch failed: {type(exc).__name__}: {exc}",
                flush=True,
            )
        return _failed_results_for_transport_batch(batch)


def _submit_parallel_translation_batches(
    batches: list[list[dict]],
    *,
    worker_count: int,
    queue_name: str,
    api_key: str,
    model: str,
    base_url: str,
    domain_guidance: str,
    mode: str,
    translation_context: TranslationControlContext | None,
    memory_store: JobMemoryStore | None = None,
    executors: list[ThreadPoolExecutor],
    translate_fn: TranslateBatchFn = default_translate_batch,
) -> dict[object, tuple[str, list[dict]]]:
    if not batches:
        return {}
    executor = ThreadPoolExecutor(max_workers=max(1, worker_count))
    executors.append(executor)
    return {
        executor.submit(
            _translate_batch_or_keep_origin,
            batch,
            api_key=api_key,
            model=model,
            base_url=base_url,
            request_label=f"book: {queue_name} batch {index}/{len(batches)}",
            domain_guidance=domain_guidance,
            mode=mode,
            context=translation_context,
            memory_store=memory_store,
            translate_fn=translate_fn,
        ): (queue_name, batch)
        for index, batch in enumerate(batches, start=1)
    }


__all__ = [
    "_keep_origin_results_for_transport_batch",
    "_failed_results_for_transport_batch",
    "_submit_parallel_translation_batches",
    "_translate_batch_or_keep_origin",
]

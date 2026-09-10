from __future__ import annotations

from dataclasses import replace
from typing import Any
from typing import Protocol

from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.llm.shared.control_context import build_translation_control_context


class TranslationMemorySummary(Protocol):
    def summary(self) -> str: ...


class TranslationMemoryBatchSummary(TranslationMemorySummary, Protocol):
    def summary_for_batch(self, batch: list[dict]) -> str: ...


def merge_guidance_parts(*parts: str) -> str:
    return "\n\n".join(part.strip() for part in parts if part and part.strip()).strip()


def memory_summary(memory_store: TranslationMemorySummary | None) -> str:
    return memory_store.summary() if memory_store is not None else ""


def memory_summary_for_batch(memory_store: TranslationMemorySummary | None, batch: list[dict] | None) -> str:
    if memory_store is None:
        return ""
    if batch is not None and hasattr(memory_store, "summary_for_batch"):
        return str(getattr(memory_store, "summary_for_batch")(batch) or "")
    return memory_store.summary()


def memory_summary_for_mode(
    memory_store: TranslationMemorySummary | None,
    batch: list[dict] | None,
    *,
    mode: str = "matched",
) -> str:
    resolved_mode = str(mode or "matched").strip().lower()
    if resolved_mode == "off" or memory_store is None:
        return ""
    if resolved_mode == "broad":
        return memory_store.summary()
    return memory_summary_for_batch(memory_store, batch)


def domain_guidance_with_memory(domain_guidance: str, memory_store: TranslationMemorySummary | None) -> str:
    return merge_guidance_parts(domain_guidance, memory_summary(memory_store))


def domain_guidance_with_retrieved_memory(
    domain_guidance: str,
    memory_store: TranslationMemorySummary | None,
    batch: list[dict] | None,
    memory_mode: str = "matched",
) -> str:
    return merge_guidance_parts(
        domain_guidance,
        memory_summary_for_mode(memory_store, batch, mode=memory_mode),
    )


def context_with_memory_guidance(
    context: TranslationControlContext | None,
    *,
    domain_guidance: str = "",
    memory_store: TranslationMemorySummary | None = None,
    batch: list[dict[str, Any]] | None = None,
    mode: str = "fast",
    request_label: str = "",
) -> TranslationControlContext:
    base_domain_guidance = context.domain_guidance if context is not None and context.domain_guidance.strip() else domain_guidance
    memory_mode = str(getattr(context, "memory_mode", "matched") if context is not None else "matched")
    merged_domain_guidance = domain_guidance_with_retrieved_memory(
        base_domain_guidance,
        memory_store,
        batch,
        memory_mode=memory_mode,
    )
    if not merged_domain_guidance and batch is None:
        merged_domain_guidance = domain_guidance_with_memory(
            base_domain_guidance,
            memory_store,
        )
    if context is None:
        return build_translation_control_context(
            mode=mode,
            domain_guidance=merged_domain_guidance,
            request_label=request_label,
        )
    return replace(
        context,
        domain_guidance=merged_domain_guidance,
        request_label=request_label or context.request_label,
    )


__all__ = [
    "context_with_memory_guidance",
    "domain_guidance_with_memory",
    "domain_guidance_with_retrieved_memory",
    "memory_summary",
    "memory_summary_for_batch",
    "memory_summary_for_mode",
    "merge_guidance_parts",
]

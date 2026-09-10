from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from retainpdf_pipeline.translate.core.context.models import TranslationDocumentContext
from retainpdf_pipeline.translate.core.context.models import TranslationItemContext
from retainpdf_pipeline.translate.core.context.models import build_item_context
from retainpdf_pipeline.translate.core.context.models import sanitize_prompt_context_text


@dataclass(frozen=True)
class TranslationUnitContext:
    """Stable context bundle for one translation unit.

    This is intentionally data-only. Workflow can build it, providers can read
    from it, but neither side should mutate payload fields through this object.
    """

    document: TranslationDocumentContext
    item: TranslationItemContext
    context_before: str = ""
    context_after: str = ""
    memory_guidance: str = ""
    glossary_guidance: str = ""

    def prompt_context_before(self) -> str:
        return sanitize_prompt_context_text(self.context_before or self.item.context_before)

    def prompt_context_after(self) -> str:
        return sanitize_prompt_context_text(self.context_after or self.item.context_after)

    def prompt_guidance_parts(self) -> list[str]:
        parts = [
            self.document.domain_guidance,
            self.document.rule_guidance,
            self.document.glossary_guidance,
            self.memory_guidance,
            self.glossary_guidance,
        ]
        return [part.strip() for part in parts if part and part.strip()]


def build_unit_context(
    item: dict[str, Any],
    *,
    document_context: TranslationDocumentContext | None = None,
    order: int = 0,
    page_idx: int | None = None,
    memory_guidance: str = "",
    glossary_guidance: str = "",
) -> TranslationUnitContext:
    item_context = build_item_context(item, order=order, page_idx=page_idx)
    return TranslationUnitContext(
        document=document_context or TranslationDocumentContext(),
        item=item_context,
        context_before=item_context.context_before,
        context_after=item_context.context_after,
        memory_guidance=memory_guidance,
        glossary_guidance=glossary_guidance,
    )


def build_unit_contexts(
    payload: list[dict[str, Any]],
    *,
    document_context: TranslationDocumentContext | None = None,
    page_idx: int | None = None,
    memory_guidance: str = "",
    glossary_guidance: str = "",
) -> list[TranslationUnitContext]:
    return [
        build_unit_context(
            item,
            document_context=document_context,
            order=order,
            page_idx=page_idx,
            memory_guidance=memory_guidance,
            glossary_guidance=glossary_guidance,
        )
        for order, item in enumerate(payload, start=1)
    ]


__all__ = ["TranslationUnitContext", "build_unit_context", "build_unit_contexts"]

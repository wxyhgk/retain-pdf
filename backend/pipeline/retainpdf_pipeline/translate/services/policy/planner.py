from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.translate.services.context import TranslationDocumentContext
from retainpdf_pipeline.translate.services.context import build_page_item_contexts


def _load_classifier():
    from retainpdf_pipeline.translate.services.classification.page_classifier import classify_item_contexts

    return classify_item_contexts


@dataclass(frozen=True)
class TranslationPlanDecision:
    item_id: str
    action: str
    reason: str = ""
    preserve_layout: bool = False


class TranslationPlanner:
    def __init__(self, document_context: TranslationDocumentContext):
        self.document_context = document_context

    def classify_no_trans(
        self,
        payload: list[dict],
        *,
        api_key: str,
        model: str,
        base_url: str,
        batch_size: int,
        request_label: str = "",
        request_chat_content_fn: Callable[..., str] | None = None,
    ) -> dict[str, str]:
        classify_item_contexts = _load_classifier()
        item_contexts = build_page_item_contexts(payload)
        return classify_item_contexts(
            item_contexts,
            api_key=api_key,
            model=model,
            base_url=base_url,
            batch_size=batch_size,
            rule_guidance=self.document_context.rule_guidance,
            request_label=request_label,
            request_chat_content_fn=request_chat_content_fn,
        )


__all__ = ["TranslationPlanDecision", "TranslationPlanner"]

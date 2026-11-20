from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from retainpdf_translation.services.context import TranslationDocumentContext
from retainpdf_translation.services.context import build_page_item_contexts


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
        classify_fn: Callable[..., dict[str, str]] | None = None,
    ) -> dict[str, str]:
        """`classify_fn`：调模型分类的函数，普通翻译引擎传进来（`TranslationPolicyConfig.page_classifier`）；没给就报错。"""
        if classify_fn is None:
            raise RuntimeError("page no-translation classification is on but no classifier was configured")
        classify_item_contexts = classify_fn
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

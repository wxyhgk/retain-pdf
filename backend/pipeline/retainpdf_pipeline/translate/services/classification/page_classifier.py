from typing import Callable
from retainpdf_pipeline.translate.llm.shared.executor_context import scoped_request

from retainpdf_pipeline.translate.services.classification.prompting import build_prompt
from retainpdf_pipeline.translate.services.classification.response_parser import parse_no_trans_response
from retainpdf_pipeline.translate.services.classification.rule_engine import rule_label
from retainpdf_pipeline.translate.services.classification.rule_engine import should_include
from retainpdf_pipeline.translate.services.context import TranslationItemContext
from retainpdf_pipeline.translate.services.context import build_item_context
from retainpdf_pipeline.translate.services.context import build_page_item_contexts
from retainpdf_pipeline.translate.core.ocr.models import TextItem


def _candidate_text_item_context(item: TextItem, order: int) -> TranslationItemContext:
    return build_item_context(
        {
            "item_id": item.item_id,
            "block_type": item.block_type,
            "block_kind": getattr(item, "block_kind", item.block_type),
            "layout_role": getattr(item, "layout_role", ""),
            "semantic_role": getattr(item, "semantic_role", ""),
            "structure_role": getattr(item, "structure_role", ""),
            "policy_translate": getattr(item, "policy_translate", None),
            "bbox": item.bbox,
            "source_text": item.text,
            "protected_source_text": item.text,
            "formula_map": item.formula_map if hasattr(item, "formula_map") else [],
            "segments": item.segments,
            "lines": item.lines,
            "metadata": item.metadata,
        },
        order=order,
    )


def _candidate_record(item: dict, order: int) -> dict:
    return build_item_context(item, order=order).as_classification_record()



def classify_item_contexts(
    item_contexts: list[TranslationItemContext],
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    batch_size: int = 12,
    rule_guidance: str = "",
    request_label: str = "",
    request_chat_content_fn: Callable[..., str] | None = None,
) -> dict[str, str]:
    del batch_size
    page_items = [context.as_classification_record() for context in item_contexts]
    filtered = [item for item in page_items if should_include(item)]
    if not filtered:
        return {}
    for item in filtered:
        item["rule_label"] = rule_label(item)
    review_items = [item for item in filtered if item["rule_label"] == "review"]
    labels = {item["item_id"]: item["rule_label"] for item in filtered if item["rule_label"] != "review"}
    if review_items:
        if request_chat_content_fn is None:
            raise ValueError("request_chat_content_fn is required when classification has review items")
        if request_label:
            print(f"{request_label}: review_items={len(review_items)} filtered={len(filtered)}", flush=True)
        content = scoped_request("classification", sorted(str(item.get("item_id", "")) for item in review_items), request_chat_content_fn,
            build_prompt(filtered, review_items, rule_guidance=rule_guidance),
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=None,
            timeout=120,
            request_label=request_label,
        )
        labels.update(parse_no_trans_response(content, review_items))
    return labels


def classify_payload_items(
    payload: list[dict],
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    batch_size: int = 12,
    rule_guidance: str = "",
    request_label: str = "",
    request_chat_content_fn: Callable[..., str] | None = None,
) -> dict[str, str]:
    return classify_item_contexts(
        build_page_item_contexts(payload),
        api_key=api_key,
        model=model,
        base_url=base_url,
        batch_size=batch_size,
        rule_guidance=rule_guidance,
        request_label=request_label,
        request_chat_content_fn=request_chat_content_fn,
    )


def classify_text_items(
    items: list[TextItem],
    api_key: str = "",
    model: str = "",
    base_url: str = "",
    batch_size: int = 12,
    rule_guidance: str = "",
    request_label: str = "",
    request_chat_content_fn: Callable[..., str] | None = None,
) -> dict[str, str]:
    return classify_item_contexts(
        [_candidate_text_item_context(item, order) for order, item in enumerate(items, start=1)],
        api_key=api_key,
        model=model,
        base_url=base_url,
        batch_size=batch_size,
        rule_guidance=rule_guidance,
        request_label=request_label,
        request_chat_content_fn=request_chat_content_fn,
    )

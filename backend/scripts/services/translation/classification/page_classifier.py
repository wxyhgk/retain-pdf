from services.translation.classification.prompting import build_prompt
from services.translation.classification.response_parser import parse_no_trans_response
from services.translation.classification.rule_engine import rule_label
from services.translation.classification.rule_engine import should_include
from services.translation.context import TranslationItemContext
from services.translation.context import build_item_context
from services.translation.context import build_page_item_contexts
from services.translation.ocr.models import TextItem
from services.translation.llm.shared.provider_runtime import DEFAULT_BASE_URL, DEFAULT_MODEL, request_chat_content


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



def classify_item_contexts(
    item_contexts: list[TranslationItemContext],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    batch_size: int = 12,
    rule_guidance: str = "",
    request_label: str = "",
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
        if request_label:
            print(f"{request_label}: review_items={len(review_items)} filtered={len(filtered)}", flush=True)
        content = request_chat_content(
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
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    batch_size: int = 12,
    rule_guidance: str = "",
    request_label: str = "",
) -> dict[str, str]:
    return classify_item_contexts(
        build_page_item_contexts(payload),
        api_key=api_key,
        model=model,
        base_url=base_url,
        batch_size=batch_size,
        rule_guidance=rule_guidance,
        request_label=request_label,
    )


def classify_text_items(
    items: list[TextItem],
    api_key: str = "",
    model: str = DEFAULT_MODEL,
    base_url: str = DEFAULT_BASE_URL,
    batch_size: int = 12,
    rule_guidance: str = "",
    request_label: str = "",
) -> dict[str, str]:
    return classify_item_contexts(
        [_candidate_text_item_context(item, order) for order, item in enumerate(items, start=1)],
        api_key=api_key,
        model=model,
        base_url=base_url,
        batch_size=batch_size,
        rule_guidance=rule_guidance,
        request_label=request_label,
    )

import re

from translation.classification.prompting import build_prompt
from translation.classification.response_parser import parse_no_trans_response
from translation.classification.rule_engine import rule_label
from translation.classification.rule_engine import should_include
from translation.ocr.models import TextItem
from translation.llm import request_chat_content


def _count_inline_formulas(segments: list[dict]) -> int:
    return sum(1 for segment in segments if segment.get("type") == "inline_equation")


def _line_texts(lines: list[dict]) -> list[str]:
    return [" ".join(span.get("content", "") for span in line.get("spans", [])).strip() for line in lines]


def _candidate_record(item: dict, order: int) -> dict:
    lines = item.get("lines", [])
    return {
        "order": order,
        "item_id": item["item_id"],
        "block_type": item.get("block_type", "unknown"),
        "bbox": item.get("bbox", []),
        "source_text": item.get("source_text", ""),
        "line_count": len(lines),
        "lines": lines,
        "line_texts": _line_texts(lines),
        "has_inline_formula": bool(item.get("formula_map")),
        "metadata": item.get("metadata", {}),
    }


def _candidate_text_item(item: TextItem, order: int) -> dict:
    return {
        "order": order,
        "item_id": item.item_id,
        "block_type": item.block_type,
        "bbox": item.bbox,
        "source_text": item.text,
        "line_count": len(item.lines),
        "lines": item.lines,
        "line_texts": _line_texts(item.lines),
        "has_inline_formula": _count_inline_formulas(item.segments) > 0,
        "metadata": item.metadata,
    }



def classify_payload_items(
    payload: list[dict],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    batch_size: int = 12,
) -> dict[str, str]:
    del batch_size
    page_items = [_candidate_record(item, order) for order, item in enumerate(payload, start=1)]
    filtered = [item for item in page_items if should_include(item)]
    if not filtered:
        return {}
    for item in filtered:
        item["rule_label"] = rule_label(item)
    review_items = [item for item in filtered if item["rule_label"] == "review"]
    labels = {item["item_id"]: item["rule_label"] for item in filtered if item["rule_label"] != "review"}
    if review_items:
        content = request_chat_content(
            build_prompt(filtered, review_items),
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=None,
            timeout=120,
        )
        labels.update(parse_no_trans_response(content, review_items))
    return labels


def classify_text_items(
    items: list[TextItem],
    api_key: str = "",
    model: str = "deepseek-chat",
    base_url: str = "https://api.deepseek.com/v1",
    batch_size: int = 12,
) -> dict[str, str]:
    del batch_size
    page_items = [_candidate_text_item(item, order) for order, item in enumerate(items, start=1)]
    filtered = [item for item in page_items if should_include(item)]
    if not filtered:
        return {}
    for item in filtered:
        item["rule_label"] = rule_label(item)
    review_items = [item for item in filtered if item["rule_label"] == "review"]
    labels = {item["item_id"]: item["rule_label"] for item in filtered if item["rule_label"] != "review"}
    if review_items:
        content = request_chat_content(
            build_prompt(filtered, review_items),
            api_key=api_key,
            model=model,
            base_url=base_url,
            temperature=0.0,
            response_format=None,
            timeout=120,
        )
        labels.update(parse_no_trans_response(content, review_items))
    return labels

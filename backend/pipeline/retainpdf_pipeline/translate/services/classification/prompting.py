from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.core.item_reader import item_block_kind
from retainpdf_pipeline.translate.core.item_reader import item_effective_role
from retainpdf_pipeline.translate.core.item_reader import item_layout_role
from retainpdf_pipeline.translate.core.item_reader import item_semantic_role
from retainpdf_pipeline.translate.services.policy.soft_hints import build_soft_rule_hints


MAX_TEXT_CHARS = 320


def short_text(text: str, limit: int = MAX_TEXT_CHARS) -> str:
    normalized = " ".join((text or "").split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 3] + "..."


def compact_bbox(bbox: list[float]) -> str:
    if len(bbox) != 4:
        return "[]"
    ints = [int(round(value)) for value in bbox]
    return f"[{ints[0]},{ints[1]},{ints[2]},{ints[3]}]"


def build_prompt(page_items: list[dict], review_items: list[dict], rule_guidance: str = "") -> list[dict[str, str]]:
    system_prompt = load_prompt("classification_system.txt")
    if rule_guidance.strip():
        system_prompt = f"{system_prompt}\n\nAdditional rule guidance:\n{rule_guidance.strip()}"
    blocks = []
    review_orders = {item["order"] for item in review_items}
    for item in page_items:
        status = "REVIEW" if item["order"] in review_orders else f"LOCKED:{item['rule_label']}"
        block_kind = item_block_kind(item)
        layout_role = item_layout_role(item) or "-"
        semantic_role = item_semantic_role(item) or "-"
        effective_role = item_effective_role(item) or "body"
        blocks.append(
            "\n".join(
                [
                    f"{item['order']}.",
                    f"status: {status}",
                    f"block_kind: {block_kind}",
                    f"layout_role: {layout_role}",
                    f"semantic_role: {semantic_role}",
                    f"effective_role: {effective_role}",
                    f"bbox: {compact_bbox(item['bbox'])}",
                    f"line_count: {item['line_count']}",
                    f"has_inline_formula: {str(item['has_inline_formula']).lower()}",
                    f"soft_hints: {', '.join(build_soft_rule_hints(item)) or '-'}",
                    f"text: {short_text(item['source_text'])}",
                ]
            )
        )
    user_prompt = "Full page block list:\n\n" + "\n\n".join(blocks)
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

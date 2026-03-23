from common.prompt_loader import load_prompt


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


def build_prompt(page_items: list[dict], review_items: list[dict]) -> list[dict[str, str]]:
    system_prompt = load_prompt("classification_system.txt")
    blocks = []
    review_orders = {item["order"] for item in review_items}
    for item in page_items:
        status = "REVIEW" if item["order"] in review_orders else f"LOCKED:{item['rule_label']}"
        blocks.append(
            "\n".join(
                [
                    f"{item['order']}.",
                    f"status: {status}",
                    f"ocr_type: {item['block_type']}",
                    f"structure_role: {item.get('metadata', {}).get('structure_role', 'body')}",
                    f"bbox: {compact_bbox(item['bbox'])}",
                    f"line_count: {item['line_count']}",
                    f"has_inline_formula: {str(item['has_inline_formula']).lower()}",
                    f"text: {short_text(item['source_text'])}",
                ]
            )
        )
    user_prompt = "Full page block list:\n\n" + "\n\n".join(blocks)
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

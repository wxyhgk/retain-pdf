from translation.payload_parts.common import has_any_translation


def summarize_payload(payload: list[dict], translation_path: str, page_idx: int, classified_items: int) -> dict:
    translated_count = sum(1 for item in payload if has_any_translation(item))
    skipped_count = sum(1 for item in payload if not item.get("should_translate", True))
    pending_count = sum(
        1
        for item in payload
        if item.get("should_translate", True) and not has_any_translation(item)
    )
    return {
        "translation_path": translation_path,
        "page_idx": page_idx,
        "total_items": len(payload),
        "translated_items": translated_count,
        "pending_items": pending_count,
        "classified_items": classified_items,
        "skipped_items": skipped_count,
    }

from __future__ import annotations

import re
from typing import Any


def normalize_space(text: object) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def source_text_from_item(item: dict[str, Any]) -> str:
    return normalize_space(
        item.get("translation_unit_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or item.get("text")
        or ""
    )


def source_text_for_batch(batch: list[dict]) -> str:
    return "\n".join(source_text_from_item(item) for item in batch if source_text_from_item(item)).strip()


def clean_term_key(text: str) -> str:
    cleaned = normalize_space(text)
    cleaned = cleaned.strip(" ,.;:()[]{}，。；：（）【】")
    return cleaned[:80]


def clean_term_value(text: str) -> str:
    cleaned = normalize_space(text)
    cleaned = cleaned.strip(" ,.;:()[]{}，。；：（）【】")
    return cleaned[:80]


def cjk_count(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text or ""))

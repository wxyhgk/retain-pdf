from __future__ import annotations

import hashlib
import json
from typing import Any

# Keep this projection deliberately small. It describes durable translation
# state and excludes diagnostics, provider responses, prompts, and credentials.
_TRANSLATION_FINGERPRINT_FIELDS = (
    "final_status",
    "decision",
    "should_translate",
    "translated_text",
    "protected_translated_text",
    "translation_unit_translated_text",
    "translation_unit_protected_translated_text",
    "group_translated_text",
    "group_protected_translated_text",
)


def translation_item_fingerprint(item: dict[str, Any]) -> str:
    projection = {field: item.get(field) for field in _TRANSLATION_FINGERPRINT_FIELDS}
    encoded = json.dumps(
        projection,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


__all__ = ["translation_item_fingerprint"]

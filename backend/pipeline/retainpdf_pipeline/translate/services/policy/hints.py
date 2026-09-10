from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TranslationPolicyHint:
    """A non-destructive policy hint attached before model translation."""

    item_id: str
    structure_kind: str
    style_hint: str


def apply_policy_hints(payload: list[dict], hints: list[TranslationPolicyHint]) -> int:
    if not hints:
        return 0

    hints_by_item_id = {hint.item_id: hint for hint in hints if hint.item_id}
    applied = 0
    for item in payload:
        item_id = str(item.get("item_id", "") or "")
        hint = hints_by_item_id.get(item_id)
        if hint is None:
            continue

        existing = str(item.get("translation_style_hint", "") or "").strip()
        item["translation_style_hint"] = f"{existing}\n{hint.style_hint}".strip() if existing else hint.style_hint
        item["translation_structure_kind"] = hint.structure_kind

        metadata = dict(item.get("metadata", {}) or {})
        metadata["translation_structure_kind"] = hint.structure_kind
        metadata["translation_style_hint"] = item["translation_style_hint"]
        item["metadata"] = metadata
        applied += 1
    return applied


__all__ = ["TranslationPolicyHint", "apply_policy_hints"]

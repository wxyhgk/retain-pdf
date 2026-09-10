from __future__ import annotations

import re


KEEP_ORIGIN_LABEL = "keep_origin"
INTERNAL_PLACEHOLDER_DEGRADED_REASON = "placeholder_unstable"


def normalize_inline_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def normalize_decision(value: str) -> str:
    normalized = (value or "translate").strip().lower().replace("-", "_")
    if normalized in {"keep", "skip", "no_translate", "keeporigin"}:
        return KEEP_ORIGIN_LABEL
    if normalized == KEEP_ORIGIN_LABEL:
        return KEEP_ORIGIN_LABEL
    return "translate"


def result_entry(decision: str, translated_text: str) -> dict[str, str]:
    normalized_decision = normalize_decision(decision)
    payload = {
        "decision": normalized_decision,
        "translated_text": "" if normalized_decision == KEEP_ORIGIN_LABEL else (translated_text or "").strip(),
    }
    payload["final_status"] = "kept_origin" if normalized_decision == KEEP_ORIGIN_LABEL else "translated"
    return payload


def internal_keep_origin_result(reason: str) -> dict[str, str]:
    result = result_entry(KEEP_ORIGIN_LABEL, "")
    result["_internal_reason"] = reason
    return result


def is_internal_placeholder_degraded(payload: dict[str, str]) -> bool:
    return str(payload.get("_internal_reason", "") or "") == INTERNAL_PLACEHOLDER_DEGRADED_REASON


def text_preview(text: str, *, limit: int = 220) -> str:
    normalized = normalize_inline_whitespace(text)
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: max(0, limit - 1)].rstrip()}…"


__all__ = [
    "INTERNAL_PLACEHOLDER_DEGRADED_REASON",
    "KEEP_ORIGIN_LABEL",
    "internal_keep_origin_result",
    "is_internal_placeholder_degraded",
    "normalize_decision",
    "result_entry",
    "text_preview",
]

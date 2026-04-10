from __future__ import annotations

from typing import Any

from .structured_output import extract_string_fields
from .structured_output import parse_structured_json


def parse_domain_context_response(content: str, *, preview_text: str) -> dict[str, str]:
    try:
        payload = parse_structured_json(content)
    except Exception:
        payload = extract_string_fields(
            content,
            {
                "domain": ("domain", "DOMAIN"),
                "summary": ("summary", "SUMMARY"),
                "translation_guidance": ("translation_guidance", "TRANSLATION_GUIDANCE", "guidance"),
            },
        )
        if not payload:
            raise
    return {
        "domain": str(payload.get("domain", payload.get("DOMAIN", ""))).strip(),
        "summary": str(payload.get("summary", payload.get("SUMMARY", ""))).strip(),
        "translation_guidance": str(
            payload.get("translation_guidance", payload.get("TRANSLATION_GUIDANCE", payload.get("guidance", "")))
        ).strip(),
        "preview_text": preview_text,
    }


def parse_continuation_review_response(content: str) -> dict[str, str]:
    payload = parse_structured_json(content)
    decisions = payload.get("decisions", [])
    result: dict[str, str] = {}
    if not isinstance(decisions, list):
        return result
    for item in decisions:
        if not isinstance(item, dict):
            continue
        pair_id = str(item.get("pair_id", "") or "").strip()
        decision = str(item.get("decision", "") or "").strip().lower()
        if not pair_id:
            continue
        result[pair_id] = "join" if decision == "join" else "break"
    return result


def parse_garbled_reconstruction_response(content: str) -> str:
    payload = parse_structured_json(content)
    return str(payload.get("translated_text", "") or "").strip()

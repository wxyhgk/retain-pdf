from __future__ import annotations


def preview_text(text: object, *, limit: int = 220) -> str:
    compact = " ".join(str(text or "").split()).strip()
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def raw_excerpt_from_diagnostics(payload: dict, *, limit: int = 260) -> str:
    direct = payload.get("raw_excerpt") or payload.get("raw_output") or payload.get("raw_response")
    if direct:
        return preview_text(direct, limit=limit)
    for entry in payload.get("error_trace") or []:
        if not isinstance(entry, dict):
            continue
        candidate = entry.get("raw_excerpt") or entry.get("raw_output") or entry.get("message")
        if candidate:
            return preview_text(candidate, limit=limit)
    return ""


def normalized_item_diagnostics(item: dict, payload: dict, *, page_idx: int) -> dict:
    normalized = dict(payload)
    normalized.setdefault("item_id", item.get("item_id", ""))
    normalized.setdefault("page_idx", page_idx)
    normalized.setdefault("provider", str(payload.get("provider", "") or payload.get("provider_family", "") or "translation"))
    normalized.setdefault("prompt_mode", str(payload.get("prompt_mode", "") or item.get("math_mode", "") or ""))
    normalized.setdefault("request_label", str(payload.get("request_label", "") or ""))
    normalized.setdefault("raw_excerpt", raw_excerpt_from_diagnostics(normalized))
    return normalized


__all__ = ["normalized_item_diagnostics", "preview_text", "raw_excerpt_from_diagnostics"]

from __future__ import annotations

import json
import re

REASONING_LEAK_MARKERS = (
    "保持简洁",
    "按照规则",
    "因此输出",
    "综上，输出",
    "注意：原文",
    "译文也应保留",
    "为保准确",
    "更简洁",
    "我选择",
    "可以译为",
    "可译为",
)
REASONING_LEAK_FINAL_PATTERNS = (
    re.compile(r"(?:综上，输出。?|因此输出：?)\s*(?P<text>.+?)\s*$", re.S),
    re.compile(r"输出[:：]\s*(?P<text>.+?)\s*$", re.S),
    re.compile(r"我选择[:：]\s*[\"“](?P<text>[^\"”\n]+)[\"”]", re.S),
    re.compile(r"我选择[:：]\s*(?P<text>[^\n。]+)", re.S),
)


def unwrap_json_translated_text(text: str) -> tuple[str, str] | None:
    raw = str(text or "").strip()
    if not raw.startswith("{") or ("translated_text" not in raw and "translations" not in raw):
        return None
    try:
        payload = json.loads(raw)
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    if "translated_text" in payload:
        decision = str(payload.get("decision", "translate") or "translate").strip() or "translate"
        translated_text = str(payload.get("translated_text", "") or "").strip()
        return decision, translated_text
    translations = payload.get("translations", [])
    if not isinstance(translations, list) or len(translations) != 1 or not isinstance(translations[0], dict):
        return None
    decision = str(translations[0].get("decision", "translate") or "translate").strip() or "translate"
    translated_text = str(translations[0].get("translated_text", "") or "").strip()
    return decision, translated_text


def normalize_result_entry(value) -> tuple[str, str]:
    if isinstance(value, dict):
        decision = str(value.get("decision", "translate") or "translate").strip() or "translate"
        translated_text = str(value.get("translated_text", "") or "").strip()
        return decision, translated_text
    text = str(value or "").strip()
    unwrapped = unwrap_json_translated_text(text)
    if unwrapped is not None:
        return unwrapped
    return "translate", text


def salvage_reasoning_leak(text: str) -> tuple[str, bool]:
    raw = str(text or "").strip()
    if not raw:
        return raw, False
    if sum(1 for marker in REASONING_LEAK_MARKERS if marker in raw) < 2:
        return raw, False
    for pattern in REASONING_LEAK_FINAL_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        candidate = str(match.group("text") or "").strip()
        candidate = candidate.splitlines()[0].strip()
        candidate = candidate.strip("\"“”")
        if candidate and len(candidate) < max(180, len(raw) * 0.35):
            return candidate, True
    quoted_candidates = re.findall(r"[\"“]([^\"”\n]{4,180})[\"”]", raw)
    for candidate in reversed(quoted_candidates):
        candidate = candidate.strip()
        if not candidate:
            continue
        if re.search(r"[\u4e00-\u9fff]", candidate) and not re.search(r"[A-Za-z]{4,}", candidate):
            return candidate, True
    return raw, False


def extract_result_metadata(value) -> dict:
    if isinstance(value, dict):
        return dict(value)
    raw = str(value or "").strip()
    if not raw.startswith("{") or ("translated_text" not in raw and "translations" not in raw):
        return {}
    try:
        payload = json.loads(raw)
    except Exception:
        return {}
    return dict(payload) if isinstance(payload, dict) else {}


def result_diagnostics_for_item(metadata: dict, item: dict) -> dict:
    diagnostics = dict(metadata.get("translation_diagnostics") or {})
    if not diagnostics:
        return {}
    diagnostics["item_id"] = item.get("item_id", "")
    if item.get("page_idx") is not None:
        diagnostics["page_idx"] = item.get("page_idx")
    return diagnostics


def with_sanitized_translation(
    protected_translated_text: str,
    metadata: dict,
) -> tuple[str, dict]:
    sanitized, changed = salvage_reasoning_leak(protected_translated_text)
    if not changed:
        return protected_translated_text, metadata
    metadata = dict(metadata)
    diagnostics = dict(metadata.get("translation_diagnostics") or {})
    diagnostics["degradation_reason"] = "reasoning_leak_salvaged"
    diagnostics["final_status"] = "partially_translated"
    metadata["translation_diagnostics"] = diagnostics
    metadata["final_status"] = "partially_translated"
    return sanitized, metadata


__all__ = [
    "extract_result_metadata",
    "normalize_result_entry",
    "result_diagnostics_for_item",
    "salvage_reasoning_leak",
    "unwrap_json_translated_text",
    "with_sanitized_translation",
]

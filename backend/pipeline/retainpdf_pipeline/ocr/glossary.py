"""OCR-local glossary JSON parsing (stage-contract duplicate).

Duplicated normalization from
retainpdf_pipeline.translate.core.terms.glossary (``parse_glossary_json``).

Stage boundary note: this returns plain ``list[dict]`` payloads, not
translate's ``GlossaryEntry`` objects. The translate stage normalizes dicts
and objects identically downstream, so parsing to dicts keeps ocr free of the
translate type while preserving end-to-end glossary semantics.
"""

from __future__ import annotations

import json
from typing import Any, Literal


def _normalize_level(value: object) -> Literal["preserve", "canonical", "preferred"]:
    normalized = str(value or "preferred").strip().lower()
    if normalized in {"preserve", "canonical", "preferred"}:
        return normalized  # type: ignore[return-value]
    return "preferred"


def _normalize_match_mode(value: object) -> Literal["exact", "regex", "case_insensitive"]:
    normalized = str(value or "exact").strip().lower()
    if normalized in {"exact", "regex", "case_insensitive"}:
        return normalized  # type: ignore[return-value]
    return "exact"


def parse_glossary_json(text: str) -> list[dict[str, Any]]:
    raw = (text or "").strip()
    if not raw:
        return []
    payload = json.loads(raw)
    if not isinstance(payload, list):
        raise ValueError("glossary_json must be a JSON array")
    entries: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        source = str(item.get("source", "") or "").strip()
        target = str(item.get("target", "") or "").strip()
        if not source or not target:
            continue
        raw_context = item.get("context")
        context = str(raw_context).strip() if raw_context is not None and str(raw_context).strip() else None
        entries.append(
            {
                "source": source,
                "target": target,
                "level": _normalize_level(item.get("level")),
                "match_mode": _normalize_match_mode(item.get("match_mode") or item.get("match")),
                "context": context,
                "note": str(item.get("note", "") or "").strip(),
            }
        )
    return entries


__all__ = ["parse_glossary_json"]

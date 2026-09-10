"""Translate-local continuation-hint defaults (file-contract duplicate).

Duplicated from retainpdf_pipeline.ocr.document_schema.defaults
:func:`normalize_block_continuation_hint` /
:func:`default_block_continuation_hint`
(stage-decouple: translate must not import ocr; duplicate wins over cross-package).
"""

from __future__ import annotations


def default_block_continuation_hint() -> dict:
    return {
        "source": "",
        "group_id": "",
        "role": "",
        "scope": "",
        "reading_order": -1,
        "confidence": 0.0,
    }


def normalize_block_continuation_hint(value: dict | None) -> dict:
    hint = default_block_continuation_hint()
    if not isinstance(value, dict):
        return hint
    for key in ("source", "group_id", "role", "scope"):
        raw = value.get(key, "")
        hint[key] = raw.strip() if isinstance(raw, str) else ""
    reading_order = value.get("reading_order", -1)
    if isinstance(reading_order, int) and not isinstance(reading_order, bool):
        hint["reading_order"] = max(-1, reading_order)
    confidence = value.get("confidence", 0.0)
    if isinstance(confidence, (int, float)) and not isinstance(confidence, bool):
        hint["confidence"] = min(1.0, max(0.0, float(confidence)))
    return hint


__all__ = [
    "default_block_continuation_hint",
    "normalize_block_continuation_hint",
]

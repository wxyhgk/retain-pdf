from __future__ import annotations

import json
from pathlib import Path


def load_normalization_report(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def build_normalization_summary(report: dict | None) -> dict:
    data = report or {}
    compat = data.get("compat", {}) or {}
    validation = data.get("validation", {}) or {}
    detection = data.get("detection", {}) or {}
    return {
        "provider": str(data.get("provider", "") or ""),
        "detected_provider": str(data.get("detected_provider", "") or ""),
        "provider_was_explicit": bool(data.get("provider_was_explicit", False)),
        "compat_pages": int(compat.get("pages_seen", 0) or 0),
        "compat_blocks": int(compat.get("blocks_seen", 0) or 0),
        "valid": bool(validation.get("valid", False)),
        "page_count": int(validation.get("page_count", 0) or 0),
        "block_count": int(validation.get("block_count", 0) or 0),
        "detection_matched": bool(detection.get("matched", False)),
        "detection_attempts": len(detection.get("attempts", []) or []),
    }


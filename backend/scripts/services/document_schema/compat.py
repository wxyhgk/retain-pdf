from __future__ import annotations

from copy import deepcopy

HARD_REQUIRED_DOCUMENT_KEYS = (
    "schema",
    "schema_version",
    "document_id",
    "source",
    "pages",
)

SOFT_DEFAULT_DOCUMENT_FIELDS = {
    "derived": {},
    "markers": {},
}

HARD_REQUIRED_PAGE_KEYS = (
    "width",
    "height",
    "unit",
    "blocks",
)

SOFT_DEFAULT_PAGE_FIELDS = {}

HARD_REQUIRED_BLOCK_KEYS = (
    "block_id",
    "type",
    "sub_type",
    "bbox",
    "text",
    "lines",
    "segments",
)

SOFT_DEFAULT_BLOCK_FIELDS = {
    "tags": [],
    "metadata": {},
    "source": {},
}


def default_block_derived() -> dict:
    return {
        "role": "",
        "by": "",
        "confidence": 0.0,
    }


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


def _increment(counter: dict[str, int], key: str) -> None:
    counter[key] = counter.get(key, 0) + 1


def _apply_document_defaults(document: dict, report: dict | None = None) -> None:
    for key, default in SOFT_DEFAULT_DOCUMENT_FIELDS.items():
        if key not in document:
            document[key] = deepcopy(default)
            if report is not None:
                _increment(report["document_defaults"], key)
    if "page_count" not in document and isinstance(document.get("pages"), list):
        document["page_count"] = len(document["pages"])
        if report is not None:
            _increment(report["document_defaults"], "page_count")


def _apply_page_defaults(page: dict, *, page_index: int, report: dict | None = None) -> None:
    if "page_index" not in page:
        page["page_index"] = page_index
        if report is not None:
            _increment(report["page_defaults"], "page_index")
    for key, default in SOFT_DEFAULT_PAGE_FIELDS.items():
        if key not in page:
            page[key] = deepcopy(default)
            if report is not None:
                _increment(report["page_defaults"], key)


def _apply_block_defaults(block: dict, *, page_index: int, order: int, report: dict | None = None) -> None:
    if "page_index" not in block:
        block["page_index"] = page_index
        if report is not None:
            _increment(report["block_defaults"], "page_index")
    if "order" not in block:
        block["order"] = order
        if report is not None:
            _increment(report["block_defaults"], "order")
    for key, default in SOFT_DEFAULT_BLOCK_FIELDS.items():
        if key not in block:
            block[key] = deepcopy(default)
            if report is not None:
                _increment(report["block_defaults"], key)
    if "derived" not in block:
        block["derived"] = default_block_derived()
        if report is not None:
            _increment(report["block_defaults"], "derived")
    if "continuation_hint" not in block:
        block["continuation_hint"] = default_block_continuation_hint()
        if report is not None:
            _increment(report["block_defaults"], "continuation_hint")
    else:
        normalized = normalize_block_continuation_hint(block.get("continuation_hint"))
        if block.get("continuation_hint") != normalized:
            block["continuation_hint"] = normalized
            if report is not None:
                _increment(report["block_defaults"], "continuation_hint")


def _build_empty_upgrade_report() -> dict:
    return {
        "document_defaults": {},
        "page_defaults": {},
        "block_defaults": {},
    }


def _summarize_upgrade_report(report: dict, upgraded: dict) -> dict:
    pages = upgraded.get("pages", []) or []
    return {
        "pages_seen": len(pages),
        "blocks_seen": sum(len(page.get("blocks", []) or []) for page in pages),
        "document_defaults": report["document_defaults"],
        "page_defaults": report["page_defaults"],
        "block_defaults": report["block_defaults"],
    }


def upgrade_document_payload(data: dict) -> dict:
    upgraded, _report = upgrade_document_payload_with_report(data)
    return upgraded


def upgrade_document_payload_with_report(data: dict) -> tuple[dict, dict]:
    upgraded = deepcopy(data)
    report = _build_empty_upgrade_report()
    _apply_document_defaults(upgraded, report)

    for page_index, page in enumerate(upgraded.get("pages", []) or []):
        _apply_page_defaults(page, page_index=page_index, report=report)
        for order, block in enumerate(page.get("blocks", []) or []):
            _apply_block_defaults(block, page_index=page_index, order=order, report=report)
    return upgraded, _summarize_upgrade_report(report, upgraded)


__all__ = [
    "HARD_REQUIRED_BLOCK_KEYS",
    "HARD_REQUIRED_DOCUMENT_KEYS",
    "HARD_REQUIRED_PAGE_KEYS",
    "SOFT_DEFAULT_BLOCK_FIELDS",
    "SOFT_DEFAULT_DOCUMENT_FIELDS",
    "SOFT_DEFAULT_PAGE_FIELDS",
    "default_block_continuation_hint",
    "default_block_derived",
    "normalize_block_continuation_hint",
    "upgrade_document_payload",
    "upgrade_document_payload_with_report",
]

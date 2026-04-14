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


def _build_empty_defaults_report() -> dict:
    return {
        "document_defaults": {},
        "page_defaults": {},
        "block_defaults": {},
    }


def _summarize_defaults_report(report: dict, document: dict) -> dict:
    pages = document.get("pages", []) or []
    return {
        "pages_seen": len(pages),
        "blocks_seen": sum(len(page.get("blocks", []) or []) for page in pages),
        "document_defaults": report["document_defaults"],
        "page_defaults": report["page_defaults"],
        "block_defaults": report["block_defaults"],
    }


def apply_document_defaults(data: dict) -> dict:
    document, _report = apply_document_defaults_with_report(data)
    return document


def apply_document_defaults_with_report(data: dict) -> tuple[dict, dict]:
    document = deepcopy(data)
    report = _build_empty_defaults_report()
    _apply_document_defaults(document, report)

    for page_index, page in enumerate(document.get("pages", []) or []):
        _apply_page_defaults(page, page_index=page_index, report=report)
        for order, block in enumerate(page.get("blocks", []) or []):
            _apply_block_defaults(block, page_index=page_index, order=order, report=report)
    return document, _summarize_defaults_report(report, document)


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
    "apply_document_defaults",
    "apply_document_defaults_with_report",
]

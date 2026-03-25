from __future__ import annotations

import re


REFERENCE_HEADING_SET = {
    "reference",
    "references",
    "references and notes",
    "bibliography",
    "works cited",
    "literature cited",
}

YEAR_RE = re.compile(r"\b(?:18|19|20)\d{2}[a-z]?\b", re.I)
DOI_RE = re.compile(r"\bdoi\b|10\.\d{4,9}/|https?://", re.I)
JOURNAL_RE = re.compile(
    r"\b(?:j\.|journal|chem|phys|soc|rev\.?|lett\.?|commun\.?|proc\.?|science|nature|"
    r"acs|springer|elsevier|wiley|vol\.?|volume|pages?|pp\.?|issue|no\.?)\b",
    re.I,
)
PAGE_RANGE_RE = re.compile(r"\b\d{1,4}\s*[-–]\s*\d{1,5}\b")
REF_INDEX_RE = re.compile(r"^(?:\(?\[?\d{1,3}\]?\)?[.)]?\s+)")
AUTHOR_START_RE = re.compile(
    r"^(?:\(?\[?\d{1,3}\]?\)?[.)]?\s+)?"
    r"(?:[A-Z][A-Za-z'`.-]+,\s*(?:[A-Z]\.\s*)+"
    r"|[A-Z][A-Za-z'`.-]+(?:\s+[A-Z][A-Za-z'`.-]+){0,2}\s*,\s*(?:[A-Z]\.\s*)+)",
)
LOWER_CONTINUATION_RE = re.compile(r"^[a-z(\\[\"'`]")


def _normalize_spaces(text: str) -> str:
    return " ".join((text or "").split())


def normalize_reference_heading(text: str) -> str:
    lowered = _normalize_spaces(text).lower().replace("&", " and ")
    lowered = re.sub(r"[^a-z ]+", " ", lowered)
    return " ".join(lowered.split())


def looks_like_reference_heading(text: str) -> bool:
    normalized = normalize_reference_heading(text)
    if not normalized:
        return False
    if normalized in REFERENCE_HEADING_SET:
        return True
    return normalized.startswith("references ") and normalized in REFERENCE_HEADING_SET


def _block_text(block: dict) -> str:
    parts: list[str] = []
    for line in block.get("lines", []) or []:
        for span in line.get("spans", []) or []:
            content = str(span.get("content", "") or "").strip()
            if content:
                parts.append(content)
    if parts:
        return _normalize_spaces(" ".join(parts))
    child_parts = [_block_text(child) for child in block.get("blocks", []) or []]
    return _normalize_spaces(" ".join(part for part in child_parts if part))


def resolve_reference_cutoff(data: dict) -> tuple[int | None, int | None]:
    for page_idx, page in enumerate(data.get("pdf_info", []) or []):
        for block_idx, block in enumerate(page.get("para_blocks", []) or []):
            stack = [block]
            while stack:
                current = stack.pop(0)
                if str(current.get("type", "") or "") == "title":
                    if looks_like_reference_heading(_block_text(current)):
                        return page_idx, block_idx
                stack[0:0] = list(current.get("blocks", []) or [])
    return None, None


def looks_like_reference_entry_text(text: str) -> bool:
    normalized = _normalize_spaces(text)
    if not normalized:
        return False
    comma_count = normalized.count(",") + normalized.count(";")
    year = bool(YEAR_RE.search(normalized))
    doi = bool(DOI_RE.search(normalized))
    journal = bool(JOURNAL_RE.search(normalized))
    page_range = bool(PAGE_RANGE_RE.search(normalized))
    indexed = bool(REF_INDEX_RE.match(normalized))
    author_start = bool(AUTHOR_START_RE.match(normalized))
    if doi and (year or comma_count >= 1):
        return True
    if indexed and (year or doi or journal or page_range or comma_count >= 2):
        return True
    if author_start and (year or doi or journal or page_range or comma_count >= 2):
        return True
    if year and journal and comma_count >= 1:
        return True
    if year and page_range and comma_count >= 1:
        return True
    return False


def looks_like_reference_continuation_text(text: str) -> bool:
    normalized = _normalize_spaces(text)
    if not normalized:
        return False
    if LOWER_CONTINUATION_RE.match(normalized):
        return True
    if normalized[:1] in {")", "]", ",", ".", ";", ":"}:
        return True
    if DOI_RE.search(normalized) or JOURNAL_RE.search(normalized) or PAGE_RANGE_RE.search(normalized):
        return True
    if YEAR_RE.search(normalized) and (normalized.count(",") >= 1 or len(normalized) <= 240):
        return True
    return False


__all__ = [
    "looks_like_reference_continuation_text",
    "looks_like_reference_entry_text",
    "looks_like_reference_heading",
    "normalize_reference_heading",
    "resolve_reference_cutoff",
]

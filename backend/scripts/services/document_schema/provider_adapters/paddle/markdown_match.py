from __future__ import annotations

import re


def enrich_markdown_match(*, metadata: dict, text: str, markdown_text: str) -> dict:
    plain_text = to_plain_text(text.strip())
    match_text = plain_text[:160]
    match_count = 0
    if match_text and markdown_text:
        match_count = markdown_text.count(match_text)
    metadata["markdown_match_text"] = match_text
    metadata["markdown_match_found"] = match_count > 0
    metadata["markdown_match_count"] = match_count
    return metadata


def to_plain_text(text: str) -> str:
    if not text:
        return ""
    without_tags = re.sub(r"<[^>]+>", " ", text)
    normalized = re.sub(r"\s+", " ", without_tags).strip()
    return normalized


__all__ = [
    "enrich_markdown_match",
    "to_plain_text",
]

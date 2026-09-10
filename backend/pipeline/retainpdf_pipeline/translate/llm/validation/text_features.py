from __future__ import annotations

import re


EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
SHORT_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")
EN_RESIDUE_SEGMENT_RE = re.compile(r"[A-Za-z][A-Za-z0-9\s,;:()'./%+-]{30,}")
AUTHOR_NAME_TOKEN_RE = re.compile(r"\b(?:[A-Z]\.\s*)?[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'`´.-]{1,}\b")
EN_CHUNK_RE = re.compile(r"[A-Za-z][A-Za-z0-9'./%+\-]*(?:\s+[A-Za-z][A-Za-z0-9'./%+\-]*)*")


def zh_char_count(text: str) -> int:
    return sum(1 for ch in text if "\u4e00" <= ch <= "\u9fff")


def english_word_count(text: str) -> int:
    return len(EN_WORD_RE.findall(text or ""))


def looks_like_short_fragment_text(text: str) -> bool:
    stripped = text.strip()
    if not stripped or " " in stripped:
        return False
    return bool(SHORT_FRAGMENT_RE.fullmatch(stripped))


def english_chunk_word_lengths(text: str) -> list[int]:
    lengths: list[int] = []
    for match in EN_CHUNK_RE.finditer(text or ""):
        segment = " ".join((match.group(0) or "").split())
        if not segment:
            continue
        word_count = english_word_count(segment)
        if word_count > 0:
            lengths.append(word_count)
    return lengths


__all__ = [
    "AUTHOR_NAME_TOKEN_RE",
    "EN_RESIDUE_SEGMENT_RE",
    "EN_WORD_RE",
    "english_chunk_word_lengths",
    "english_word_count",
    "looks_like_short_fragment_text",
    "zh_char_count",
]

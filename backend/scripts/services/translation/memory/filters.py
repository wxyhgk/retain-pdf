from __future__ import annotations

import re
from typing import Any

from services.translation.memory.constants import MAX_TERM_KEY_WORDS_FOR_PROMPT
from services.translation.memory.constants import MAX_TRANSLATED_TERM_VALUE_CHARS
from services.translation.memory.constants import MAX_TRANSLATED_TERM_VALUE_CJK
from services.translation.memory.constants import TERM_VALUE_BLOCKLIST_WORDS
from services.translation.memory.text import cjk_count
from services.translation.memory.text import clean_term_key
from services.translation.memory.text import clean_term_value
from services.translation.memory.text import normalize_space


def term_key_matches_source(key: str, source_text: str) -> bool:
    cleaned_key = clean_term_key(key)
    cleaned_source = normalize_space(source_text)
    if not cleaned_key or not cleaned_source:
        return False
    if not re.search(r"[A-Za-z0-9]", cleaned_key):
        return cleaned_key.lower() in cleaned_source.lower()
    escaped_key = re.escape(cleaned_key).replace(r"\ ", r"\s+")
    pattern = re.compile(
        rf"(?<![A-Za-z0-9]){escaped_key}(?![A-Za-z0-9])",
        re.IGNORECASE,
    )
    return bool(pattern.search(cleaned_source))


def preserve_hint_matches_source(hint: str, source_text: str) -> bool:
    cleaned_hint = normalize_space(hint).lower()
    cleaned_source = normalize_space(source_text).lower()
    if not cleaned_hint or not cleaned_source:
        return False
    if cleaned_hint in cleaned_source or cleaned_source in cleaned_hint:
        return True
    hint_lines = [line.strip().lower() for line in str(hint or "").splitlines() if len(line.strip()) >= 8]
    source_lines = {line.strip().lower() for line in str(source_text or "").splitlines() if len(line.strip()) >= 8}
    return any(line in source_lines for line in hint_lines)


def looks_like_useful_term_key(key: str) -> bool:
    if len(key) < 2:
        return False
    if key.lower() in {"or", "and", "the", "from", "with", "for", "this", "that"}:
        return False
    return any(ch.isalpha() for ch in key)


def looks_like_useful_term_value(value: str) -> bool:
    return bool(value and re.search(r"[\u4e00-\u9fff]", value))


def is_identity_term(key: str, value: str) -> bool:
    return clean_term_key(key).lower() == clean_term_value(value).lower()


def fallback_looks_like_noun_phrase(value: str) -> bool:
    cleaned = clean_term_value(value)
    if not cleaned:
        return False
    if re.search(r"[，。；：、,.!?！？]", cleaned):
        return False
    return len(cleaned) <= MAX_TRANSLATED_TERM_VALUE_CHARS and cjk_count(cleaned) <= MAX_TRANSLATED_TERM_VALUE_CJK


def looks_like_noun_phrase(value: str) -> bool:
    cleaned = clean_term_value(value)
    if not fallback_looks_like_noun_phrase(cleaned):
        return False
    if any(word in cleaned for word in TERM_VALUE_BLOCKLIST_WORDS):
        return False
    return True


def term_key_allowed_in_prompt(key: str) -> bool:
    cleaned = clean_term_key(key)
    if not looks_like_useful_term_key(cleaned):
        return False
    if len(cleaned.split()) > MAX_TERM_KEY_WORDS_FOR_PROMPT:
        return False
    return True


def translated_value_allowed_in_prompt(value: str) -> bool:
    cleaned = clean_term_value(value)
    if not looks_like_useful_term_value(cleaned):
        return False
    if len(cleaned) > MAX_TRANSLATED_TERM_VALUE_CHARS:
        return False
    if cjk_count(cleaned) > MAX_TRANSLATED_TERM_VALUE_CJK:
        return False
    return looks_like_noun_phrase(cleaned)


def term_record_allowed_in_prompt(record: dict[str, Any]) -> bool:
    key = clean_term_key(str(record.get("key") or ""))
    value = clean_term_value(str(record.get("value") or ""))
    if not term_key_allowed_in_prompt(key) or not value:
        return False
    if is_identity_term(key, value):
        return True
    return translated_value_allowed_in_prompt(value)


def is_preserve_candidate(source_text: str) -> bool:
    text = source_text.strip()
    if not text:
        return False
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) >= 2:
        symbolic_lines = sum(1 for line in lines if re.search(r"^(?:[$>#]|[-*]\s+|\|[-\w .]+|[A-Za-z_][\w.-]*\s*=)", line))
        if symbolic_lines >= max(1, len(lines) // 2):
            return True
    if re.search(r"^\s*(?:[$>#]\s*\w+|[A-Za-z_][\w.-]*\s*=\s*\S+)", text):
        return True
    if re.search(r"\b(?:Default|Type|Input|Output|Usage|Example)\s*:\s*\\?<?[A-Z0-9_./-]+>?$", text):
        return True
    return False

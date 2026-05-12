from __future__ import annotations

from services.translation.memory.constants import TECH_TOKEN_RE
from services.translation.memory.constants import TERM_PAIR_PATTERNS
from services.translation.memory.filters import looks_like_useful_term_key
from services.translation.memory.filters import looks_like_useful_term_value
from services.translation.memory.text import clean_term_key
from services.translation.memory.text import clean_term_value
from services.translation.memory.text import normalize_space


def extract_term_candidates(source_text: str, translated_text: str) -> list[tuple[str, str]]:
    translated = normalize_space(translated_text)
    candidates: list[tuple[str, str]] = []
    for pattern in TERM_PAIR_PATTERNS:
        for match in pattern.finditer(translated):
            key = clean_term_key(match.group("en"))
            value = clean_term_value(match.group("zh"))
            if looks_like_useful_term_key(key) and looks_like_useful_term_value(value):
                candidates.append((key, value))

    source_tokens = [clean_term_key(match.group(0)) for match in TECH_TOKEN_RE.finditer(source_text or "")]
    translated_lower = translated.lower()
    for token in source_tokens[:24]:
        if not looks_like_useful_term_key(token):
            continue
        if token.lower() in translated_lower:
            candidates.append((token, token))
    return candidates

from __future__ import annotations

from dataclasses import dataclass

from retainpdf_pipeline.translate.services.memory.constants import TECH_TOKEN_RE
from retainpdf_pipeline.translate.services.memory.constants import TERM_PAIR_PATTERNS
from retainpdf_pipeline.translate.services.memory.filters import looks_like_useful_term_key
from retainpdf_pipeline.translate.services.memory.filters import looks_like_useful_term_value
from retainpdf_pipeline.translate.services.memory.text import clean_term_key
from retainpdf_pipeline.translate.services.memory.text import clean_term_value
from retainpdf_pipeline.translate.services.memory.text import normalize_space


@dataclass(frozen=True)
class TermCandidate:
    key: str
    value: str
    source: str
    score: float


def _candidate_score(*, source: str, identity: bool) -> float:
    if source == "explicit_pair":
        return 1.0
    if identity:
        return 0.55
    return 0.5


def extract_scored_term_candidates(source_text: str, translated_text: str) -> list[TermCandidate]:
    translated = normalize_space(translated_text)
    candidates: list[TermCandidate] = []
    for pattern in TERM_PAIR_PATTERNS:
        for match in pattern.finditer(translated):
            key = clean_term_key(match.group("en"))
            value = clean_term_value(match.group("zh"))
            if looks_like_useful_term_key(key) and looks_like_useful_term_value(value):
                candidates.append(
                    TermCandidate(
                        key=key,
                        value=value,
                        source="explicit_pair",
                        score=_candidate_score(source="explicit_pair", identity=False),
                    )
                )

    source_tokens = [clean_term_key(match.group(0)) for match in TECH_TOKEN_RE.finditer(source_text or "")]
    translated_lower = translated.lower()
    for token in source_tokens[:24]:
        if not looks_like_useful_term_key(token):
            continue
        if token.lower() in translated_lower:
            candidates.append(
                TermCandidate(
                    key=token,
                    value=token,
                    source="identity_technical_token",
                    score=_candidate_score(source="identity_technical_token", identity=True),
                )
            )
    return candidates


def extract_term_candidates(source_text: str, translated_text: str) -> list[tuple[str, str]]:
    return [(candidate.key, candidate.value) for candidate in extract_scored_term_candidates(source_text, translated_text)]


__all__ = ["TermCandidate", "extract_scored_term_candidates", "extract_term_candidates"]

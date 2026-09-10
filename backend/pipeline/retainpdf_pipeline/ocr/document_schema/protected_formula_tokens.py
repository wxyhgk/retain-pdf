"""OCR-local inline-formula protection (stage-contract duplicate).

Duplicated formula-only subset of
retainpdf_pipeline.translate.core.payload.formula_protection
(``PROTECTED_TOKEN_RE``, ``protect_inline_formulas``).

The ocr stage only protects provider-text inline math while building
``document.v1.json`` segments; glossary term protection stays in translate.
Term-span behavior is therefore unsupported here by design.
"""

from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
import hashlib
import re


PROTECTED_TOKEN_RE = re.compile(
    r"<[futnvc]\d+-[0-9a-z]{3}/>"
    r"|\[\[FORMULA_\d+]]"
    r"|@@F\d+@@"
)
PROSE_BOUNDARY_RE = re.compile(r"([}\]])([A-Za-z][a-z]{2,})")
LATEX_FORMULA_RE = re.compile(
    r"""
    (
        (?:
            \\[A-Za-z]+
            | [A-Za-z]
        )
        (?:
            \s*
            (?:
                _\s*\{[^{}]*\}
                | \^\s*\{[^{}]*\}
                | _\s*[A-Za-z0-9]
                | \^\s*[A-Za-z0-9]
                | \{[^{}]*\}
                | \([^()]*\)
                | \[[^\[\]]*\]
                | [=+\-−*/<>.,]
                | [A-Za-z0-9]
                | \\[A-Za-z]+
            )
        )+
    )
    """,
    re.VERBOSE,
)
GREEK_RUN_RE = re.compile(
    r"""
    (
        (?:\\[A-Za-z]+|[α-ωΑ-Ωωγβμφαζη∂])
        (?:
            \s*
            (?:
                _\s*\{[^{}]*\}
                | \^\s*\{[^{}]*\}
                | [A-Za-z0-9]
                | \\[A-Za-z]+
            )
        )*
    )
    """,
    re.VERBOSE,
)
GREEK_COMMA_PAIR_RE = re.compile(
    r"""
    ^
    (?:\\alpha|α)
    \s*
    (?:\{\s*,\s*\}|,)
    \s*
    (?:\\beta|β)
    (?:\s*-\s*[A-Za-z]+)?
    $
    """,
    re.VERBOSE,
)
SIMPLE_DISPLAY_COMMAND_RE = re.compile(r"\\(?:mathrm|mathit|mathbf|mathcal|text)\s*\{\s*([^{}]+?)\s*\}")
STANDALONE_GREEK_RE = re.compile(r"^(?:\\[A-Za-z]+|[α-ωΑ-Ωωγβμφαζη∂])$")
SHORT_BOND_LIKE_RE = re.compile(r"^[A-Za-z]{1,3}-[A-Za-z]{1,3}$")
CITATIONISH_PSEUDO_FORMULA_RE = re.compile(r"^(?:\d+\s*[A-Za-z]|[A-Za-z])(?:\s*,\s*(?:\d+\s*[A-Za-z]|[A-Za-z])){2,}$")
PROSE_HEAVY_WORD_RE = re.compile(r"[A-Za-z]{3,}")
REFERENCE_TOKEN_RE = re.compile(r"^(?:\d+\s*[A-Za-z](?:\s*-\s*[A-Za-z])?|[A-Za-z](?:\s*-\s*[A-Za-z])?)$")


TOKEN_TYPE_PREFIX = {
    "formula": "f",
    "term": "t",
    "unit": "u",
    "numeric": "n",
    "variable": "v",
    "citation": "c",
}


@dataclass(frozen=True)
class ProtectedToken:
    token_tag: str
    token_type: str
    original_text: str
    restore_text: str
    source_offset: int
    checksum: str

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class _Span:
    start: int
    end: int
    token_type: str
    original_text: str
    restore_text: str


def _prepare_text(text: str) -> str:
    return PROSE_BOUNDARY_RE.sub(r"\1 \2", text)


def _checksum(value: str, token_type: str) -> str:
    return hashlib.blake2s(f"{token_type}\0{value}".encode("utf-8"), digest_size=2).hexdigest()[:3]


def _token_tag(token_type: str, index: int, checksum: str) -> str:
    prefix = TOKEN_TYPE_PREFIX[token_type]
    return f"<{prefix}{index}-{checksum}/>"


def _iter_formula_matches(text: str):
    for pattern in (LATEX_FORMULA_RE, GREEK_RUN_RE):
        for match in pattern.finditer(text):
            value = match.group(0).strip()
            if GREEK_COMMA_PAIR_RE.match(value):
                continue
            if _should_skip_formula_candidate(value):
                continue
            if any(marker in value for marker in ("\\", "_", "^", "{", "}", "α", "β", "γ", "μ", "φ", "ζ", "η", "∂")):
                yield match.start(), match.end(), value


def _unwrap_display_commands(value: str) -> str:
    previous = value
    while True:
        replaced = SIMPLE_DISPLAY_COMMAND_RE.sub(r"\1", previous)
        if replaced == previous:
            return replaced
        previous = replaced


def _normalize_formula_candidate(value: str) -> str:
    text = _unwrap_display_commands(str(value or "").strip())
    text = text.replace("{", "").replace("}", "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _looks_like_standalone_greek_symbol(value: str) -> bool:
    normalized = _normalize_formula_candidate(value)
    if any(marker in normalized for marker in ("_", "^", "(", ")", "[", "]", "+", "=", "/")):
        return False
    return bool(STANDALONE_GREEK_RE.fullmatch(normalized))


def _looks_like_short_bond_token(value: str) -> bool:
    normalized = _normalize_formula_candidate(value).replace(" ", "")
    if any(marker in normalized for marker in ("_", "^", "+", "=", "/", "*")):
        return False
    return bool(SHORT_BOND_LIKE_RE.fullmatch(normalized))


def _looks_like_citationish_pseudo_formula(value: str) -> bool:
    normalized = _normalize_formula_candidate(value)
    if any(marker in normalized for marker in ("_", "^", "(", ")", "[", "]", "+", "=", "/")):
        return False
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if CITATIONISH_PSEUDO_FORMULA_RE.fullmatch(normalized):
        return True
    parts = [part.strip() for part in normalized.split(",") if part.strip()]
    if len(parts) < 4:
        return False
    return all(REFERENCE_TOKEN_RE.fullmatch(part) for part in parts)


def _looks_like_prose_heavy_formula_candidate(value: str) -> bool:
    command_stripped = re.sub(r"\\[A-Za-z]+", " ", str(value or ""))
    normalized = _normalize_formula_candidate(command_stripped)
    words = PROSE_HEAVY_WORD_RE.findall(normalized)
    if len(words) < 4:
        return False
    lowercase_words = sum(1 for word in words if any(ch.islower() for ch in word))
    return lowercase_words >= 3


def _should_skip_formula_candidate(value: str) -> bool:
    return (
        _looks_like_prose_heavy_formula_candidate(value)
        or _looks_like_citationish_pseudo_formula(value)
        or _looks_like_standalone_greek_symbol(value)
        or _looks_like_short_bond_token(value)
    )


def _overlaps_any(span: tuple[int, int], selected: list[_Span]) -> bool:
    start, end = span
    return any(start < existing.end and end > existing.start for existing in selected)


def _collect_formula_spans(text: str) -> list[_Span]:
    raw_matches = sorted(_iter_formula_matches(text), key=lambda item: (item[0], -(item[1] - item[0])))
    selected: list[_Span] = []
    cursor = 0
    for start, end, value in raw_matches:
        if end <= cursor or start < cursor:
            continue
        selected.append(_Span(start, end, "formula", value, value))
        cursor = end
    return selected


def _protect_spans(text: str, spans: list[_Span]) -> tuple[str, list[dict]]:
    ordered = sorted(spans, key=lambda span: (span.start, -(span.end - span.start)))
    selected: list[_Span] = []
    for span in ordered:
        if _overlaps_any((span.start, span.end), selected):
            continue
        selected.append(span)

    counters: dict[str, int] = {}
    protected_map: list[dict] = []
    chunks: list[str] = []
    cursor = 0
    for span in selected:
        chunks.append(text[cursor:span.start])
        counters[span.token_type] = counters.get(span.token_type, 0) + 1
        checksum = _checksum(span.original_text, span.token_type)
        token_tag = _token_tag(span.token_type, counters[span.token_type], checksum)
        protected_map.append(
            ProtectedToken(
                token_tag=token_tag,
                token_type=span.token_type,
                original_text=span.original_text,
                restore_text=span.restore_text,
                source_offset=span.start,
                checksum=checksum,
            ).to_dict()
        )
        chunks.append(token_tag)
        cursor = span.end
    chunks.append(text[cursor:])
    return "".join(chunks), protected_map


def _formula_map_from_protected_map(protected_map: list[dict]) -> list[dict]:
    return [
        {
            "placeholder": str(entry.get("token_tag", "") or ""),
            "formula_text": str(entry.get("restore_text", "") or entry.get("original_text", "") or ""),
        }
        for entry in protected_map
        if str(entry.get("token_type", "") or "") == "formula"
    ]


def protect_inline_formulas(text: str) -> tuple[str, list[dict]]:
    prepared = _prepare_text(text)
    spans = _collect_formula_spans(prepared)
    _protected_text, protected_map = _protect_spans(prepared, spans)
    return _protected_text, _formula_map_from_protected_map(protected_map)


__all__ = [
    "PROTECTED_TOKEN_RE",
    "protect_inline_formulas",
]

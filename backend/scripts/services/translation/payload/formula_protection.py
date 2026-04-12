from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
import hashlib
import re
from typing import Iterable

from services.translation.terms.glossary import GlossaryEntry
from services.translation.terms.glossary import glossary_hard_entries
from services.translation.terms.glossary import normalize_glossary_entries


LEGACY_FORMULA_PLACEHOLDER_RE = re.compile(r"\[\[FORMULA_(\d+)]]")
LEGACY_ALIAS_PLACEHOLDER_RE = re.compile(r"@@F\d+@@")
TYPED_TOKEN_RE = re.compile(r"<(?P<prefix>[futnvc])(?P<index>\d+)-(?P<checksum>[0-9a-z]{3})/>")
PROTECTED_TOKEN_RE = re.compile(
    r"<[futnvc]\d+-[0-9a-z]{3}/>"
    r"|\[\[FORMULA_\d+]]"
    r"|@@F\d+@@"
)
INLINE_MATH_RE = re.compile(r"\$(?P<body>[^$\n]+)\$")
PROSE_BOUNDARY_RE = re.compile(r"([}\]])([A-Za-z][a-z]{2,})")
TERM_WORD_CHARS = r"A-Za-z0-9_"
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


def _iter_formula_matches(text: str) -> Iterable[tuple[int, int, str]]:
    for pattern in (LATEX_FORMULA_RE, GREEK_RUN_RE):
        for match in pattern.finditer(text):
            value = match.group(0).strip()
            if GREEK_COMMA_PAIR_RE.match(value):
                continue
            if any(marker in value for marker in ("\\", "_", "^", "{", "}", "α", "β", "γ", "μ", "φ", "ζ", "η", "∂")):
                yield match.start(), match.end(), value


def _term_pattern(entry: GlossaryEntry) -> re.Pattern[str]:
    if entry.match_mode == "regex":
        return re.compile(entry.source)
    escaped = re.escape(entry.source)
    pattern = rf"(?<![{TERM_WORD_CHARS}]){escaped}(?![{TERM_WORD_CHARS}])"
    flags = re.IGNORECASE if entry.match_mode == "case_insensitive" else 0
    return re.compile(pattern, flags)


def _context_matches(text: str, entry: GlossaryEntry, *, start: int, end: int) -> bool:
    if not entry.context:
        return True
    window_start = max(0, start - 160)
    window_end = min(len(text), end + 160)
    return entry.context.casefold() in text[window_start:window_end].casefold()


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


def _collect_term_spans(text: str, glossary_entries: list[GlossaryEntry] | None) -> list[_Span]:
    selected: list[_Span] = [
        _Span(match.start(), match.end(), "protected", match.group(0), match.group(0))
        for match in PROTECTED_TOKEN_RE.finditer(text)
    ]
    term_spans: list[_Span] = []
    for entry in glossary_hard_entries(normalize_glossary_entries(glossary_entries)):
        pattern = _term_pattern(entry)
        for match in pattern.finditer(text):
            start, end = match.span()
            if start == end or _overlaps_any((start, end), selected):
                continue
            if not _context_matches(text, entry, start=start, end=end):
                continue
            original = match.group(0)
            restore_text = original if entry.level == "preserve" else entry.target
            span = _Span(start, end, "term", original, restore_text)
            selected.append(span)
            term_spans.append(span)
    return term_spans


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


def _next_token_indexes(existing_map: list[dict]) -> dict[str, int]:
    counters = {token_type: 0 for token_type in TOKEN_TYPE_PREFIX}
    for entry in existing_map or []:
        token_type = str(entry.get("token_type", "") or "")
        token_tag = str(entry.get("token_tag") or entry.get("placeholder") or "")
        match = TYPED_TOKEN_RE.fullmatch(token_tag)
        if token_type in counters and match is not None:
            counters[token_type] = max(counters[token_type], int(match.group("index")))
    return counters


def protect_glossary_terms(
    text: str,
    *,
    glossary_entries: list[GlossaryEntry] | None = None,
    existing_map: list[dict] | None = None,
) -> tuple[str, list[dict]]:
    normalized = normalize_glossary_entries(glossary_entries)
    if not normalized:
        return text, list(existing_map or [])
    term_spans = _collect_term_spans(text, normalized)
    if not term_spans:
        return text, list(existing_map or [])
    counters = _next_token_indexes(existing_map or [])
    selected = sorted(term_spans, key=lambda span: (span.start, -(span.end - span.start)))
    protected_map = list(existing_map or [])
    chunks: list[str] = []
    cursor = 0
    for span in selected:
        chunks.append(text[cursor:span.start])
        counters["term"] += 1
        checksum = _checksum(span.original_text, span.token_type)
        token_tag = _token_tag(span.token_type, counters["term"], checksum)
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


def protect_inline_formulas(
    text: str,
    *,
    glossary_entries: list[GlossaryEntry] | None = None,
) -> tuple[str, list[dict]]:
    protected_text, protected_map = protect_inline_content(text, glossary_entries=glossary_entries)
    return protected_text, _formula_map_from_protected_map(protected_map)


def protect_inline_content(
    text: str,
    *,
    glossary_entries: list[GlossaryEntry] | None = None,
) -> tuple[str, list[dict]]:
    prepared = _prepare_text(text)
    spans = _collect_formula_spans(prepared)
    spans.extend(_collect_term_spans(prepared, glossary_entries))
    return _protect_spans(prepared, spans)


def protect_inline_formulas_in_segments(
    segments: list[dict],
    *,
    glossary_entries: list[GlossaryEntry] | None = None,
) -> tuple[str, list[dict], list[dict]]:
    chunks: list[str] = []
    formula_spans: list[_Span] = []
    cursor = 0
    for segment in segments:
        content = segment.get("content", "").strip()
        if not content:
            continue
        if chunks:
            chunks.append(" ")
            cursor += 1
        start = cursor
        chunks.append(content)
        cursor += len(content)
        if segment.get("type") == "inline_equation" and not GREEK_COMMA_PAIR_RE.match(content):
            formula_spans.append(_Span(start, cursor, "formula", content, content))
    text = _prepare_text("".join(chunks))
    spans = formula_spans + _collect_term_spans(text, glossary_entries)
    protected_text, protected_map = _protect_spans(text, spans)
    return protected_text, _formula_map_from_protected_map(protected_map), protected_map


def protected_map_from_formula_map(formula_map: list[dict]) -> list[dict]:
    protected_map: list[dict] = []
    if isinstance(formula_map, dict):
        iterable = []
    else:
        iterable = list(formula_map or [])
    for index, item in enumerate(iterable, start=1):
        if not isinstance(item, dict):
            continue
        token_tag = str(item.get("placeholder", "") or "")
        restore_text = str(item.get("formula_text", "") or "")
        token_type = "formula"
        checksum = _checksum(restore_text, token_type)
        protected_map.append(
            ProtectedToken(
                token_tag=token_tag,
                token_type=token_type,
                original_text=restore_text,
                restore_text=restore_text,
                source_offset=-1,
                checksum=checksum,
            ).to_dict()
        )
    return protected_map


def wrap_formula_inline_math(formula_text: str) -> str:
    text = str(formula_text or "").strip()
    if not text:
        return ""
    match = INLINE_MATH_RE.fullmatch(text)
    if match is not None:
        text = match.group("body").strip()
    return f"${text}$"


def restore_protected_tokens(text: str, protected_map: list[dict]) -> str:
    restored = text or ""
    for item in protected_map or []:
        token_tag = str(item.get("token_tag") or item.get("placeholder") or "")
        restore_text = str(item.get("restore_text") or item.get("formula_text") or item.get("original_text") or "")
        if str(item.get("token_type", "") or "") == "formula":
            restore_text = wrap_formula_inline_math(restore_text)
        if token_tag:
            restored = restored.replace(token_tag, restore_text)
    return restored


def restore_tokens_by_type(text: str, protected_map: list[dict], token_types: set[str]) -> str:
    restored = text or ""
    for item in protected_map or []:
        if str(item.get("token_type", "") or "") not in token_types:
            continue
        token_tag = str(item.get("token_tag") or item.get("placeholder") or "")
        restore_text = str(item.get("restore_text") or item.get("formula_text") or item.get("original_text") or "")
        if token_tag:
            restored = restored.replace(token_tag, restore_text)
    return restored


def restore_inline_formulas(text: str, formula_map: list[dict]) -> str:
    if formula_map and any("token_tag" in item for item in formula_map):
        return restore_protected_tokens(text, formula_map)
    restored = text
    for item in formula_map or []:
        placeholder = str(item.get("placeholder", "") or "")
        formula_text = wrap_formula_inline_math(str(item.get("formula_text", "") or ""))
        if placeholder:
            restored = restored.replace(placeholder, formula_text)
    return restored


def re_protect_restored_formulas(text: str, formula_map: list[dict]) -> str:
    def _can_replace_raw_formula(formula_text: str) -> bool:
        text = str(formula_text or "").strip()
        if not text:
            return False
        if len(text) <= 1:
            return False
        if re.fullmatch(r"[A-Za-z0-9]+", text):
            return False
        return any(
            marker in text
            for marker in ("\\", "_", "^", "{", "}", "(", ")", "[", "]", "+", "-", "=", "/", "*")
        )

    protected = text or ""
    if not protected or not formula_map:
        return protected

    parts = PROTECTED_TOKEN_RE.split(protected)
    delimiters = PROTECTED_TOKEN_RE.findall(protected)

    for item in sorted(formula_map or [], key=lambda entry: len(str(entry.get("formula_text", ""))), reverse=True):
        formula_text = str(item.get("formula_text", "") or "")
        placeholder = str(item.get("placeholder", "") or "")
        if not formula_text or not placeholder:
            continue
        wrapped_formula = wrap_formula_inline_math(formula_text)
        updated_parts: list[str] = []
        for chunk in parts:
            next_chunk = chunk.replace(wrapped_formula, placeholder)
            if _can_replace_raw_formula(formula_text):
                next_chunk = next_chunk.replace(formula_text, placeholder)
            updated_parts.append(next_chunk)
        parts = updated_parts

    rebuilt: list[str] = []
    for index, chunk in enumerate(parts):
        rebuilt.append(chunk)
        if index < len(delimiters):
            rebuilt.append(delimiters[index])
    return "".join(rebuilt)

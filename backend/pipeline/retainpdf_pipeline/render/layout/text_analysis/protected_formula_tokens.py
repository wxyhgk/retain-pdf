"""Render-local protected-token / inline-formula helpers.

Duplicated from retainpdf_pipeline.translate.core.payload.formula_protection
(stage-decouple: render must not import translate; duplicate wins over cross-package).
Only the glossary-independent subset is carried here. Render never passes
glossary entries, so term-span protection is intentionally unsupported here;
formula-span protection is verbatim.
"""

from __future__ import annotations

from dataclasses import asdict
from dataclasses import dataclass
import hashlib
import re


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
FORMULA_NEIGHBOR_ALLOWED_RE = re.compile(r"^[A-Za-z0-9(){}\[\]_^\-+*/=~.,%\\:;]+$")
FORMULA_NEIGHBOR_PUNCT_RE = re.compile(r"^[,.;:)\]}]+$")


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


@dataclass(frozen=True)
class _SegmentRecord:
    index: int
    segment_type: str
    content: str
    start: int
    end: int


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


def _looks_like_formula_neighbor_fragment(text: str) -> bool:
    normalized = " ".join((text or "").split()).strip()
    if not normalized or len(normalized) > 24:
        return False
    words = re.findall(r"[A-Za-z]+", normalized)
    if " " in normalized:
        if len(words) >= 2:
            return False
        if len(words) == 1 and len(normalized) > 8:
            return False
    compact = normalized.replace(" ", "")
    if not compact:
        return False
    if compact.lower() in {"and", "or", "to", "of", "by", "with", "from", "for", "in", "at"}:
        return False
    if FORMULA_NEIGHBOR_PUNCT_RE.fullmatch(compact):
        return False
    if not FORMULA_NEIGHBOR_ALLOWED_RE.fullmatch(compact):
        return False
    if any(ch in compact for ch in "()[]{}_^-+*/=~.,%\\"):
        return True
    return bool(re.search(r"[A-Za-z]+\d|\d+[A-Za-z]|[A-Z][a-z]?[A-Z]", compact))


def _should_protect_segment_formula_candidate(value: str, *, merged_left_fragment: bool = False) -> bool:
    if merged_left_fragment:
        return False
    if "\ufffd" in value or "��" in value:
        return False
    return not _should_skip_formula_candidate(value)


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


def protect_inline_formulas_in_segments(
    segments: list[dict],
    *,
    glossary_entries=None,
) -> tuple[str, list[dict], list[dict]]:
    # Render never supplies glossary entries; term-span protection is unsupported
    # here (translate owns glossary). Formula-span protection below is verbatim.
    del glossary_entries
    chunks: list[str] = []
    records: list[_SegmentRecord] = []
    cursor = 0
    for index, segment in enumerate(segments):
        content = segment.get("content", "").strip()
        if not content:
            continue
        if chunks:
            chunks.append(" ")
            cursor += 1
        start = cursor
        chunks.append(content)
        cursor += len(content)
        records.append(
            _SegmentRecord(
                index=index,
                segment_type=str(segment.get("type", "") or ""),
                content=content,
                start=start,
                end=cursor,
            )
        )
    text = _prepare_text("".join(chunks))
    formula_spans: list[_Span] = []
    consumed_indexes: set[int] = set()
    for position, record in enumerate(records):
        if record.index in consumed_indexes:
            continue
        if record.segment_type != "inline_equation":
            continue
        if GREEK_COMMA_PAIR_RE.match(record.content):
            continue
        start_record = record
        end_record = record
        merged_left_fragment = False
        if position > 0:
            left = records[position - 1]
            if (
                left.index not in consumed_indexes
                and left.segment_type == "text"
                and _looks_like_formula_neighbor_fragment(left.content)
            ):
                start_record = left
                consumed_indexes.add(left.index)
                merged_left_fragment = True
        merged_content = text[start_record.start:end_record.end]
        if not _should_protect_segment_formula_candidate(
            merged_content,
            merged_left_fragment=merged_left_fragment,
        ):
            continue
        consumed_indexes.add(record.index)
        formula_spans.append(_Span(start_record.start, end_record.end, "formula", merged_content, merged_content))
    protected_text, protected_map = _protect_spans(text, formula_spans)
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


__all__ = [
    "PROTECTED_TOKEN_RE",
    "protect_inline_formulas_in_segments",
    "protected_map_from_formula_map",
    "re_protect_restored_formulas",
    "restore_protected_tokens",
    "wrap_formula_inline_math",
]

from __future__ import annotations

import re

from retainpdf_pipeline.translate.core.item_reader import item_is_textual


EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
URL_LIKE_RE = re.compile(
    r"^(?:(?:https?://|ftp://|www\.)\S+|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:/[A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]*)?)$",
    re.I,
)
COPYRIGHT_TAIL_RE = re.compile(
    r"\b(?:copyright|all rights reserved|trademarks?|registered|unregistered|intellectual property rights?)\b",
    re.I,
)

FLAG_TOKEN_RE = re.compile(r"^-{1,2}[A-Za-z0-9][\w.-]*$")
FILE_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8}$")
NUMBER_TOKEN_RE = re.compile(r"^-?\d+(?:\.\d+)?$")
COMMAND_HEAD_RE = re.compile(r"^[A-Za-z][\w.-]{0,31}$")
ARG_TOKEN_RE = re.compile(r"^<[^<>\n]+>$")
PROSE_CUE_RE = re.compile(
    r"\b(a|an|the|this|that|these|those|is|are|was|were|be|been|being|has|have|had|do|does|did|"
    r"can|could|may|might|must|should|would|will|our|their|its|during|through|within|than|"
    r"therefore|however|because|while|where|which|whose|method|function|equation|theory|"
    r"energy|calculation|model|procedure|results|using|used|shows|demonstrates)\b",
    re.I,
)
FORTRAN_LOOP_RE = re.compile(r"\bDO\d+[A-Z]\s*=", re.I)
FORTRAN_FLOAT_RE = re.compile(r"\b\d+(?:\.\d+)?D[+-]?\d+\b", re.I)
INDEXED_SYMBOL_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\([A-Za-z0-9_,]+\)")
ALL_CAPS_CODE_TOKEN_RE = re.compile(r"^[A-Z][A-Z0-9_.-]{3,}$")
MIXED_ALNUM_TOKEN_RE = re.compile(r"(?=.*[A-Za-z])(?=.*\d)")
CODE_OPERATOR_CHARS = set("(){}[]=*<>+/,;:")

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

TITLE_STYLE_HINT = (
    "Title rule: translate titles as concise formal headings. Preserve numbering, "
    "formula placeholders, symbols, and proper nouns; apply the document domain "
    "guidance and matched terminology when choosing technical wording; do not "
    "expand into body prose."
)
STYLE_HINTS_BY_ROLE = {
    "abstract": "This block is an abstract sentence or paragraph. Translate it as compact academic summary prose.",
    "heading": "This block is a section heading. Translate it as a short academic heading, not as a full sentence.",
    "title": TITLE_STYLE_HINT,
    "figure_caption": "This block is a figure-style caption or note. Keep caption style concise; preserve numbering, labels, and visual references.",
    "image_caption": "This block is a figure caption. Keep caption style concise; preserve figure numbering/letters and visual references.",
    "table_caption": "This block is a table caption. Keep caption style concise; preserve table numbering and parameter symbols.",
    "code_caption": "This block is a code/listing caption. Keep listing identifiers and code names unchanged where appropriate.",
    "caption": "This block is a caption. Keep it concise and caption-like rather than paragraph-like.",
    "table_footnote": "This block is a table footnote. Keep it brief and note-like; preserve symbols, superscripts, and markers.",
    "image_footnote": "This block is an image footnote. Keep it brief and note-like; preserve symbols, superscripts, and markers.",
    "footnote": "This block is a footnote. Keep it brief and note-like rather than expanding it into body prose.",
}


def natural_word_count(text: str) -> int:
    return len([word for word in EN_WORD_RE.findall(text or "") if len(word) >= 3])


def structure_style_hint(payload: dict | None) -> str:
    source = payload or {}
    explicit_hint = str(source.get("translation_style_hint", "") or "").strip()
    explicit = str(source.get("structure_role", "") or "").strip().lower()
    role_hint = STYLE_HINTS_BY_ROLE.get(explicit, "")
    if explicit_hint and role_hint:
        return f"{role_hint}\n{explicit_hint}"
    return explicit_hint or role_hint


def looks_like_url_fragment(text: str) -> bool:
    stripped = text.strip().strip("()[]<>\"'“”‘’,;")
    if not stripped or any(ch.isspace() for ch in stripped):
        return False
    return bool(URL_LIKE_RE.fullmatch(stripped))


def looks_like_pure_email_fragment(text: str) -> bool:
    stripped = text.strip().strip("()[]<>\"'“”‘’,;")
    return bool(EMAIL_RE.fullmatch(stripped))


def looks_like_short_copyright_tail(text: str) -> bool:
    normalized = " ".join(text.split()).strip()
    if not normalized:
        return False
    lowered = normalized.lower()
    if len(normalized) > 220:
        return False
    if len(re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)?", normalized)) > 32:
        return False
    if not COPYRIGHT_TAIL_RE.search(normalized):
        return False
    tail_signals = (
        "all rights reserved",
        "copyright",
        "trademark",
        "trademarks",
        "registered trademark",
        "registered and unregistered",
        "intellectual property rights",
        "key symbol",
        "periodicals",
    )
    if not any(signal in lowered for signal in tail_signals):
        return False
    disclaimer_markers = (
        "redistribution of this document",
        "accepts no liability",
        "written permission",
        "this material is distributed",
        "advised to seek independent professional advice",
    )
    if any(marker in lowered for marker in disclaimer_markers):
        return False
    return True


def looks_like_hard_nontranslatable_text(text: str) -> bool:
    return (
        looks_like_url_fragment(text)
        or looks_like_pure_email_fragment(text)
        or looks_like_short_copyright_tail(text)
    )


def looks_like_hard_nontranslatable_metadata(item: dict) -> bool:
    if not item_is_textual(item):
        return False
    text = " ".join((item.get("source_text") or "").split())
    if not text:
        return False
    return looks_like_hard_nontranslatable_text(text)


def looks_like_code_literal_text_value(text: str) -> bool:
    normalized = " ".join((text or "").split())
    if not normalized:
        return False
    if len(normalized) < 24:
        return False
    if any("\u4e00" <= ch <= "\u9fff" for ch in normalized):
        return False
    tokens = normalized.split()
    if not 2 <= len(tokens) <= 64:
        return False

    codeish_tokens = 0
    for token in tokens:
        stripped = token.strip()
        if not stripped:
            continue
        if INDEXED_SYMBOL_RE.search(stripped):
            codeish_tokens += 1
            continue
        if FORTRAN_FLOAT_RE.search(stripped):
            codeish_tokens += 1
            continue
        if any(ch in CODE_OPERATOR_CHARS for ch in stripped):
            codeish_tokens += 1
            continue
        if ALL_CAPS_CODE_TOKEN_RE.fullmatch(stripped):
            codeish_tokens += 1
            continue
        if "_" in stripped or MIXED_ALNUM_TOKEN_RE.search(stripped):
            codeish_tokens += 1

    alpha_chars = sum(ch.isalpha() for ch in normalized)
    uppercase_alpha_chars = sum(ch.isupper() for ch in normalized if ch.isalpha())
    uppercase_ratio = uppercase_alpha_chars / max(1, alpha_chars)
    operator_char_count = sum(1 for ch in normalized if ch in CODE_OPERATOR_CHARS)
    prose_cues = bool(PROSE_CUE_RE.search(normalized))
    prose_words = natural_word_count(normalized)

    if FORTRAN_LOOP_RE.search(normalized) and codeish_tokens >= 2:
        return True
    if codeish_tokens >= max(3, len(tokens) // 2):
        if prose_words <= 4:
            return True
        if uppercase_ratio >= 0.55 and not prose_cues:
            return True
        if operator_char_count >= max(6, len(normalized) // 18):
            return True
    return False


def looks_like_reference_entry_text(text: str) -> bool:
    normalized = " ".join((text or "").split())
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


__all__ = [
    "TITLE_STYLE_HINT",
    "STYLE_HINTS_BY_ROLE",
    "looks_like_code_literal_text_value",
    "looks_like_hard_nontranslatable_metadata",
    "looks_like_hard_nontranslatable_text",
    "looks_like_pure_email_fragment",
    "looks_like_reference_entry_text",
    "looks_like_short_copyright_tail",
    "looks_like_url_fragment",
    "natural_word_count",
    "structure_style_hint",
]

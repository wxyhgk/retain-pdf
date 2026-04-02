import re

from services.document_schema.semantics import is_body_structure_role
from services.document_schema.semantics import is_metadata_semantic


SHORT_CONNECTOR_SET = {
    "vs",
    "vs.",
    "&",
}
COMMON_SHORT_WORD_SET = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "if",
    "in",
    "into",
    "is",
    "it",
    "its",
    "not",
    "of",
    "on",
    "or",
    "our",
    "than",
    "that",
    "the",
    "their",
    "there",
    "these",
    "this",
    "those",
    "to",
    "via",
    "was",
    "were",
    "with",
}

EDITORIAL_PREFIX_RE = re.compile(
    r"^(received|revised|accepted|published|available online|online publication date|supporting information|editor|editors)\b",
    re.I,
)
COPYRIGHT_JOURNAL_RE = re.compile(
    r"(wiley|elsevier|springer|acs|american chemical society|journal|j\.?\s+[A-Za-z]|vol\.\s*\d+)",
    re.I,
)
AUTHOR_MARKER_RE = re.compile(r"[†‡§]|corresponding author", re.I)
AFFILIATION_RE = re.compile(
    r"\b(university|department|departamento|faculty|facultad|institute|institut|laboratory|laboratoire|school|college|center|centre|campus|street|road|avenue|casilla|minneapolis|minnesota|santiago|france|united states|china)\b",
    re.I,
)
PERSON_NAME_RE = re.compile(r"^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3}$")
POSTAL_RE = re.compile(r"\b\d{4,6}\b")
INITIAL_NAME_RE = re.compile(r"\b[A-Z]\.\s*[A-Z][a-z]+")
ALL_CAPS_TOKEN_RE = re.compile(r"\b[A-Z][A-Z'`´.-]{1,}\b")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}")
LETTER_RE = re.compile(r"[A-Za-z]")
SHORT_ALPHA_FRAGMENT_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._/-]{0,7}$")
SECTION_MARKER_START_RE = re.compile(r"^(?:\(|\[)?(?:\d+(?:\.\d+)*|[A-Za-z])(?:\)|\]|\.)\s+|^[•\-*]\s+")
NAME_LIKE_TOKEN_RE = re.compile(r"\b(?:[A-Z]\.\s*)?[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'`´.-]{1,}(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'`´.-]{1,}){0,3}\b")
AUTHOR_LIST_NAME_RE = re.compile(
    r"\b[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'`´.-]*\d*"
    r"(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'`´.-]*\d*){1,3}\b"
)
ADDRESS_WORD_RE = re.compile(
    r"\b(platz|street|st\.|road|rd\.|avenue|ave\.|campus|building|room|suite|postal|postfach|germany|france|spain|italy|uk|u\.k\.|usa|u\.s\.a\.|denmark|sweden|norway|finland|japan|korea)\b",
    re.I,
)
PROSE_CUE_RE = re.compile(
    r"\b(a|an|the|this|that|these|those|is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|may|might|must|should|would|will|our|their|its|during|through|within|than|therefore|however|furthermore|because|while|where|which|whose|investigate|exhibits|discovered|properties|synthesis|processing|susceptible|compared)\b",
    re.I,
)
URL_LIKE_RE = re.compile(
    r"^(?:(?:https?://|ftp://|www\.)\S+|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:/[A-Za-z0-9._~:/?#\[\]@!$&()*+,;=%-]*)?)$",
    re.I,
)
WORD_TOKEN_RE = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:[.'`´/-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*")
MAX_METADATA_FRAGMENT_WORDS = 9


def _normalized_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())


def _line_count(item: dict) -> int:
    return len(item.get("lines", []))


def _word_count(text: str) -> int:
    return len(WORD_TOKEN_RE.findall(text))


def _comma_count(text: str) -> int:
    return text.count(",") + text.count(";")


def _looks_like_standalone_connector(text: str) -> bool:
    lowered = text.strip().lower()
    return lowered in SHORT_CONNECTOR_SET


def _connector_is_metadata_like(item: dict, text: str) -> bool:
    if not _looks_like_standalone_connector(text):
        return False
    metadata = item.get("metadata") or {}
    if not is_body_structure_role(metadata):
        return True
    page_idx = item.get("page_idx")
    try:
        page_idx_value = int(page_idx)
    except (TypeError, ValueError):
        page_idx_value = -1
    return page_idx_value in {0, 1} and _line_count(item) <= 1 and len(text) <= 8


def _looks_like_editorial_metadata(text: str) -> bool:
    return bool(EDITORIAL_PREFIX_RE.match(text))


def _looks_like_author_or_affiliation(text: str) -> bool:
    sanitized = re.sub(r"\\[A-Za-z]+(?:\{[^}]*\})*", " ", text)
    upper_name_tokens = len(ALL_CAPS_TOKEN_RE.findall(text))
    initial_names = len(INITIAL_NAME_RE.findall(text))
    author_segments = _author_like_segments(text)
    author_list_names = AUTHOR_LIST_NAME_RE.findall(sanitized)
    name_like_tokens = sum(1 for segment in author_segments if segment)
    comma_count = _comma_count(text)
    if ("·" in sanitized or ";" in sanitized or comma_count >= 2) and len(author_list_names) >= 3 and not PROSE_CUE_RE.search(sanitized):
        return True
    if AUTHOR_MARKER_RE.search(text) and (_comma_count(text) >= 1 or initial_names >= 1 or upper_name_tokens >= 2):
        return True
    if PERSON_NAME_RE.fullmatch(text.strip()) and len(text) <= 80:
        return True
    if initial_names >= 2 and _comma_count(text) >= 1:
        return True
    if upper_name_tokens >= 4 and _comma_count(text) >= 1 and len(text) <= 360:
        return True
    if author_segments and not PROSE_CUE_RE.search(text) and name_like_tokens >= 4 and comma_count >= 2 and len(text) <= 420:
        return True
    if author_segments and not PROSE_CUE_RE.search(text) and name_like_tokens >= 8 and comma_count >= 4 and len(text) <= 520:
        return True
    if AFFILIATION_RE.search(text) and len(text) <= 160 and _comma_count(text) == 0:
        return True
    if AFFILIATION_RE.search(text) and (_comma_count(text) >= 2 or POSTAL_RE.search(text)) and len(text) <= 360:
        return True
    if POSTAL_RE.search(text) and (ADDRESS_WORD_RE.search(text) or comma_count >= 2) and len(text) <= 240:
        return True
    if EMAIL_RE.search(text):
        return True
    return False


def _author_like_segments(text: str) -> list[str]:
    if "." in text and "., " not in text and "et al." not in text:
        # Full-sentence prose is much more likely than an author list.
        return []
    segments = [segment.strip() for segment in re.split(r",|;|\band\b", text) if segment.strip()]
    author_like: list[str] = []
    for segment in segments:
        if len(segment) > 80:
            continue
        if PROSE_CUE_RE.search(segment):
            continue
        words = [word for word in re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ.'`´-]+", segment) if word]
        if not 1 <= len(words) <= 6:
            continue
        if not all(re.fullmatch(r"(?:[A-Z]\.)|(?:[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ'`´.-]+)", word) for word in words):
            continue
        capitalized = sum(1 for word in words if word[:1].isupper())
        if capitalized < max(1, len(words) - 1):
            continue
        author_like.append(segment)
    return author_like


def _looks_like_copyright_or_journal_line(text: str) -> bool:
    if not COPYRIGHT_JOURNAL_RE.search(text):
        return False
    if re.search(r"\b\d{4}\b", text) and re.search(r"\b\d{1,4}\s*[-–]\s*\d{1,4}\b", text):
        return True
    if "copyright" in text.lower() or "periodicals" in text.lower():
        return True
    return False


def _letter_count(text: str) -> int:
    return len(LETTER_RE.findall(text))


def _looks_like_short_alpha_fragment(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return False
    if stripped.lower() in COMMON_SHORT_WORD_SET:
        return False
    if SECTION_MARKER_START_RE.match(stripped):
        return False
    if any(ch.isspace() for ch in stripped):
        return False
    if not SHORT_ALPHA_FRAGMENT_RE.fullmatch(stripped):
        return False
    return _letter_count(stripped) < 4


def looks_like_url_fragment(text: str) -> bool:
    stripped = text.strip().strip("()[]<>\"'“”‘’,;")
    if not stripped or any(ch.isspace() for ch in stripped):
        return False
    return bool(URL_LIKE_RE.fullmatch(stripped))


def should_skip_metadata_fragment(item: dict) -> bool:
    if item.get("block_type") not in {"text", "title", "list"}:
        return False
    if not item.get("should_translate", True):
        return False

    text = _normalized_text(item)
    if not text:
        return False
    if _word_count(text) > MAX_METADATA_FRAGMENT_WORDS:
        return False

    if looks_like_nontranslatable_metadata(item):
        return True

    if _line_count(item) <= 2 and len(text) <= 64 and text.strip().lower() == "supporting information":
        return True
    return False


def looks_like_nontranslatable_metadata(item: dict) -> bool:
    if item.get("block_type") not in {"text", "title", "list"}:
        return False
    if is_metadata_semantic((item.get("metadata") or {})):
        return True
    text = _normalized_text(item)
    if not text:
        return False

    if len(text) <= 16 and _connector_is_metadata_like(item, text):
        return True
    if _looks_like_editorial_metadata(text):
        return True
    if _looks_like_author_or_affiliation(text):
        return True
    if _looks_like_copyright_or_journal_line(text):
        return True
    if looks_like_url_fragment(text):
        return True
    if _looks_like_short_alpha_fragment(text):
        return True

    if _line_count(item) <= 2 and len(text) <= 64 and text.strip().lower() == "supporting information":
        return True
    return False


def find_metadata_fragment_item_ids(payload: list[dict]) -> set[str]:
    skipped: set[str] = set()
    for item in payload:
        if should_skip_metadata_fragment(item):
            skipped.add(item.get("item_id", ""))
    return skipped


__all__ = [
    "find_metadata_fragment_item_ids",
    "looks_like_url_fragment",
    "looks_like_nontranslatable_metadata",
    "should_skip_metadata_fragment",
]

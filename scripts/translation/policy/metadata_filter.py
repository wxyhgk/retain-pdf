import re


SHORT_CONNECTOR_SET = {
    "and",
    "or",
    "vs",
    "vs.",
    "&",
}

EDITORIAL_PREFIX_RE = re.compile(
    r"^(received|revised|accepted|published|available online|online publication date|supporting information)\b",
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


def _normalized_text(item: dict) -> str:
    return " ".join((item.get("source_text") or "").split())


def _line_count(item: dict) -> int:
    return len(item.get("lines", []))


def _comma_count(text: str) -> int:
    return text.count(",") + text.count(";")


def _looks_like_standalone_connector(text: str) -> bool:
    lowered = text.strip().lower()
    return lowered in SHORT_CONNECTOR_SET


def _looks_like_editorial_metadata(text: str) -> bool:
    return bool(EDITORIAL_PREFIX_RE.match(text))


def _looks_like_author_or_affiliation(text: str) -> bool:
    upper_name_tokens = len(ALL_CAPS_TOKEN_RE.findall(text))
    initial_names = len(INITIAL_NAME_RE.findall(text))
    if AUTHOR_MARKER_RE.search(text) and (_comma_count(text) >= 1 or initial_names >= 1 or upper_name_tokens >= 2):
        return True
    if PERSON_NAME_RE.fullmatch(text.strip()) and len(text) <= 80:
        return True
    if initial_names >= 2 and _comma_count(text) >= 1:
        return True
    if upper_name_tokens >= 4 and _comma_count(text) >= 1 and len(text) <= 360:
        return True
    if AFFILIATION_RE.search(text) and len(text) <= 160 and _comma_count(text) == 0:
        return True
    if AFFILIATION_RE.search(text) and (_comma_count(text) >= 2 or POSTAL_RE.search(text)) and len(text) <= 360:
        return True
    if EMAIL_RE.search(text):
        return True
    return False


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
    if SECTION_MARKER_START_RE.match(stripped):
        return False
    if any(ch.isspace() for ch in stripped):
        return False
    if not SHORT_ALPHA_FRAGMENT_RE.fullmatch(stripped):
        return False
    return _letter_count(stripped) < 4


def should_skip_metadata_fragment(item: dict) -> bool:
    if item.get("block_type") not in {"text", "title", "list"}:
        return False
    if not item.get("should_translate", True):
        return False

    text = _normalized_text(item)
    if not text:
        return False

    if len(text) <= 16 and _looks_like_standalone_connector(text):
        return True
    if _looks_like_editorial_metadata(text):
        return True
    if _looks_like_author_or_affiliation(text):
        return True
    if _looks_like_copyright_or_journal_line(text):
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


__all__ = ["find_metadata_fragment_item_ids", "should_skip_metadata_fragment"]

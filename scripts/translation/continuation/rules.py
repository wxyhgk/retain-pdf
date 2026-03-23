import re


TERMINAL_PUNCTUATION = (".", "!", "?", ":", ";")
LOWER_START_RE = re.compile(r"^[a-z]")
UPPER_START_RE = re.compile(r"^[A-Z]")
HEADING_START_RE = re.compile(r"^(?:\(?\d+(?:\.\d+)*\)?[.)]?\s+|[A-Z][A-Z\s\-]{3,}|[•\-*]\s+)")
SOFT_BREAK_PUNCTUATION = (",",)
CONTINUATION_START_WORDS = {
    "and",
    "or",
    "but",
    "with",
    "without",
    "whereas",
    "while",
    "which",
    "that",
    "than",
    "then",
    "thus",
    "therefore",
    "however",
    "nevertheless",
    "moreover",
    "furthermore",
    "second",
}
CONTINUATION_END_WORDS = {
    "the",
    "a",
    "an",
    "of",
    "to",
    "for",
    "with",
    "and",
    "or",
    "but",
    "that",
    "these",
    "those",
    "this",
    "two",
    "three",
    "four",
    "five",
    "several",
    "many",
    "more",
    "less",
}
SUSPICIOUS_END_WORDS = {
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "can",
    "could",
    "may",
    "might",
    "should",
    "would",
    "must",
    "will",
    "shall",
}


def normalize_text(text: str) -> str:
    return " ".join((text or "").split())


def last_word(text: str) -> str:
    tokens = re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)?", text)
    return tokens[-1].lower() if tokens else ""


def starts_like_continuation(text: str) -> bool:
    stripped = normalize_text(text)
    if not stripped:
        return False
    if LOWER_START_RE.match(stripped):
        return True
    first = last_word(stripped[:32])
    return first in CONTINUATION_START_WORDS


def ends_like_continuation(text: str) -> bool:
    stripped = normalize_text(text)
    if not stripped:
        return False
    if stripped.endswith("-"):
        return True
    if stripped.endswith(TERMINAL_PUNCTUATION):
        return False
    last = last_word(stripped)
    return last in CONTINUATION_END_WORDS


def ends_with_soft_break(text: str) -> bool:
    stripped = normalize_text(text)
    return bool(stripped) and stripped.endswith(SOFT_BREAK_PUNCTUATION)


def starts_like_heading_or_list(text: str) -> bool:
    stripped = normalize_text(text)
    return bool(stripped) and bool(HEADING_START_RE.match(stripped))


def starts_with_upper(text: str) -> bool:
    stripped = normalize_text(text)
    return bool(stripped) and bool(UPPER_START_RE.match(stripped))


def last_token_is_suspicious(text: str) -> bool:
    return last_word(text) in SUSPICIOUS_END_WORDS


def bbox(item: dict) -> list[float]:
    item_bbox = item.get("bbox", [])
    return item_bbox if len(item_bbox) == 4 else []


def column_gap(prev_bbox: list[float], next_bbox: list[float]) -> float:
    if not prev_bbox or not next_bbox:
        return 0.0
    return next_bbox[0] - prev_bbox[2]


def vertical_gap(prev_bbox: list[float], next_bbox: list[float]) -> float:
    if not prev_bbox or not next_bbox:
        return 0.0
    return next_bbox[1] - prev_bbox[3]


def same_page(a: dict, b: dict) -> bool:
    return a.get("page_idx") == b.get("page_idx")


def eligible(item: dict) -> bool:
    return item.get("block_type") == "text" and bool(normalize_text(item.get("protected_source_text", "")))


def same_column(prev_bbox: list[float], next_bbox: list[float]) -> bool:
    if not prev_bbox or not next_bbox:
        return False
    return abs(next_bbox[0] - prev_bbox[0]) <= 28


def likely_pair_geometry(prev_item: dict, next_item: dict) -> bool:
    prev_bbox = bbox(prev_item)
    next_bbox = bbox(next_item)
    if not prev_bbox or not next_bbox:
        return True
    if same_page(prev_item, next_item):
        cross_column = next_bbox[0] > prev_bbox[2] + 8
        near_vertical = same_column(prev_bbox, next_bbox) and vertical_gap(prev_bbox, next_bbox) <= 40
        if cross_column:
            return column_gap(prev_bbox, next_bbox) <= 96
        return near_vertical
    return True


def pair_join_score(prev_item: dict, next_item: dict) -> int:
    prev_page_idx = prev_item.get("page_idx", -1)
    next_page_idx = next_item.get("page_idx", -1)
    if next_page_idx < prev_page_idx or next_page_idx - prev_page_idx > 1:
        return -999
    if not eligible(prev_item) or not eligible(next_item):
        return -999
    prev_text = normalize_text(prev_item.get("protected_source_text", ""))
    next_text = normalize_text(next_item.get("protected_source_text", ""))
    if not prev_text or not next_text:
        return -999

    score = 0
    if starts_like_continuation(next_text):
        score += 3
    if ends_like_continuation(prev_text):
        score += 3
    if prev_text.endswith("-"):
        score += 4
    if ends_with_soft_break(prev_text):
        score += 1
    if last_token_is_suspicious(prev_text):
        score += 1
    if next_page_idx != prev_page_idx:
        if not prev_text.endswith(TERMINAL_PUNCTUATION):
            score += 2
    elif likely_pair_geometry(prev_item, next_item):
        score += 1
    return score


def pair_break_score(prev_item: dict, next_item: dict) -> int:
    prev_text = normalize_text(prev_item.get("protected_source_text", ""))
    next_text = normalize_text(next_item.get("protected_source_text", ""))
    score = 0
    if prev_text.endswith((".", "!", "?")):
        score += 4
    elif prev_text.endswith(TERMINAL_PUNCTUATION):
        score += 2
    if starts_like_heading_or_list(next_text):
        score += 3
    if starts_with_upper(next_text) and not starts_like_continuation(next_text):
        score += 1
    prev_bbox = bbox(prev_item)
    next_bbox = bbox(next_item)
    if same_page(prev_item, next_item) and prev_bbox and next_bbox:
        if not likely_pair_geometry(prev_item, next_item):
            score += 2
    return score


def pair_decision(prev_item: dict, next_item: dict) -> str:
    join_score = pair_join_score(prev_item, next_item)
    if join_score < 0:
        return "break"
    break_score = pair_break_score(prev_item, next_item)
    if join_score >= 4 and join_score >= break_score + 2:
        return "join"
    if break_score >= 4 and break_score >= join_score + 1:
        return "break"
    return "candidate"


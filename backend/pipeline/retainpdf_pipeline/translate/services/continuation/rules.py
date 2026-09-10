import re

from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike


TERMINAL_PUNCTUATION = (".", "!", "?", ":", ";")
LOWER_START_RE = re.compile(r"^[a-z]")
UPPER_START_RE = re.compile(r"^[A-Z]")
HEADING_START_RE = re.compile(r"^(?:\(?\d+(?:\.\d+)*\)?[.)]?\s+|[A-Z][A-Z\s\-]{3,}|[•\-*]\s+)")
# Multi-level section numbers like "2.2.1 Title" / "2.1 Lithium-halogen..." — not body continuations.
SECTION_NUMBER_START_RE = re.compile(r"^\d+(?:\.\d+){1,}\s+[A-Z]")
# Figure/table/scheme captions mis-tagged as body must never join continuations
# (e.g. Nickel paper: "Scheme 18. Intermolecular ..." tagged text/body joined a
# dangling paragraph tail). A label alone is not enough — a number must follow,
# so "Table salt is ..." stays eligible while "Table 2. ..." does not.
CAPTION_TITLE_START_RE = re.compile(
    r"^(?:"
    r"schemes?|figures?|fig\.?|tables?|algorithms?|equations?|charts?|panels?|plates?|boxes?"
    r")\.?\s+"
    r"(?:S\d+|\d+[A-Za-z]?|[IVXLCDM]+\b)",
    re.IGNORECASE,
)
CJK_CAPTION_TITLE_START_RE = re.compile(
    r"^(?:附?[图插表]|方案)\s*[SＳ\d\d０-９一二三四五六七八九十百千〇零]+\s*[.．、:：]?"
)
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
    # Common mid-sentence cuts at column/page boundaries (SCI dual-column).
    "under",
    "only",
    "into",
    "from",
    "as",
    "at",
    "by",
    "via",
    "onto",
    "upon",
    "within",
    "without",
    "between",
    "among",
    "across",
    "through",
    "during",
    "before",
    "after",
    "against",
    "about",
    "over",
    "above",
    "below",
    "using",
    "including",
    "such",
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
UNESCAPED_INLINE_DOLLAR_RE = re.compile(r"(?<!\\)\$")


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


def starts_like_section_number(text: str) -> bool:
    stripped = normalize_text(text)
    return bool(stripped) and bool(SECTION_NUMBER_START_RE.match(stripped))


def starts_like_caption_title(text: str) -> bool:
    """True when the block reads as a figure/table/scheme caption title.

    Role-based guards (``item_is_bodylike``) only catch captions that are
    tagged as captions. Provider OCR frequently tags captions as plain body
    text, so cross-column/cross-page continuation must also refuse them by
    their text shape. Only the *start* of the block is inspected: a body
    paragraph that merely mentions "Scheme 18" mid-sentence is unaffected.
    """
    stripped = normalize_text(text)
    if not stripped:
        return False
    return bool(CAPTION_TITLE_START_RE.match(stripped) or CJK_CAPTION_TITLE_START_RE.match(stripped))


def starts_with_upper(text: str) -> bool:
    stripped = normalize_text(text)
    return bool(stripped) and bool(UPPER_START_RE.match(stripped))


def last_token_is_suspicious(text: str) -> bool:
    return last_word(text) in SUSPICIOUS_END_WORDS


def inline_math_delimiter_balance(text: str) -> int:
    return len(UNESCAPED_INLINE_DOLLAR_RE.findall(normalize_text(text)))


def has_balanced_inline_math_delimiters(text: str) -> bool:
    return inline_math_delimiter_balance(text) % 2 == 0


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
    if (
        str(item.get("translation_group_strategy", "") or "").strip() == "aggregate_geometry"
        or not item_is_bodylike(item)
        or not has_balanced_inline_math_delimiters(item.get("protected_source_text", ""))
        or not normalize_text(item.get("protected_source_text", ""))
    ):
        return False
    # Cross-column/cross-page continuation joins body blocks only. Captions
    # mis-tagged as body (e.g. "Scheme 18. ...") are refused by text shape.
    return not starts_like_caption_title(item.get("protected_source_text", ""))


def same_column(prev_bbox: list[float], next_bbox: list[float]) -> bool:
    if not prev_bbox or not next_bbox:
        return False
    return abs(next_bbox[0] - prev_bbox[0]) <= 28


def layout_zone(item: dict) -> str:
    return str(item.get("layout_zone", "") or "").strip().lower()


def layout_boundary_role(item: dict) -> str:
    return str(item.get("layout_boundary_role", "") or "").strip().lower()


def is_reading_boundary_cross_column_pair(prev_item: dict, next_item: dict) -> bool:
    if not is_same_page_cross_column_pair(prev_item, next_item):
        return False
    return (
        layout_zone(prev_item) == "left_column"
        and layout_boundary_role(prev_item) in {"tail", "single"}
        and layout_zone(next_item) == "right_column"
        and layout_boundary_role(next_item) in {"head", "single"}
    )


def is_reading_boundary_cross_page_pair(prev_item: dict, next_item: dict) -> bool:
    prev_page_idx = prev_item.get("page_idx", -1)
    next_page_idx = next_item.get("page_idx", -1)
    if next_page_idx != prev_page_idx + 1:
        return False

    prev_role = layout_boundary_role(prev_item)
    next_role = layout_boundary_role(next_item)
    if prev_role or next_role:
        if prev_role not in {"tail", "single"}:
            return False
        if next_role not in {"head", "single"}:
            return False

    prev_zone = layout_zone(prev_item)
    next_zone = layout_zone(next_item)
    if not prev_zone and not next_zone:
        return True
    return (
        prev_zone in {"right_column", "full_width", "single_column"}
        and next_zone in {"left_column", "full_width", "single_column"}
    )


def is_same_page_cross_column_pair(prev_item: dict, next_item: dict) -> bool:
    """True when next item is the right-hand column peer of prev on the same page.

    Prefer layout_zone (stable for dual-column papers). BBox fallback allows a
    narrow gutter: next may start only a few points to the right of prev.x1.
    """
    if not same_page(prev_item, next_item):
        return False
    prev_zone = layout_zone(prev_item)
    next_zone = layout_zone(next_item)
    if prev_zone == "left_column" and next_zone == "right_column":
        return True
    prev_bbox = bbox(prev_item)
    next_bbox = bbox(next_item)
    if not prev_bbox or not next_bbox:
        return False
    # Clearly to the right of the previous block (even with a ~0–8pt gutter).
    to_the_right = next_bbox[0] >= prev_bbox[2] - 4 and (next_bbox[0] - prev_bbox[0]) >= 40
    if not to_the_right:
        return False
    # Reject extreme horizontal leaps that are unlikely to be adjacent columns.
    return column_gap(prev_bbox, next_bbox) <= 120 or next_bbox[0] <= prev_bbox[2] + 120


def likely_pair_geometry(prev_item: dict, next_item: dict) -> bool:
    prev_bbox = bbox(prev_item)
    next_bbox = bbox(next_item)
    if not prev_bbox or not next_bbox:
        return True
    if same_page(prev_item, next_item):
        # Dual-column L→R flow often jumps from bottom-left to mid/top-right;
        # zone/bbox cross-column detection is enough (no vertical proximity).
        if is_same_page_cross_column_pair(prev_item, next_item):
            return True
        near_vertical = same_column(prev_bbox, next_bbox) and vertical_gap(prev_bbox, next_bbox) <= 40
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
    if prev_page_idx == next_page_idx:
        if not likely_pair_geometry(prev_item, next_item):
            return -999
        if not is_same_page_cross_column_pair(prev_item, next_item):
            if not prev_text.endswith("-"):
                return -999

    score = 0
    if starts_like_continuation(next_text):
        score += 3
    if prev_text.endswith(TERMINAL_PUNCTUATION) and starts_like_continuation(next_text):
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
    else:
        score += 2 if is_same_page_cross_column_pair(prev_item, next_item) else 0
    return score


def pair_break_score(prev_item: dict, next_item: dict) -> int:
    prev_text = normalize_text(prev_item.get("protected_source_text", ""))
    next_text = normalize_text(next_item.get("protected_source_text", ""))
    score = 0
    if prev_text.endswith((".", "!", "?")):
        score += 4
    elif prev_text.endswith(TERMINAL_PUNCTUATION):
        score += 2
    if starts_like_continuation(next_text):
        score -= 3
    if starts_like_section_number(next_text):
        score += 6
    elif starts_like_heading_or_list(next_text):
        score += 3
    if starts_with_upper(next_text) and not starts_like_continuation(next_text):
        score += 1
    prev_bbox = bbox(prev_item)
    next_bbox = bbox(next_item)
    if same_page(prev_item, next_item) and prev_bbox and next_bbox:
        if not likely_pair_geometry(prev_item, next_item):
            score += 2
    return max(0, score)


def pair_decision(prev_item: dict, next_item: dict) -> str:
    join_score = pair_join_score(prev_item, next_item)
    if join_score < 0:
        return "break"
    next_text = normalize_text(next_item.get("protected_source_text", ""))
    # Section headings are never body continuations (e.g. "...that of" + "2.2.1 Title").
    if starts_like_section_number(next_text):
        return "break"
    break_score = pair_break_score(prev_item, next_item)
    if join_score >= 4 and join_score >= break_score + 2:
        return "join"
    if break_score >= 4 and break_score >= join_score + 1:
        return "break"
    return "candidate"

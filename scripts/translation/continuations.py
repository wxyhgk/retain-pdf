import re


TERMINAL_PUNCTUATION = (".", "!", "?", ":", ";")
LOWER_START_RE = re.compile(r"^[a-z]")


def _normalize(text: str) -> str:
    return " ".join((text or "").split())


def _last_word(text: str) -> str:
    tokens = re.findall(r"[A-Za-z]+(?:[-'][A-Za-z]+)?", text)
    return tokens[-1].lower() if tokens else ""


def _starts_like_continuation(text: str) -> bool:
    stripped = _normalize(text)
    if not stripped:
        return False
    if LOWER_START_RE.match(stripped):
        return True
    first = _last_word(stripped[:32])
    return first in {
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


def _ends_like_continuation(text: str) -> bool:
    stripped = _normalize(text)
    if not stripped:
        return False
    if stripped.endswith("-"):
        return True
    if stripped.endswith(TERMINAL_PUNCTUATION):
        return False
    last = _last_word(stripped)
    return last in {
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


def _bbox(item: dict) -> list[float]:
    bbox = item.get("bbox", [])
    return bbox if len(bbox) == 4 else []


def _column_gap(prev_bbox: list[float], next_bbox: list[float]) -> float:
    if not prev_bbox or not next_bbox:
        return 0.0
    return next_bbox[0] - prev_bbox[2]


def _vertical_gap(prev_bbox: list[float], next_bbox: list[float]) -> float:
    if not prev_bbox or not next_bbox:
        return 0.0
    return next_bbox[1] - prev_bbox[3]


def _same_page(a: dict, b: dict) -> bool:
    return a.get("page_idx") == b.get("page_idx")


def _eligible(item: dict) -> bool:
    return item.get("block_type") == "text" and bool(_normalize(item.get("protected_source_text", "")))


def _is_continuation_pair(prev_item: dict, next_item: dict) -> bool:
    prev_page_idx = prev_item.get("page_idx", -1)
    next_page_idx = next_item.get("page_idx", -1)
    if next_page_idx < prev_page_idx or next_page_idx - prev_page_idx > 1:
        return False
    if not _eligible(prev_item) or not _eligible(next_item):
        return False
    prev_text = _normalize(prev_item.get("protected_source_text", ""))
    next_text = _normalize(next_item.get("protected_source_text", ""))
    if not _ends_like_continuation(prev_text):
        return False
    if not _starts_like_continuation(next_text):
        return False

    prev_bbox = _bbox(prev_item)
    next_bbox = _bbox(next_item)
    if not prev_bbox or not next_bbox:
        return True

    if next_page_idx != prev_page_idx:
        return True

    cross_column = next_bbox[0] > prev_bbox[2] + 8
    near_vertical = abs(next_bbox[0] - prev_bbox[0]) <= 24 and _vertical_gap(prev_bbox, next_bbox) <= 36
    if cross_column:
        return _column_gap(prev_bbox, next_bbox) <= 80
    return near_vertical


def annotate_continuation_context(payload: list[dict]) -> int:
    for item in payload:
        item["continuation_group"] = ""
        item["continuation_prev_text"] = ""
        item["continuation_next_text"] = ""

    group_index = 0
    annotated = 0
    i = 0
    while i < len(payload) - 1:
        current = payload[i]
        nxt = payload[i + 1]
        if not _is_continuation_pair(current, nxt):
            i += 1
            continue

        group_index += 1
        group_id = f"cg-{current.get('page_idx', 0) + 1:03d}-{group_index:03d}"
        chain = [current, nxt]
        j = i + 1
        while j < len(payload) - 1 and _is_continuation_pair(payload[j], payload[j + 1]):
            chain.append(payload[j + 1])
            j += 1

        for pos, item in enumerate(chain):
            item["continuation_group"] = group_id
            if pos > 0:
                item["continuation_prev_text"] = _normalize(chain[pos - 1].get("protected_source_text", ""))
            annotated += 1
        i = j + 1

    return annotated


def annotate_continuation_context_global(payloads_by_page: dict[int, list[dict]]) -> int:
    ordered_pages = sorted(payloads_by_page)
    flat_payload: list[dict] = []
    for page_idx in ordered_pages:
        flat_payload.extend(payloads_by_page[page_idx])
    return annotate_continuation_context(flat_payload)

from __future__ import annotations

from dataclasses import dataclass
import re

from retainpdf_pipeline.translate.core.context.models import sanitize_prompt_context_text
from retainpdf_pipeline.translate.core.item_reader import item_is_caption_like
from retainpdf_pipeline.translate.core.item_reader import item_is_textual


DEFAULT_CONTEXT_WINDOW_NEIGHBORS = 2
DEFAULT_CONTEXT_TEXT_LIMIT = 360
SOURCE_TERMINAL_RE = re.compile(r"[.!?。！？；;:：)\]）】”’\"']\s*$")
CONNECTOR_START_RE = re.compile(
    r"^(?:and|or|but|than|which|that|where|when|while|because|therefore|thus|hence|so|as|of|to|for|from|with|in|on|by)\b",
    re.IGNORECASE,
)
WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")


@dataclass(frozen=True)
class TranslationContextWindow:
    item_id: str
    before: str = ""
    after: str = ""


def _item_order(item: dict) -> tuple[int, int]:
    page_idx = item.get("page_idx", 0)
    block_idx = item.get("block_idx", item.get("reading_order", 0))
    try:
        page_idx = int(page_idx)
    except Exception:
        page_idx = 0
    try:
        block_idx = int(block_idx)
    except Exception:
        block_idx = 0
    return page_idx, block_idx


def _context_source(item: dict) -> str:
    return sanitize_prompt_context_text(
        str(
            item.get("source_text")
            or item.get("protected_source_text")
            or item.get("translation_unit_protected_source_text")
            or ""
        )
    )


def _trim_context(text: str, *, limit: int) -> str:
    compact = sanitize_prompt_context_text(text)
    if len(compact) <= limit:
        return compact
    return f"{compact[: max(0, limit - 1)].rstrip()}..."


def _join_context_items(items: list[dict], *, limit: int) -> str:
    parts = [_context_source(item) for item in items if _context_source(item)]
    return _trim_context(" / ".join(parts), limit=limit)


def _is_context_candidate(item: dict) -> bool:
    if not item_is_textual(item):
        return False
    if not _context_source(item):
        return False
    return True


def _source_looks_incomplete(text: str) -> bool:
    source = str(text or "").strip()
    if not source:
        return False
    return SOURCE_TERMINAL_RE.search(source) is None


def _needs_translation_context(item: dict) -> bool:
    source = _context_source(item)
    if not source:
        return False
    if str(item.get("continuation_group", "") or "").strip():
        return True
    if str(item.get("continuation_candidate_prev_id", "") or "").strip():
        return True
    if str(item.get("continuation_candidate_next_id", "") or "").strip():
        return True
    if item_is_caption_like(item):
        return True
    words = WORD_RE.findall(source)
    if CONNECTOR_START_RE.search(source):
        return True
    if len(words) <= 8 and _source_looks_incomplete(source):
        return True
    return False


def build_translation_context_windows(
    page_payloads: dict[int, list[dict]],
    *,
    neighbors: int = DEFAULT_CONTEXT_WINDOW_NEIGHBORS,
    text_limit: int = DEFAULT_CONTEXT_TEXT_LIMIT,
) -> dict[str, TranslationContextWindow]:
    flat_items = [
        item
        for page_idx in sorted(page_payloads)
        for item in sorted(page_payloads[page_idx], key=_item_order)
    ]
    context_items = [item for item in flat_items if _is_context_candidate(item)]
    index_by_identity = {id(item): index for index, item in enumerate(context_items)}
    windows: dict[str, TranslationContextWindow] = {}
    window_size = max(0, int(neighbors))
    for item in flat_items:
        item_id = str(item.get("item_id", "") or "")
        if not item_id or not _is_context_candidate(item):
            continue
        index = index_by_identity.get(id(item))
        if index is None:
            continue
        before_items = context_items[max(0, index - window_size) : index]
        after_items = context_items[index + 1 : index + 1 + window_size]
        windows[item_id] = TranslationContextWindow(
            item_id=item_id,
            before=_join_context_items(before_items, limit=text_limit),
            after=_join_context_items(after_items, limit=text_limit),
        )
    return windows


def annotate_translation_context_windows(
    page_payloads: dict[int, list[dict]],
    *,
    neighbors: int = DEFAULT_CONTEXT_WINDOW_NEIGHBORS,
    text_limit: int = DEFAULT_CONTEXT_TEXT_LIMIT,
    mode: str = "needed",
) -> int:
    """Attach reading-order context only where a human translator would look around.

    The default keeps ordinary complete body paragraphs context-free, reducing
    prompt size and preventing neighboring text from being translated into the
    current block. Use mode="all" for the legacy behavior.
    """

    windows = build_translation_context_windows(page_payloads, neighbors=neighbors, text_limit=text_limit)
    resolved_mode = str(mode or "needed").strip().lower()
    annotate_all = resolved_mode == "all"
    annotate_none = resolved_mode == "off"
    annotated = 0
    flat_items = [
        item
        for page_idx in sorted(page_payloads)
        for item in sorted(page_payloads[page_idx], key=_item_order)
    ]
    for item in flat_items:
        item["translation_context_mode"] = resolved_mode
        item_id = str(item.get("item_id", "") or "")
        window = windows.get(item_id)
        if annotate_none or window is None or (not annotate_all and not _needs_translation_context(item)):
            item["translation_context_before"] = ""
            item["translation_context_after"] = ""
            continue
        if item.get("translation_context_before") != window.before:
            item["translation_context_before"] = window.before
            annotated += 1
        if item.get("translation_context_after") != window.after:
            item["translation_context_after"] = window.after
            annotated += 1
    return annotated


__all__ = [
    "DEFAULT_CONTEXT_TEXT_LIMIT",
    "DEFAULT_CONTEXT_WINDOW_NEIGHBORS",
    "TranslationContextWindow",
    "annotate_translation_context_windows",
    "build_translation_context_windows",
]

from __future__ import annotations

import re

from services.translation.item_reader import item_block_kind
from services.translation.item_reader import item_is_bodylike
from services.translation.item_reader import item_is_caption_like
from services.translation.item_reader import item_policy_translate
from services.translation.item_reader import item_raw_block_type
from services.translation.llm.placeholder_guard import has_formula_placeholders
from services.translation.llm.placeholder_guard import is_direct_math_mode
from services.translation.llm.placeholder_guard import placeholder_sequence
from services.translation.llm.placeholder_guard import should_force_translate_body_text
from services.translation.payload.parts.common import item_source_text
from services.translation.policy.metadata_filter import looks_like_hard_nontranslatable_metadata


SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;:])\s+")
WORD_SPLIT_RE = re.compile(r"\S+")
INLINE_MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
FALLBACK_TOKEN_RE = re.compile(rf"{INLINE_MATH_SPAN_RE.pattern}|\S+")
_CJK_CHAR_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
_LATIN_CHAR_RE = re.compile(r"[A-Za-z]")
_EN_WORD_RE = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")
FORMULA_PLACEHOLDER_RE = re.compile(r"<[ft]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]")
LONG_PLAIN_TEXT_CHARS = 800


def formula_placeholder_count(text: str) -> int:
    return len(FORMULA_PLACEHOLDER_RE.findall(text or ""))


def zh_char_count(text: str) -> int:
    return len(_CJK_CHAR_RE.findall(text or ""))


def _fallback_tokens(source_text: str) -> list[str]:
    text = str(source_text or "")
    if not text:
        return []
    if "$" not in text:
        return WORD_SPLIT_RE.findall(text)
    return FALLBACK_TOKEN_RE.findall(text)


def chunk_source_text_fallback(source_text: str, *, words_per_chunk: int = 48) -> list[str]:
    words = _fallback_tokens(source_text)
    if len(words) <= words_per_chunk:
        return [str(source_text or "").strip()] if str(source_text or "").strip() else []
    return [" ".join(words[i : i + words_per_chunk]).strip() for i in range(0, len(words), words_per_chunk)]


def is_continuation_or_group_unit(item: dict) -> bool:
    item_id = str(item.get("item_id", "") or "")
    unit_id = str(item.get("translation_unit_id", "") or "")
    return bool(
        item_id.startswith("__cg__:")
        or unit_id.startswith("__cg__:")
        or str(item.get("continuation_group", "") or "").strip()
    )


def is_long_plain_text_item(item: dict) -> bool:
    compact = " ".join(item_source_text(item).split())
    return len(compact) >= LONG_PLAIN_TEXT_CHARS


def should_keep_origin_on_empty_translation(item: dict) -> bool:
    if looks_like_hard_nontranslatable_metadata(item):
        return True
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    compact = " ".join(source_text.split())
    if not compact or len(compact) > 4:
        return False
    if not compact.replace(" ", "").isalnum():
        return False
    layout_zone = str(item.get("layout_zone", "") or "").strip().lower()
    policy_translate = item_policy_translate(item)
    if item_is_caption_like(item):
        return True
    return policy_translate is False and layout_zone == "non_flow"


def looks_like_cjk_dominant_body_text(item: dict) -> bool:
    if item_block_kind(item) != "text":
        return False
    if not item_is_bodylike(item):
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or item.get("source_text") or "")
    compact = " ".join(source_text.split())
    if len(compact) < 16:
        return False
    cjk_chars = len(_CJK_CHAR_RE.findall(compact))
    if cjk_chars < 10:
        return False
    latin_chars = len(_LATIN_CHAR_RE.findall(compact))
    english_words = len(_EN_WORD_RE.findall(compact))
    return cjk_chars >= max(10, latin_chars * 2, english_words * 2)


def should_keep_origin_on_protocol_shell(item: dict) -> bool:
    if looks_like_cjk_dominant_body_text(item):
        return True
    if is_direct_math_mode(item):
        return True
    if is_continuation_or_group_unit(item):
        return True
    return not should_force_translate_body_text(item)


def sentence_level_fallback_allowed(item: dict) -> bool:
    return not is_continuation_or_group_unit(item)


def single_item_http_retry_attempts(item: dict) -> int | None:
    if is_direct_math_mode(item):
        return None
    if has_formula_placeholders(item) or is_continuation_or_group_unit(item):
        return 1
    return None


def looks_like_direct_typst_partial_accept_text(item: dict, translated_text: str) -> bool:
    translated = str(translated_text or "").strip()
    if not translated:
        return False
    if zh_char_count(translated) < 8:
        return False
    if translated.startswith("{") and "translated_text" in translated:
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    source_words = len(_EN_WORD_RE.findall(source_text))
    translated_words = len(_EN_WORD_RE.findall(translated))
    if translated_words >= max(16, source_words * 0.7) and zh_char_count(translated) < translated_words:
        return False
    return True


def should_prefer_tagged_placeholder_first(item: dict, *, allow_tagged_placeholder_retry: bool) -> bool:
    if is_direct_math_mode(item):
        return False
    if not allow_tagged_placeholder_retry:
        return False
    if not has_formula_placeholders(item):
        return False
    if is_continuation_or_group_unit(item):
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "")
    return len(placeholder_sequence(source_text)) >= 8


def is_low_risk_deepseek_batch_item(
    item: dict,
    *,
    batch_low_risk_max_placeholders: int,
    batch_low_risk_min_chars: int,
    batch_low_risk_max_chars: int,
) -> bool:
    if item_raw_block_type(item) != "text":
        return False
    if not item_is_bodylike(item):
        return False
    source_text = str(item.get("translation_unit_protected_source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False
    if len(placeholder_sequence(source_text)) > batch_low_risk_max_placeholders:
        return False
    if not should_force_translate_body_text(item):
        return False
    compact_len = len(" ".join(source_text.split()))
    if compact_len < batch_low_risk_min_chars or compact_len > batch_low_risk_max_chars:
        return False
    return True

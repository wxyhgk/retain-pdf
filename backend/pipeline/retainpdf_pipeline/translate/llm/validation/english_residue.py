from __future__ import annotations

from difflib import SequenceMatcher
import re

from retainpdf_pipeline.translate.core.item_reader import item_content_kind
from retainpdf_pipeline.translate.core.item_reader import item_is_bodylike
from retainpdf_pipeline.translate.core.item_reader import item_is_metadata_like
from retainpdf_pipeline.translate.core.item_reader import item_is_reference_compatible
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import FORMULA_TOKEN_RE
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import strip_placeholders
from retainpdf_pipeline.translate.llm.validation.text_features import AUTHOR_NAME_TOKEN_RE
from retainpdf_pipeline.translate.llm.validation.text_features import EN_RESIDUE_SEGMENT_RE
from retainpdf_pipeline.translate.llm.validation.text_features import EN_WORD_RE
from retainpdf_pipeline.translate.llm.validation.text_features import english_chunk_word_lengths
from retainpdf_pipeline.translate.llm.validation.text_features import english_word_count
from retainpdf_pipeline.translate.llm.validation.text_features import looks_like_short_fragment_text
from retainpdf_pipeline.translate.llm.validation.text_features import zh_char_count
from retainpdf_pipeline.translate.core.text_rules import looks_like_code_literal_text_value
from retainpdf_pipeline.translate.core.text_rules import looks_like_reference_entry_text
from retainpdf_pipeline.translate.core.text_rules import looks_like_url_fragment


def normalize_inline_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def unit_source_text(item: dict) -> str:
    return (
        item.get("translation_unit_protected_source_text")
        or item.get("group_protected_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )


def item_math_mode(item: dict) -> str:
    return str(item.get("math_mode", "placeholder") or "placeholder").strip() or "placeholder"


def is_direct_math_mode(item: dict) -> bool:
    return item_math_mode(item) == "direct_typst"


def looks_like_english_prose(text: str) -> bool:
    cleaned = strip_placeholders(text).strip()
    if not cleaned:
        return False
    if looks_like_code_literal_text_value(cleaned):
        return False
    if "@" in cleaned or "http://" in cleaned or "https://" in cleaned or looks_like_url_fragment(cleaned):
        return False
    words = EN_WORD_RE.findall(cleaned)
    if len(words) < 8:
        return False
    alpha_chars = sum(ch.isalpha() for ch in cleaned)
    if alpha_chars < 30:
        return False
    return True


def _english_word_count(text: str) -> int:
    return english_word_count(strip_placeholders(text))


def _zh_char_count(text: str) -> int:
    return zh_char_count(strip_placeholders(text))


def _looks_like_data_dense_segment(segment: str) -> bool:
    # NMR 谱线、数值列表、化学计量串:数字密度高,是合法保留的数据而
    # 不是待译散文。此前这类片段会命中长残留跨度硬错误,触发注定失败
    # 的重试(译文本来就该保留它们)。
    alpha = sum(1 for char in segment if char.isalpha())
    digits = sum(1 for char in segment if char.isdigit())
    if alpha <= 0:
        return True
    return digits >= max(6, int(alpha * 0.35))


def _has_long_english_residue_span(text: str) -> bool:
    cleaned = strip_placeholders(text)
    if not cleaned:
        return False
    for match in EN_RESIDUE_SEGMENT_RE.finditer(cleaned):
        segment = " ".join((match.group(0) or "").split())
        if _looks_like_data_dense_segment(segment):
            continue
        if len(EN_WORD_RE.findall(segment)) >= 10 and looks_like_english_prose(segment):
            return True
    return False


def _long_english_residue_spans(text: str) -> list[str]:
    cleaned = strip_placeholders(text)
    if not cleaned:
        return []
    spans: list[str] = []
    for match in EN_RESIDUE_SEGMENT_RE.finditer(cleaned):
        segment = " ".join((match.group(0) or "").split())
        if _looks_like_data_dense_segment(segment):
            continue
        if len(EN_WORD_RE.findall(segment)) >= 10 and looks_like_english_prose(segment):
            spans.append(segment)
    return spans


def _normalized_english_surface(text: str) -> str:
    normalized = normalize_inline_whitespace(strip_placeholders(text)).lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return " ".join(normalized.split())


def _looks_like_copy_dominant_english_output(source_text: str, translated_text: str) -> bool:
    source_surface = _normalized_english_surface(source_text)
    translated_surface = _normalized_english_surface(translated_text)
    if not source_surface or not translated_surface:
        return False
    if source_surface == translated_surface:
        return True
    if min(len(source_surface), len(translated_surface)) < 32:
        return False
    similarity = SequenceMatcher(None, source_surface, translated_surface).ratio()
    return similarity >= 0.82


def _looks_like_author_name_list(text: str) -> bool:
    cleaned = strip_placeholders(text).strip()
    if not cleaned:
        return False
    if len(cleaned) > 240:
        return False
    if "@" in cleaned or "http://" in cleaned or "https://" in cleaned:
        return False
    normalized = cleaned.replace(" and ", ", ")
    segments = [segment.strip(" *†‡§,;") for segment in re.split(r",|;|\band\b", normalized) if segment.strip(" *†‡§,;")]
    if len(segments) < 3:
        return False
    name_like = 0
    for segment in segments:
        words = AUTHOR_NAME_TOKEN_RE.findall(segment)
        if 2 <= len(words) <= 5:
            name_like += 1
    return name_like >= max(3, len(segments) - 1)


def _is_reference_like_item(item: dict) -> bool:
    if item_is_reference_compatible(item):
        return True
    if not item_is_metadata_like(item):
        return False
    source_text = strip_placeholders(unit_source_text(item)).strip()
    if not source_text:
        return False
    return looks_like_reference_entry_text(source_text)


def _is_formula_dense_body_item(item: dict) -> bool:
    source_text = unit_source_text(item).strip()
    if not source_text:
        return False
    if not should_force_translate_body_text(item):
        return False
    has_formula_context = bool(
        item.get("continuation_group")
        or item.get("formula_map")
        or item.get("translation_unit_formula_map")
    )
    if not has_formula_context:
        return False
    formula_token_count = len(FORMULA_TOKEN_RE.findall(source_text))
    if formula_token_count >= 3:
        return True
    if item.get("continuation_group") and formula_token_count >= 1:
        return True
    return False


def _looks_like_term_preserving_mixed_output(item: dict, translated_text: str) -> bool:
    translated = str(translated_text or "").strip()
    if not translated:
        return False
    zh_chars = _zh_char_count(translated)
    if zh_chars < 6:
        return False
    if _has_long_english_residue_span(translated):
        return False
    chunk_lengths = english_chunk_word_lengths(strip_placeholders(translated))
    if not chunk_lengths:
        return False
    # 7-8 词的合法英文技术短语(方法名、仪器型号)不应让术语保留豁免失效
    if max(chunk_lengths) > 8:
        return False
    english_words = _english_word_count(translated)
    if english_words > max(24, zh_chars * 2):
        return False
    return bool(
        is_direct_math_mode(item)
        or item.get("continuation_group")
        or item.get("formula_map")
        or item.get("translation_unit_formula_map")
    )


def looks_like_predominantly_english_output(item: dict, translated_text: str) -> bool:
    source_text = unit_source_text(item).strip()
    translated = str(translated_text or "").strip()
    if not translated:
        return False
    if _is_reference_like_item(item):
        return False
    if is_direct_math_mode(item) and (_zh_char_count(translated) > 0 or not looks_like_english_prose(source_text)):
        return False
    if not should_force_translate_body_text(item):
        return False
    if not looks_like_english_prose(source_text):
        return False
    if _looks_like_author_name_list(source_text):
        return False
    english_words = _english_word_count(translated)
    zh_chars = _zh_char_count(translated)
    if _looks_like_term_preserving_mixed_output(item, translated):
        return False
    if _has_long_english_residue_span(translated):
        return True
    if english_words < 12:
        return False
    if zh_chars == 0:
        return True
    if _is_formula_dense_body_item(item):
        return False
    return english_words >= max(12, zh_chars // 2)


def looks_like_untranslated_english_output(item: dict, translated_text: str) -> bool:
    translated = str(translated_text or "").strip()
    if not looks_like_predominantly_english_output(item, translated):
        return False
    if _zh_char_count(translated) > 0:
        return False
    source_text = unit_source_text(item).strip()
    return _looks_like_copy_dominant_english_output(source_text, translated)


def looks_like_mixed_english_residue_output(item: dict, translated_text: str) -> bool:
    translated = str(translated_text or "").strip()
    if not translated:
        return False
    if _is_reference_like_item(item):
        return False
    if not should_force_translate_body_text(item):
        return False
    if _is_formula_dense_body_item(item):
        return False
    if _looks_like_term_preserving_mixed_output(item, translated):
        return False
    if _zh_char_count(translated) <= 0:
        return False
    source_text = unit_source_text(item).strip()
    if not looks_like_english_prose(source_text):
        return False
    for segment in _long_english_residue_spans(translated):
        if len(EN_WORD_RE.findall(segment)) < 12:
            continue
        if _looks_like_copy_dominant_english_output(source_text, segment):
            return True
    return False


def looks_like_short_fragment(text: str) -> bool:
    return looks_like_short_fragment_text(text)


def looks_like_garbled_fragment(text: str) -> bool:
    cleaned = strip_placeholders(text).strip()
    if not cleaned:
        return True
    if "\ufffd" in cleaned:
        return True
    visible = [ch for ch in cleaned if not ch.isspace()]
    if not visible:
        return True
    weird = sum(1 for ch in visible if not (ch.isalnum() or ch in ".,;:!?()[]{}'\"-_/+*&%$#=@"))
    return weird / max(1, len(visible)) > 0.35


def should_force_translate_body_text(item: dict) -> bool:
    source_text = unit_source_text(item).strip()
    if not source_text:
        return False
    if looks_like_code_literal_text_value(source_text):
        return False
    if looks_like_garbled_fragment(source_text):
        return False
    if looks_like_short_fragment(source_text):
        return False
    if item_content_kind(item) != "text":
        return False
    if not item_is_bodylike(item):
        return False
    words = EN_WORD_RE.findall(strip_placeholders(source_text))
    if item.get("continuation_group"):
        return len(words) >= 6 and looks_like_english_prose(source_text)
    if item_content_kind(item) == "text" and (
        is_direct_math_mode(item) or bool(item.get("formula_map") or item.get("translation_unit_formula_map"))
    ):
        return len(words) >= 5 and looks_like_english_prose(source_text)
    return looks_like_english_prose(source_text) and len(words) >= 8


__all__ = [
    "is_direct_math_mode",
    "item_math_mode",
    "looks_like_english_prose",
    "looks_like_garbled_fragment",
    "looks_like_mixed_english_residue_output",
    "looks_like_predominantly_english_output",
    "looks_like_short_fragment",
    "looks_like_untranslated_english_output",
    "normalize_inline_whitespace",
    "should_force_translate_body_text",
    "unit_source_text",
]

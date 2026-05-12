from __future__ import annotations

import re

from services.rendering.layout.inline_content.core.markdown import build_plain_text
from services.rendering.layout.model.render_text import get_render_formula_map
from services.rendering.layout.model.render_text import get_render_protected_text
from services.rendering.layout.model.render_text import restore_render_protected_text
from services.translation.item_reader import item_is_bodylike


FORMULA_TOKEN_PATTERN = r"<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\$(?!\s)(?:\\.|[^$\n]){1,240}?\$"
TOKEN_RE = re.compile(rf"({FORMULA_TOKEN_PATTERN}|\s+|[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|[\u4e00-\u9fff]|.)")
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*")
ZH_CHAR_RE = re.compile(r"[\u4e00-\u9fff]")
SPLIT_PUNCTUATION = (".", "。", "!", "！", "?", "？", ";", "；", ":", "：", ",", "，")
COMPACT_TRIGGER_RATIO = 0.9
COMPACT_SCALE = 0.9
HEAVY_COMPACT_RATIO = 1.0
LAYOUT_COMPACT_TRIGGER_RATIO = 0.9
LAYOUT_HEAVY_COMPACT_RATIO = 1.04


def is_flag_like_plain_text_block(item: dict) -> bool:
    text = re.sub(r"\s+", " ", build_plain_text(item)).strip()
    if not text:
        return False
    if len(item.get("formula_map", [])) > 0:
        return False
    if item_is_bodylike(item):
        return False
    line_count = len(item.get("lines", []))
    if line_count > 1:
        return False
    if not text.startswith("-"):
        return False
    body = text[1:].strip()
    if not body:
        return False
    if any(mark in body for mark in (".", "。", "!", "！", "?", "？", ";", "；")):
        return False
    if len(body) > 32:
        return False
    if len(WORD_RE.findall(body)) > 6:
        return False
    if len(ZH_CHAR_RE.findall(body)) > 18:
        return False
    return True


def tokenize_protected_text(text: str) -> list[str]:
    return TOKEN_RE.findall(text or "")


def strip_formula_placeholders(text: str) -> str:
    return re.sub(FORMULA_TOKEN_PATTERN, " ", text or "")


def normalize_render_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def same_meaningful_render_text(source_text: str, translated_text: str) -> bool:
    return normalize_render_text(source_text) == normalize_render_text(translated_text)


def source_word_count(item: dict) -> int:
    source_text = (
        item.get("render_source_text")
        or item.get("protected_source_text")
        or item.get("source_text")
        or ""
    )
    plain = strip_formula_placeholders(source_text)
    return len(WORD_RE.findall(plain))


def translated_zh_char_count(protected_text: str) -> int:
    plain = strip_formula_placeholders(protected_text)
    return len(ZH_CHAR_RE.findall(plain))


def translation_density_ratio(item: dict, protected_text: str) -> float:
    source_words = source_word_count(item)
    if source_words <= 0:
        return 0.0
    zh_chars = translated_zh_char_count(protected_text)
    if zh_chars <= 0:
        return 0.0
    return zh_chars / source_words


def layout_density_ratio(
    inner: list[float],
    protected_text: str,
    *,
    font_size_pt: float,
    line_step_pt: float,
) -> float:
    if len(inner) != 4 or font_size_pt <= 0 or line_step_pt <= 0:
        return 0.0
    width = max(8.0, inner[2] - inner[0])
    height = max(8.0, inner[3] - inner[1])
    zh_chars = translated_zh_char_count(protected_text)
    if zh_chars <= 0:
        return 0.0
    approx_char_width = max(font_size_pt * 0.92, 1.0)
    chars_per_line = max(4.0, width / approx_char_width)
    required_lines = max(1.0, zh_chars / chars_per_line)
    occupied_height = required_lines * line_step_pt
    return occupied_height / height


def trim_joined_tokens(tokens: list[str]) -> str:
    return "".join(tokens).strip()

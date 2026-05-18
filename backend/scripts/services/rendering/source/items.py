from __future__ import annotations

import re

import fitz

from services.rendering.layout.model.render_text import get_render_formula_map
from services.rendering.layout.model.render_text import get_render_protected_text


TOKEN_RE = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-./][A-Za-z0-9]+)*|[\u4e00-\u9fff]+")


def get_item_translated_text(item: dict) -> str:
    return get_render_protected_text(item)


def get_item_formula_map(item: dict) -> list[dict]:
    return get_render_formula_map(item)


def iter_valid_translated_items(translated_items: list[dict]) -> list[tuple[fitz.Rect, dict, str]]:
    valid_items: list[tuple[fitz.Rect, dict, str]] = []
    for item in translated_items:
        bbox = item.get("bbox", [])
        translated_text = get_item_translated_text(item)
        if len(bbox) != 4 or not translated_text:
            continue
        valid_items.append((fitz.Rect(bbox), item, translated_text))
    return valid_items


def normalize_words(text: str) -> list[str]:
    return [word.lower() for word in WORD_RE.findall(text or "")]

import re

import fitz
from services.rendering.layout.payload.text_common import restore_render_protected_text


TOKEN_RE = re.compile(r"(<[futnvc]\d+-[0-9a-z]{3}/>|\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-./][A-Za-z0-9]+)*|[\u4e00-\u9fff]+")


def get_item_translated_text(item: dict) -> str:
    if "render_protected_text" in item:
        return restore_render_protected_text(str(item.get("render_protected_text", "") or "").strip(), item)
    return restore_render_protected_text(
        (
        item.get("translation_unit_translated_text")
        or item.get("group_translated_text")
        or item.get("translated_text")
        or ""
        ).strip(),
        item,
    )


def get_item_formula_map(item: dict) -> list[dict]:
    return (
        item.get("render_formula_map")
        or item.get("translation_unit_formula_map")
        or item.get("group_formula_map")
        or item.get("formula_map", [])
    )


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

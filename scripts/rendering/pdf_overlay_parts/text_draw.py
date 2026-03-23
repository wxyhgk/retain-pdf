from pathlib import Path

import fitz

from config import fonts
from rendering.pdf_overlay_parts.redaction import redact_translated_text_areas
from rendering.pdf_overlay_parts.shared import TOKEN_RE, get_item_formula_map, iter_valid_translated_items
from rendering.typst_formula_renderer import compile_formula_png
from translation.payload import re_protect_restored_formulas


def insert_fitted_text(page: fitz.Page, rect: fitz.Rect, text: str, font_path: Path) -> None:
    expanded_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y1 + max(8, rect.height * 1.0))
    start_size = fonts.DEFAULT_FONT_SIZE
    end_size = fonts.MIN_FONT_SIZE

    current_size = start_size
    while current_size >= end_size:
        result = page.insert_textbox(
            expanded_rect,
            text,
            fontname="noto_cjk",
            fontsize=current_size,
            color=(0, 0, 0),
            align=0,
            overlay=True,
        )
        if result >= 0:
            return
        current_size -= 0.5

    page.insert_text(
        fitz.Point(rect.x0, rect.y1 - 1),
        text,
        fontname="noto_cjk",
        fontsize=fonts.MIN_FONT_SIZE,
        color=(0, 0, 0),
        overlay=True,
    )


def tokenize_protected_text(protected_text: str) -> list[str]:
    return [token for token in TOKEN_RE.findall(protected_text) if token]


def formula_lookup_map(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def insert_reflowed_segments(
    page: fitz.Page,
    rect: fitz.Rect,
    translated_text: str,
    formula_map: list[dict],
    font_path: Path,
) -> None:
    if not translated_text:
        return

    font = fitz.Font(fontfile=str(font_path))
    protected_text = re_protect_restored_formulas(translated_text, formula_map)
    tokens = tokenize_protected_text(protected_text)
    formulas = formula_lookup_map(formula_map)

    text_size = fonts.DEFAULT_FONT_SIZE
    formula_size = fonts.DEFAULT_FONT_SIZE
    line_height = fonts.DEFAULT_FONT_SIZE * 1.45
    x = rect.x0
    y = rect.y0 + fonts.DEFAULT_FONT_SIZE
    max_x = rect.x1

    def token_width(token_text: str, size: float) -> float:
        return font.text_length(token_text, size)

    def newline() -> None:
        nonlocal x, y
        x = rect.x0
        y += line_height

    for token in tokens:
        if y > rect.y1 + rect.height * 1.2:
            return

        if token.isspace():
            if "\n" in token:
                newline()
            else:
                x += token_width(" ", text_size)
            continue

        is_formula = token in formulas
        draw_text = formulas[token] if is_formula else token
        font_size = formula_size if is_formula else text_size
        formula_png = None
        if is_formula:
            try:
                formula_png, (img_w, img_h) = compile_formula_png(draw_text)
                formula_height = font_size * 1.35
                width = formula_height * (img_w / max(img_h, 1))
            except Exception:
                width = token_width(draw_text, font_size)
        else:
            width = token_width(draw_text, font_size)

        if x + width > max_x and x > rect.x0:
            newline()

        if is_formula and formula_png is not None:
            formula_height = font_size * 1.35
            img_rect = fitz.Rect(x, y - formula_height + 2, x + width, y + 2)
            page.insert_image(img_rect, filename=str(formula_png), overlay=True)
        else:
            page.insert_text(
                fitz.Point(x, y),
                draw_text,
                fontname="noto_cjk",
                fontsize=font_size,
                color=(0, 0, 0),
                overlay=True,
            )
        x += width


def apply_translated_items_to_page(
    page: fitz.Page,
    translated_items: list[dict],
    font_path: Path,
) -> None:
    valid_items = iter_valid_translated_items(translated_items)
    redact_translated_text_areas(page, translated_items)

    page.insert_font(fontname="noto_cjk", fontfile=str(font_path))
    for rect, item, translated_text in valid_items:
        formula_map = get_item_formula_map(item)
        if formula_map:
            insert_reflowed_segments(page, rect, translated_text, formula_map, font_path)
        else:
            insert_fitted_text(page, rect, translated_text, font_path)

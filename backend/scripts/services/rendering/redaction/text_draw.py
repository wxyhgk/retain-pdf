from pathlib import Path
import re

import fitz

from foundation.config import fonts
from services.rendering.redaction.redaction import redact_translated_text_areas
from services.rendering.redaction.shared import TOKEN_RE, get_item_formula_map, iter_valid_translated_items
from services.rendering.formula.typst_formula_renderer import compile_formula_png
from services.translation.payload import re_protect_restored_formulas


DIRECT_MATH_TOKEN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$|\s+|[^\s]+")
FORMULA_HEIGHT_SCALE = 1.35
LINE_HEIGHT_SCALE = 1.45
FONT_STEP_PT = 0.5
HEIGHT_BUDGET_SCALE = 1.0


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


def tokenize_direct_math_text(text: str) -> list[str]:
    return [token for token in DIRECT_MATH_TOKEN_RE.findall(text or "") if token]


def formula_lookup_map(formula_map: list[dict]) -> dict[str, str]:
    return {item["placeholder"]: item["formula_text"] for item in formula_map}


def _build_draw_token(*, text: str, kind: str, font: fitz.Font) -> dict:
    token = {"kind": kind, "text": text}
    if kind != "formula":
        return token
    try:
        formula_png, (img_w, img_h) = compile_formula_png(text)
        token["formula_png"] = formula_png
        token["aspect_ratio"] = img_w / max(img_h, 1)
    except Exception:
        token["fallback_width_factor"] = font.text_length(text, 1.0)
    return token


def _build_protected_draw_tokens(
    translated_text: str,
    formula_map: list[dict],
    font: fitz.Font,
) -> list[dict]:
    protected_text = re_protect_restored_formulas(translated_text, formula_map)
    formulas = formula_lookup_map(formula_map)
    tokens: list[dict] = []
    for token in tokenize_protected_text(protected_text):
        if token.isspace():
            tokens.append({"kind": "newline" if "\n" in token else "space", "text": token})
            continue
        if token in formulas:
            tokens.append(_build_draw_token(text=formulas[token], kind="formula", font=font))
            continue
        tokens.append({"kind": "text", "text": token})
    return tokens


def _build_direct_draw_tokens(markdown_text: str, font: fitz.Font) -> list[dict]:
    tokens: list[dict] = []
    for token in tokenize_direct_math_text(markdown_text):
        if token.isspace():
            tokens.append({"kind": "newline" if "\n" in token else "space", "text": token})
            continue
        if token.startswith("$") and token.endswith("$") and len(token) >= 2:
            tokens.append(_build_draw_token(text=token[1:-1], kind="formula", font=font))
            continue
        tokens.append({"kind": "text", "text": token})
    return tokens


def _space_width(font: fitz.Font, size: float) -> float:
    return font.text_length(" ", size)


def _token_width(font: fitz.Font, token: dict, size: float) -> float:
    if token["kind"] == "formula":
        formula_height = size * FORMULA_HEIGHT_SCALE
        aspect_ratio = token.get("aspect_ratio")
        if aspect_ratio:
            return formula_height * aspect_ratio
        return float(token.get("fallback_width_factor", 0.0)) * size
    return font.text_length(token["text"], size)


def _layout_segment_tokens(
    rect: fitz.Rect,
    tokens: list[dict],
    font: fitz.Font,
    font_size: float,
) -> tuple[bool, list[dict]]:
    available_width = max(rect.width, 1.0)
    available_height = max(rect.height * HEIGHT_BUDGET_SCALE, font_size)
    line_height = font_size * LINE_HEIGHT_SCALE
    baseline = font_size
    x = 0.0
    y = baseline
    placements: list[dict] = []

    def newline() -> bool:
        nonlocal x, y
        x = 0.0
        y += line_height
        return y <= available_height + 1e-6

    for token in tokens:
        kind = token["kind"]
        if kind == "newline":
            if not newline():
                return False, placements
            continue
        if kind == "space":
            if x <= 0:
                continue
            x += _space_width(font, font_size)
            continue

        width = _token_width(font, token, font_size)
        if x > 0 and x + width > available_width:
            if not newline():
                return False, placements
        if y > available_height + 1e-6:
            return False, placements
        placements.append(
            {
                "token": token,
                "x": rect.x0 + x,
                "y": rect.y0 + y,
                "width": width,
                "font_size": font_size,
            }
        )
        x += width
    return True, placements


def _fit_segment_layout(
    rect: fitz.Rect,
    tokens: list[dict],
    font: fitz.Font,
) -> tuple[float, list[dict]]:
    current_size = fonts.DEFAULT_FONT_SIZE
    best_size = fonts.MIN_FONT_SIZE
    best_layout: list[dict] = []
    while current_size >= fonts.MIN_FONT_SIZE - 1e-6:
        fits, placements = _layout_segment_tokens(rect, tokens, font, current_size)
        if fits:
            return current_size, placements
        best_size = current_size
        best_layout = placements
        current_size = round(current_size - FONT_STEP_PT, 2)
    _fits, placements = _layout_segment_tokens(rect, tokens, font, fonts.MIN_FONT_SIZE)
    if placements:
        return fonts.MIN_FONT_SIZE, placements
    return best_size, best_layout


def _render_segment_layout(page: fitz.Page, placements: list[dict]) -> None:
    for placement in placements:
        token = placement["token"]
        font_size = placement["font_size"]
        if token["kind"] == "formula" and token.get("formula_png") is not None:
            formula_height = font_size * FORMULA_HEIGHT_SCALE
            img_rect = fitz.Rect(
                placement["x"],
                placement["y"] - formula_height + 2,
                placement["x"] + placement["width"],
                placement["y"] + 2,
            )
            page.insert_image(img_rect, filename=str(token["formula_png"]), overlay=True)
            continue
        page.insert_text(
            fitz.Point(placement["x"], placement["y"]),
            token["text"],
            fontname="noto_cjk",
            fontsize=font_size,
            color=(0, 0, 0),
            overlay=True,
        )


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
    tokens = _build_protected_draw_tokens(translated_text, formula_map, font)
    _font_size, placements = _fit_segment_layout(rect, tokens, font)
    if placements:
        _render_segment_layout(page, placements)


def insert_direct_math_segments(
    page: fitz.Page,
    rect: fitz.Rect,
    translated_text: str,
    font_path: Path,
) -> None:
    direct_text = str(translated_text or "").strip()
    if "$" not in direct_text:
        insert_fitted_text(page, rect, translated_text, font_path)
        return

    font = fitz.Font(fontfile=str(font_path))
    tokens = _build_direct_draw_tokens(direct_text, font)
    _font_size, placements = _fit_segment_layout(rect, tokens, font)
    if placements:
        _render_segment_layout(page, placements)


def apply_translated_items_to_page(
    page: fitz.Page,
    translated_items: list[dict],
    font_path: Path,
    cover_only: bool = False,
) -> None:
    valid_items = iter_valid_translated_items(translated_items)
    redact_translated_text_areas(page, translated_items, cover_only=cover_only)

    page.insert_font(fontname="noto_cjk", fontfile=str(font_path))
    for rect, item, translated_text in valid_items:
        formula_map = get_item_formula_map(item)
        if formula_map:
            insert_reflowed_segments(page, rect, translated_text, formula_map, font_path)
        elif str(item.get("math_mode", "placeholder") or "placeholder").strip() == "direct_typst":
            insert_direct_math_segments(page, rect, translated_text, font_path)
        else:
            insert_fitted_text(page, rect, translated_text, font_path)

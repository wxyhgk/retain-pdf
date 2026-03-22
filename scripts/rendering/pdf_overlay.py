from pathlib import Path
import re

import fitz
from common.config import DEFAULT_FONT_SIZE, MIN_FONT_SIZE
from rendering.typst_formula_renderer import compile_formula_png
from translation.formula_protection import re_protect_restored_formulas


TOKEN_RE = re.compile(r"(\[\[FORMULA_\d+]]|\s+|[A-Za-z0-9_\-./]+|[\u4e00-\u9fff]|.)")
WORD_RE = re.compile(r"[A-Za-z0-9]+(?:[-./][A-Za-z0-9]+)*|[\u4e00-\u9fff]+")


def save_optimized_pdf(doc: fitz.Document, output_pdf_path: Path) -> None:
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    doc.subset_fonts()
    doc.save(
        output_pdf_path,
        garbage=4,
        deflate=True,
        deflate_images=True,
        deflate_fonts=True,
        use_objstms=1,
    )


def strip_page_links(page: fitz.Page) -> None:
    for link in page.get_links():
        try:
            page.delete_link(link)
        except Exception:
            continue


def page_has_editable_text(page: fitz.Page) -> bool:
    return len(page.get_text("words")) >= 20


def _normalize_words(text: str) -> list[str]:
    return [word.lower() for word in WORD_RE.findall(text or "")]


def _item_has_removable_text(page: fitz.Page, item: dict, rect: fitz.Rect) -> bool:
    source_text = (item.get("source_text") or item.get("protected_source_text") or "").strip()
    if not source_text:
        return False

    clip = fitz.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)
    words = page.get_text("words", clip=clip)
    if not words:
        return False

    pdf_words = [str(entry[4]).strip().lower() for entry in words if len(entry) >= 5 and str(entry[4]).strip()]
    if not pdf_words:
        return False

    source_words = _normalize_words(source_text)
    if not source_words:
        return len(pdf_words) >= 2

    pdf_word_set = set(pdf_words)
    source_word_set = set(source_words)
    overlap = len(pdf_word_set & source_word_set)
    source_len = len(source_words)

    if source_len <= 3:
        return overlap >= 1
    if source_len <= 8:
        return overlap >= 2
    return overlap >= max(2, int(source_len * 0.3))


def redact_translated_text_areas(
    page: fitz.Page,
    translated_items: list[dict],
    fill_background: bool | None = None,
) -> None:
    redactions: list[tuple[fitz.Rect, tuple[float, float, float] | None]] = []
    for item in translated_items:
        bbox = item.get("bbox", [])
        translated_text = (
            item.get("render_protected_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        ).strip()
        if len(bbox) != 4 or not translated_text:
            continue
        rect = fitz.Rect(bbox)
        if fill_background is None:
            fill = None if _item_has_removable_text(page, item, rect) else (1, 1, 1)
        else:
            fill = (1, 1, 1) if fill_background else None
        redactions.append((rect, fill))

    for rect, fill in redactions:
        page.add_redact_annot(rect, fill=fill)
    if redactions:
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
            text=fitz.PDF_REDACT_TEXT_REMOVE,
        )


def extract_single_page_pdf(source_pdf_path: Path, output_pdf_path: Path, page_idx: int) -> None:
    source_doc = fitz.open(source_pdf_path)
    output_doc = fitz.open()
    output_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    strip_page_links(output_doc[0])
    save_optimized_pdf(output_doc, output_pdf_path)
    output_doc.close()
    source_doc.close()


def insert_fitted_text(page: fitz.Page, rect: fitz.Rect, text: str, font_path: Path) -> None:
    expanded_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y1 + max(8, rect.height * 1.0))
    start_size = DEFAULT_FONT_SIZE
    end_size = MIN_FONT_SIZE

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
        fontsize=MIN_FONT_SIZE,
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

    text_size = DEFAULT_FONT_SIZE
    formula_size = DEFAULT_FONT_SIZE
    line_height = DEFAULT_FONT_SIZE * 1.45
    x = rect.x0
    y = rect.y0 + DEFAULT_FONT_SIZE
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
    valid_items: list[tuple[fitz.Rect, dict]] = []
    for item in translated_items:
        bbox = item["bbox"]
        translated_text = (
            item.get("render_protected_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        ).strip()
        if len(bbox) != 4 or not translated_text:
            continue
        rect = fitz.Rect(bbox)
        valid_items.append((rect, item))
    redact_translated_text_areas(page, translated_items)

    page.insert_font(fontname="noto_cjk", fontfile=str(font_path))
    for rect, item in valid_items:
        translated_text = (
            item.get("render_protected_text")
            or item.get("translation_unit_translated_text")
            or item.get("group_translated_text")
            or item.get("translated_text")
            or ""
        ).strip()
        formula_map = (
            item.get("render_formula_map")
            or item.get("translation_unit_formula_map")
            or item.get("group_formula_map")
            or item.get("formula_map", [])
        )
        if formula_map:
            insert_reflowed_segments(page, rect, translated_text, formula_map, font_path)
        else:
            insert_fitted_text(page, rect, translated_text, font_path)


def build_dev_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    font_path: Path,
) -> None:
    doc = fitz.open(source_pdf_path)
    page = doc[page_idx]
    strip_page_links(page)
    apply_translated_items_to_page(page, translated_items, font_path)

    save_optimized_pdf(doc, output_pdf_path)
    doc.close()


def build_single_page_dev_pdf(
    source_pdf_path: Path,
    output_pdf_path: Path,
    translated_items: list[dict],
    page_idx: int,
    font_path: Path,
) -> None:
    temp_doc = fitz.open()
    source_doc = fitz.open(source_pdf_path)
    temp_doc.insert_pdf(source_doc, from_page=page_idx, to_page=page_idx)
    page = temp_doc[0]
    strip_page_links(page)
    apply_translated_items_to_page(page, translated_items, font_path)

    save_optimized_pdf(temp_doc, output_pdf_path)
    temp_doc.close()
    source_doc.close()

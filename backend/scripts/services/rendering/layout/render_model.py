from __future__ import annotations

import re
from pathlib import Path

import fitz

from services.rendering.api.render_payloads import prepare_render_payloads_by_page
from services.rendering.formula.math_utils import build_markdown_from_parts
from services.rendering.formula.math_utils import build_plain_text_from_text
from services.rendering.core.models import RenderLayoutBlock
from services.rendering.core.models import RenderPageSpec
from services.rendering.layout.font_fit import estimate_font_size_pt
from services.rendering.layout.font_fit import estimate_leading_em
from services.rendering.layout.font_fit import is_body_text_candidate
from services.rendering.layout.font_fit import page_baseline_font_size
from services.rendering.layout.typography.geometry import cover_bbox
from services.rendering.layout.typography.geometry import inner_bbox
from services.rendering.layout.typography.measurement import bbox_width
from services.rendering.layout.payload.text_common import is_flag_like_plain_text_block
from services.rendering.layout.payload.text_common import restore_render_protected_text


def _compact_zh_len(text: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", text or ""))


def _should_fit_wrapped_markdown(item: dict, markdown_text: str, *, font_size_pt: float, leading_em: float) -> bool:
    inner = inner_bbox(item)
    if len(inner) != 4:
        return False
    width = max(1.0, inner[2] - inner[0])
    height = max(1.0, inner[3] - inner[1])
    zh_len = _compact_zh_len(markdown_text)
    if zh_len <= 0 or font_size_pt <= 0:
        return False
    chars_per_line = max(4.0, width / max(1.0, font_size_pt * 0.92))
    estimated_lines = max(1.0, zh_len / chars_per_line)
    estimated_height = estimated_lines * font_size_pt * (1.0 + max(0.1, leading_em))
    return estimated_height > height * 0.92


def _layout_block_from_item(
    item: dict,
    *,
    page_index: int,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
    page_text_width_med: float,
) -> RenderLayoutBlock | None:
    protected_text = str(
        item.get("render_protected_text")
        or item.get("translation_unit_protected_translated_text")
        or item.get("protected_translated_text")
        or ""
    ).strip()
    protected_text = restore_render_protected_text(protected_text, item)
    if not protected_text:
        return None

    formula_map = item.get("render_formula_map") or item.get("translation_unit_formula_map") or item.get("formula_map", [])
    body_candidate = is_body_text_candidate(item, page_text_width_med)
    item_with_flag = {**item, "_is_body_text_candidate": body_candidate}
    font_size_pt = estimate_font_size_pt(
        item_with_flag,
        page_font_size,
        page_line_pitch,
        page_line_height,
        density_baseline,
    )
    leading_em = estimate_leading_em(item_with_flag, page_line_pitch, font_size_pt)
    content_kind = "plain" if item.get("_force_plain_line") or is_flag_like_plain_text_block(item) else "markdown"
    markdown_text = build_markdown_from_parts(protected_text, formula_map)
    plain_text = build_plain_text_from_text(markdown_text)
    wrapped_markdown_candidate = content_kind == "markdown" and _should_fit_wrapped_markdown(
        item,
        markdown_text,
        font_size_pt=font_size_pt,
        leading_em=leading_em,
    )
    fit_to_box = body_candidate or wrapped_markdown_candidate
    fit_min_font_size_pt = max(7.2, round(font_size_pt - 0.8, 2))
    fit_min_leading_em = max(0.22, round(leading_em - 0.08, 2))
    if wrapped_markdown_candidate and not body_candidate:
        fit_min_font_size_pt = max(7.2, round(font_size_pt - 2.2, 2))
        fit_min_leading_em = max(0.18, round(leading_em - 0.2, 2))

    return RenderLayoutBlock(
        block_id=f"item-{item.get('item_id', page_index)}",
        page_index=page_index,
        background_rect=list(cover_bbox(item)),
        content_rect=list(inner_bbox(item)),
        content_kind=content_kind,
        content_text=plain_text if content_kind == "plain" else markdown_text,
        plain_text=plain_text,
        math_map=list(formula_map),
        font_size_pt=font_size_pt,
        leading_em=leading_em,
        fit_to_box=fit_to_box,
        fit_min_font_size_pt=fit_min_font_size_pt,
        fit_min_leading_em=fit_min_leading_em,
        fit_max_height_pt=max(8.0, inner_bbox(item)[3] - inner_bbox(item)[1]),
    )


def _page_text_width_med(items: list[dict]) -> float:
    text_widths = [bbox_width(item) for item in items if item.get("block_type") == "text"]
    if not text_widths:
        return 0.0
    text_widths = sorted(text_widths)
    return text_widths[len(text_widths) // 2]


def _build_layout_blocks(items: list[dict], *, page_index: int) -> list[RenderLayoutBlock]:
    page_font_size, page_line_pitch, page_line_height, density_baseline = page_baseline_font_size(items)
    page_text_width_med = _page_text_width_med(items)
    blocks: list[RenderLayoutBlock] = []
    for item in items:
        block = _layout_block_from_item(
            item,
            page_index=page_index,
            page_font_size=page_font_size,
            page_line_pitch=page_line_pitch,
            page_line_height=page_line_height,
            density_baseline=density_baseline,
            page_text_width_med=page_text_width_med,
        )
        if block is not None:
            blocks.append(block)
    return blocks


def _with_render_fields(items: list[dict]) -> list[dict]:
    prepared: list[dict] = []
    for item in items:
        next_item = dict(item)
        next_item["render_protected_text"] = restore_render_protected_text(str(
            item.get("render_protected_text")
            or item.get("translation_unit_protected_translated_text")
            or item.get("protected_translated_text")
            or ""
        ).strip(), next_item)
        next_item["render_formula_map"] = item.get("render_formula_map") or item.get("translation_unit_formula_map") or item.get("formula_map", [])
        prepared.append(next_item)
    return prepared


def _layout_page_spec(
    *,
    page_index: int,
    page_width_pt: float,
    page_height_pt: float,
    items: list[dict],
    background_pdf_path: Path | None,
) -> RenderPageSpec:
    return RenderPageSpec(
        page_index=page_index,
        page_width_pt=page_width_pt,
        page_height_pt=page_height_pt,
        background_pdf_path=background_pdf_path,
        blocks=_build_layout_blocks(_with_render_fields(items), page_index=page_index),
    )


def build_render_page_specs(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    background_pdf_path: Path | None = None,
) -> list[RenderPageSpec]:
    prepared_pages = prepare_render_payloads_by_page(translated_pages)
    source_doc = fitz.open(source_pdf_path)
    try:
        page_specs: list[RenderPageSpec] = []
        for page_index in sorted(page_idx for page_idx in prepared_pages if 0 <= page_idx < len(source_doc)):
            page = source_doc[page_index]
            page_specs.append(
                _layout_page_spec(
                    page_index=page_index,
                    page_width_pt=page.rect.width,
                    page_height_pt=page.rect.height,
                    items=prepared_pages[page_index],
                    background_pdf_path=background_pdf_path,
                )
            )
        return page_specs
    finally:
        source_doc.close()

from __future__ import annotations

from pathlib import Path
from typing import Any

from retainpdf_pipeline.render.layout.model.models import RenderLayoutBlock
from retainpdf_pipeline.render.layout.model.models import RenderLineBox
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.model.models import RenderTocEntry
from retainpdf_pipeline.render.layout.page_specs import build_render_page_specs
from retainpdf_pipeline.render.output.typst.book_support import prepare_translated_pages_for_render
from retainpdf_pipeline.render.source.prewarm_manifest import color_tuple
from retainpdf_pipeline.render.source.prewarm_manifest import float_list
from retainpdf_pipeline.render.source.prewarm_color_profile import apply_page_color_adapt_for_prewarm


BACKGROUND_RENDER_PAGE_SPECS_ALGORITHM_VERSION = "background_render_page_specs_v5_inline_math_compat"


def build_background_render_page_specs_manifest(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    first_line_indent_lookup: dict[str, float],
    effective_inner_bbox_lookup: dict[str, list[float]],
    prepared_translated_pages: dict[int, list[dict]] | None = None,
    color_adapted_pages: dict[int, list[dict]] | None = None,
) -> dict[str, Any]:
    try:
        prepared = prepared_translated_pages or prepare_translated_pages_for_render(
            source_pdf_path,
            translated_pages,
            first_line_indent_lookup=first_line_indent_lookup,
            effective_inner_bbox_lookup=effective_inner_bbox_lookup,
        )
        adapted = color_adapted_pages or apply_page_color_adapt_for_prewarm(source_pdf_path, prepared)
        page_specs = build_render_page_specs(
            source_pdf_path=source_pdf_path,
            translated_pages=adapted,
            prepared=True,
        )
        return {
            "algorithm": BACKGROUND_RENDER_PAGE_SPECS_ALGORITHM_VERSION,
            "page_count": len(page_specs),
            "block_count": sum(len(spec.blocks) for spec in page_specs),
            "block_ids_by_page": {
                str(spec.page_index): [block.block_id for block in spec.blocks]
                for spec in page_specs
            },
            "page_specs": [render_page_spec_to_manifest(spec) for spec in page_specs],
        }
    except Exception as exc:
        print(f"render payload prewarm: background page specs failed {type(exc).__name__}: {exc}", flush=True)
        return {}


def render_page_spec_to_manifest(spec: RenderPageSpec) -> dict[str, Any]:
    return {
        "page_index": spec.page_index,
        "page_width_pt": spec.page_width_pt,
        "page_height_pt": spec.page_height_pt,
        "block_count": len(spec.blocks),
        "block_ids": [block.block_id for block in spec.blocks],
        "blocks": [render_layout_block_to_manifest(block) for block in spec.blocks],
    }


def render_layout_block_to_manifest(block: RenderLayoutBlock) -> dict[str, Any]:
    return {
        "block_id": block.block_id,
        "page_index": block.page_index,
        "background_rect": list(block.background_rect),
        "content_rect": list(block.content_rect),
        "content_kind": block.content_kind,
        "content_text": block.content_text,
        "plain_text": block.plain_text,
        "math_map": list(block.math_map or []),
        "font_size_pt": block.font_size_pt,
        "leading_em": block.leading_em,
        "font_weight": block.font_weight,
        "fit_to_box": block.fit_to_box,
        "fit_single_line": block.fit_single_line,
        "fit_min_font_size_pt": block.fit_min_font_size_pt,
        "fit_max_font_size_pt": block.fit_max_font_size_pt,
        "fit_min_leading_em": block.fit_min_leading_em,
        "fit_max_height_pt": block.fit_max_height_pt,
        "fit_target_width_pt": block.fit_target_width_pt,
        "fit_target_height_pt": block.fit_target_height_pt,
        "fit_shift_up_pt": block.fit_shift_up_pt,
        "first_line_indent_pt": block.first_line_indent_pt,
        "justify_text": block.justify_text,
        "text_color": list(block.text_color),
        "cover_fill": list(block.cover_fill),
        "use_cover_fill": block.use_cover_fill,
        "skip_reason": block.skip_reason,
        "preserve_line_breaks": block.preserve_line_breaks,
        "preserved_line_boxes": [
            {"text": line.text, "bbox": list(line.bbox)}
            for line in (block.preserved_line_boxes or [])
        ],
        "toc_entries": [
            {
                "title": entry.title,
                "page_label": entry.page_label,
                "bbox": list(entry.bbox),
                "number": entry.number,
                "level": entry.level,
            }
            for entry in (block.toc_entries or [])
        ],
    }


def render_page_specs_from_manifest(value: object) -> list[RenderPageSpec] | None:
    payload = dict(value or {})
    if payload.get("algorithm") != BACKGROUND_RENDER_PAGE_SPECS_ALGORITHM_VERSION:
        return None
    raw_specs = payload.get("page_specs") if isinstance(payload.get("page_specs"), list) else []
    if not raw_specs:
        return None
    specs: list[RenderPageSpec] = []
    for raw_spec in raw_specs:
        spec = render_page_spec_from_manifest(raw_spec)
        if spec is None:
            return None
        specs.append(spec)
    expected_page_count = int(payload.get("page_count") or len(raw_specs))
    expected_block_count = int(payload.get("block_count") or sum(len(spec.blocks) for spec in specs))
    if len(specs) != expected_page_count:
        return None
    if sum(len(spec.blocks) for spec in specs) != expected_block_count:
        return None
    expected_ids = {
        int(page_idx): [str(block_id) for block_id in block_ids]
        for page_idx, block_ids in dict(payload.get("block_ids_by_page") or {}).items()
        if isinstance(block_ids, list)
    }
    for spec in specs:
        if expected_ids and [block.block_id for block in spec.blocks] != expected_ids.get(spec.page_index, []):
            return None
    return specs or None


def render_page_spec_from_manifest(value: object) -> RenderPageSpec | None:
    if not isinstance(value, dict):
        return None
    raw_blocks = value.get("blocks") if isinstance(value.get("blocks"), list) else None
    if raw_blocks is None:
        return None
    blocks: list[RenderLayoutBlock] = []
    for raw_block in raw_blocks:
        block = render_layout_block_from_manifest(raw_block)
        if block is None:
            return None
        blocks.append(block)
    try:
        expected_block_count = int(value.get("block_count") or len(raw_blocks))
        expected_block_ids = [str(block_id) for block_id in list(value.get("block_ids") or [])]
        if len(blocks) != expected_block_count:
            return None
        if expected_block_ids and [block.block_id for block in blocks] != expected_block_ids:
            return None
        return RenderPageSpec(
            page_index=int(value.get("page_index")),
            page_width_pt=float(value.get("page_width_pt")),
            page_height_pt=float(value.get("page_height_pt")),
            background_pdf_path=None,
            blocks=blocks,
        )
    except Exception:
        return None


def render_layout_block_from_manifest(value: object) -> RenderLayoutBlock | None:
    if not isinstance(value, dict):
        return None
    try:
        background_rect = float_list(value.get("background_rect"))
        content_rect = float_list(value.get("content_rect"))
        if len(background_rect) != 4 or len(content_rect) != 4:
            return None
        block_id = str(value.get("block_id", "") or "")
        content_kind = str(value.get("content_kind", "") or "")
        font_size_pt = float(value.get("font_size_pt"))
        leading_em = float(value.get("leading_em"))
        if not block_id or not content_kind or font_size_pt <= 0.0 or leading_em <= 0.0:
            return None
        return RenderLayoutBlock(
            block_id=block_id,
            page_index=int(value.get("page_index")),
            background_rect=background_rect,
            content_rect=content_rect,
            content_kind=content_kind,
            content_text=str(value.get("content_text", "") or ""),
            plain_text=str(value.get("plain_text", "") or ""),
            math_map=list(value.get("math_map") or []),
            font_size_pt=font_size_pt,
            leading_em=leading_em,
            font_weight=str(value.get("font_weight", "regular") or "regular"),
            fit_to_box=bool(value.get("fit_to_box")),
            fit_single_line=bool(value.get("fit_single_line")),
            fit_min_font_size_pt=float(value.get("fit_min_font_size_pt") or 0.0),
            fit_max_font_size_pt=float(value.get("fit_max_font_size_pt") or 0.0),
            fit_min_leading_em=float(value.get("fit_min_leading_em") or 0.0),
            fit_max_height_pt=float(value.get("fit_max_height_pt") or 0.0),
            fit_target_width_pt=float(value.get("fit_target_width_pt") or 0.0),
            fit_target_height_pt=float(value.get("fit_target_height_pt") or 0.0),
            fit_shift_up_pt=float(value.get("fit_shift_up_pt") or 0.0),
            first_line_indent_pt=float(value.get("first_line_indent_pt") or 0.0),
            justify_text=bool(value.get("justify_text")),
            text_color=color_tuple(value.get("text_color"), default=(0.0, 0.0, 0.0)),
            cover_fill=color_tuple(value.get("cover_fill"), default=(1.0, 1.0, 1.0)),
            use_cover_fill=bool(value.get("use_cover_fill")),
            skip_reason=str(value.get("skip_reason", "") or ""),
            preserve_line_breaks=bool(value.get("preserve_line_breaks")),
            preserved_line_boxes=line_boxes_from_manifest(value.get("preserved_line_boxes")),
            toc_entries=toc_entries_from_manifest(value.get("toc_entries")),
        )
    except Exception:
        return None


def line_boxes_from_manifest(value: object) -> list[RenderLineBox]:
    rows = value if isinstance(value, list) else []
    result: list[RenderLineBox] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        bbox = float_list(row.get("bbox"))
        if len(bbox) == 4:
            result.append(RenderLineBox(text=str(row.get("text", "") or ""), bbox=bbox))
    return result


def toc_entries_from_manifest(value: object) -> list[RenderTocEntry]:
    rows = value if isinstance(value, list) else []
    result: list[RenderTocEntry] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        bbox = float_list(row.get("bbox"))
        if len(bbox) != 4:
            continue
        result.append(
            RenderTocEntry(
                title=str(row.get("title", "") or ""),
                page_label=str(row.get("page_label", "") or ""),
                bbox=bbox,
                number=str(row.get("number", "") or ""),
                level=int(row.get("level") or 1),
            )
        )
    return result


__all__ = [
    "BACKGROUND_RENDER_PAGE_SPECS_ALGORITHM_VERSION",
    "build_background_render_page_specs_manifest",
    "render_page_specs_from_manifest",
]

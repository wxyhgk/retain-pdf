from __future__ import annotations

from math import ceil
from pathlib import Path
import re
from dataclasses import dataclass
from typing import Callable

import fitz

from services.rendering.layout.payload.capacity import box_capacity_units
from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.layout.payload.prepare import prepare_render_payloads_by_page
from services.rendering.layout.payload.blocks import build_render_block_payloads
from services.rendering.layout.payload.blocks import resolve_book_body_font_target_from_payloads
from services.rendering.layout.payload.body_pipeline import apply_body_payload_pipeline
from services.rendering.layout.payload.annotation_font_policy import unify_annotation_fonts
from services.rendering.layout.payload.collision import mark_adjacent_collision_risk
from services.rendering.layout.payload.emit import emit_render_blocks
from services.rendering.layout.model.models import RenderLayoutBlock
from services.rendering.layout.model.models import RenderPageSpec
from services.rendering.layout.title_fit import apply_title_fit_budget_to_render_blocks
from services.rendering.policy import apply_render_pages_policy_fields
from foundation.config import layout

RenderPageSpecProgressCallback = Callable[[int, int, int], None]

FLOW_REBUILD_TRIGGER_RATIO = 1.35
FLOW_REBUILD_TARGET_FILL_RATIO = 0.86
FLOW_REBUILD_MIN_CHARS_PER_CHUNK = 36
FLOW_REBUILD_MIN_CONTINUATION_CHARS = 80
FLOW_REBUILD_MAX_CONTINUATION_PAGES_PER_BLOCK = 12
FLOW_REBUILD_SHORT_LINE_MAX_HEIGHT_PT = 18.0
FLOW_REBUILD_CONTEXT_MAX_HEIGHT_PT = 48.0
FLOW_REBUILD_CONTEXT_MAX_CHARS = 160
FLOW_REBUILD_SHORT_GROUP_MAX_BLOCKS = 5
FLOW_REBUILD_GROUP_MIN_FONT_PT = 9.0
FLOW_REBUILD_GROUP_MIN_LEADING_EM = 0.35
FLOW_REBUILD_GROUP_FIT_STEP_PT = 0.25
FLOW_REBUILD_GROUP_HEIGHT_PADDING_PT = 1.5
FLOW_REBUILD_GROUP_EXTEND_MAX_GAP_PT = 18.0
FLOW_REBUILD_RECLAIM_TOP_GAP_PT = 2.0
FLOW_REBUILD_RECLAIM_TOP_MAX_PT = 14.0
FLOW_REBUILD_MATH_SIGNAL_RE = re.compile(
    "|".join(
        [
            r"\$",
            r"\\[A-Za-z]+(?:\s*\{[^{}]*\})?",
            r"[A-Za-z0-9]\s*[\^_]\s*\{?[A-Za-z0-9.+\-]+",
            "[\U0001D400-\U0001D7FF]",
            r"[\u2200-\u22ff]",
        ]
    )
)
FLOW_REBUILD_FORMULA_LINE_RE = re.compile(r"[$=^*/]|\\(?:times|text|mathrm)\b|\d+\s*%")
FLOW_REBUILD_FRAGMENT_START_RE = re.compile(
    r"^\s*(?:[$)}\]>]|\\[A-Za-z]+|[A-Za-z0-9]{1,4}\s*[\^_*/=]|[*/=])"
)
FLOW_REBUILD_SAFE_BREAK_CHARS = "\n.!?;:, \u3002\uff01\uff1f\uff1b\uff0c\u3001"


@dataclass(frozen=True)
class FlowTextToken:
    text: str
    atomic: bool = False


def _layout_block_from_render_block(block, *, page_index: int) -> RenderLayoutBlock:
    return RenderLayoutBlock(
        block_id=f"item-{block.source_item_id}" if block.source_item_id else block.block_id,
        page_index=page_index,
        background_rect=list(block.cover_bbox),
        content_rect=list(block.inner_bbox),
        content_kind=block.render_kind,
        content_text=block.plain_text if block.render_kind == "plain" else block.markdown_text,
        plain_text=block.plain_text,
        math_map=list(block.math_map if hasattr(block, "math_map") else []),
        font_size_pt=block.font_size_pt,
        leading_em=block.leading_em,
        font_weight=block.font_weight,
        fit_to_box=block.fit_to_box,
        fit_single_line=block.fit_single_line,
        fit_min_font_size_pt=block.fit_min_font_size_pt,
        fit_max_font_size_pt=block.fit_max_font_size_pt,
        fit_min_leading_em=block.fit_min_leading_em,
        fit_max_height_pt=block.fit_max_height_pt,
        fit_target_width_pt=block.fit_target_width_pt,
        fit_target_height_pt=block.fit_target_height_pt,
        fit_shift_up_pt=block.fit_shift_up_pt,
        first_line_indent_pt=block.first_line_indent_pt,
        justify_text=block.justify_text,
        text_color=block.text_color,
        cover_fill=block.cover_fill,
        use_cover_fill=block.use_cover_fill,
        skip_reason=block.skip_reason,
        preserve_line_breaks=block.preserve_line_breaks,
        preserved_line_boxes=list(block.preserved_line_boxes or []),
        toc_entries=list(block.toc_entries or []),
    )


def _layout_page_spec(
    *,
    page_index: int,
    page_width_pt: float,
    page_height_pt: float,
    block_payloads: list[dict],
    page_text_width_med: float,
    book_body_font_target: float | None,
    background_pdf_path: Path | None,
) -> RenderPageSpec:
    ordered_payloads = sorted(block_payloads, key=lambda payload: (payload["inner_bbox"][1], payload["inner_bbox"][0]))
    apply_body_payload_pipeline(
        ordered_payloads,
        page_text_width_med=page_text_width_med,
        book_body_font_target=book_body_font_target,
    )
    if layout.FONT_UNIFY_MODE != "off":
        unify_annotation_fonts(ordered_payloads)
    mark_adjacent_collision_risk(ordered_payloads)
    blocks = [
        _layout_block_from_render_block(block, page_index=page_index)
        for block in emit_render_blocks(block_payloads)
    ]
    apply_title_fit_budget_to_render_blocks(
        blocks,
        page_width=page_width_pt,
        page_height=page_height_pt,
    )
    return RenderPageSpec(
        page_index=page_index,
        page_width_pt=page_width_pt,
        page_height_pt=page_height_pt,
        background_pdf_path=background_pdf_path,
        blocks=blocks,
    )


def build_render_page_specs(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    background_pdf_path: Path | None = None,
    prepared: bool = False,
    flow_rebuild_page_indices: frozenset[int] = frozenset(),
    on_page_spec_built: RenderPageSpecProgressCallback | None = None,
) -> list[RenderPageSpec]:
    prepared_pages = (
        apply_render_pages_policy_fields(translated_pages)
        if prepared
        else apply_render_pages_policy_fields(prepare_render_payloads_by_page(translated_pages))
    )
    source_doc = fitz.open(source_pdf_path)
    try:
        page_payloads: dict[int, tuple[list[dict], float]] = {}
        for page_index in sorted(page_idx for page_idx in prepared_pages if 0 <= page_idx < len(source_doc)):
            page = source_doc[page_index]
            page_payloads[page_index] = build_render_block_payloads(
                prepared_pages[page_index],
                page_width=page.rect.width,
                page_height=page.rect.height,
            )
        book_body_font_target = resolve_book_body_font_target_from_payloads(list(page_payloads.values()))
        page_specs: list[RenderPageSpec] = []
        ordered_page_indices = sorted(page_payloads)
        total_pages = len(ordered_page_indices)
        for completed, page_index in enumerate(ordered_page_indices, start=1):
            page = source_doc[page_index]
            block_payloads, page_text_width_med = page_payloads[page_index]
            page_specs.append(
                _layout_page_spec(
                    page_index=page_index,
                    page_width_pt=page.rect.width,
                    page_height_pt=page.rect.height,
                    block_payloads=block_payloads,
                    page_text_width_med=page_text_width_med,
                    book_body_font_target=book_body_font_target,
                    background_pdf_path=background_pdf_path,
                )
            )
            if on_page_spec_built is not None:
                on_page_spec_built(completed, total_pages, page_index)
        return expand_page_specs_for_flow_rebuild(
            page_specs,
            flow_rebuild_page_indices=flow_rebuild_page_indices,
        )
    finally:
        source_doc.close()


def expand_page_specs_for_flow_rebuild(
    page_specs: list[RenderPageSpec],
    *,
    flow_rebuild_page_indices: frozenset[int],
) -> list[RenderPageSpec]:
    if not page_specs or not flow_rebuild_page_indices:
        return page_specs
    already_expanded_sources = {
        spec.source_page_index if spec.source_page_index is not None else spec.page_index
        for spec in page_specs
        if spec.is_flow_continuation
    }
    expanded: list[RenderPageSpec] = []
    for spec in page_specs:
        source_page_index = spec.source_page_index if spec.source_page_index is not None else spec.page_index
        if (
            spec.is_flow_continuation
            or source_page_index in already_expanded_sources
            or source_page_index not in flow_rebuild_page_indices
        ):
            expanded.append(spec)
            continue
        rebuilt, continuations = _flow_rebuild_page_spec(spec, source_page_index=source_page_index)
        expanded.append(rebuilt)
        expanded.extend(continuations)
    return expanded


def _flow_rebuild_page_spec(
    spec: RenderPageSpec,
    *,
    source_page_index: int,
) -> tuple[RenderPageSpec, list[RenderPageSpec]]:
    rebuilt_blocks: list[RenderLayoutBlock] = []
    continuation_chunks: list[tuple[RenderLayoutBlock, str, str]] = []
    source_blocks = _merge_flow_short_line_groups(spec.blocks)
    for block in source_blocks:
        chunks = _flow_chunks_for_block(block, page_width=spec.page_width_pt, page_height=spec.page_height_pt)
        if len(chunks) <= 1:
            rebuilt_blocks.append(block)
            continue
        rebuilt_blocks.append(
            _copy_block_with_text(
                block,
                text=chunks[0],
                block_id=block.block_id,
                rect=block.content_rect,
                reason="flow_rebuild_first_chunk",
                continuation=False,
            )
        )
        for chunk_index, chunk in enumerate(chunks[1:], start=1):
            continuation_chunks.append(
                (
                    block,
                    chunk,
                    f"{block.block_id}-flow-{chunk_index}",
                )
            )
    rebuilt = RenderPageSpec(
        page_index=spec.page_index,
        page_width_pt=spec.page_width_pt,
        page_height_pt=spec.page_height_pt,
        background_pdf_path=spec.background_pdf_path,
        blocks=rebuilt_blocks,
        source_page_index=spec.source_page_index,
        background_page_index=spec.background_page_index,
        is_flow_continuation=spec.is_flow_continuation,
    )
    continuation_specs = _pack_flow_continuation_specs(
        spec,
        source_page_index=source_page_index,
        continuation_chunks=continuation_chunks,
    )
    return rebuilt, continuation_specs


def _merge_flow_short_line_groups(blocks: list[RenderLayoutBlock]) -> list[RenderLayoutBlock]:
    if not blocks:
        return blocks
    merged: list[RenderLayoutBlock] = []
    index = 0
    while index < len(blocks):
        block = blocks[index]
        next_block = blocks[index + 1] if index + 1 < len(blocks) else None
        if (
            next_block is not None
            and _can_precede_fragile_flow_group(block, next_block)
            and _is_fragile_flow_short_line(next_block)
        ):
            group = [block, next_block]
            cursor = index + 2
            while (
                cursor < len(blocks)
                and len(group) < FLOW_REBUILD_SHORT_GROUP_MAX_BLOCKS
                and _is_fragile_flow_short_line(blocks[cursor])
                and _can_merge_adjacent_flow_blocks(group[-1], blocks[cursor])
            ):
                group.append(blocks[cursor])
                cursor += 1
            previous = merged[-1] if merged else None
            group, cursor = _extend_overfull_flow_group(group, blocks, cursor, previous_block=previous)
            merged.append(_merged_flow_short_line_group(group, previous_block=previous))
            index = cursor
            continue
        if _is_fragile_flow_short_line(block):
            group = [block]
            cursor = index + 1
            while (
                cursor < len(blocks)
                and len(group) < FLOW_REBUILD_SHORT_GROUP_MAX_BLOCKS
                and _is_fragile_flow_short_line(blocks[cursor])
                and _can_merge_adjacent_flow_blocks(group[-1], blocks[cursor])
            ):
                group.append(blocks[cursor])
                cursor += 1
            if len(group) > 1:
                previous = merged[-1] if merged else None
                group, cursor = _extend_overfull_flow_group(group, blocks, cursor, previous_block=previous)
                merged.append(_merged_flow_short_line_group(group, previous_block=previous))
                index = cursor
                continue
            merged.append(
                _copy_block_with_text(
                    block,
                    text=_block_text(block),
                    block_id=block.block_id,
                    rect=block.content_rect,
                    reason="flow_rebuild_short_line",
                    continuation=False,
                )
            )
            index += 1
            continue
        merged.append(block)
        index += 1
    return merged


def _can_precede_fragile_flow_group(block: RenderLayoutBlock, next_block: RenderLayoutBlock) -> bool:
    text = _block_text(block).strip()
    if not _is_flow_group_eligible(block, text):
        return False
    if len(text) > FLOW_REBUILD_CONTEXT_MAX_CHARS:
        return False
    if _rect_height(block.content_rect) > FLOW_REBUILD_CONTEXT_MAX_HEIGHT_PT:
        return False
    return _can_merge_adjacent_flow_blocks(block, next_block)


def _can_merge_adjacent_flow_blocks(block: RenderLayoutBlock, next_block: RenderLayoutBlock) -> bool:
    if not _is_flow_group_eligible(block, _block_text(block)):
        return False
    if not _is_flow_group_eligible(next_block, _block_text(next_block)):
        return False
    current = block.content_rect
    following = next_block.content_rect
    if len(current) != 4 or len(following) != 4:
        return False
    gap = float(following[1]) - float(current[3])
    max_gap = max(4.0, min(block.font_size_pt, next_block.font_size_pt) * 0.55)
    if gap < -2.0 or gap > max_gap:
        return False
    overlap = min(float(current[2]), float(following[2])) - max(float(current[0]), float(following[0]))
    if overlap <= 0:
        return False
    narrow_width = max(1.0, min(_rect_width(current), _rect_width(following)))
    return overlap / narrow_width >= 0.72


def _is_fragile_flow_short_line(block: RenderLayoutBlock) -> bool:
    text = _block_text(block).strip()
    if not _is_flow_group_eligible(block, text):
        return False
    if _rect_height(block.content_rect) > max(FLOW_REBUILD_SHORT_LINE_MAX_HEIGHT_PT, block.font_size_pt * 1.65):
        return False
    if not _has_flow_formula_line_signal(text):
        return False
    return bool(block.fit_to_box or block.justify_text or block.skip_reason == "adjacent_collision_risk")


def _is_flow_group_eligible(block: RenderLayoutBlock, text: str) -> bool:
    if not text.strip():
        return False
    if block.content_kind not in {"markdown", "plain", "plain_line"}:
        return False
    if block.math_map:
        return False
    if block.toc_entries:
        return False
    if block.preserve_line_breaks or block.preserved_line_boxes:
        return False
    return True


def _has_flow_formula_line_signal(text: str) -> bool:
    return bool(_has_flow_unsafe_math(text) or FLOW_REBUILD_FORMULA_LINE_RE.search(text or ""))


def _extend_overfull_flow_group(
    group: list[RenderLayoutBlock],
    blocks: list[RenderLayoutBlock],
    cursor: int,
    *,
    previous_block: RenderLayoutBlock | None,
) -> tuple[list[RenderLayoutBlock], int]:
    while (
        cursor < len(blocks)
        and len(group) < FLOW_REBUILD_SHORT_GROUP_MAX_BLOCKS
        and _flow_group_needs_more_room(group, previous_block=previous_block)
        and _can_extend_overfull_flow_group(group[-1], blocks[cursor])
    ):
        group.append(blocks[cursor])
        cursor += 1
    return group, cursor


def _flow_group_needs_more_room(
    group: list[RenderLayoutBlock],
    *,
    previous_block: RenderLayoutBlock | None,
) -> bool:
    content_rect = _flow_group_content_rect(group, previous_block=previous_block)
    text = _flow_group_text(group)
    estimated_height = _flow_group_estimated_height_pt(
        content_rect,
        text,
        _flow_group_base_font_size_pt(group),
        _flow_group_base_leading_em(group),
    )
    available_height = max(8.0, _rect_height(content_rect) - FLOW_REBUILD_GROUP_HEIGHT_PADDING_PT)
    return estimated_height > available_height


def _can_extend_overfull_flow_group(block: RenderLayoutBlock, next_block: RenderLayoutBlock) -> bool:
    if not _is_flow_group_eligible(block, _block_text(block)):
        return False
    if not _is_flow_group_eligible(next_block, _block_text(next_block)):
        return False
    if block.page_index != next_block.page_index:
        return False
    current = block.content_rect
    following = next_block.content_rect
    if len(current) != 4 or len(following) != 4:
        return False
    gap = float(following[1]) - float(current[3])
    max_gap = max(FLOW_REBUILD_GROUP_EXTEND_MAX_GAP_PT, min(block.font_size_pt, next_block.font_size_pt) * 1.6)
    if gap < -2.0 or gap > max_gap:
        return False
    overlap = min(float(current[2]), float(following[2])) - max(float(current[0]), float(following[0]))
    if overlap <= 0:
        return False
    narrow_width = max(1.0, min(_rect_width(current), _rect_width(following)))
    return overlap / narrow_width >= 0.72


def _merged_flow_short_line_group(
    group: list[RenderLayoutBlock],
    *,
    previous_block: RenderLayoutBlock | None = None,
) -> RenderLayoutBlock:
    first = group[0]
    content_rect = _flow_group_content_rect(group, previous_block=previous_block)
    background_rect = _union_rect(block.background_rect for block in group)
    background_rect[1] = min(background_rect[1], content_rect[1])
    background_rect[3] = max(background_rect[3], content_rect[3])
    text = _flow_group_text(group)
    font_size_pt, leading_em = _flow_group_typography(group, content_rect, text)
    content_kind = "plain" if all(block.content_kind in {"plain", "plain_line"} for block in group) else "markdown"
    return RenderLayoutBlock(
        block_id=f"{first.block_id}-flow-group",
        page_index=first.page_index,
        background_rect=background_rect,
        content_rect=content_rect,
        content_kind=content_kind,
        content_text=text,
        plain_text=text,
        math_map=[],
        font_size_pt=font_size_pt,
        leading_em=leading_em,
        font_weight=first.font_weight,
        fit_to_box=False,
        fit_single_line=False,
        fit_min_font_size_pt=0.0,
        fit_max_font_size_pt=0.0,
        fit_min_leading_em=0.0,
        fit_max_height_pt=max(8.0, _rect_height(content_rect)),
        fit_target_width_pt=0.0,
        fit_target_height_pt=0.0,
        fit_shift_up_pt=0.0,
        first_line_indent_pt=0.0,
        justify_text=False,
        text_color=first.text_color,
        cover_fill=first.cover_fill,
        use_cover_fill=any(block.use_cover_fill for block in group),
        skip_reason="flow_rebuild_short_line_group",
        preserve_line_breaks=False,
        preserved_line_boxes=[],
        toc_entries=[],
    )


def _flow_group_text(group: list[RenderLayoutBlock]) -> str:
    parts = [_block_text(block).strip() for block in group if _block_text(block).strip()]
    return "  \n".join(parts)


def _flow_group_content_rect(
    group: list[RenderLayoutBlock],
    *,
    previous_block: RenderLayoutBlock | None,
) -> list[float]:
    content_rect = _union_rect(block.content_rect for block in group)
    return _reclaim_previous_visual_gap(content_rect, previous_block, group[0])


def _flow_group_base_font_size_pt(group: list[RenderLayoutBlock]) -> float:
    return max(FLOW_REBUILD_GROUP_MIN_FONT_PT, min(block.font_size_pt for block in group))


def _flow_group_base_leading_em(group: list[RenderLayoutBlock]) -> float:
    return max(FLOW_REBUILD_GROUP_MIN_LEADING_EM, min(block.leading_em for block in group))


def _flow_group_typography(
    group: list[RenderLayoutBlock],
    content_rect: list[float],
    text: str,
) -> tuple[float, float]:
    base_font_size = _flow_group_base_font_size_pt(group)
    base_leading = _flow_group_base_leading_em(group)
    available_height = max(8.0, _rect_height(content_rect) - FLOW_REBUILD_GROUP_HEIGHT_PADDING_PT)
    if _flow_group_estimated_height_pt(content_rect, text, base_font_size, base_leading) <= available_height:
        return base_font_size, base_leading

    leading_em = FLOW_REBUILD_GROUP_MIN_LEADING_EM
    steps = int(max(0.0, base_font_size - FLOW_REBUILD_GROUP_MIN_FONT_PT) / FLOW_REBUILD_GROUP_FIT_STEP_PT)
    for step in range(steps + 1):
        font_size = round(base_font_size - step * FLOW_REBUILD_GROUP_FIT_STEP_PT, 2)
        if font_size < FLOW_REBUILD_GROUP_MIN_FONT_PT:
            font_size = FLOW_REBUILD_GROUP_MIN_FONT_PT
        if _flow_group_estimated_height_pt(content_rect, text, font_size, leading_em) <= available_height:
            return font_size, leading_em
    return FLOW_REBUILD_GROUP_MIN_FONT_PT, leading_em


def _flow_group_estimated_height_pt(
    content_rect: list[float],
    text: str,
    font_size_pt: float,
    leading_em: float,
) -> float:
    parts = [part.strip() for part in text.splitlines() if part.strip()]
    if len(parts) <= 1:
        return estimated_render_height_pt(content_rect, text, [], font_size_pt, leading_em)
    return sum(estimated_render_height_pt(content_rect, part, [], font_size_pt, leading_em) for part in parts)


def _reclaim_previous_visual_gap(
    content_rect: list[float],
    previous_block: RenderLayoutBlock | None,
    first_group_block: RenderLayoutBlock,
) -> list[float]:
    if previous_block is None:
        return content_rect
    if not _can_reclaim_previous_visual_gap(previous_block, first_group_block):
        return content_rect
    previous_height = _rect_height(previous_block.content_rect)
    if previous_height <= 0:
        return content_rect
    estimated_previous_height = estimated_render_height_pt(
        previous_block.content_rect,
        _block_text(previous_block),
        previous_block.math_map,
        previous_block.font_size_pt,
        previous_block.leading_em,
    )
    slack = previous_height - estimated_previous_height
    if slack <= FLOW_REBUILD_RECLAIM_TOP_GAP_PT:
        return content_rect
    safe_top = float(previous_block.content_rect[1]) + estimated_previous_height + FLOW_REBUILD_RECLAIM_TOP_GAP_PT
    reclaim = min(FLOW_REBUILD_RECLAIM_TOP_MAX_PT, slack - FLOW_REBUILD_RECLAIM_TOP_GAP_PT)
    new_top = max(safe_top, float(content_rect[1]) - reclaim)
    if new_top >= float(content_rect[1]):
        return content_rect
    adjusted = list(content_rect)
    adjusted[1] = round(new_top, 3)
    return adjusted


def _can_reclaim_previous_visual_gap(
    previous_block: RenderLayoutBlock,
    first_group_block: RenderLayoutBlock,
) -> bool:
    if previous_block.page_index != first_group_block.page_index:
        return False
    if previous_block.skip_reason.startswith("flow_rebuild"):
        return False
    if not _is_flow_group_eligible(previous_block, _block_text(previous_block)):
        return False
    previous = previous_block.content_rect
    current = first_group_block.content_rect
    if len(previous) != 4 or len(current) != 4:
        return False
    gap = float(current[1]) - float(previous[3])
    if gap < -2.0 or gap > max(6.0, first_group_block.font_size_pt * 0.7):
        return False
    overlap = min(float(previous[2]), float(current[2])) - max(float(previous[0]), float(current[0]))
    if overlap <= 0:
        return False
    narrow_width = max(1.0, min(_rect_width(previous), _rect_width(current)))
    return overlap / narrow_width >= 0.72


def _pack_flow_continuation_specs(
    spec: RenderPageSpec,
    *,
    source_page_index: int,
    continuation_chunks: list[tuple[RenderLayoutBlock, str, str]],
) -> list[RenderPageSpec]:
    if not continuation_chunks:
        return []
    flow_rect = _flow_content_rect(spec.page_width_pt, spec.page_height_pt)
    page_specs: list[RenderPageSpec] = []
    current_blocks: list[RenderLayoutBlock] = []
    cursor_y = flow_rect[1]
    gap_pt = 8.0

    def flush() -> None:
        nonlocal current_blocks, cursor_y
        if not current_blocks:
            return
        page_specs.append(
            RenderPageSpec(
                page_index=spec.page_index,
                page_width_pt=spec.page_width_pt,
                page_height_pt=spec.page_height_pt,
                background_pdf_path=None,
                blocks=current_blocks,
                source_page_index=source_page_index,
                background_page_index=-1,
                is_flow_continuation=True,
            )
        )
        current_blocks = []
        cursor_y = flow_rect[1]

    for source_block, chunk, block_id in continuation_chunks:
        block_height = _continuation_block_height(source_block, chunk, flow_rect)
        if current_blocks and cursor_y + block_height > flow_rect[3]:
            flush()
        y0 = cursor_y
        y1 = min(flow_rect[3], y0 + block_height)
        if y1 - y0 < 8.0:
            flush()
            y0 = cursor_y
            y1 = min(flow_rect[3], y0 + block_height)
        rect = [flow_rect[0], y0, flow_rect[2], y1]
        current_blocks.append(
            _copy_block_with_text(
                source_block,
                text=chunk,
                block_id=block_id,
                rect=rect,
                reason="flow_rebuild_continuation",
                continuation=True,
            )
        )
        cursor_y = y1 + gap_pt
    flush()
    return page_specs


def _continuation_block_height(
    block: RenderLayoutBlock,
    text: str,
    flow_rect: list[float],
) -> float:
    font_size_pt = max(block.font_size_pt, 9.0)
    leading_em = max(block.leading_em, 0.35)
    estimated_height = estimated_render_height_pt(
        flow_rect,
        text,
        [],
        font_size_pt,
        leading_em,
    )
    available_height = max(8.0, flow_rect[3] - flow_rect[1])
    return min(available_height, max(36.0, estimated_height + font_size_pt * 1.5))


def _flow_chunks_for_block(
    block: RenderLayoutBlock,
    *,
    page_width: float,
    page_height: float,
) -> list[str]:
    text = _block_text(block)
    if not _can_flow_split_block(block, text):
        return [text]
    estimated_height = estimated_render_height_pt(
        block.content_rect,
        text,
        block.math_map,
        block.font_size_pt,
        block.leading_em,
    )
    box_height = max(1.0, float(block.content_rect[3]) - float(block.content_rect[1]))
    if estimated_height <= box_height * FLOW_REBUILD_TRIGGER_RATIO:
        return [text]

    first_budget = int(
        max(
            FLOW_REBUILD_MIN_CHARS_PER_CHUNK,
            box_capacity_units(block.content_rect, block.font_size_pt, block.leading_em)
            * FLOW_REBUILD_TARGET_FILL_RATIO,
        )
    )
    flow_rect = _flow_content_rect(page_width, page_height)
    flow_budget = int(
        max(
            first_budget,
            box_capacity_units(flow_rect, max(block.font_size_pt, 9.0), max(block.leading_em, 0.35))
            * FLOW_REBUILD_TARGET_FILL_RATIO,
        )
    )
    estimated_chunk_count = int(
        ceil(max(1.0, estimated_height) / max(1.0, box_height))
    )
    if estimated_chunk_count <= 1 and len(text) <= first_budget:
        return [text]
    return _split_text_by_budgets(
        text,
        first_budget=first_budget,
        continuation_budget=flow_budget,
        max_continuation_pages=FLOW_REBUILD_MAX_CONTINUATION_PAGES_PER_BLOCK,
    )


def _can_flow_split_block(block: RenderLayoutBlock, text: str) -> bool:
    if not text.strip():
        return False
    if block.content_kind not in {"markdown", "plain", "plain_line"}:
        return False
    if block.math_map:
        return False
    if block.toc_entries:
        return False
    if block.preserve_line_breaks or block.preserved_line_boxes:
        return False
    return len(text.strip()) > FLOW_REBUILD_MIN_CHARS_PER_CHUNK


def _has_flow_unsafe_math(text: str) -> bool:
    return bool(FLOW_REBUILD_MATH_SIGNAL_RE.search(text or ""))


def _block_text(block: RenderLayoutBlock) -> str:
    if block.content_kind in {"plain", "plain_line"}:
        return str(block.plain_text or block.content_text or "")
    return str(block.content_text or block.plain_text or "")


def _flow_content_rect(page_width: float, page_height: float) -> list[float]:
    margin_x = min(60.0, max(36.0, page_width * 0.08))
    margin_top = min(64.0, max(42.0, page_height * 0.07))
    margin_bottom = min(64.0, max(42.0, page_height * 0.07))
    return [
        margin_x,
        margin_top,
        max(margin_x + 24.0, page_width - margin_x),
        max(margin_top + 24.0, page_height - margin_bottom),
    ]


def _rect_width(rect: list[float]) -> float:
    if len(rect) != 4:
        return 0.0
    return max(0.0, float(rect[2]) - float(rect[0]))


def _rect_height(rect: list[float]) -> float:
    if len(rect) != 4:
        return 0.0
    return max(0.0, float(rect[3]) - float(rect[1]))


def _union_rect(rects) -> list[float]:
    values = [list(rect) for rect in rects if len(rect) == 4]
    if not values:
        return [0.0, 0.0, 8.0, 8.0]
    return [
        min(float(rect[0]) for rect in values),
        min(float(rect[1]) for rect in values),
        max(float(rect[2]) for rect in values),
        max(float(rect[3]) for rect in values),
    ]


def _split_text_by_budgets(
    text: str,
    *,
    first_budget: int,
    continuation_budget: int,
    max_continuation_pages: int,
) -> list[str]:
    if _has_flow_unsafe_math(text):
        return _split_text_by_token_budgets(
            text,
            first_budget=first_budget,
            continuation_budget=continuation_budget,
            max_continuation_pages=max_continuation_pages,
        )
    remaining = text.strip()
    chunks: list[str] = []
    chunk_limit = max(1, max_continuation_pages + 1)
    while remaining and len(chunks) < chunk_limit:
        budget = first_budget if not chunks else continuation_budget
        if len(chunks) + 1 >= chunk_limit:
            chunks.append(remaining)
            break
        split_at = _best_split_index(remaining, max(FLOW_REBUILD_MIN_CHARS_PER_CHUNK, budget))
        chunks.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    return _merge_low_content_flow_chunks([chunk for chunk in chunks if chunk], continuation_budget=continuation_budget)


def _split_text_by_token_budgets(
    text: str,
    *,
    first_budget: int,
    continuation_budget: int,
    max_continuation_pages: int,
) -> list[str]:
    tokens = _flow_text_tokens(text.strip())
    if not tokens:
        return []
    chunks: list[str] = []
    current: list[FlowTextToken] = []
    current_units = 0
    chunk_limit = max(1, max_continuation_pages + 1)

    def current_text() -> str:
        return "".join(token.text for token in current).strip()

    def flush() -> None:
        nonlocal current, current_units
        chunk = current_text()
        if chunk:
            chunks.append(chunk)
        current = []
        current_units = 0

    for token in tokens:
        token_units = max(1, len(token.text))
        budget = first_budget if not chunks else continuation_budget
        if (
            current
            and current_units + token_units > max(FLOW_REBUILD_MIN_CHARS_PER_CHUNK, budget)
            and _can_flush_flow_tokens(current)
            and len(chunks) + 1 < chunk_limit
        ):
            flush()
            budget = continuation_budget
        current.append(token)
        current_units += token_units
        if (
            current_units >= budget
            and _can_flush_flow_tokens(current)
            and len(chunks) + 1 < chunk_limit
        ):
            flush()
    flush()
    return _merge_low_content_flow_chunks(chunks, continuation_budget=continuation_budget)


def _can_flush_flow_tokens(tokens: list[FlowTextToken]) -> bool:
    if not tokens:
        return False
    text = "".join(token.text for token in tokens).strip()
    if not text:
        return False
    if _has_unbalanced_inline_math(text):
        return False
    return not bool(FLOW_REBUILD_FRAGMENT_START_RE.match(text))


def _flow_text_tokens(text: str) -> list[FlowTextToken]:
    tokens: list[FlowTextToken] = []
    index = 0
    buffer: list[str] = []

    def flush_buffer() -> None:
        if buffer:
            tokens.append(FlowTextToken("".join(buffer)))
            buffer.clear()

    while index < len(text):
        char = text[index]
        if char == "$":
            end = text.find("$", index + 1)
            if end > index + 1:
                flush_buffer()
                tokens.append(FlowTextToken(text[index : end + 1], atomic=True))
                index = end + 1
                continue
            if tokens:
                previous = tokens.pop()
                tokens.append(FlowTextToken(previous.text + char, atomic=True))
            else:
                buffer.append(char)
            index += 1
            continue
        if char == "\\":
            command_end = _latex_command_end(text, index)
            if command_end > index + 1:
                flush_buffer()
                tokens.append(FlowTextToken(text[index:command_end], atomic=True))
                index = command_end
                continue
        if _is_math_unicode(char):
            flush_buffer()
            start = index
            index += 1
            while index < len(text) and _is_math_unicode(text[index]):
                index += 1
            tokens.append(FlowTextToken(text[start:index], atomic=True))
            continue
        if char.isspace() or char in FLOW_REBUILD_SAFE_BREAK_CHARS:
            buffer.append(char)
            flush_buffer()
            index += 1
            continue
        buffer.append(char)
        index += 1
    flush_buffer()
    return tokens


def _latex_command_end(text: str, start: int) -> int:
    index = start + 1
    while index < len(text) and text[index].isalpha():
        index += 1
    if index == start + 1:
        return start + 1
    while index < len(text) and text[index].isspace():
        index += 1
    while index < len(text) and text[index] == "{":
        close = _matching_brace_index(text, index)
        if close <= index:
            break
        index = close + 1
        while index < len(text) and text[index].isspace():
            index += 1
    if index < len(text) and text[index] == "$":
        index += 1
    return index


def _matching_brace_index(text: str, open_index: int) -> int:
    depth = 0
    for index in range(open_index, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return index
    return -1


def _is_math_unicode(char: str) -> bool:
    codepoint = ord(char)
    return 0x1D400 <= codepoint <= 0x1D7FF or 0x2200 <= codepoint <= 0x22FF


def _has_unbalanced_inline_math(text: str) -> bool:
    return text.count("$") % 2 != 0


def _merge_low_content_flow_chunks(chunks: list[str], *, continuation_budget: int) -> list[str]:
    if len(chunks) <= 1:
        return chunks
    merged: list[str] = []
    for chunk in chunks:
        if not chunk:
            continue
        if (
            merged
            and (
                _is_low_content_flow_chunk(chunk)
                or len(merged[-1]) + len(chunk) + 1 <= max(continuation_budget, FLOW_REBUILD_MIN_CONTINUATION_CHARS)
            )
        ):
            separator = "" if merged[-1].endswith(("-", "/", "\\")) else " "
            merged[-1] = f"{merged[-1]}{separator}{chunk}".strip()
            continue
        merged.append(chunk)
    if len(merged) > 1 and _is_low_content_flow_chunk(merged[-1]):
        tail = merged.pop()
        merged[-1] = f"{merged[-1]} {tail}".strip()
    return merged


def _is_low_content_flow_chunk(text: str) -> bool:
    stripped = str(text or "").strip()
    if len(stripped) < FLOW_REBUILD_MIN_CONTINUATION_CHARS:
        return True
    return bool(FLOW_REBUILD_FRAGMENT_START_RE.match(stripped))


def _best_split_index(text: str, limit: int) -> int:
    if len(text) <= limit:
        return len(text)
    limit = max(1, min(limit, len(text)))
    lower_bound = max(1, int(limit * 0.62))
    for index in range(limit, lower_bound - 1, -1):
        if text[index - 1] in FLOW_REBUILD_SAFE_BREAK_CHARS:
            return index
    for index in range(limit, lower_bound - 1, -1):
        if text[index - 1].isspace():
            return index
    return limit


def _copy_block_with_text(
    block: RenderLayoutBlock,
    *,
    text: str,
    block_id: str,
    rect: list[float],
    reason: str,
    continuation: bool,
) -> RenderLayoutBlock:
    content_kind = "plain" if block.content_kind == "plain_line" and continuation else block.content_kind
    flow_generated = reason.startswith("flow_rebuild")
    disable_fixed_fit = continuation or flow_generated
    return RenderLayoutBlock(
        block_id=block_id,
        page_index=block.page_index,
        background_rect=list(rect),
        content_rect=list(rect),
        content_kind=content_kind,
        content_text=text,
        plain_text=text,
        math_map=[],
        font_size_pt=max(block.font_size_pt, 9.0) if continuation else block.font_size_pt,
        leading_em=max(block.leading_em, 0.35) if continuation else block.leading_em,
        font_weight=block.font_weight,
        fit_to_box=False if disable_fixed_fit else block.fit_to_box,
        fit_single_line=False if disable_fixed_fit else block.fit_single_line,
        fit_min_font_size_pt=0.0 if disable_fixed_fit else block.fit_min_font_size_pt,
        fit_max_font_size_pt=0.0 if disable_fixed_fit else block.fit_max_font_size_pt,
        fit_min_leading_em=0.0 if disable_fixed_fit else block.fit_min_leading_em,
        fit_max_height_pt=max(8.0, rect[3] - rect[1]),
        fit_target_width_pt=0.0 if disable_fixed_fit else block.fit_target_width_pt,
        fit_target_height_pt=0.0 if disable_fixed_fit else block.fit_target_height_pt,
        fit_shift_up_pt=0.0,
        first_line_indent_pt=0.0 if disable_fixed_fit else block.first_line_indent_pt,
        justify_text=False if disable_fixed_fit else block.justify_text,
        text_color=block.text_color,
        cover_fill=block.cover_fill,
        use_cover_fill=block.use_cover_fill,
        skip_reason=reason,
        preserve_line_breaks=False,
        preserved_line_boxes=[],
        toc_entries=[],
    )


__all__ = [
    "build_render_page_specs",
    "expand_page_specs_for_flow_rebuild",
]

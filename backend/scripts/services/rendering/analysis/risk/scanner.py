from __future__ import annotations

import re
from pathlib import Path

import fitz

from services.rendering.analysis.risk.models import BlockRisk
from services.rendering.analysis.risk.models import PageRiskReport
from services.rendering.analysis.risk.models import RenderRiskReport
from services.rendering.analysis.risk.models import RiskTrigger
from services.rendering.analysis.risk.thresholds import DEFAULT_RENDER_RISK_THRESHOLDS
from services.rendering.analysis.risk.thresholds import RenderRiskThresholds
from services.rendering.layout.payload.blocks import build_render_blocks
from services.rendering.layout.payload.capacity import estimated_render_height_pt
from services.rendering.source.rects import rect_area
from services.rendering.source.rects import rects_overlap_area


GARBLED_CHAR_RE = re.compile(r"[\u25a1\ufffd�]")
FORMULA_DIAGNOSTIC_RE = re.compile(r"(placeholder|formula).*(mismatch|missing|duplicate|order|lost|invalid)", re.I)


def scan_render_risk(
    *,
    source_pdf_path: Path,
    translated_pages: dict[int, list[dict]],
    start_page: int = 0,
    end_page: int = -1,
    thresholds: RenderRiskThresholds = DEFAULT_RENDER_RISK_THRESHOLDS,
    source_text_precleaned_page_indices: frozenset[int] = frozenset(),
    bbox_text_strip_skipped_page_indices: frozenset[int] = frozenset(),
) -> RenderRiskReport:
    page_indices = _selected_page_indices(translated_pages, start_page=start_page, end_page=end_page)
    pages: list[PageRiskReport] = []
    doc = fitz.open(source_pdf_path)
    try:
        for page_index in page_indices:
            page_width, page_height = _page_size(doc, page_index, translated_pages.get(page_index, []))
            pages.append(
                _scan_page(
                    page_index=page_index,
                    items=translated_pages.get(page_index, []),
                    page_width=page_width,
                    page_height=page_height,
                    thresholds=thresholds,
                    bbox_text_strip_skipped=page_index in bbox_text_strip_skipped_page_indices,
                )
            )
    finally:
        doc.close()
    return RenderRiskReport(
        pages=pages,
        page_count=len(pages),
        high_or_hard_page_count=sum(1 for page in pages if page.risk_level in {"high", "extreme"}),
        hard_trigger_count=sum(len(page.hard_triggers) for page in pages),
    )


def _selected_page_indices(
    translated_pages: dict[int, list[dict]],
    *,
    start_page: int,
    end_page: int,
) -> list[int]:
    if not translated_pages:
        return []
    start = max(0, start_page)
    stop = max(translated_pages) if end_page < 0 else end_page
    return [page_index for page_index in sorted(translated_pages) if start <= page_index <= stop]


def _page_size(doc: fitz.Document, page_index: int, items: list[dict]) -> tuple[float, float]:
    if 0 <= page_index < len(doc):
        rect = doc[page_index].rect
        return float(rect.width), float(rect.height)
    max_x = max((_bbox(item)[2] for item in items if _valid_bbox(_bbox(item))), default=595.0)
    max_y = max((_bbox(item)[3] for item in items if _valid_bbox(_bbox(item))), default=842.0)
    return max(1.0, max_x), max(1.0, max_y)


def _scan_page(
    *,
    page_index: int,
    items: list[dict],
    page_width: float,
    page_height: float,
    thresholds: RenderRiskThresholds,
    bbox_text_strip_skipped: bool,
) -> PageRiskReport:
    page_triggers: list[RiskTrigger] = []
    block_risks: list[BlockRisk] = []
    hard_triggers: list[str] = []
    page_area = max(1.0, page_width * page_height)
    formula_rects = [_rect(item) for item in items if _is_formula_item(item) and _valid_bbox(_bbox(item))]
    nontext_rects = [_rect(item) for item in items if _is_image_or_table_item(item) and _valid_bbox(_bbox(item))]
    formula_block_count = len(formula_rects)
    image_or_table_block_count = len(nontext_rects)
    occupied_area_ratio = sum(rect_area(_rect(item)) for item in items if _valid_bbox(_bbox(item))) / page_area

    copied_items = [dict(item) for item in items]
    render_blocks = build_render_blocks(copied_items, page_width=page_width, page_height=page_height)
    estimated_text_rects: list[tuple[str, fitz.Rect]] = []

    for block in render_blocks:
        block_triggers: list[RiskTrigger] = []
        inner = block.inner_bbox
        if len(inner) != 4:
            continue
        estimated_height = estimated_render_height_pt(
            inner,
            block.markdown_text,
            block.math_map or [],
            block.font_size_pt,
            block.leading_em,
        )
        inner_height = max(1.0, float(inner[3]) - float(inner[1]))
        height_ratio = estimated_height / inner_height
        item = _find_source_item(items, block.source_item_id)
        block_triggers.extend(
            _height_triggers(
                item_id=block.source_item_id,
                ratio=height_ratio,
                thresholds=thresholds,
            )
        )
        block_triggers.extend(
            _font_triggers(
                item=item,
                item_id=block.source_item_id,
                font_size_pt=min(block.font_size_pt, block.fit_min_font_size_pt or block.font_size_pt),
                thresholds=thresholds,
            )
        )
        block_triggers.extend(
            _garbled_triggers(
                item_id=block.source_item_id,
                text=block.plain_text or block.markdown_text,
                thresholds=thresholds,
            )
        )
        if block.fit_to_box and block.skip_reason == "adjacent_collision_risk":
            block_triggers.append(
                RiskTrigger(
                    kind="adjacent_collision_risk",
                    severity="high",
                    score=3,
                    item_id=block.source_item_id,
                    note="existing layout fit marked adjacent collision risk",
                )
            )
        estimated_rect = fitz.Rect(inner[0], inner[1], inner[2], inner[1] + max(inner_height, estimated_height))
        estimated_text_rects.append((block.source_item_id, estimated_rect))
        for formula_rect in formula_rects:
            overlap = rects_overlap_area(estimated_rect, formula_rect)
            if overlap >= thresholds.text_formula_overlap_hard_area_pt:
                block_triggers.append(
                    RiskTrigger(
                        kind="text_formula_overlap",
                        severity="hard",
                        score=thresholds.full_rebuild_max_score + 1,
                        item_id=block.source_item_id,
                        metric=round(overlap, 3),
                        threshold=thresholds.text_formula_overlap_hard_area_pt,
                    )
                )
        for nontext_rect in nontext_rects:
            overlap = rects_overlap_area(estimated_rect, nontext_rect)
            if overlap <= 0:
                continue
            ratio = overlap / max(1.0, rect_area(nontext_rect))
            if ratio >= thresholds.text_nontext_overlap_hard_ratio:
                block_triggers.append(
                    RiskTrigger(
                        kind="text_nontext_overlap",
                        severity="hard",
                        score=thresholds.full_rebuild_max_score + 1,
                        item_id=block.source_item_id,
                        metric=round(ratio, 4),
                        threshold=thresholds.text_nontext_overlap_hard_ratio,
                    )
                )
            elif ratio >= thresholds.text_nontext_overlap_high_ratio:
                block_triggers.append(
                    RiskTrigger(
                        kind="text_nontext_overlap",
                        severity="high",
                        score=4,
                        item_id=block.source_item_id,
                        metric=round(ratio, 4),
                        threshold=thresholds.text_nontext_overlap_high_ratio,
                    )
                )
        block_risks.append(
            BlockRisk(
                item_id=block.source_item_id,
                page_index=page_index,
                bbox=[float(value) for value in inner],
                estimated_height_pt=estimated_height,
                height_ratio=height_ratio,
                font_size_pt=block.font_size_pt,
                leading_em=block.leading_em,
                formula_count=len(block.math_map or []),
                triggers=block_triggers,
            )
        )
        page_triggers.extend(block_triggers)

    page_triggers.extend(_text_pair_collision_triggers(estimated_text_rects, thresholds=thresholds))
    page_triggers.extend(_page_complexity_triggers(
        page_index=page_index,
        text_block_count=len(render_blocks),
        formula_block_count=formula_block_count,
        image_or_table_block_count=image_or_table_block_count,
        occupied_area_ratio=occupied_area_ratio,
        thresholds=thresholds,
    ))
    page_triggers.extend(_translation_diagnostic_triggers(items, thresholds=thresholds))
    if bbox_text_strip_skipped and items:
        page_triggers.append(
            RiskTrigger(
                kind="source_text_preclean_skipped",
                severity="warn",
                score=2,
                note="bbox text strip did not preclean this translated page",
            )
        )

    hard_triggers = sorted({trigger.kind for trigger in page_triggers if trigger.severity == "hard"})
    score = sum(trigger.score for trigger in page_triggers)
    level = _risk_level(score, hard_triggers=hard_triggers, thresholds=thresholds)
    return PageRiskReport(
        page_index=page_index,
        risk_score=score,
        risk_level=level,
        suggested_action=_suggested_action(level, hard_triggers=hard_triggers),
        hard_triggers=hard_triggers,
        triggers=page_triggers,
        block_risks=block_risks,
        text_block_count=len(render_blocks),
        formula_block_count=formula_block_count,
        image_or_table_block_count=image_or_table_block_count,
        occupied_area_ratio=occupied_area_ratio,
    )


def _height_triggers(
    *,
    item_id: str,
    ratio: float,
    thresholds: RenderRiskThresholds,
) -> list[RiskTrigger]:
    if ratio > thresholds.height_ratio_hard:
        return [
            RiskTrigger(
                kind="text_height_overflow",
                severity="hard",
                score=thresholds.full_rebuild_max_score + 1,
                item_id=item_id,
                metric=round(ratio, 3),
                threshold=thresholds.height_ratio_hard,
            )
        ]
    if ratio > thresholds.height_ratio_high:
        return [
            RiskTrigger(
                kind="text_height_overflow",
                severity="high",
                score=3,
                item_id=item_id,
                metric=round(ratio, 3),
                threshold=thresholds.height_ratio_high,
            )
        ]
    if ratio > thresholds.height_ratio_warn:
        return [
            RiskTrigger(
                kind="text_height_overflow",
                severity="warn",
                score=1,
                item_id=item_id,
                metric=round(ratio, 3),
                threshold=thresholds.height_ratio_warn,
            )
        ]
    return []


def _font_triggers(
    *,
    item: dict,
    item_id: str,
    font_size_pt: float,
    thresholds: RenderRiskThresholds,
) -> list[RiskTrigger]:
    minimum = _min_font_threshold(item, thresholds)
    if font_size_pt >= minimum:
        return []
    return [
        RiskTrigger(
            kind="font_below_readable_minimum",
            severity="high",
            score=3,
            item_id=item_id,
            metric=round(font_size_pt, 3),
            threshold=minimum,
        )
    ]


def _garbled_triggers(
    *,
    item_id: str,
    text: str,
    thresholds: RenderRiskThresholds,
) -> list[RiskTrigger]:
    count = len(GARBLED_CHAR_RE.findall(text or ""))
    if count >= thresholds.garbled_chars_hard_per_block:
        return [
            RiskTrigger(
                kind="garbled_text",
                severity="hard",
                score=thresholds.full_rebuild_max_score + 1,
                item_id=item_id,
                metric=float(count),
                threshold=float(thresholds.garbled_chars_hard_per_block),
            )
        ]
    return []


def _text_pair_collision_triggers(
    text_rects: list[tuple[str, fitz.Rect]],
    *,
    thresholds: RenderRiskThresholds,
) -> list[RiskTrigger]:
    triggers: list[RiskTrigger] = []
    for index, (item_id, rect) in enumerate(text_rects):
        for other_id, other_rect in text_rects[index + 1 :]:
            overlap = rects_overlap_area(rect, other_rect)
            if overlap <= 0:
                continue
            ratio = overlap / max(1.0, min(rect_area(rect), rect_area(other_rect)))
            if ratio >= thresholds.text_text_overlap_hard:
                triggers.append(
                    RiskTrigger(
                        kind="text_text_overlap",
                        severity="hard",
                        score=thresholds.full_rebuild_max_score + 1,
                        item_id=item_id,
                        other_item_id=other_id,
                        metric=round(ratio, 4),
                        threshold=thresholds.text_text_overlap_hard,
                    )
                )
            elif ratio >= thresholds.text_text_overlap_high:
                triggers.append(
                    RiskTrigger(
                        kind="text_text_overlap",
                        severity="high",
                        score=4,
                        item_id=item_id,
                        other_item_id=other_id,
                        metric=round(ratio, 4),
                        threshold=thresholds.text_text_overlap_high,
                    )
                )
    return triggers


def _page_complexity_triggers(
    *,
    page_index: int,
    text_block_count: int,
    formula_block_count: int,
    image_or_table_block_count: int,
    occupied_area_ratio: float,
    thresholds: RenderRiskThresholds,
) -> list[RiskTrigger]:
    triggers: list[RiskTrigger] = []
    if text_block_count > thresholds.max_text_blocks_high:
        triggers.append(
            RiskTrigger(
                kind="page_text_block_density",
                severity="high",
                score=3,
                metric=float(text_block_count),
                threshold=float(thresholds.max_text_blocks_high),
                note=f"page={page_index + 1}",
            )
        )
    if formula_block_count > thresholds.max_formula_blocks_high:
        triggers.append(
            RiskTrigger(
                kind="page_formula_density",
                severity="high",
                score=3,
                metric=float(formula_block_count),
                threshold=float(thresholds.max_formula_blocks_high),
                note=f"page={page_index + 1}",
            )
        )
    if image_or_table_block_count > thresholds.max_image_or_table_blocks_high:
        triggers.append(
            RiskTrigger(
                kind="page_image_table_density",
                severity="high",
                score=3,
                metric=float(image_or_table_block_count),
                threshold=float(thresholds.max_image_or_table_blocks_high),
                note=f"page={page_index + 1}",
            )
        )
    if occupied_area_ratio > thresholds.occupied_area_high:
        triggers.append(
            RiskTrigger(
                kind="page_occupied_area_high",
                severity="high",
                score=4,
                metric=round(occupied_area_ratio, 4),
                threshold=thresholds.occupied_area_high,
            )
        )
    elif occupied_area_ratio > thresholds.occupied_area_warn:
        triggers.append(
            RiskTrigger(
                kind="page_occupied_area_high",
                severity="warn",
                score=1,
                metric=round(occupied_area_ratio, 4),
                threshold=thresholds.occupied_area_warn,
            )
        )
    return triggers


def _translation_diagnostic_triggers(
    items: list[dict],
    *,
    thresholds: RenderRiskThresholds,
) -> list[RiskTrigger]:
    triggers: list[RiskTrigger] = []
    for item in items:
        diagnostics = dict(item.get("translation_diagnostics") or {})
        error_trace = diagnostics.get("error_trace") or []
        for entry in error_trace:
            text = " ".join(
                str((entry or {}).get(key, "") or "")
                for key in ("type", "message", "reason")
            )
            if FORMULA_DIAGNOSTIC_RE.search(text):
                triggers.append(
                    RiskTrigger(
                        kind="formula_placeholder_diagnostic",
                        severity="hard",
                        score=thresholds.full_rebuild_max_score + 1,
                        item_id=str(item.get("item_id", "") or ""),
                        note=text.strip()[:160],
                    )
                )
    return triggers


def _risk_level(
    score: int,
    *,
    hard_triggers: list[str],
    thresholds: RenderRiskThresholds,
) -> str:
    if hard_triggers or score > thresholds.full_rebuild_max_score:
        return "extreme"
    if score > thresholds.partial_reflow_max_score:
        return "high"
    if score > thresholds.overlay_max_score:
        return "medium"
    return "low"


def _suggested_action(level: str, *, hard_triggers: list[str]) -> str:
    if hard_triggers or level in {"high", "extreme"}:
        return "full_rebuild"
    if level == "medium":
        return "partial_reflow"
    return "overlay"


def _find_source_item(items: list[dict], item_id: str) -> dict:
    for item in items:
        if str(item.get("item_id", "") or "") == item_id:
            return item
    return {}


def _min_font_threshold(item: dict, thresholds: RenderRiskThresholds) -> float:
    values = {
        str(item.get("block_kind", "") or ""),
        str(item.get("block_type", "") or ""),
        str(item.get("layout_role", "") or ""),
        str(item.get("semantic_role", "") or ""),
        str(item.get("structure_role", "") or ""),
        str(item.get("normalized_sub_type", "") or ""),
        str(item.get("sub_type", "") or ""),
    }
    lowered = {value.strip().lower() for value in values if value}
    if lowered & {"reference", "reference_entry", "footnote", "footer"}:
        return thresholds.min_reference_font_pt
    if lowered & {"table", "table_cell", "cell"}:
        return thresholds.min_table_font_pt
    return thresholds.min_body_font_pt


def _is_formula_item(item: dict) -> bool:
    lowered = _item_roles(item)
    return bool(lowered & {"formula", "display_formula", "inline_equation", "interline_equation"})


def _is_image_or_table_item(item: dict) -> bool:
    lowered = _item_roles(item)
    return bool(lowered & {"image", "figure", "table", "table_cell", "chart", "diagram"})


def _item_roles(item: dict) -> set[str]:
    keys = (
        "block_kind",
        "block_type",
        "type",
        "sub_type",
        "normalized_sub_type",
        "layout_role",
        "semantic_role",
        "structure_role",
    )
    return {str(item.get(key, "") or "").strip().lower() for key in keys if str(item.get(key, "") or "").strip()}


def _bbox(item: dict) -> list[float]:
    bbox = item.get("bbox", [])
    if not isinstance(bbox, list) or len(bbox) != 4:
        return []
    try:
        return [float(value) for value in bbox]
    except Exception:
        return []


def _valid_bbox(bbox: list[float]) -> bool:
    return len(bbox) == 4 and bbox[2] > bbox[0] and bbox[3] > bbox[1]


def _rect(item: dict) -> fitz.Rect:
    return fitz.Rect(_bbox(item))


__all__ = [
    "scan_render_risk",
]

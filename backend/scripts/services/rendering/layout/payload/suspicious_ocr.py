from __future__ import annotations

import re

from services.rendering.layout.payload.metrics import VERTICAL_COLLISION_GAP_PT
from services.rendering.layout.payload.metrics import block_metrics
from services.rendering.layout.payload.metrics import estimated_render_height_pt
from services.rendering.layout.typography.geometry import inner_bbox


SUSPICIOUS_OCR_GLUE_MIN_CHARS = 1000
SUSPICIOUS_OCR_GLUE_MIN_CHAR_HEIGHT_RATIO = 15.0
SUSPICIOUS_OCR_GLUE_MAX_SOURCE_GAP_PT = 28.0
SUSPICIOUS_OCR_GLUE_MIN_WIDTH_OVERLAP_RATIO = 0.6
SUSPICIOUS_OCR_GLUE_OVERFLOW_RATIO = 1.25
SUSPICIOUS_OCR_GLUE_REASON = "suspicious_ocr_glued_block"
SUSPICIOUS_OCR_GLUE_DIAGNOSTIC_KIND = "render_skip_detector"
SUSPICIOUS_OCR_GLUE_DIAGNOSTIC_NAME = "suspicious_ocr_glued_block"


def _compact_text_len(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))


def _width_overlap_ratio(current_inner: list[float], next_inner: list[float]) -> float:
    overlap_width = max(0.0, min(current_inner[2], next_inner[2]) - max(current_inner[0], next_inner[0]))
    min_width = max(1.0, min(current_inner[2] - current_inner[0], next_inner[2] - next_inner[0]))
    return overlap_width / min_width


def clear_render_text(item: dict, *, reason: str) -> None:
    item["render_protected_text"] = ""
    item["render_formula_map"] = []
    item["translation_unit_protected_translated_text"] = ""
    item["translation_unit_translated_text"] = ""
    item["protected_translated_text"] = ""
    item["translated_text"] = ""
    item["group_protected_translated_text"] = ""
    item["group_translated_text"] = ""
    item["render_skip_reason"] = reason


def _append_item_diagnostic(item: dict, diagnostic: dict) -> None:
    existing = item.get("render_diagnostics")
    if isinstance(existing, list):
        diagnostics = existing
    else:
        diagnostics = []
        item["render_diagnostics"] = diagnostics
    diagnostics.append(diagnostic)


def detect_and_drop_suspicious_ocr_glued_blocks(
    items: list[dict],
    *,
    page_idx: int,
    page_font_size: float,
    page_line_pitch: float,
    page_line_height: float,
    density_baseline: float,
    page_text_width_med: float,
) -> dict:
    ordered = sorted(
        (
            item
            for item in items
            if str(item.get("block_type", "") or "") == "text" and (item.get("render_protected_text") or "").strip()
        ),
        key=lambda item: (
            inner_bbox(item)[1] if len(inner_bbox(item)) == 4 else 0.0,
            inner_bbox(item)[0] if len(inner_bbox(item)) == 4 else 0.0,
        ),
    )
    hits: list[dict] = []
    for current, nxt in zip(ordered, ordered[1:]):
        current_inner = inner_bbox(current)
        next_inner = inner_bbox(nxt)
        if len(current_inner) != 4 or len(next_inner) != 4:
            continue
        if bool(current.get("render_formula_map")):
            continue
        source_text = (
            current.get("translation_unit_protected_source_text")
            or current.get("protected_source_text")
            or current.get("source_text")
            or ""
        )
        source_chars = _compact_text_len(source_text)
        bbox = current.get("bbox", [])
        bbox_height = max(1.0, (bbox[3] - bbox[1])) if len(bbox) == 4 else 1.0
        char_height_ratio = source_chars / bbox_height
        if source_chars < SUSPICIOUS_OCR_GLUE_MIN_CHARS:
            continue
        if char_height_ratio < SUSPICIOUS_OCR_GLUE_MIN_CHAR_HEIGHT_RATIO:
            continue
        width_overlap_ratio = _width_overlap_ratio(current_inner, next_inner)
        if width_overlap_ratio < SUSPICIOUS_OCR_GLUE_MIN_WIDTH_OVERLAP_RATIO:
            continue
        source_gap = next_inner[1] - current_inner[3]
        if source_gap < 0 or source_gap > SUSPICIOUS_OCR_GLUE_MAX_SOURCE_GAP_PT:
            continue
        font_size_pt, leading_em = block_metrics(
            current,
            page_font_size,
            page_line_pitch,
            page_line_height,
            density_baseline,
            page_text_width_med,
        )
        estimated_height = estimated_render_height_pt(
            current_inner,
            current.get("render_protected_text", ""),
            current.get("render_formula_map") or [],
            font_size_pt,
            leading_em,
        )
        max_height_pt = next_inner[1] - current_inner[1] - VERTICAL_COLLISION_GAP_PT
        if max_height_pt <= 0:
            continue
        overflow_ratio = estimated_height / max_height_pt
        if estimated_height <= max_height_pt * SUSPICIOUS_OCR_GLUE_OVERFLOW_RATIO:
            continue
        diagnostic = {
            "kind": SUSPICIOUS_OCR_GLUE_DIAGNOSTIC_KIND,
            "name": SUSPICIOUS_OCR_GLUE_DIAGNOSTIC_NAME,
            "reason": SUSPICIOUS_OCR_GLUE_REASON,
            "page_idx": page_idx,
            "item_id": current.get("item_id", ""),
            "next_item_id": nxt.get("item_id", ""),
            "source_chars": source_chars,
            "bbox_height_pt": round(bbox_height, 2),
            "char_height_ratio": round(char_height_ratio, 2),
            "width_overlap_ratio": round(width_overlap_ratio, 3),
            "source_gap_pt": round(source_gap, 2),
            "font_size_pt": round(font_size_pt, 2),
            "leading_em": round(leading_em, 2),
            "estimated_height_pt": round(estimated_height, 2),
            "allowed_height_pt": round(max_height_pt, 2),
            "overflow_ratio": round(overflow_ratio, 3),
            "thresholds": {
                "min_chars": SUSPICIOUS_OCR_GLUE_MIN_CHARS,
                "min_char_height_ratio": SUSPICIOUS_OCR_GLUE_MIN_CHAR_HEIGHT_RATIO,
                "max_source_gap_pt": SUSPICIOUS_OCR_GLUE_MAX_SOURCE_GAP_PT,
                "min_width_overlap_ratio": SUSPICIOUS_OCR_GLUE_MIN_WIDTH_OVERLAP_RATIO,
                "overflow_ratio": SUSPICIOUS_OCR_GLUE_OVERFLOW_RATIO,
            },
        }
        clear_render_text(current, reason=SUSPICIOUS_OCR_GLUE_REASON)
        _append_item_diagnostic(current, diagnostic)
        hits.append(diagnostic)

    return {
        "name": SUSPICIOUS_OCR_GLUE_DIAGNOSTIC_NAME,
        "reason": SUSPICIOUS_OCR_GLUE_REASON,
        "count": len(hits),
        "page_idx": page_idx,
        "hits": hits,
    }

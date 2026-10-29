from __future__ import annotations

# 估行、拆行内公式这些各家通用的挪到了 `document_schema/estimated_lines.py`（2026-10-29）；这里接着导出原来的名字，
# Paddle 适配器和 `provider_pipeline` 的兼容名字（`build_paddle_lines`、`tighten_paddle_text_bbox`）照旧从这里拿。
# 只有 Paddle 专用的「按版面框给行内公式配坐标」留在这里。
from retainpdf_pipeline.ocr.document_schema.estimated_lines import (  # noqa: F401
    build_lines,
    build_segments,
    tighten_text_bbox,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.common import (  # noqa: F401
    inherit_missing_segment_bboxes,
)


def assign_inline_formula_bboxes(
    *,
    segments: list[dict],
    block_bbox: list[float],
    layout_box_lookup: dict[tuple[float, float, float, float], dict],
) -> dict:
    """Use Paddle layout boxes only when formula-to-box pairing is unambiguous.

    The layout detector does not expose recognized formula text, so a partial
    positional match could attach the wrong box. We therefore assign provider
    geometry only when the number of formula segments exactly equals the
    number of contained ``inline_formula`` boxes; otherwise the normal block
    or line approximation remains explicit.
    """

    formula_segments = [
        segment for segment in segments if segment.get("type") == "inline_formula"
    ]
    candidates: list[tuple[list[float], dict]] = []
    if len(block_bbox) == 4:
        x0, y0, x1, y1 = (float(value) for value in block_bbox)
        for raw_box in layout_box_lookup.values():
            if str(raw_box.get("label", "") or "").strip().lower() != "inline_formula":
                continue
            coordinate = raw_box.get("coordinate")
            if not isinstance(coordinate, list) or len(coordinate) != 4:
                continue
            candidate = [float(value or 0) for value in coordinate]
            if candidate[2] <= candidate[0] or candidate[3] <= candidate[1]:
                continue
            if (
                candidate[0] >= x0
                and candidate[1] >= y0
                and candidate[2] <= x1
                and candidate[3] <= y1
            ):
                candidates.append((candidate, raw_box))
    candidates.sort(key=lambda item: (item[0][1], item[0][0], item[0][3], item[0][2]))

    matched_count = 0
    if formula_segments and len(formula_segments) == len(candidates):
        for segment, (candidate, raw_box) in zip(formula_segments, candidates):
            segment["bbox"] = candidate
            segment["bbox_precision"] = "provider_layout"
            score = raw_box.get("score")
            if isinstance(score, (int, float)):
                segment["score"] = float(score)
            matched_count += 1
    return {
        "provider_inline_formula_segment_count": len(formula_segments),
        "provider_inline_formula_candidate_count": len(candidates),
        "provider_inline_formula_bbox_count": matched_count,
        "provider_inline_formula_bbox_complete": bool(formula_segments)
        and matched_count == len(formula_segments),
    }

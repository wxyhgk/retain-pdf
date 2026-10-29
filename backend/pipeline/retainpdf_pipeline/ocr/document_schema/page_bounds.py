"""把略微超出页边的框夹回页内（2026-10-29 起）。

OCR 的坐标有取整误差，块常常超出页边一两个单位。校验器要求块在页内，以前一个这样的块就让整份文档校验失败、任务直接失败
（MinerU 超出 1.5 点、Paddle 超出 2 像素的人造样例都撞上过，见 `devtools/tests/document_schema/fixtures/synthetic/`）。

只夹"略微"超出的：每条边超出的距离不超过页面那一边长的 `PAGE_OVERFLOW_TOLERANCE_RATIO`。超得更多的不动，让校验照样报错——那多半是
数据真的错了（单位弄错、配错了页），不该悄悄藏起来。块夹了以后，它的行、行里的片段、块的片段跟着收进块里（校验要求它们在块内）；
整个落在块外的不动，照样让校验报出来。夹过的块在 `metadata.page_overflow_clamped` 记下原来的框，文档的 `derived` 记夹了几个
（没夹的文档一个字都不改）。

在适配器出来、第一次校验之前调（坐标还是 OCR 自己的单位，按 OCR 自己的页面尺寸比）。
"""

from __future__ import annotations

PAGE_OVERFLOW_TOLERANCE_RATIO = 0.01
# 校验器自己的容差：在这以内本来就算在页内。
_VALIDATOR_TOLERANCE = 1e-3


def _bbox(value: object) -> list[float] | None:
    if not isinstance(value, list) or len(value) != 4:
        return None
    try:
        return [float(item) for item in value]
    except (TypeError, ValueError):
        return None


def _intersect(inner: object, outer: list[float]) -> list[float] | None:
    box = _bbox(inner)
    if box is None:
        return None
    clipped = [max(box[0], outer[0]), max(box[1], outer[1]), min(box[2], outer[2]), min(box[3], outer[3])]
    return clipped if clipped[2] > clipped[0] and clipped[3] > clipped[1] else None


def _shrink_into(value: object, container: list[float]) -> object:
    """框在容器里就原样返回；有一部分出界就裁成相交的部分；整个在外面原样返回（让校验报出来）。"""
    box = _bbox(value)
    if box is None:
        return value
    if box[0] >= container[0] and box[1] >= container[1] and box[2] <= container[2] and box[3] <= container[3]:
        return value
    clipped = _intersect(box, container)
    return clipped if clipped is not None else value


def clamp_page_overflow(document: dict) -> int:
    """把略微超出页边的块夹回页内，返回夹了几个块。原地改 `document`。"""
    clamped_count = 0
    for page in document.get("pages", []) or []:
        try:
            width = float(page.get("width", 0) or 0)
            height = float(page.get("height", 0) or 0)
        except (TypeError, ValueError):
            continue
        if width <= 0 or height <= 0:
            continue
        tolerance_x = width * PAGE_OVERFLOW_TOLERANCE_RATIO
        tolerance_y = height * PAGE_OVERFLOW_TOLERANCE_RATIO
        for block in page.get("blocks", []) or []:
            box = _bbox(block.get("bbox"))
            if box is None:
                continue
            x0, y0, x1, y1 = box
            inside = (
                x0 >= -_VALIDATOR_TOLERANCE
                and y0 >= -_VALIDATOR_TOLERANCE
                and x1 <= width + _VALIDATOR_TOLERANCE
                and y1 <= height + _VALIDATOR_TOLERANCE
            )
            if inside:
                continue
            slightly = x0 >= -tolerance_x and y0 >= -tolerance_y and x1 <= width + tolerance_x and y1 <= height + tolerance_y
            if not slightly:
                continue
            clamped = [max(0.0, x0), max(0.0, y0), min(width, x1), min(height, y1)]
            if not (clamped[2] > clamped[0] and clamped[3] > clamped[1]):
                continue
            original = list(block.get("bbox"))
            block["bbox"] = clamped
            geometry = block.get("geometry")
            if isinstance(geometry, dict) and "bbox" in geometry:
                geometry["bbox"] = list(clamped)
            for line in block.get("lines", []) or []:
                if not isinstance(line, dict):
                    continue
                line["bbox"] = _shrink_into(line.get("bbox"), clamped)
                line_box = _bbox(line.get("bbox")) or clamped
                for span in line.get("spans", []) or []:
                    if isinstance(span, dict) and "bbox" in span:
                        span["bbox"] = _shrink_into(span.get("bbox"), line_box)
            for segment in block.get("segments", []) or []:
                if isinstance(segment, dict) and "bbox" in segment:
                    segment["bbox"] = _shrink_into(segment.get("bbox"), clamped)
            metadata = block.get("metadata")
            if not isinstance(metadata, dict):
                metadata = {}
                block["metadata"] = metadata
            metadata["page_overflow_clamped"] = {"original_bbox": original}
            clamped_count += 1
    if clamped_count:
        document.setdefault("derived", {})["page_overflow_clamped_block_count"] = clamped_count
    return clamped_count


__all__ = ["PAGE_OVERFLOW_TOLERANCE_RATIO", "clamp_page_overflow"]

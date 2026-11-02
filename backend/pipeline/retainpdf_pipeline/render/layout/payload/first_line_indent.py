from __future__ import annotations

from functools import lru_cache
from statistics import median

import fitz

from retainpdf_pipeline.render.layout.font_roles import is_body_text_candidate
from retainpdf_pipeline.render.layout.font_roles import is_caption_like_block
from retainpdf_pipeline.render.layout.font_roles import is_footnote_like_block
from retainpdf_pipeline.render.layout.font_roles import is_title_like_block
from retainpdf_pipeline.render.layout.typography.measurement import bbox_height
from retainpdf_pipeline.render.layout.typography.measurement import bbox_width
from retainpdf_pipeline.render.semantics.item_view import layout_role as schema_layout_role
from retainpdf_pipeline.render.semantics.item_view import semantic_role as schema_semantic_role


INDENT_RENDER_SCALE = 2.0
MIN_BLOCK_WIDTH_PT = 80.0
MIN_BLOCK_HEIGHT_PT = 20.0
MIN_DETECTED_LINES = 2
INK_THRESHOLD = 26
ROW_INK_RATIO = 0.012
COL_INK_RATIO = 0.035
MIN_LINE_HEIGHT_PX = 3
MAX_INDENT_EM = 2.2


def _is_body_paragraph(item: dict, *, page_text_width_med: float) -> bool:
    if is_caption_like_block(item) or is_footnote_like_block(item) or is_title_like_block(item):
        return False
    item_layout_role = schema_layout_role(item)
    item_semantic_role = schema_semantic_role(item)
    if item_layout_role not in {"paragraph", "list_item"} and not is_body_text_candidate(item, page_text_width_med):
        return False
    return item_semantic_role in {"", "body", "abstract", "unknown"}


def _border_background(samples: bytes, width: int, height: int) -> int:
    if width <= 0 or height <= 0:
        return 255
    values: list[int] = []
    for x in range(width):
        values.append(samples[x])
        values.append(samples[(height - 1) * width + x])
    for y in range(height):
        values.append(samples[y * width])
        values.append(samples[y * width + width - 1])
    if not values:
        return 255
    return int(median(values))


def _ink_rows(samples: bytes, width: int, height: int, background: int) -> list[bool]:
    min_ink = max(2, int(width * ROW_INK_RATIO))
    if background - INK_THRESHOLD >= 0:
        threshold = background - INK_THRESHOLD
        dark_table = _dark_threshold_table(threshold)
        return [
            sum(samples[y * width : (y + 1) * width].translate(dark_table)) >= min_ink
            for y in range(height)
        ]
    rows: list[bool] = []
    for y in range(height):
        start = y * width
        ink = 0
        for pixel in samples[start : start + width]:
            if abs(int(pixel) - background) >= INK_THRESHOLD and int(pixel) < background:
                ink += 1
        rows.append(ink >= min_ink)
    return rows


@lru_cache(maxsize=256)
def _dark_threshold_table(threshold: int) -> bytes:
    threshold = max(0, min(255, int(threshold)))
    return bytes.maketrans(
        bytes(range(256)),
        bytes(1 if value <= threshold else 0 for value in range(256)),
    )


def _bands(flags: list[bool], *, min_size: int) -> list[tuple[int, int]]:
    bands: list[tuple[int, int]] = []
    start: int | None = None
    for index, flag in enumerate(flags):
        if flag and start is None:
            start = index
        elif not flag and start is not None:
            if index - start >= min_size:
                bands.append((start, index))
            start = None
    if start is not None and len(flags) - start >= min_size:
        bands.append((start, len(flags)))
    return bands


def _line_left_px(samples: bytes, width: int, background: int, y0: int, y1: int) -> int | None:
    band_height = max(1, y1 - y0)
    min_ink = max(1, int(band_height * COL_INK_RATIO))
    for x in range(width):
        ink = 0
        for y in range(y0, y1):
            pixel = int(samples[y * width + x])
            if abs(pixel - background) >= INK_THRESHOLD and pixel < background:
                ink += 1
        if ink >= min_ink:
            return x
    return None


def detect_first_line_indent_pt(
    source_doc: fitz.Document | None,
    item: dict,
    *,
    page_idx: int,
    font_size_pt: float,
    page_text_width_med: float,
) -> float:
    return detect_first_line_indent_pt_with_displaylist(
        source_doc,
        None,
        item,
        page_idx=page_idx,
        font_size_pt=font_size_pt,
        page_text_width_med=page_text_width_med,
    )


def detect_first_line_indent_pt_with_displaylist(
    source_doc: fitz.Document | None,
    displaylist: fitz.DisplayList | None,
    item: dict,
    *,
    page_idx: int,
    font_size_pt: float,
    page_text_width_med: float,
) -> float:
    if source_doc is None or page_idx < 0 or page_idx >= len(source_doc):
        return 0.0
    if not is_first_line_indent_candidate(item, page_text_width_med=page_text_width_med):
        return 0.0
    bbox = item.get("bbox", [])

    page = source_doc[page_idx]
    clip = fitz.Rect(bbox) & page.rect
    if clip.is_empty or clip.width <= 0 or clip.height <= 0:
        return 0.0
    matrix = fitz.Matrix(INDENT_RENDER_SCALE, INDENT_RENDER_SCALE)
    if displaylist is not None:
        pix = displaylist.get_pixmap(matrix=matrix, colorspace=fitz.csGRAY, alpha=False, clip=clip)
    else:
        pix = page.get_pixmap(
            matrix=matrix,
            colorspace=fitz.csGRAY,
            alpha=False,
            clip=clip,
        )
    if pix.width <= 0 or pix.height <= 0:
        return 0.0

    samples = pix.samples
    background = _border_background(samples, pix.width, pix.height)
    line_bands = _bands(_ink_rows(samples, pix.width, pix.height, background), min_size=MIN_LINE_HEIGHT_PX)
    if len(line_bands) < MIN_DETECTED_LINES:
        return 0.0
    lefts = [
        left
        for y0, y1 in line_bands
        if (left := _line_left_px(samples, pix.width, background, y0, y1)) is not None
    ]
    if len(lefts) < MIN_DETECTED_LINES:
        return 0.0

    first_left = lefts[0]
    rest_lefts = lefts[1:]
    rest_median = median(rest_lefts)
    indent_px = first_left - rest_median
    return _accepted_indent_pt(indent_px / INDENT_RENDER_SCALE, font_size_pt=font_size_pt)


def _accepted_indent_pt(indent_pt: float, *, font_size_pt: float, precise: bool = False) -> float:
    # 灰度图数墨迹有像素级噪声，门槛要高（0.75em，封顶 8pt）；文字层坐标是精确的，
    # 半个字宽就够。按 0.75em 算的话，字号估成 10.76pt 时门槛正好 8pt，实测 8pt 的缩进
    # （312.72 - 304.72 在浮点下差一点不到 8）被刷掉。
    threshold = max(3.0, font_size_pt * 0.5) if precise else max(4.0, min(8.0, font_size_pt * 0.75))
    if indent_pt < threshold:
        return 0.0
    max_indent = max(8.0, font_size_pt * MAX_INDENT_EM)
    return round(max(0.0, min(indent_pt, max_indent)), 2)


# 同一行被 PDF 拆成几段（换字体、上下标）时 y0 差不了这么多。
TEXT_LINE_SAME_ROW_PT = 2.0
TEXT_LINE_BBOX_TOLERANCE_PT = 2.0
TEXT_LINE_FLAGS = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES


def page_text_line_boxes(page: fitz.Page) -> list[tuple[float, float, float, float]]:
    """这一页文字层里每一行的 bbox。扫描件（没有文字层）返回空表。

    可复制的 PDF 每行从哪个 x 开始，文字层里直接写着 —— 一页取一次，比把每个块渲染成
    灰度图再数墨迹（detect_first_line_indent_pt_with_displaylist，给扫描件用的）省得多。
    """
    boxes: list[tuple[float, float, float, float]] = []
    # 不要图片：默认的 "dict" 会把每张图解码进结果，扫描件一页 0.13 秒，481 页光这一步 60 秒（2026-11-02），
    # 而这里只看文字行（图片块本来就跳过）。
    for block in page.get_text("dict", flags=TEXT_LINE_FLAGS).get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            if not "".join(str(span.get("text", "")) for span in line.get("spans", [])).strip():
                continue
            x0, y0, x1, y1 = (float(value) for value in line["bbox"])
            if x1 > x0 and y1 > y0:
                boxes.append((x0, y0, x1, y1))
    return boxes


def detect_first_line_indent_pt_from_text_lines(
    item: dict,
    text_lines: list[tuple[float, float, float, float]],
    *,
    font_size_pt: float,
    page_text_width_med: float,
) -> float | None:
    """文字层里读得到这一块至少两行 → 返回缩进（没有缩进就是 0.0）；
    读不到（扫描件，或者文字层没盖住这一块）→ 返回 None，交给灰度图那条路。

    是不是正文段落由调用方先用 is_first_line_indent_candidate 判过，这里不再判一次。
    """
    del page_text_width_med
    if not text_lines:
        return None
    x0, y0, x1, y1 = (float(value) for value in item["bbox"])
    tol = TEXT_LINE_BBOX_TOLERANCE_PT
    inside = sorted(
        (line for line in text_lines
         if x0 - tol <= (line[0] + line[2]) / 2 <= x1 + tol and y0 - tol <= (line[1] + line[3]) / 2 <= y1 + tol),
        key=lambda line: (line[1], line[0]),
    )
    rows: list[list[float]] = []
    for line in inside:
        if rows and abs(rows[-1][1] - line[1]) < TEXT_LINE_SAME_ROW_PT:
            rows[-1][0] = min(rows[-1][0], line[0])
        else:
            rows.append([line[0], line[1]])
    if len(rows) < MIN_DETECTED_LINES:
        return None
    indent_pt = rows[0][0] - median(row[0] for row in rows[1:])
    return _accepted_indent_pt(indent_pt, font_size_pt=font_size_pt, precise=True)


def is_first_line_indent_candidate(item: dict, *, page_text_width_med: float) -> bool:
    if not _is_body_paragraph(item, page_text_width_med=page_text_width_med):
        return False
    if bbox_width(item) < MIN_BLOCK_WIDTH_PT or bbox_height(item) < MIN_BLOCK_HEIGHT_PT:
        return False
    bbox = item.get("bbox", [])
    return len(bbox) == 4


__all__ = [
    "detect_first_line_indent_pt",
    "detect_first_line_indent_pt_from_text_lines",
    "page_text_line_boxes",
    "detect_first_line_indent_pt_with_displaylist",
    "is_first_line_indent_candidate",
]

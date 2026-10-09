"""从底图 PDF 读矢量图形、图片与文字框，给 rpr_fit 引擎当障碍物。

和引擎仓库 experiments/overlay/vector-obstacles.js 的 PyMuPDF 脚本同一份逻辑（引擎侧的
几何处理在 src/retain/vector-obstacles.js）：

- drawings：每个路径的外框、类型、线宽、填充 / 描边色、裁剪框（只取 scissor），路径拍平成
  折线（贝塞尔 8 段）；
- images / words：OCR 障碍物（图、表、公式）按真实墨迹收紧框时用。

只读取要渲染的页。
"""

from __future__ import annotations

from pathlib import Path

import fitz


def _bezier(p0, p1, p2, p3, n: int = 8) -> list[tuple[float, float]]:
    points = []
    for k in range(n + 1):
        t = k / n
        u = 1 - t
        points.append(
            (
                u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
                u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
            )
        )
    return points


def _page_drawings(page: fitz.Page, obstacle_boxes: list[list[float]] | None = None) -> list[dict]:
    """obstacle_boxes：完全落在其中的路径不拍平折线（之后只按外框合并成墨迹，见
    _collapse_into_obstacles），省掉大图里成千上万条路径的拍平。"""
    obstacle_boxes = obstacle_boxes or []
    entries: list[dict] = []
    # extended=True 同时给出裁剪路径：level 为 L 的 clip 约束其后所有更深的条目，直到出现
    # level <= L 的条目为止。只用裁剪框（scissor）。
    stack: list[tuple[int, fitz.Rect | None]] = []
    for drawing in page.get_drawings(extended=True):
        level = drawing.get("level", 0)
        while stack and stack[-1][0] >= level:
            stack.pop()
        kind = drawing.get("type")
        if kind == "clip":
            scissor = drawing.get("scissor")
            stack.append((level, fitz.Rect(scissor) if scissor else None))
            continue
        if kind == "group":
            stack.append((level, None))
            continue
        rect = drawing.get("rect")
        if not rect:
            continue
        clip = None
        for _, scissor in stack:
            if scissor is None:
                continue
            clip = fitz.Rect(scissor) if clip is None else clip & scissor
        fill = drawing.get("fill")
        color = drawing.get("color")
        entry = {
            "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
            "type": drawing.get("type") or "",
            "width": drawing.get("width") or 0,
            "fill": list(fill) if fill is not None else None,
            "stroke": list(color) if color is not None else None,
            "clip": [clip.x0, clip.y0, clip.x1, clip.y1] if clip is not None else None,
            "fillOpacity": drawing.get("fill_opacity"),
            "polylines": [],
        }
        if obstacle_boxes:
            visible = _visible_rect(entry)
            if visible is not None and any(_contains(box, visible) for box in obstacle_boxes):
                entries.append(entry)
                continue
        segments = []
        for item in drawing.get("items") or []:
            op = item[0]
            if op == "l":
                segments.append([(item[1].x, item[1].y), (item[2].x, item[2].y)])
            elif op == "c":
                segments.append(_bezier(item[1], item[2], item[3], item[4]))
            elif op == "re":
                q = item[1]
                segments.append([(q.x0, q.y0), (q.x1, q.y0), (q.x1, q.y1), (q.x0, q.y1), (q.x0, q.y0)])
            elif op == "qu":
                q = item[1]
                segments.append(
                    [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y), (q.ul.x, q.ul.y)]
                )
        entry["polylines"] = [[[round(x, 2), round(y, 2)] for x, y in segment] for segment in segments]
        entries.append(entry)
    return entries


Box = list[float]

# 扫描件 / 伪扫描件：最大的一张图盖住页面这么大比例时，页面内容基本都在像素里，矢量图形
# 看不到题框、表格线这类东西，改从低分辨率渲染图里找墨迹。
RASTER_PAGE_IMAGE_RATIO = 0.5
# 36 dpi：一个像素约 2pt。18 dpi（4pt）时细的彩色题框线被平均到只比纸色暗一点，认不出来（703433 第 23 页）。
RASTER_INK_DPI = 36
RASTER_INK_DELTA = 18


def _contains(outer: Box, inner: Box, tol: float = 0.5) -> bool:
    return (
        inner[0] >= outer[0] - tol
        and inner[1] >= outer[1] - tol
        and inner[2] <= outer[2] + tol
        and inner[3] <= outer[3] + tol
    )


def _visible_rect(entry: dict) -> Box | None:
    """引擎 obstacleInkBoxes 的口径：按线宽加粗（细线至少 0.5pt 半宽）后再按裁剪框裁。"""
    x0, y0, x1, y1 = entry["rect"]
    stroked = entry.get("stroke") is not None and "s" in str(entry.get("type") or "")
    pad = max(float(entry.get("width") or 0) / 2, 0.5) if stroked else 0.0
    if x1 - x0 < 2 * pad:
        cx = (x0 + x1) / 2
        x0, x1 = min(x0, cx - pad), max(x1, cx + pad)
    if y1 - y0 < 2 * pad:
        cy = (y0 + y1) / 2
        y0, y1 = min(y0, cy - pad), max(y1, cy + pad)
    clip = entry.get("clip")
    if clip:
        x0, y0, x1, y1 = max(x0, clip[0]), max(y0, clip[1]), min(x1, clip[2]), min(y1, clip[3])
    if x1 - x0 <= 0.01 or y1 - y0 <= 0.01:
        return None
    return [x0, y0, x1, y1]


def _collapse_into_obstacles(entries: list[dict], obstacle_boxes: list[Box]) -> list[dict]:
    """完全落在已知障碍物（图、表、公式、不翻译的块）里的路径，合并成每个障碍物一个墨迹矩形。

    引擎对它们只做两件事：判定「在障碍物里」就跳过，以及按墨迹收紧障碍物框
    （obstacleInkBoxes 取并集）。一个并集矩形给出的结果相同，但不必把一张图里几万条路径
    逐条拍平、写成 JSON 再解析（fe8d63 的一张图有 34,765 条）。
    """
    if not obstacle_boxes:
        return entries
    kept: list[dict] = []
    ink: dict[int, Box] = {}
    for entry in entries:
        rect = _visible_rect(entry)
        owner = -1
        if rect is not None:
            for index, box in enumerate(obstacle_boxes):
                if _contains(box, rect):
                    owner = index
                    break
        if owner < 0:
            kept.append(entry)
            continue
        visible = (entry.get("fill") is not None and entry.get("fillOpacity") != 0) or (
            entry.get("stroke") is not None and "s" in str(entry.get("type") or "")
        )
        if not visible:
            continue
        union = ink.get(owner)
        ink[owner] = rect if union is None else [
            min(union[0], rect[0]), min(union[1], rect[1]), max(union[2], rect[2]), max(union[3], rect[3])
        ]
    for rect in ink.values():
        kept.append(
            {"rect": rect, "type": "f", "width": 0, "fill": [0, 0, 0], "stroke": None, "clip": None,
             "fillOpacity": 1, "polylines": [], "synthetic": "obstacle-ink"}
        )
    return kept


def _is_raster_page(page: fitz.Page) -> bool:
    page_area = max(1.0, page.rect.width * page.rect.height)
    largest = 0.0
    for info in page.get_image_info():
        rect = fitz.Rect(info["bbox"]) & page.rect
        largest = max(largest, rect.width * rect.height)
    return largest >= RASTER_PAGE_IMAGE_RATIO * page_area


def _raster_ink(page: fitz.Page, skip_boxes: list[Box]) -> list[dict]:
    """扫描页：低分辨率渲染图里的墨迹，当作实心障碍物。

    只跳过**整格**落在已知框（译文块、障碍物）里的墨迹；跨在框边上的格子留着——贴着译文框
    边的题框线、表格线就在这种格子里。引擎会把障碍物落在译文框里的部分裁掉
    （vector-obstacles.js：repainted text boxes are cut away），所以译文块自己的原文墨迹
    不会挡住它自己。每行相邻的墨迹格合成一段；墨迹 = 比页面纸色（亮度 90 分位）暗
    RASTER_INK_DELTA 以上。
    """
    pix = page.get_pixmap(dpi=RASTER_INK_DPI, colorspace=fitz.csGRAY, alpha=False)
    width, height, samples = pix.width, pix.height, pix.samples
    if not width or not height:
        return []
    ordered = sorted(samples[:: max(1, len(samples) // 4096)])
    paper = ordered[int(len(ordered) * 0.9)] if ordered else 255
    threshold = paper - RASTER_INK_DELTA
    sx = page.rect.width / width
    sy = page.rect.height / height
    entries: list[dict] = []
    for row in range(height):
        base = row * width
        y0, y1 = row * sy, (row + 1) * sy
        start = -1
        for col in range(width + 1):
            dark = col < width and samples[base + col] < threshold
            if dark:
                cell = [col * sx, y0, (col + 1) * sx, y1]
                if any(_contains(box, cell, 0.0) for box in skip_boxes):
                    dark = False
            if dark and start < 0:
                start = col
            elif not dark and start >= 0:
                rect = [start * sx, y0, col * sx, y1]
                entries.append(
                    {"rect": rect, "type": "f", "width": 0, "fill": [0, 0, 0], "stroke": None, "clip": None,
                     "fillOpacity": 1, "polylines": [], "synthetic": "raster-ink"}
                )
                start = -1
    return entries


def extract_drawings(
    pdf_path: Path,
    page_indices: list[int],
    *,
    obstacle_boxes: dict[int, list[Box]] | None = None,
    text_boxes: dict[int, list[Box]] | None = None,
) -> dict[str, dict]:
    """{"<页号>": {width, height, drawings, images, words, raster}}，只含 page_indices 里的页。

    obstacle_boxes：每页已知的障碍物框（不翻译的块：图、表、公式、页眉页脚……），落在里面的
    路径合并成一个墨迹矩形；text_boxes：每页译文块的框。扫描页（raster=True）额外从渲染图
    里找墨迹（框外的题框、表格线等），以实心障碍物的形式放进 drawings。
    """
    out: dict[str, dict] = {}
    with fitz.open(pdf_path) as doc:
        for index in page_indices:
            if not 0 <= int(index) < len(doc):
                continue
            page = doc[int(index)]
            obstacles = list((obstacle_boxes or {}).get(int(index), []))
            texts = list((text_boxes or {}).get(int(index), []))
            images = [[b[0], b[1], b[2], b[3]] for b in (info["bbox"] for info in page.get_image_info())]
            words = [[round(w[0], 2), round(w[1], 2), round(w[2], 2), round(w[3], 2)] for w in page.get_text("words")]
            drawings = _collapse_into_obstacles(_page_drawings(page, obstacles), obstacles)
            raster = _is_raster_page(page)
            if raster:
                drawings.extend(_raster_ink(page, texts + obstacles))
            out[str(int(index))] = {
                "width": page.rect.width,
                "height": page.rect.height,
                "drawings": drawings,
                "images": images,
                "words": words,
                "raster": raster,
            }
    return out


__all__ = ["extract_drawings"]

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


def _page_drawings(page: fitz.Page) -> list[dict]:
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
        fill = drawing.get("fill")
        color = drawing.get("color")
        entries.append(
            {
                "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
                "type": drawing.get("type") or "",
                "width": drawing.get("width") or 0,
                "fill": list(fill) if fill is not None else None,
                "stroke": list(color) if color is not None else None,
                "clip": [clip.x0, clip.y0, clip.x1, clip.y1] if clip is not None else None,
                "fillOpacity": drawing.get("fill_opacity"),
                "polylines": [[[round(x, 2), round(y, 2)] for x, y in segment] for segment in segments],
            }
        )
    return entries


def extract_drawings(pdf_path: Path, page_indices: list[int]) -> dict[str, dict]:
    """{"<页号>": {width, height, drawings, images, words}}，只含 page_indices 里的页。"""
    out: dict[str, dict] = {}
    with fitz.open(pdf_path) as doc:
        for index in page_indices:
            if not 0 <= int(index) < len(doc):
                continue
            page = doc[int(index)]
            images = [[b[0], b[1], b[2], b[3]] for b in (info["bbox"] for info in page.get_image_info())]
            words = [[round(w[0], 2), round(w[1], 2), round(w[2], 2), round(w[3], 2)] for w in page.get_text("words")]
            out[str(int(index))] = {
                "width": page.rect.width,
                "height": page.rect.height,
                "drawings": _page_drawings(page),
                "images": images,
                "words": words,
            }
    return out


__all__ = ["extract_drawings"]

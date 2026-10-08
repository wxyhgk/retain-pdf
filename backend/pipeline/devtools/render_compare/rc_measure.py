"""从成品 PDF 上量每块译文：行数、文字矩形、块间文字重叠。两条路线用同一套几何方法。

方法（参考 retain-pdf-rendering 的 experiments/typeset/run-retain.js drift 检查与 retain_sizes.py）：
- 只取可见的思源宋体 span（字体名含 SourceHanSerif、alpha > 0）。rpr 的透明 LaTeX 复制层
  alpha = 0，公式字形（Typst 的 NewCMMath、rpr 的 MathJax 路径）不计；
- span 归属：基线点 (中心 x, 基线 y) 落在哪个块的 content_rect 里（外扩 1pt，多块命中取面积最小），
  落不进任何框的、在某块框底下 1.5 个字号以内且横向重叠的，算作该块溢出的行；
- 行数：块内 span 按基线聚类（相邻基线差 > 0.3 × 字号算新行）；
- 文字重叠：整页每个行片段取 [基线 - 0.75 × 字号, 基线 + 0.12 × 字号] 的墨迹近似框，两个行片段相交
  （宽、高都 > 0.5pt；同一基线的两段要横向叠进 0.25 字号以上）记一处（不按块归属，溢出压进下一块的行也能抓到）。
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from dataclasses import field

import fitz

INK_ASCENT_EM = 0.75
INK_DESCENT_EM = 0.12
OVERLAP_MIN_PT = 0.5
BASELINE_GAP_EM = 0.3
OVERFLOW_REACH_EM = 1.5


@dataclass
class BlockMeasure:
    item_id: str
    page: int  # 0-based
    lines: int = 0
    font_size: float = 0.0
    line_rects: list[tuple[float, float, float, float]] = field(default_factory=list)
    below_box_lines: int = 0

    def as_dict(self) -> dict:
        return {
            "item_id": self.item_id,
            "page": self.page + 1,
            "lines": self.lines,
            "font_size": round(self.font_size, 2),
            "below_box_lines": self.below_box_lines,
        }


def _visible_cjk_spans(page: fitz.Page) -> list[dict]:
    spans = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                if not span["text"].strip():
                    continue
                if "SourceHanSerif" not in span["font"] and "NotoSerifCJK" not in span["font"]:
                    continue
                if span.get("alpha", 255) == 0:
                    continue
                spans.append(span)
    return spans


def _assign(spans: list[dict], rects: dict[str, tuple]) -> dict[str, list[tuple[dict, bool]]]:
    """span → item_id；第二个值表示这一行在框外（框底下）。"""
    assigned: dict[str, list[tuple[dict, bool]]] = {}
    items = list(rects.items())
    for span in spans:
        x = (span["bbox"][0] + span["bbox"][2]) / 2
        y = span["origin"][1]
        hits = [
            (item_id, rect)
            for item_id, rect in items
            if rect[0] - 1 <= x <= rect[2] + 1 and rect[1] - 1 <= y <= rect[3] + 1
        ]
        below = False
        if not hits:
            reach = OVERFLOW_REACH_EM * span["size"]
            hits = [
                (item_id, rect)
                for item_id, rect in items
                if rect[0] - 1 <= x <= rect[2] + 1 and rect[3] < y <= rect[3] + reach
            ]
            # 框底下：取离框底最近的那块
            hits.sort(key=lambda hit: y - hit[1][3])
            hits = hits[:1]
            below = True
        if not hits:
            continue
        hits.sort(key=lambda hit: (hit[1][2] - hit[1][0]) * (hit[1][3] - hit[1][1]))
        assigned.setdefault(hits[0][0], []).append((span, below))
    return assigned


def measure_pdf(pdf_path, rects_by_page: dict[int, dict[str, tuple]]) -> dict[str, BlockMeasure]:
    """rects_by_page: {0-based 页号: {item_id: (x0, y0, x1, y1)}}。返回 {item_id: BlockMeasure}。"""
    out: dict[str, BlockMeasure] = {}
    doc = fitz.open(pdf_path)
    try:
        for page_index, rects in rects_by_page.items():
            if page_index >= len(doc) or not rects:
                continue
            spans = _visible_cjk_spans(doc[page_index])
            for item_id, members in _assign(spans, rects).items():
                size = statistics.median(span["size"] for span, _ in members)
                rows: list[dict] = []
                for span, below in sorted(members, key=lambda m: m[0]["origin"][1]):
                    y = span["origin"][1]
                    if not rows or y - rows[-1]["y"] > BASELINE_GAP_EM * size:
                        rows.append({"y": y, "x0": span["bbox"][0], "x1": span["bbox"][2], "size": span["size"], "below": below})
                    else:
                        row = rows[-1]
                        row["x0"] = min(row["x0"], span["bbox"][0])
                        row["x1"] = max(row["x1"], span["bbox"][2])
                        row["size"] = max(row["size"], span["size"])
                        row["below"] = row["below"] and below
                measure = BlockMeasure(item_id=item_id, page=page_index, lines=len(rows), font_size=size)
                measure.below_box_lines = sum(1 for row in rows if row["below"])
                measure.line_rects = [
                    (row["x0"], row["y"] - INK_ASCENT_EM * row["size"], row["x1"], row["y"] + INK_DESCENT_EM * row["size"])
                    for row in rows
                ]
                out[item_id] = measure
    finally:
        doc.close()
    return out


def _page_rows(page: fitz.Page) -> list[dict]:
    """整页可见思源宋体文字按 (行, 基线) 切成行片段：PyMuPDF 的 line 内再按基线拆开。"""
    rows: list[dict] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                if not span["text"].strip() or span.get("alpha", 255) == 0:
                    continue
                if "SourceHanSerif" not in span["font"] and "NotoSerifCJK" not in span["font"]:
                    continue
                y, size = span["origin"][1], span["size"]
                for row in rows:
                    if row["line"] is line and abs(row["y"] - y) <= BASELINE_GAP_EM * size:
                        row["x0"] = min(row["x0"], span["bbox"][0])
                        row["x1"] = max(row["x1"], span["bbox"][2])
                        row["size"] = max(row["size"], size)
                        row["text"] += span["text"]
                        break
                else:
                    rows.append({"line": line, "y": y, "x0": span["bbox"][0], "x1": span["bbox"][2], "size": size, "text": span["text"]})
    return rows


def _owner(row: dict, rects: dict[str, tuple]) -> str:
    x = (row["x0"] + row["x1"]) / 2
    hits = [(i, r) for i, r in rects.items() if r[0] - 1 <= x <= r[2] + 1 and r[1] - 1 <= row["y"] <= r[3] + 1]
    hits.sort(key=lambda hit: (hit[1][2] - hit[1][0]) * (hit[1][3] - hit[1][1]))
    return hits[0][0] if hits else ""


def text_overlaps(pdf_path, rects_by_page: dict[int, dict[str, tuple]]) -> list[dict]:
    """整页上两个行片段的墨迹近似框相交（宽、高都 > 0.5pt）记一处文字重叠。

    不依赖「这行属于哪块」：溢出的行压到下一块里时，归属会被框吸走，按块两两求交会漏掉。
    记录里的 a / b 是两行基线点所在的块（框外的行记空串），只用于定位。
    """
    found = []
    doc = fitz.open(pdf_path)
    try:
        for page_index in range(len(doc)):
            rows = _page_rows(doc[page_index])
            boxes = [
                (row, (row["x0"], row["y"] - INK_ASCENT_EM * row["size"], row["x1"], row["y"] + INK_DESCENT_EM * row["size"]))
                for row in rows
            ]
            rects = rects_by_page.get(page_index, {})
            for i, (ra, ba) in enumerate(boxes):
                for rb, bb in boxes[i + 1 :]:
                    w = min(ba[2], bb[2]) - max(ba[0], bb[0])
                    h = min(ba[3], bb[3]) - max(ba[1], bb[1])
                    # 同一基线上的两个行片段：只有横向叠进去四分之一个字以上才算（避免相邻片段贴边误报）
                    same_baseline = abs(ra["y"] - rb["y"]) <= BASELINE_GAP_EM * min(ra["size"], rb["size"])
                    min_w = 0.25 * min(ra["size"], rb["size"]) if same_baseline else OVERLAP_MIN_PT
                    if w > min_w and h > OVERLAP_MIN_PT:
                        found.append({
                            "page": page_index + 1,
                            "a": _owner(ra, rects),
                            "b": _owner(rb, rects),
                            "w": round(w, 2),
                            "h": round(h, 2),
                            "text_a": ra["text"][:24],
                            "text_b": rb["text"][:24],
                        })
    finally:
        doc.close()
    return found


def render_page_png(pdf_path, page_index: int, dpi: int, clip=None):
    """返回 PIL.Image。"""
    from PIL import Image

    doc = fitz.open(pdf_path)
    try:
        page = doc[page_index]
        pix = page.get_pixmap(dpi=dpi, clip=fitz.Rect(*clip) if clip else None, alpha=False)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    finally:
        doc.close()


def page_count(pdf_path) -> int:
    doc = fitz.open(pdf_path)
    try:
        return len(doc)
    finally:
        doc.close()


def page_size(pdf_path, page_index: int) -> tuple[float, float]:
    doc = fitz.open(pdf_path)
    try:
        rect = doc[page_index].rect
        return rect.width, rect.height
    finally:
        doc.close()

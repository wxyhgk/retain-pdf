"""排完以后查公式：译文 PDF 上看得见的 LaTeX（`\\frac`、`^{`……）就是没排成公式的地方。

两个来源，都对到译文条目：

- 引擎自己报的 MathJax 失败（报告 ``math.failed`` 的 tex）：按 tex 找包含它的条目；
- 最终 PDF 上看得见的文字里有 LaTeX 命令：``$`` 不成对、根本没被认成公式的引擎看不见也不报
  （2026-11-02 481 页的书第 379 页，报告写着 2297 个公式、0 个失败，页面上印着一大段 LaTeX）。
  引擎给每个公式配一层隐形的 LaTeX 供复制（文字渲染模式 3），那一层不算。按文字找条目，找不到按框找。

查出来的条目由渲染器改成保留原文、让引擎重排一次（别的块会让开它），再用这里的
``restore_original_regions`` 把原件的那一块盖回去：宁可这一块是原文，也不印一堆 LaTeX、不盖掉原来的图。
481 页查一遍不到 1 秒。
"""

from __future__ import annotations

import re
from pathlib import Path

import fitz

# 看得见的文字里出现这些就是没排成公式：反斜杠命令（两个字母以上，`\,` 之类不算）、带花括号的上下标。
# 单独的 `$` 不算：价格（$22.00）、FORTRAN 续行符都是原文里本来就有的。
LATEX_MARKER_RE = re.compile(r"\\[A-Za-z]{2,}|\^\{|_\{")
INVISIBLE_TEXT = 3

REASON_MATHJAX = "mathjax_failed"
REASON_VISIBLE = "visible_latex"


def visible_latex_spans(page: fitz.Page) -> list[tuple[fitz.Rect, str]]:
    """这一页看得见的、带 LaTeX 命令的文字片段（隐形的复制层、全透明的不算）。"""
    spans: list[tuple[fitz.Rect, str]] = []
    for span in page.get_texttrace():
        if span.get("type") == INVISIBLE_TEXT or span.get("opacity", 1) == 0:
            continue
        text = "".join(chr(char[0]) for char in span.get("chars") or ())
        if LATEX_MARKER_RE.search(text):
            spans.append((fitz.Rect(span["bbox"]), text.strip()))
    return spans


def _squash(text: str) -> str:
    return re.sub(r"\s+", "", str(text or ""))


def _overlap(a: fitz.Rect, b: fitz.Rect) -> float:
    inter = fitz.Rect(a) & b
    return 0.0 if inter.is_empty else inter.width * inter.height


def failed_formula_items(
    output_pdf: Path,
    *,
    output_pages: dict[int, int],
    items: list[dict],
    bboxes: dict[str, list[float]],
    mathjax_failed: list[dict],
) -> dict[str, list[str]]:
    """{条目编号: [原因…]}。

    ``output_pages``：译文 PDF 的第几页（0 起）→ 原文页号；``items``：交给引擎的条目（``translated_text`` 是
    引擎文本，空的不查）；``bboxes``：条目编号 → 原文框（点，左上原点）。
    """
    candidates = [item for item in items if str(item.get("translated_text") or "").strip()]
    texts = {str(item.get("item_id") or ""): _squash(item.get("translated_text")) for item in candidates}
    reasons: dict[str, list[str]] = {}

    def mark(item_id: str, reason: str) -> None:
        if item_id and reason not in reasons.setdefault(item_id, []):
            reasons[item_id].append(reason)

    for entry in mathjax_failed:
        tex = _squash(entry.get("tex") if isinstance(entry, dict) else "")
        if not tex:
            continue
        for item_id, text in texts.items():
            if tex in text:
                mark(item_id, REASON_MATHJAX)

    by_page: dict[int, list[dict]] = {}
    for item in candidates:
        by_page.setdefault(int(item.get("page_idx") or 0), []).append(item)
    with fitz.open(output_pdf) as document:
        for output_index, page_idx in output_pages.items():
            page_items = by_page.get(page_idx) or []
            if not page_items or output_index >= document.page_count:
                continue
            for rect, text in visible_latex_spans(document[output_index]):
                key = _squash(text)
                matched = [item for item in page_items if key and key in texts[str(item.get("item_id") or "")]]
                if not matched:
                    boxed = [
                        (_overlap(rect, fitz.Rect(bboxes[item_id])), item_id)
                        for item_id in (str(item.get("item_id") or "") for item in page_items)
                        if len(bboxes.get(item_id) or []) == 4
                    ]
                    best = max(boxed, default=(0.0, ""))
                    matched = [{"item_id": best[1]}] if best[0] > 0 else []
                for item in matched:
                    mark(str(item.get("item_id") or ""), REASON_VISIBLE)
    return reasons


def restore_original_regions(output_pdf: Path, original_pdf: Path, regions: list[tuple[int, int, list[float]]]) -> int:
    """把原件的这些块盖回译文 PDF：(译文 PDF 第几页, 原件第几页, 框)。返回盖了几块。

    这些块在重排时已经是保留元素，别的块不会排进来，所以直接把原件那一块画在最上面就行：
    扫描件盖回原图，电子版补回底图里去掉的原文。
    """
    if not regions:
        return 0
    restored = 0
    with fitz.open(original_pdf) as original, fitz.open(output_pdf) as output:
        for output_index, source_index, bbox in regions:
            if output_index >= output.page_count or source_index >= original.page_count:
                continue
            rect = fitz.Rect(bbox) & output[output_index].rect
            if rect.is_empty:
                continue
            output[output_index].show_pdf_page(rect, original, source_index, clip=rect)
            restored += 1
        temporary = output_pdf.with_name(output_pdf.name + ".restore.pdf")
        output.save(temporary, garbage=3, deflate=True)
    temporary.replace(output_pdf)
    return restored


__all__ = [
    "LATEX_MARKER_RE",
    "REASON_MATHJAX",
    "REASON_VISIBLE",
    "failed_formula_items",
    "restore_original_regions",
    "visible_latex_spans",
]

"""标题的原文字号：标题译文用原文的字号排，排不下才缩小，不再撑满框（2026-11-09）。

以前标题的字号按框定：在框里找塞得下译文的最大字号（最多放到估算字号的 2.6 倍）。框的高度是「原文字号 × 原文行数」
定的，译成中文行数变少，字就被放大去填满：原文两行、译文一行时放大将近一倍。3 本书实测，译文行数比原文少的标题全都放大了，
最多 2.29 倍；行数没变的也偏大（Handbook 那本中位数大 24%）。估算字号本身从 OCR 行高量（OCR 常把两行标题报成一行，
量出来的是整个框高），又封顶在 14.2pt，量不准，所以才用框去凑。

字号是原文字形的大小，和框无关，所以先量原文字号：

- 原文 PDF 有文字层（论文、电子书）：框里文字的字号，按字数取中位数（`from=pdf`）。框里的字和原文对不上（扫描件
  OCR 出来的文字层错位、框里没字）就不用。
- 没有文字层：把原文在原来的框里按现有的字宽估算排一遍，取塞得下的最大字号（`from=fit`）。原文正好填满了这个框，
  反推出来的就是原文字号。拿有文字层的书对过答案：两篇论文中位数差 1–2%，Handbook 那本大约大 10%。

量好的写进条目的 ``source_font_size_pt`` / ``source_font_size_from``，Typst 路线（``title_binary_fit``）和
rpr_fit 引擎（随译文条目传过去）用同一个值：标题字号不超过它，排不下照旧往小缩。
"""

from __future__ import annotations

from pathlib import Path
from statistics import median

import fitz

from retainpdf_pipeline.render.layout.payload.capacity import estimated_required_lines
from retainpdf_pipeline.render.semantics.item_view import is_title_like_block

SOURCE_FONT_SIZE_KEY = "source_font_size_pt"
SOURCE_FONT_SIZE_FROM_KEY = "source_font_size_from"
# 退路反推时原文的行距（em）：0.15–0.35 试过，对答案的结果差不到 1%
FALLBACK_LEADING_EM = 0.25
FALLBACK_MIN_PT = 3.0
FALLBACK_MAX_PT = 96.0
FALLBACK_ITERATIONS = 30
# 文字层里框中的字数和原文字数之比在这个范围外，就当文字层和 OCR 对不上
TEXT_LAYER_CHAR_RATIO_MIN = 0.5
TEXT_LAYER_CHAR_RATIO_MAX = 2.0


def _visible_chars(text: str) -> int:
    return sum(1 for char in str(text or "") if not char.isspace())


def _bbox(item: dict) -> list[float] | None:
    bbox = item.get("bbox")
    if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
        return None
    try:
        values = [float(value) for value in bbox]
    except (TypeError, ValueError):
        return None
    if values[2] <= values[0] or values[3] <= values[1]:
        return None
    return values


def text_layer_font_size_pt(spans: list[tuple[list[float], float, str]], item: dict) -> float | None:
    """框里文字层的字号：中心落在框里的 span，按字数取中位数。框里的字数和原文对不上返回 None。"""
    bbox = _bbox(item)
    if bbox is None:
        return None
    weighted: list[float] = []
    for span_bbox, size, text in spans:
        cx = (span_bbox[0] + span_bbox[2]) / 2
        cy = (span_bbox[1] + span_bbox[3]) / 2
        if not (bbox[0] <= cx <= bbox[2] and bbox[1] <= cy <= bbox[3]) or size <= 0:
            continue
        weighted.extend([size] * _visible_chars(text))
    source_chars = _visible_chars(item.get("source_text") or "")
    if not weighted or source_chars <= 0:
        return None
    ratio = len(weighted) / source_chars
    if not TEXT_LAYER_CHAR_RATIO_MIN <= ratio <= TEXT_LAYER_CHAR_RATIO_MAX:
        return None
    return round(float(median(weighted)), 2)


def fitted_source_font_size_pt(item: dict) -> float | None:
    """没有文字层时：原文按现有的字宽估算塞回原来的框，塞得下的最大字号。"""
    bbox = _bbox(item)
    text = str(item.get("source_text") or "").strip()
    if bbox is None or not text:
        return None
    height = bbox[3] - bbox[1]
    low, high, best = FALLBACK_MIN_PT, FALLBACK_MAX_PT, None
    for _ in range(FALLBACK_ITERATIONS):
        mid = (low + high) / 2
        lines = estimated_required_lines(bbox, text, [], mid)
        # n 行：n 个字高加 n-1 个行距
        needed = lines * mid + (lines - 1) * mid * FALLBACK_LEADING_EM
        if needed <= height:
            best, low = mid, mid
        else:
            high = mid
    return round(best, 2) if best is not None else None


def title_source_font_size_pt(item: dict) -> float | None:
    """标题的原文字号：量好的（``annotate_title_source_font_sizes``）优先，没量过就现场反推。不是标题返回 None。"""
    if not is_title_like_block(item):
        return None
    try:
        measured = float(item.get(SOURCE_FONT_SIZE_KEY) or 0.0)
    except (TypeError, ValueError):
        measured = 0.0
    if measured > 0:
        return measured
    return fitted_source_font_size_pt(item)


def _page_spans(page: fitz.Page) -> list[tuple[list[float], float, str]]:
    spans: list[tuple[list[float], float, str]] = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = str(span.get("text") or "")
                if text.strip():
                    spans.append((list(span.get("bbox") or [0, 0, 0, 0]), float(span.get("size") or 0.0), text))
    return spans


def annotate_title_source_font_sizes(translated_pages: dict[int, list[dict]], source_pdf_path: Path | str | None) -> dict[str, int]:
    """给每个标题条目写上原文字号（原地改）。只读有标题的页的文字层；读不了 PDF 就全部按框反推。"""
    stats = {"pdf": 0, "fit": 0, "none": 0}
    title_pages = {
        int(page_idx): [item for item in items or [] if isinstance(item, dict) and is_title_like_block(item)]
        for page_idx, items in translated_pages.items()
    }
    title_pages = {page_idx: items for page_idx, items in title_pages.items() if items}
    if not title_pages:
        return stats
    document = None
    if source_pdf_path is not None and Path(source_pdf_path).is_file():
        try:
            document = fitz.open(source_pdf_path)
        except Exception as exc:  # noqa: BLE001 - 读不了就全部走退路
            print(f"title source font: cannot open {source_pdf_path}: {type(exc).__name__}: {exc}", flush=True)
    try:
        for page_idx, items in sorted(title_pages.items()):
            spans: list[tuple[list[float], float, str]] = []
            if document is not None and 0 <= page_idx < len(document):
                try:
                    spans = _page_spans(document[page_idx])
                except Exception as exc:  # noqa: BLE001 - 这一页走退路
                    print(f"title source font: page {page_idx + 1} text layer failed: {type(exc).__name__}: {exc}", flush=True)
            for item in items:
                size = text_layer_font_size_pt(spans, item) if spans else None
                origin = "pdf"
                if size is None:
                    size, origin = fitted_source_font_size_pt(item), "fit"
                if size is None:
                    stats["none"] += 1
                    continue
                item[SOURCE_FONT_SIZE_KEY] = size
                item[SOURCE_FONT_SIZE_FROM_KEY] = origin
                stats[origin] += 1
    finally:
        if document is not None:
            document.close()
    return stats


__all__ = [
    "SOURCE_FONT_SIZE_FROM_KEY",
    "SOURCE_FONT_SIZE_KEY",
    "annotate_title_source_font_sizes",
    "fitted_source_font_size_pt",
    "text_layer_font_size_pt",
    "title_source_font_size_pt",
]

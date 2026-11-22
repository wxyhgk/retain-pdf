"""表格译文放回译文 PDF（表格翻译 T5：整表按原表的框重排，2026-11-22）。

表格翻译（T3）把每格译文写在 ``tables.v1.json``，阅读页（T4）读它；正文渲染（rpr_fit、Typst 两条路线）把表格当保留元素
不碰，所以译文 PDF 里的表格一直是原文。这里在排好的译文 PDF 上把整张表重排一遍：

1. 核对：原文这张表的格子，在译文 PDF 那一页对应位置读出来的字要和原文一致；对上的不到一半整张不动（页码对错、
   文字层被挪过都不会擦错地方）。
2. 量原表：字号（格子字号的中位数）、表头是不是粗体、每列左/中/右对齐、行距（反推格子上下内边距）、
   表格线（只有横线按三线表，线宽取原表的；有竖线画全框）、文字颜色。
3. 排版：交给正文同一个 rpr 引擎的表格排版（``rpr-table.js``，像 HTML ``<table>`` 那样：列宽按内容自动分、跨行跨列、
   格子里折行，和正文同一套中文折行），按原表的宽度排，从原文字号往下找排得进原表高度的最大字号（最多缩到 0.7 倍）。
   翻了的格子用译文，没翻的（数字、代号）照抄原文；``<sup>``/``<sub>`` 转成公式上下标。
4. 换上：排进了的表，擦掉原表框里的字和表格线（不填底色、图片不动），把引擎画的那一层叠上去（字嵌子集字体）。
   排不进的表不动（以后交给排版 agent，见 docs/ops/planning/layout-agent/）；引擎用不了（没有 node、缺依赖）也不动。

出错只记一笔，照常交出排好的 PDF（和挪链接一样，见 ``render/workflow/executor.py``）。
"""

from __future__ import annotations

import json
import os
import re
import statistics
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import fitz

# 和翻译阶段写的文件名一致（stage-decouple：渲染不 import 翻译包）
TABLES_FILE_NAME = "tables.v1.json"
TABLES_SCHEMA = "tables.v1"
ENGINE_INPUT_SCHEMA = "rpr_table_input_v1"
# 字号最多缩到原文的这么多倍；再排不进这张表就不动
TABLE_MIN_SCALE = 0.7
LINE_HEIGHT = 1.2
# 量不出原表行距时格子的上下内边距（pt）
DEFAULT_PADDING_PT = 1.5
# 一列格子左/中/右边缘的离散度在这个范围内算对齐（pt）
ALIGN_TOLERANCE_PT = 2.0
# 原表的线可能压在框边外一点：擦线、找线时框往外放这么多
RULE_MARGIN_PT = 2.0
# 核对：对得上的格子不到这个比例，整张不动
MIN_MATCHED_RATIO = 0.5
ENGINE_TIMEOUT_SECONDS = 300

_TAG_RE = re.compile(r"<(sup|sub)>(.*?)</\1>", re.I | re.S)
_ANY_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
_SCRIPT_SAFE_RE = re.compile(r"^[0-9A-Za-z+\-−–.,*′″'° ]+$")


@dataclass
class TableStyle:
    font_size: float
    header_bold: bool
    header_rows: int
    aligns: list[str]
    rules: dict
    padding: float
    color: tuple[float, float, float]


def _normalize(text: str) -> str:
    """核对用：去标签、空白，统一几个常见的替身字符（文字层的减号、连字和 OCR 不一样）。"""
    text = _ANY_TAG_RE.sub("", str(text or ""))
    for src, dst in (("−", "-"), ("–", "-"), ("—", "-"), ("ﬁ", "fi"), ("ﬂ", "fl")):
        text = text.replace(src, dst)
    return re.sub(r"\s+", "", text).casefold()


def load_translated_tables(translations_dir: Path) -> list[dict]:
    path = Path(translations_dir) / TABLES_FILE_NAME
    if not path.is_file():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schema") != TABLES_SCHEMA:
        return []
    tables = []
    for table in payload.get("tables") or []:
        model = table.get("model") or {}
        result = table.get("result") or {}
        if result.get("status") != "translated" or model.get("source_kind") != "text_layer":
            continue
        tables.append(table)
    return tables


def cell_markup(text: str) -> str:
    """格子文字 → 引擎的文字：``<sup>x</sup>``/``<sub>x</sub>`` 转成公式上下标，其余标签去掉。"""

    def script(match: re.Match) -> str:
        inner = _ANY_TAG_RE.sub("", match.group(2)).strip()
        if not inner:
            return ""
        if not _SCRIPT_SAFE_RE.match(inner):
            return inner
        tex = inner.replace("−", "-").replace("–", "-").replace("°", "^{\\circ}")
        return f"$^{{{tex}}}$" if match.group(1).lower() == "sup" else f"$_{{{tex}}}$"

    return _ANY_TAG_RE.sub("", _TAG_RE.sub(script, str(text or ""))).strip()


def _span_is_bold(span: dict) -> bool:
    return bool(int(span.get("flags") or 0) & 16) or bool(re.search(r"bold|black|heavy|semibold", str(span.get("font") or ""), re.I))


def _rgb(value: int) -> tuple[float, float, float]:
    value = int(value or 0)
    return (((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)


def _text_in(page: fitz.Page, rect: fitz.Rect) -> tuple[str, bool, tuple[float, float, float]]:
    """框里现有的字、是不是粗体（按字数过半）、第一段字的颜色。"""
    texts: list[str] = []
    bold_chars = 0
    color = None
    for block in page.get_text("dict", clip=rect).get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = span.get("text", "")
                if not text.strip():
                    continue
                texts.append(text)
                if _span_is_bold(span):
                    bold_chars += len(text.strip())
                if color is None:
                    color = _rgb(span.get("color"))
    joined = "".join(texts)
    return joined, bold_chars * 2 > len(re.sub(r"\s+", "", joined)), color or (0.0, 0.0, 0.0)


def _column_align(rects: list[fitz.Rect]) -> str:
    if len(rects) < 2:
        return "left"
    spreads = {
        "left": max(r.x0 for r in rects) - min(r.x0 for r in rects),
        "center": max((r.x0 + r.x1) / 2 for r in rects) - min((r.x0 + r.x1) / 2 for r in rects),
        "right": max(r.x1 for r in rects) - min(r.x1 for r in rects),
    }
    best = min(spreads, key=lambda key: (spreads[key], ["left", "center", "right"].index(key)))
    return best if spreads[best] <= ALIGN_TOLERANCE_PT else "left"


def _rules(page: fitz.Page, rect: fitz.Rect) -> dict:
    """原表的线：只有横线按三线表（上、表头下、下三条的线宽），有竖线画全框。

    线是零高度的矩形，不能用 Rect.intersects 判断。"""
    outer = rect + (-RULE_MARGIN_PT, -RULE_MARGIN_PT, RULE_MARGIN_PT, RULE_MARGIN_PT)
    horizontal: list[tuple[float, float]] = []
    vertical = 0
    for drawing in page.get_drawings():
        box = fitz.Rect(drawing["rect"])
        if box.x1 < outer.x0 or box.x0 > outer.x1 or box.y1 < outer.y0 or box.y0 > outer.y1:
            continue
        width = float(drawing.get("width") or 0.0)
        if box.height <= 2.0 and box.width > rect.width * 0.5:
            horizontal.append(((box.y0 + box.y1) / 2, width or box.height or 0.5))
        elif box.width <= 2.0 and box.height > 4.0:
            vertical += 1
    horizontal.sort()
    if vertical >= 2:
        return {"kind": "grid", "mid": round(min((w for _, w in horizontal), default=0.5), 2)}
    if not horizontal:
        return {"kind": "none"}
    top, bottom = horizontal[0][1], horizontal[-1][1]
    mid = horizontal[1][1] if len(horizontal) > 2 else min(top, 0.5)
    rules = {"kind": "booktabs", "top": round(top, 2), "mid": round(mid, 2), "bottom": round(bottom, 2)}
    if len(horizontal) > 2:
        rules["mid_y"] = round(horizontal[1][0], 2)  # 表头下线的位置：定表头有几行用，不传给引擎
    return rules


def _padding_from_pitch(cells: list[dict], size: float) -> float:
    """原表相邻两行（都是一行字的行）的行距 → 格子上下内边距（引擎里一行字的行高 = 字号 + 2 × 内边距）。"""
    tops: dict[int, list[float]] = {}
    single: dict[int, bool] = {}
    for cell in cells:
        row = int(cell.get("row") or 0)
        rect = fitz.Rect(cell["bbox"])
        tops.setdefault(row, []).append(rect.y0)
        single[row] = single.get(row, True) and rect.height < size * 1.6 and int(cell.get("rowspan") or 1) == 1
    pitches = [
        min(tops[row + 1]) - min(tops[row])
        for row in sorted(tops)
        if row + 1 in tops and single.get(row) and single.get(row + 1)
    ]
    if not pitches:
        return DEFAULT_PADDING_PT
    return round(max(0.5, min((statistics.median(pitches) - size) / 2, size)), 2)


def _header_rows(cells: list[dict], *, mid_y: float | None, bold_rows: set[int]) -> set[int]:
    """表头有哪几行。按可靠程度：原表三线表的表头下线（线以上的行）→ 从第一行起连续的粗体行 →
    表格模型标的 header（从第一行往下整行都是 header 的行）。模型的 header 不太准：全是文字的表会把前几行都标成 header。"""
    by_row: dict[int, list[dict]] = {}
    for cell in cells:
        by_row.setdefault(int(cell.get("row") or 0), []).append(cell)
    if mid_y is not None:
        rows = {row for row, members in by_row.items() if min(fitz.Rect(c["bbox"]).y0 for c in members if c.get("bbox")) < mid_y}
        if rows and rows != set(by_row):
            return rows
    rows = set()
    for row in sorted(by_row):
        if row not in bold_rows:
            break
        rows.add(row)
    if rows and rows != set(by_row):
        return rows
    rows = set()
    for row in sorted(by_row):
        if not all(cell.get("role") == "header" for cell in by_row[row]):
            break
        rows.add(row)
    return rows or {0}


def measure_table(page: fitz.Page, table: dict) -> tuple[TableStyle | None, dict]:
    """核对原表、量出原表的样式。核对不过返回 (None, 原因)。"""
    model = table["model"]
    translations = (table.get("result") or {}).get("cells") or {}
    cells = [c for c in model.get("cells") or [] if c.get("bbox") and str(c.get("text") or "").strip()]
    matched = 0
    colors = []
    bold_votes: dict[int, list[bool]] = {}
    for cell in cells:
        on_page, bold, color = _text_in(page, fitz.Rect(cell["bbox"]))
        if on_page and _normalize(on_page) == _normalize(cell.get("text")):
            matched += 1
            colors.append(color)
            bold_votes.setdefault(int(cell.get("row") or 0), []).append(bold)
    rules = _rules(page, fitz.Rect(model.get("bbox") or table.get("bbox")))
    bold_rows = {row for row, votes in bold_votes.items() if sum(votes) * 2 > len(votes)}
    header_rows = _header_rows(cells, mid_y=rules.pop("mid_y", None), bold_rows=bold_rows)
    header_bold_votes = [vote for row in header_rows for vote in bold_votes.get(row, [])]
    translated = sum(1 for c in cells if str((translations.get(c.get("id")) or {}).get("translation") or "").strip())
    stats = {"block_id": table.get("block_id"), "cells": len(cells), "cells_matched": matched, "cells_translated": translated}
    if not translated:
        return None, {**stats, "skipped": "no_translated_cells"}
    if not cells or matched < len(cells) * MIN_MATCHED_RATIO:
        return None, {**stats, "skipped": "text_mismatch"}
    n_cols = int(model.get("n_cols") or 0) or 1 + max(int(c.get("col") or 0) for c in cells)
    aligns = [
        _column_align([
            fitz.Rect(c["bbox"]) for c in cells
            if c.get("col") == col and int(c.get("colspan") or 1) == 1 and int(c.get("row") or 0) not in header_rows
        ])
        for col in range(n_cols)
    ]
    sizes = [float(c["font_size"]) for c in cells if c.get("font_size")]
    size = statistics.median(sizes) if sizes else 10.0
    style = TableStyle(
        font_size=size,
        header_bold=sum(header_bold_votes) * 2 > len(header_bold_votes),
        header_rows=max(header_rows) + 1,
        aligns=aligns,
        rules=rules,
        padding=_padding_from_pitch(cells, size),
        color=statistics.mode(colors) if colors else (0.0, 0.0, 0.0),
    )
    return style, stats


def engine_table(table: dict, style: TableStyle) -> dict:
    """一张表 → 引擎 rpr-table.js 的输入（rpr_table_input_v1 里的一张表）。没翻的格子照抄原文。"""
    model = table["model"]
    translations = (table.get("result") or {}).get("cells") or {}
    cells = []
    for cell in model.get("cells") or []:
        row, col = int(cell.get("row") or 0), int(cell.get("col") or 0)
        translation = str((translations.get(cell.get("id")) or {}).get("translation") or "").strip()
        text = cell_markup(translation or str(cell.get("text") or ""))
        colspan = int(cell.get("colspan") or 1)
        cells.append({
            "row": row, "col": col, "rowspan": int(cell.get("rowspan") or 1), "colspan": colspan, "text": text,
            "bold": style.header_bold and row < style.header_rows,
            "align": "center" if colspan > 1 else style.aligns[col] if col < len(style.aligns) else "left",
        })
    return {
        "id": str(table.get("block_id") or ""),
        "rect": [round(float(v), 3) for v in (model.get("bbox") or table.get("bbox"))],
        "fontSize": round(style.font_size, 2),
        "minFontSize": round(style.font_size * TABLE_MIN_SCALE, 2),
        "lineHeight": LINE_HEIGHT,
        "padding": {"x": round(max(2.0, style.font_size * 0.4), 2), "y": style.padding},
        "color": [round(c, 4) for c in style.color],
        "rules": style.rules,
        "headerRows": style.header_rows,
        "nRows": int(model.get("n_rows") or 0),
        "nCols": int(model.get("n_cols") or 0),
        "cells": cells,
    }


def output_page_indices(source_page_count: int, output_page_count: int, page_indices) -> dict[int, int]:
    """原文页号 → 译文 PDF 页号：页数一样按原页号，不一样（只输出要渲染的页）按顺序排（和挪链接同一个规则）。"""
    indices = sorted(int(page) for page in page_indices)
    if source_page_count == output_page_count:
        return {index: index for index in indices}
    return {index: offset for offset, index in enumerate(indices)}


def run_table_engine(pages: list[dict], work_dir: Path) -> tuple[Path, dict]:
    """rpr 引擎排表：一张表一页（页面大小同译文 PDF 那一页），返回叠加层 PDF 和报告。"""
    from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineFailed
    from retainpdf_pipeline.render.output.rpr.engine_cli import resolve_engine_runtime
    from retainpdf_pipeline.render.output.typst.compiler import _resolved_font_paths

    runtime = resolve_engine_runtime("rpr-table.js")
    input_path = work_dir / "table-input.json"
    out_dir = work_dir / "table-engine"
    input_path.write_text(json.dumps({"schema": ENGINE_INPUT_SCHEMA, "pages": pages}, ensure_ascii=False), encoding="utf-8")
    command = [runtime.node, str(runtime.entry), "--input", str(input_path), "--out-dir", str(out_dir)]
    for font_dir in _resolved_font_paths():
        command.extend(["--font-path", str(font_dir)])
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=ENGINE_TIMEOUT_SECONDS, env=runtime.env(), cwd=str(work_dir))
    except subprocess.TimeoutExpired as exc:
        raise RprEngineFailed("engine_timeout", f"rpr-table 超时（{exc.timeout}s）") from exc
    overlay = out_dir / "overlay.pdf"
    if result.returncode != 0 or not overlay.is_file():
        raise RprEngineFailed("engine_error", f"rpr-table 失败（退出码 {result.returncode}）：{result.stderr.strip()[-500:]}")
    report = json.loads((out_dir / "report.json").read_text(encoding="utf-8"))
    return overlay, report


def _erase(page: fitz.Page, rect: fitz.Rect) -> None:
    """擦掉原表：框里的字（不填底色），以及框里（含框外一点）整条落在里面的线。图片不动。"""
    page.add_redact_annot(rect, fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE)
    page.add_redact_annot(rect + (-RULE_MARGIN_PT, -RULE_MARGIN_PT, RULE_MARGIN_PT, RULE_MARGIN_PT), fill=False)
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED, text=fitz.PDF_REDACT_TEXT_NONE)


def apply_table_translations(
    *,
    output_pdf_path: Path,
    source_pdf_path: Path,
    translations_dir: Path,
    page_indices,
) -> dict:
    tables = load_translated_tables(translations_dir)
    if not tables:
        return {"skipped": "no_translated_tables"}
    selected = {int(page) for page in page_indices}
    with fitz.open(source_pdf_path) as source:
        source_count = len(source)
    output_pdf_path = Path(output_pdf_path)
    with tempfile.TemporaryDirectory(prefix="table-overlay-", dir=str(output_pdf_path.parent)) as work:
        work_dir = Path(work)
        temp_pdf = work_dir / "with-tables.pdf"
        with fitz.open(output_pdf_path) as doc:
            summary = _overlay_document(doc, tables, source_count, selected, work_dir, temp_pdf)
        if summary.get("tables_written"):
            # 先存到旁边，关掉原文件再换掉：存一半出错不留半个文件
            os.replace(temp_pdf, output_pdf_path)
    return summary


def _overlay_document(doc, tables, source_count, selected, work_dir: Path, temp_pdf: Path) -> dict:
    from retainpdf_pipeline.render.output.rpr.engine_cli import RprEngineUnavailable

    results: list[dict] = []
    mapping = output_page_indices(source_count, len(doc), selected)
    pages: list[dict] = []  # 一张表一页
    targets: list[tuple[int, dict, fitz.Rect]] = []
    for table in tables:
        page_index = int((table.get("model") or {}).get("page_index", table.get("page_index", -1)))
        if page_index not in mapping or mapping[page_index] >= len(doc):
            results.append({"block_id": table.get("block_id"), "skipped": "page_not_rendered"})
            continue
        page = doc[mapping[page_index]]
        if page.rotation:
            results.append({"block_id": table.get("block_id"), "skipped": "page_rotated"})
            continue
        style, stats = measure_table(page, table)
        results.append(stats)
        if style is None:
            continue
        spec = engine_table(table, style)
        pages.append({"index": len(pages), "width": round(page.rect.width, 3), "height": round(page.rect.height, 3), "tables": [spec]})
        targets.append((mapping[page_index], stats, fitz.Rect(spec["rect"])))
    summary = {"tables": len(tables), "tables_written": 0, "details": results}
    if not pages:
        return summary
    try:
        overlay_pdf, report = run_table_engine(pages, work_dir)
    except RprEngineUnavailable as exc:
        print(f"table overlay: rpr engine unavailable ({exc}), tables kept", flush=True)
        for _, stats, _ in targets:
            stats["skipped"] = "engine_unavailable"
        return summary
    entries = report.get("tables") or []
    if len(entries) != len(targets):
        raise RuntimeError(f"rpr-table reported {len(entries)} tables, expected {len(targets)}")
    written = 0
    with fitz.open(overlay_pdf) as overlay:
        for index, ((page_number, stats, rect), entry) in enumerate(zip(targets, entries)):
            stats.update({"font_size": entry.get("font_size"), "height": round(float(entry.get("height") or 0), 1), "box_height": round(rect.height, 1)})
            if not entry.get("fits"):
                stats["skipped"] = "does_not_fit"
                continue
            page = doc[page_number]
            _erase(page, rect)
            page.show_pdf_page(page.rect, overlay, index, overlay=True)
            written += 1
    summary["tables_written"] = written
    if written:
        doc.save(str(temp_pdf), garbage=3, deflate=True)
    return summary


__all__ = [
    "TABLES_FILE_NAME",
    "apply_table_translations",
    "cell_markup",
    "engine_table",
    "load_translated_tables",
    "measure_table",
    "output_page_indices",
]

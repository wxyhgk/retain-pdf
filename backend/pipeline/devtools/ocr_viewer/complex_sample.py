"""造一份 2 页、元素很杂的双栏论文 PDF，每个元素按我们自己的分类（`taxonomy.py`）记下标准答案。

用到的类别：页眉、页脚、页码、文档标题、作者、机构、出版信息、摘要、关键词、三级章节标题、段落（中英文、跨栏、跨页）、
列表项、图（单张、两张子图共用一个图注）、图注、表、表题、表注、代码块、代码题注、行间公式和编号、脚注、致谢、参考文献条目；
行内的有行内公式（带上下标）、脚注标记、引用标记。

    python -m devtools.ocr_viewer.complex_sample --out /tmp/complex_paper   # 在 backend/pipeline 下跑

生成 `complex_paper.pdf` 和 `truth.json`。
"""

from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path

import fitz

from devtools.ocr_viewer.sample_layout import SUB
from devtools.ocr_viewer.sample_layout import SUP
from devtools.ocr_viewer.sample_layout import Element
from devtools.ocr_viewer.sample_layout import TextStyle
from devtools.ocr_viewer.sample_layout import block_height
from devtools.ocr_viewer.sample_layout import draw_lines
from devtools.ocr_viewer.sample_layout import font
from devtools.ocr_viewer.sample_layout import r2
from devtools.ocr_viewer.sample_layout import tokenize
from devtools.ocr_viewer.sample_layout import union
from devtools.ocr_viewer.sample_layout import wrap
from devtools.ocr_viewer.taxonomy import BLOCK_CLASSES
from devtools.ocr_viewer.taxonomy import TAXONOMY_VERSION

PAGE_W, PAGE_H = 595.0, 842.0
TOC, P1, P2 = 0, 1, 2  # 第 1 页是目录页（页码 i），正文在第 2、3 页（页码 1、2）
PRINTED_PAGE = {TOC: "i", P1: "1", P2: "2"}
MARGIN_X, TOP, BOTTOM = 54.0, 58.0, 784.0
GUTTER = 16.0
COL_W = (PAGE_W - 2 * MARGIN_X - GUTTER) / 2
INK = (0.1, 0.1, 0.12)
RULE = (0.35, 0.35, 0.38)

BODY = TextStyle("rm", 9.0, 12.2, indent=9.0)
BODY_FIRST = TextStyle("rm", 9.0, 12.2)
ZH_BODY = TextStyle("zh", 8.6, 13.0, indent=17.2)
H1 = TextStyle("bf", 10.5, 13.5)
H2 = TextStyle("bf", 9.4, 12.4)
CAPTION = TextStyle("rm", 8.0, 10.6)
SMALL = TextStyle("rm", 7.4, 9.6)
REF = TextStyle("rm", 7.6, 9.9)


class _PageAccess:
    def __init__(self, pdf: fitz.Document) -> None:
        self._pdf = pdf

    def __getitem__(self, index: int) -> fitz.Page:
        return self._pdf[index]

    def __len__(self) -> int:
        return self._pdf.page_count


@dataclass
class Region:
    page: int
    x: float
    width: float
    y: float
    bottom: float


class SampleDocument:
    def __init__(self) -> None:
        self.pdf = fitz.open()
        for _ in range(3):
            self.pdf.new_page(width=PAGE_W, height=PAGE_H)
        # 加新页会让手里旧的 Page 对象失效，每次都按页号重新取。
        self.pages = _PageAccess(self.pdf)
        self.elements: list[Element] = []
        self._counter: dict[int, int] = {}
        self.flow: list[Region] = []

    # ---- 记录 ----
    def _new_id(self, page: int, key: str | None) -> str:
        if key:
            return key
        self._counter[page] = self._counter.get(page, 0) + 1
        return f"p{page + 1}-{self._counter[page]:02d}"

    def add(self, element: Element) -> Element:
        if element.cls not in BLOCK_CLASSES:
            raise ValueError(f"unknown class {element.cls}")
        self.elements.append(element)
        return element

    # ---- 文字块 ----
    def text(
        self,
        region: Region,
        cls: str,
        content,
        ts: TextStyle,
        *,
        key: str | None = None,
        gap: float = 5.0,
        relations: dict | None = None,
        attributes: dict | None = None,
        lang: str = "en",
        split: bool = False,
    ) -> list[Element]:
        """排一个文字块。`split=True` 时写不下的部分接到下一个区域，后半段记 `continues` 指向前半段。"""
        atoms = tokenize(content, ts.style)
        lines = wrap(atoms, region.width, ts)
        made: list[Element] = []
        start = 0
        current = region
        while start < len(lines):
            room = current.bottom - current.y
            fit = len(lines) - start
            while fit > 0 and block_height(fit, ts) > room:
                fit -= 1
            if fit < len(lines) - start and not split:
                raise RuntimeError(f"{cls} {key or ''} does not fit on page {current.page + 1} (needs {block_height(len(lines) - start, ts):.1f}pt, has {room:.1f}pt)")
            if fit == 0:
                current = self._next_region(current)
                continue
            records, inlines, next_top = draw_lines(
                self.pages[current.page],
                lines[start : start + fit],
                current.x,
                current.y,
                current.width,
                ts,
                first_index=start,
            )
            element_key = key if not made else f"{key}-cont{len(made)}" if key else None
            element = Element(
                id=self._new_id(current.page, element_key),
                cls=cls,
                page=current.page,
                bbox=r2(union([r["bbox"] for r in records])),
                text=_join_lines([r["text"] for r in records], lang),
                lines=records,
                inlines=inlines,
                relations=dict(relations or {}),
                attributes=dict(attributes or {}),
                lang=lang,
            )
            if made:
                element.relations["continues"] = made[-1].id
            made.append(self.add(element))
            current.y = next_top - ts.leading + block_height(1, ts) + gap
            start += fit
            if start < len(lines):
                current = self._next_region(current)
        return made

    def _next_region(self, region: Region) -> Region:
        index = self.flow.index(region)
        if index + 1 >= len(self.flow):
            raise RuntimeError("ran out of columns")
        return self.flow[index + 1]

    # ---- 非文字块 ----
    def rule(self, page: int, x0: float, x1: float, y: float, width: float = 0.6) -> None:
        self.pages[page].draw_line((x0, y), (x1, y), color=RULE, width=width)

    def figure(self, region: Region, height: float, *, key: str, seed: int, panels: int = 1, gap: float = 4.0) -> list[Element]:
        made = []
        panel_gap = 10.0
        panel_w = (region.width - panel_gap * (panels - 1)) / panels
        for index in range(panels):
            x0 = region.x + index * (panel_w + panel_gap)
            rect = fitz.Rect(x0, region.y, x0 + panel_w, region.y + height)
            _draw_plot(self.pages[region.page], rect, seed + index, label=f"({chr(97 + index)})" if panels > 1 else "")
            panel_key = key if panels == 1 else f"{key}{chr(97 + index)}"
            made.append(
                self.add(
                    Element(
                        id=panel_key,
                        cls="figure",
                        page=region.page,
                        bbox=r2(rect),
                        text="",
                        lines=[],
                        attributes={"figure_type": "chart"},
                    )
                )
            )
        region.y += height + gap
        return made

    def table(self, region: Region, rows: list[list[str]], *, key: str, gap: float = 3.0) -> Element:
        page = self.pages[region.page]
        size, row_h = 7.4, 11.0
        widths = [0.40, 0.20, 0.20, 0.20]
        top = region.y
        self.rule(region.page, region.x, region.x + region.width, top, 0.9)
        lines = []
        y = top + 2.0
        for r_index, row in enumerate(rows):
            style = "bf" if r_index == 0 else "rm"
            f = font(style)
            baseline = y + f.ascender * size
            x = region.x + 2.0
            boxes = []
            for c_index, cell in enumerate(row):
                cw = widths[c_index] * (region.width - 4.0)
                tw = f.text_length(cell, size)
                cx = x if c_index == 0 else x + cw - tw - 4.0
                page.insert_text((cx, baseline), cell, fontname="tibo" if style == "bf" else "tiro", fontsize=size)
                boxes.append([cx, baseline - f.ascender * size, cx + tw, baseline - f.descender * size])
                x += cw
            lines.append({"bbox": r2(union(boxes)), "text": " | ".join(row)})
            y += row_h
            if r_index == 0:
                self.rule(region.page, region.x, region.x + region.width, y + 0.5, 0.5)
                y += 2.0
        bottom = y + 1.5
        self.rule(region.page, region.x, region.x + region.width, bottom, 0.9)
        element = self.add(
            Element(
                id=key,
                cls="table",
                page=region.page,
                bbox=r2([region.x, top - 0.5, region.x + region.width, bottom + 0.5]),
                text="\n".join(line["text"] for line in lines),
                lines=lines,
            )
        )
        region.y = bottom + gap + 2.0
        return element

    def code(self, region: Region, source: list[str], *, key: str, gap: float = 5.0) -> Element:
        page = self.pages[region.page]
        size, lead = 7.0, 9.4
        f = font("tt")
        pad = 4.0
        height = pad * 2 + (len(source) - 1) * lead + (f.ascender - f.descender) * size
        rect = fitz.Rect(region.x, region.y, region.x + region.width, region.y + height)
        page.draw_rect(rect, color=None, fill=(0.94, 0.95, 0.96))
        baseline = region.y + pad + f.ascender * size
        lines = []
        for text in source:
            x = region.x + pad
            if text.strip():
                page.insert_text((x, baseline), text, fontname="cour", fontsize=size)
                indent = len(text) - len(text.lstrip(" "))
                x0 = x + f.text_length(" " * indent, size)
                lines.append(
                    {
                        "bbox": r2([x0, baseline - f.ascender * size, x + f.text_length(text, size), baseline - f.descender * size]),
                        "text": text,
                    }
                )
            baseline += lead
        element = self.add(
            Element(id=key, cls="code_block", page=region.page, bbox=r2(rect), text="\n".join(source), lines=lines)
        )
        region.y += height + gap
        return element

    def display_formula(self, region: Region, pieces, number: str, *, key: str, latex: str, gap: float = 6.0) -> list[Element]:
        page = self.pages[region.page]
        size = 10.0
        base = font("rm")
        width = 0.0
        for text, style, script in pieces:
            width += font(style).text_length(text, size * (0.68 if script else 1.0))
        x = region.x + (region.width - width) / 2
        baseline = region.y + base.ascender * size + 2.0
        boxes = []
        for text, style, script in pieces:
            psize = size * (0.68 if script else 1.0)
            shift = {SUP: -0.38, SUB: 0.22}.get(script, 0.0) * size
            f = font(style)
            page.insert_text((x, baseline + shift), text, fontname={"rm": "tiro", "it": "tiit", "bf": "tibo"}[style], fontsize=psize)
            w = f.text_length(text, psize)
            boxes.append([x, baseline + shift - f.ascender * psize, x + w, baseline + shift - f.descender * psize])
            x += w
        formula_box = union(boxes)
        text = "".join(p[0] for p in pieces)
        formula = self.add(
            Element(
                id=key,
                cls="display_formula",
                page=region.page,
                bbox=r2(formula_box),
                text=text,
                lines=[{"bbox": r2(formula_box), "text": text}],
                attributes={"latex": latex},
            )
        )
        nw = base.text_length(number, 9.0)
        nx = region.x + region.width - nw
        page.insert_text((nx, baseline), number, fontname="tiro", fontsize=9.0)
        number_box = [nx, baseline - base.ascender * 9.0, nx + nw, baseline - base.descender * 9.0]
        numbered = self.add(
            Element(
                id=f"{key}-no",
                cls="formula_number",
                page=region.page,
                bbox=r2(number_box),
                text=number,
                lines=[{"bbox": r2(number_box), "text": number}],
                relations={"number_of": key},
            )
        )
        region.y = max(formula_box[3], number_box[3]) + gap
        return [formula, numbered]

    def algorithm(self, region: Region, caption: str, body: list[tuple[int, list[tuple[str, str]]]], *, key: str, gap: float = 6.0) -> list[Element]:
        """算法框：上线、题注、中线、带行号的伪代码、下线（algorithm2e 的样子）。题注和算法是两个块。"""
        page = self.pages[region.page]
        x0, x1 = region.x, region.x + region.width
        self.rule(region.page, x0, x1, region.y, 0.9)
        region.y += 2.5
        made = self.text(
            region,
            "code_caption",
            [{"b": caption.split(":", 1)[0] + ":"}, caption.split(":", 1)[1]],
            CAPTION,
            key=f"{key}-cap",
            relations={"caption_of": [key]},
            gap=2.0,
        )
        self.rule(region.page, x0, x1, region.y, 0.5)
        size, lead = 8.0, 10.6
        f = font("rm")
        top = region.y + 2.0
        baseline = top + f.ascender * size
        lines = []
        for number, (indent, pieces) in enumerate(body, start=0):
            label = f"{number}:" if number else ""
            x = x0 + 2.0
            boxes = []
            if label:
                page.insert_text((x, baseline), label, fontname="tiro", fontsize=size * 0.85)
            x = x0 + 16.0 + indent * 10.0
            text = ""
            for piece, style in pieces:
                pf = font(style)
                page.insert_text((x, baseline), piece, fontname={"rm": "tiro", "bf": "tibo", "it": "tiit"}[style], fontsize=size)
                w = pf.text_length(piece, size)
                boxes.append([x, baseline - pf.ascender * size, x + w, baseline - pf.descender * size])
                x += w
                text += piece
            lines.append({"bbox": r2(union(boxes)), "text": (label + " " if label else "") + text})
            baseline += lead
        bottom = top + (len(body) - 1) * lead + (f.ascender - f.descender) * size + 2.0
        self.rule(region.page, x0, x1, bottom, 0.9)
        made.append(
            self.add(
                Element(
                    id=key,
                    cls="algorithm",
                    page=region.page,
                    bbox=r2([x0, top - 1.0, x1, bottom]),
                    text="\n".join(line["text"] for line in lines),
                    lines=lines,
                )
            )
        )
        region.y = bottom + gap
        return made

    def seal(self, page: int, center: tuple[float, float], radius: float, *, key: str) -> Element:
        """红色圆章：外圈、五角星、一行字，压在前面的文字上。"""
        p = self.pages[page]
        red = (0.82, 0.12, 0.12)
        cx, cy = center
        p.draw_circle(center, radius, color=red, width=1.6)
        p.draw_circle(center, radius - 3.0, color=red, width=0.5)
        star = []
        for i in range(10):
            angle = -math.pi / 2 + i * math.pi / 5
            r = (radius * 0.28) if i % 2 == 0 else (radius * 0.11)
            star.append(fitz.Point(cx + r * math.cos(angle), cy - radius * 0.18 + r * math.sin(angle)))
        p.draw_polyline(star + [star[0]], color=red, fill=red, width=0.3)
        label = "样例专用章"
        size = radius * 0.3
        w = font("zh").text_length(label, size)
        p.insert_text((cx - w / 2, cy + radius * 0.45), label, fontname="china-s", fontsize=size, color=red)
        return self.add(
            Element(
                id=key,
                cls="seal",
                page=page,
                bbox=r2([cx - radius - 0.8, cy - radius - 0.8, cx + radius + 0.8, cy + radius + 0.8]),
                text=label,
                lines=[],
                lang="zh",
            )
        )

    def vertical_note(self, page: int, x: float, y: float, text: str, *, cls: str, key: str) -> Element:
        """左页边竖排的一行（arXiv 编号那种），从下往上读。框从 PDF 里取回来，不自己算旋转后的坐标。"""
        p = self.pages[page]
        p.insert_text((x, y), text, fontname="tiro", fontsize=9.0, rotate=90, color=(0.45, 0.45, 0.48))
        spans = [
            span["bbox"]
            for block in p.get_text("dict")["blocks"]
            for line in block.get("lines", [])
            for span in line["spans"]
            if span["text"].strip() == text.strip()
        ]
        if len(spans) != 1:
            raise RuntimeError(f"vertical text {text!r} not found exactly once")
        box = r2(spans[0])
        return self.add(
            Element(
                id=key,
                cls=cls,
                page=page,
                bbox=box,
                text=text,
                lines=[{"bbox": box, "text": text}],
                attributes={"writing_mode": "vertical"},
            )
        )

    def toc_entry(self, region: Region, level: int, title: str, page_label: str, *, key: str, target: str) -> Element:
        """一条目录：按级别缩进，标题太长就折行，最后一行补引导点和右对齐的页码。"""
        ts = TextStyle("bf" if level == 1 else "rm", 9.6 if level == 1 else 9.0, 12.4)
        indent = (level - 1) * 16.0
        number_w = font("rm").text_length("000", ts.size)
        width = region.width - indent - number_w - 18.0
        atoms = tokenize(title, ts.style)
        lines = wrap(atoms, width, ts)
        records, _, next_top = draw_lines(self.pages[region.page], lines, region.x + indent, region.y, width, ts)
        last = records[-1]
        baseline = region.y + font(ts.style).ascender * ts.size + ts.leading * (len(records) - 1)
        nw = font("rm").text_length(page_label, ts.size)
        nx = region.x + region.width - nw
        self.pages[region.page].insert_text((nx, baseline), page_label, fontname="tiro", fontsize=ts.size)
        dot_w = font("rm").text_length(" .", ts.size)
        start = last["bbox"][2] + 4.0
        dots = " ." * max(0, int((nx - 4.0 - start) // dot_w))
        if dots:
            self.pages[region.page].insert_text((start, baseline), dots, fontname="tiro", fontsize=ts.size, color=(0.45, 0.45, 0.5))
        last["bbox"] = r2([last["bbox"][0], last["bbox"][1], nx + nw, last["bbox"][3]])
        last["text"] = f"{last['text']}{dots} {page_label}"
        element = self.add(
            Element(
                id=key,
                cls="toc_entry",
                page=region.page,
                bbox=r2(union([r["bbox"] for r in records])),
                text=_join_lines([r["text"] for r in records], "en"),
                lines=records,
                relations={"toc_target": target},
                attributes=_toc_attributes(level, title, page_label),
                lang="zh" if any("\u4e00" <= ch <= "\u9fff" for ch in title) else "en",
            )
        )
        region.y = next_top - ts.leading + block_height(1, ts) + (7.0 if level == 1 else 4.0)
        return element

    def footnote_bottom(self, region: Region, content, *, key: str, relations: dict) -> Element:
        """脚注排在栏底，栏的可用高度跟着缩短。"""
        atoms = tokenize(content, SMALL.style)
        lines = wrap(atoms, region.width, SMALL)
        height = block_height(len(lines), SMALL)
        top = region.bottom - height
        self.rule(region.page, region.x, region.x + 60, top - 4.0, 0.5)
        records, inlines, _ = draw_lines(self.pages[region.page], lines, region.x, top, region.width, SMALL)
        region.bottom = top - 9.0
        return self.add(
            Element(
                id=key,
                cls="footnote",
                page=region.page,
                bbox=r2(union([r["bbox"] for r in records])),
                text=_join_lines([r["text"] for r in records], "en"),
                lines=records,
                inlines=inlines,
                relations=relations,
            )
        )

    def save(self, out_dir: Path) -> tuple[Path, Path]:
        out_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = out_dir / "complex_paper.pdf"
        truth_path = out_dir / "truth.json"
        self.pdf.set_metadata({"title": "Synthetic complex paper", "producer": "RetainPDF devtools", "creationDate": "", "modDate": ""})
        self.pdf.save(pdf_path, garbage=3, deflate=True, no_new_id=True)
        truth = {
            "schema": "retainpdf_ocr_truth_v1",
            "taxonomy_version": TAXONOMY_VERSION,
            "document_id": "complex_paper",
            "coordinate_space": "pdf_point",
            "pages": [{"index": i, "width": PAGE_W, "height": PAGE_H} for i in range(len(self.pages))],
            "elements": [element.payload() for element in self.elements],
        }
        truth_path.write_text(json.dumps(truth, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        return pdf_path, truth_path


def _toc_attributes(level: int, title: str, page_label: str) -> dict:
    """目录条目的结构：级别、编号（"2.1"，没编号的条目不写）、页码。"""
    attributes = {"level": level, "page_label": page_label}
    first = title.split()[0] if title.split() else ""
    if re.fullmatch(r"\d+(\.\d+)*", first):
        attributes["number"] = first
    return attributes


def _join_lines(texts: list[str], lang: str) -> str:
    return ("" if lang == "zh" else " ").join(texts)


def _draw_plot(page: fitz.Page, rect: fitz.Rect, seed: int, *, label: str = "") -> None:
    """画一张小折线图：坐标轴、刻度、两条曲线和一个图例，像论文里的矢量图。"""
    page.draw_rect(rect, color=(0.82, 0.84, 0.88), width=0.4)
    left, bottom = rect.x0 + 22, rect.y1 - 16
    right, top = rect.x1 - 8, rect.y0 + (18 if label else 10)
    page.draw_line((left, bottom), (right, bottom), color=INK, width=0.6)
    page.draw_line((left, bottom), (left, top), color=INK, width=0.6)
    for i in range(5):
        y = bottom - i * (bottom - top) / 4
        page.draw_line((left - 2, y), (left, y), color=INK, width=0.5)
        page.insert_text((rect.x0 + 6, y + 2), f"{i * 25}", fontname="helv", fontsize=5)
    for i in range(6):
        x = left + i * (right - left) / 5
        page.draw_line((x, bottom), (x, bottom + 2), color=INK, width=0.5)
        page.insert_text((x - 2, bottom + 8), f"{i * 2}", fontname="helv", fontsize=5)
    colors = [(0.18, 0.43, 0.88), (0.84, 0.36, 0.17)]
    for curve in range(2):
        points = []
        for i in range(11):
            t = i / 10
            value = 0.25 + 0.55 * (1 - (1 - t) ** (2 + curve + seed % 2)) - 0.05 * curve * (seed % 3)
            points.append(fitz.Point(left + t * (right - left), bottom - value * (bottom - top)))
        page.draw_polyline(points, color=colors[curve], width=1.0, dashes="[2 1] 0" if curve else None)
    lx = right - 50
    page.draw_line((lx, top + 4), (lx + 10, top + 4), color=colors[0], width=1.0)
    page.insert_text((lx + 13, top + 6), "ours", fontname="helv", fontsize=5)
    page.draw_line((lx, top + 11), (lx + 10, top + 11), color=colors[1], width=1.0, dashes="[2 1] 0")
    page.insert_text((lx + 13, top + 13), "baseline", fontname="helv", fontsize=5)
    if label:
        page.insert_text((rect.x0 + 4, rect.y0 + 8), label, fontname="hebo", fontsize=6.5)


def _math(*pieces, latex: str) -> dict:
    return {"math": list(pieces), "latex": latex}


def build() -> SampleDocument:
    doc = SampleDocument()
    full = lambda page, y, bottom=BOTTOM: Region(page, MARGIN_X, PAGE_W - 2 * MARGIN_X, y, bottom)  # noqa: E731

    # ---- 页眉、页脚、页码 ----
    for page in (TOC, P1, P2):
        band = full(page, 30.0)
        left = doc.text(band, "running_header", "Journal of Synthetic Document Studies 3 (2026)", SMALL, gap=0)[0]
        band = Region(page, PAGE_W - MARGIN_X - 140, 140, 30.0, BOTTOM)
        doc.text(band, "running_header", "Mei et al.  Layout recovery", TextStyle("it", 7.4, 9.6, align="right"), gap=0)
        doc.rule(page, MARGIN_X, PAGE_W - MARGIN_X, left.bbox[3] + 3.0, 0.5)
        doc.text(full(page, 800.0, 830.0), "running_footer", "Preprint. Distributed for layout-analysis testing only.", TextStyle("it", 7.2, 9.4), gap=0)
        doc.text(Region(page, PAGE_W / 2 - 20, 40, 800.0, 830.0), "page_number", PRINTED_PAGE[page], TextStyle("rm", 8.0, 10.0, align="center"), gap=0)

    # ---- 第 1 页：通栏的前言 ----
    top = full(P1, 66.0)
    doc.text(
        Region(P1, 100, PAGE_W - 200, 66.0, BOTTOM),
        "doc_title",
        "Measuring Layout Recovery on Dense Two-Column Papers with Mixed Scripts",
        TextStyle("bf", 15.5, 19.0, align="center"),
        key="title",
        gap=7,
    )
    top.y = doc.elements[-1].bbox[3] + 7
    doc.text(
        top,
        "author",
        ["Lin Mei", {"sup": "1"}, ",  Tomas Ortega", {"sup": "2"}, ",  Priya Natarajan", {"sup": "1,*"}],
        TextStyle("rm", 10.0, 12.5, align="center"),
        key="authors",
        gap=3,
    )
    doc.text(
        top,
        "affiliation",
        [{"sup": "1"}, "School of Information Science, Example University, Hangzhou, China"],
        TextStyle("it", 7.8, 9.8, align="center"),
        key="affil1",
        gap=1,
    )
    doc.text(
        top,
        "affiliation",
        [{"sup": "2"}, "Institute for Document Engineering, Valencia, Spain.  ", {"sup": "*"}, "Corresponding author."],
        TextStyle("it", 7.8, 9.8, align="center"),
        key="affil2",
        gap=3,
    )
    doc.text(
        top,
        "publication_info",
        "Received 3 June 2026  ·  Accepted 9 September 2026  ·  doi:10.0000/jsds.2026.0031",
        TextStyle("rm", 7.2, 9.2, align="center"),
        key="pubinfo",
        gap=8,
    )
    abstract_region = Region(P1, MARGIN_X + 24, PAGE_W - 2 * MARGIN_X - 48, top.y, BOTTOM)
    doc.text(abstract_region, "section_heading", "Abstract", TextStyle("bf", 9.0, 11.6), key="h-abstract", attributes={"level": 1}, gap=2)
    doc.text(
        abstract_region,
        "abstract",
        [
            "OCR services return blocks, lines and labels, but each service names them differently and none of them marks what a block",
            " is for. We build a two-page synthetic paper whose every element carries a known class, and score how well block boxes,",
            " reading order and roles survive normalization. On dense pages the block-level ",
            _math(("F", "it", ""), ("1", "rm", SUB), latex="F_1"),
            " drops from 0.94 to 0.81 when two columns are close together, while caption-to-figure links are lost in 23% of the cases.",
        ],
        TextStyle("rm", 8.4, 11.0),
        key="abstract",
        gap=4,
    )
    doc.text(
        abstract_region,
        "keywords",
        "Keywords: layout analysis; reading order; bilingual documents; OCR evaluation",
        TextStyle("rm", 8.0, 10.4),
        key="keywords",
        gap=0,
    )
    columns_top = abstract_region.y + 8
    doc.rule(P1, MARGIN_X, PAGE_W - MARGIN_X, columns_top - 4, 0.5)

    p1_left = Region(P1, MARGIN_X, COL_W, columns_top, BOTTOM)
    p1_right = Region(P1, MARGIN_X + COL_W + GUTTER, COL_W, columns_top, BOTTOM)
    p2_left = Region(P2, MARGIN_X, COL_W, 66.0, BOTTOM)
    p2_right = Region(P2, MARGIN_X + COL_W + GUTTER, COL_W, 66.0, BOTTOM)
    doc.flow = [p1_left, p1_right, p2_left, p2_right]

    # ---- 第 1 页左栏 ----
    doc.footnote_bottom(
        p1_left,
        [{"sup": "1"}, " All coordinates in this paper are PDF points with the origin at the top-left corner of the page."],
        key="fn1",
        relations={"note_of": "intro-p1"},
    )
    doc.text(p1_left, "section_heading", "1   Introduction", H1, key="h-intro", attributes={"level": 1}, gap=4)
    doc.text(
        p1_left,
        "paragraph",
        [
            "Translating a scientific paper while keeping its layout needs more than text: every block must be put back where it",
            " came from, at the right size, in the right reading order",
            {"fn": "1", "target": "fn1"},
            ". Commercial OCR services ",
            {"cite": "[1, 2]"},
            " report a bounding box ",
            _math(("b", "it", ""), ("i", "it", SUB), latex="b_i"),
            " and a label for each block, yet the labels are provider specific and a caption may be called ",
            "figure_title, image_caption or simply text.",
        ],
        BODY_FIRST,
        key="intro-p1",
    )
    doc.text(p1_left, "paragraph", "We make three contributions:", BODY, key="intro-p2", gap=3)
    for index, item in enumerate(
        [
            "a synthetic paper with 60 elements whose classes are known by construction;",
            "a provider-neutral class list with attributes and relations, independent of any OCR label set;",
            "a viewer that overlays predicted and reference boxes on the page.",
        ],
        start=1,
    ):
        doc.text(
            Region(P1, p1_left.x + 8, p1_left.width - 8, p1_left.y, p1_left.bottom),
            "list_item",
            f"({index})  {item}",
            TextStyle("rm", 9.0, 12.2),
            key=f"intro-li{index}",
            gap=2,
        )
        p1_left.y = doc.elements[-1].bbox[3] + 3
    p1_left.y += 3
    doc.text(
        p1_left,
        "paragraph",
        [
            "与英文论文不同，中文排版没有词间空格，一行可以在任意两个汉字之间断开。识别服务把中文行拼成段落时，常常在行与行之间多插一个空格，",
            "或者把行内公式",
            _math(("x", "it", ""), ("2", "rm", SUP), latex="x^2"),
            "前后的空格丢掉。本文的样例同时包含中英文段落，用来检查这两种错误。",
        ],
        ZH_BODY,
        key="intro-zh",
        lang="zh",
    )

    # ---- 第 1 页右栏 ----
    doc.figure(p1_right, 118.0, key="fig1", seed=1)
    doc.text(
        p1_right,
        "figure_caption",
        [
            "Figure 1: Block-level recall of three OCR services on dense two-column pages. The dashed line is the baseline that",
            " ignores column gaps.",
        ],
        CAPTION,
        key="fig1-cap",
        relations={"caption_of": ["fig1"]},
        gap=7,
    )
    doc.text(
        p1_right,
        "paragraph",
        ["We score a page by the harmonic mean of block precision ", _math(("P", "it", ""), latex="P"), " and recall ", _math(("R", "it", ""), latex="R"), ":"],
        BODY_FIRST,
        key="metric-p",
        gap=4,
    )
    doc.display_formula(
        p1_right,
        [("F", "it", ""), ("1", "rm", SUB), (" = 2", "rm", ""), ("PR", "it", ""), (" / (", "rm", ""), ("P", "it", ""), (" + ", "rm", ""), ("R", "it", ""), (")", "rm", "")],
        "(1)",
        key="eq1",
        latex=r"F_1 = \frac{2PR}{P + R}",
    )
    doc.text(p1_right, "section_heading", "2   Method", H1, key="h-method", attributes={"level": 1}, gap=4)
    doc.text(
        p1_right,
        "paragraph",
        [
            "Each reference element is rendered from a short program that records its class, its attributes and its relations while",
            " it draws the glyphs, so the reference boxes are exact rather than annotated by hand. The generator places a",
            " title, authors and affiliations across the full width, then flows the body text through two columns. A paragraph",
            " that does not fit at the bottom of a column is continued at the top of the next one and the continuation records",
            " which block it continues; the same happens across the page break. Footnotes are placed first so that the body",
            " text stops above them, which mirrors how a typesetter reserves space for notes. Figures are vector drawings with",
            " axis labels, so an OCR service may read the tick numbers as text; a good normalizer keeps them inside the",
            " figure instead of emitting them as stray paragraphs. Every caption names the figure or table it belongs to, and",
            " when two sub-figures share one caption the caption points to both of them. Tables use horizontal rules only,",
            " which is the most common style in the literature and also the hardest one for cell detection. The text mixes",
            " inline formulas such as ",
            _math(("s", "it", ""), ("t", "it", SUB), (" = ", "rm", ""), ("e", "it", ""), ("-", "rm", SUP), ("t", "it", SUP), latex="s_t = e^{-t}"),
            " with ordinary words, citations ",
            {"cite": "[3]"},
            " and footnote marks, and the last page ends with references that must never be translated. A heading carries",
            " its level, which the reader needs for the outline, and the conclusion is written in Chinese so that the same",
            " page holds two scripts. Running headers, footers and page numbers repeat on every page; they belong to no",
            " part of the running text and are never translated. Front matter, from the title to the keywords, is kept apart from",
            " the body because authors and affiliations must stay in the original language while the abstract is",
            " translated. Finally, every paragraph that is split by a column or page break keeps a pointer to the block it",
            " continues, so that a translator can join the halves into one sentence before translating it and split the",
            " translation again afterwards.",
        ],
        BODY,
        key="method-p1",
        split=True,
    )

    # ---- 第 2 页左栏（接着上一页的段落） ----
    doc.text(p2_left, "section_heading", "2.1   Matching rule", H2, key="h-match", attributes={"level": 2}, gap=4)
    doc.text(
        p2_left,
        "paragraph",
        [
            "A predicted block matches a reference block when their overlap ",
            _math(("s", "it", ""), ("(", "rm", ""), ("a", "it", ""), (", ", "rm", ""), ("b", "it", ""), (")", "rm", ""), latex="s(a, b)"),
            " exceeds 0.5. Unmatched reference blocks count as misses and unmatched predictions as false alarms; Table 1",
            " lists the counts per class.",
        ],
        BODY_FIRST,
        key="match-p1",
        gap=6,
    )
    doc.text(
        p2_left,
        "table_caption",
        "Table 1: Matched, missed and spurious blocks per class on the two sample pages.",
        CAPTION,
        key="tab1-cap",
        relations={"caption_of": ["tab1"]},
        gap=4,
    )
    doc.table(
        p2_left,
        [
            ["Class", "Matched", "Missed", "Spurious"],
            ["Paragraph", "14", "1", "2"],
            ["Section heading", "6", "0", "1"],
            ["Caption*", "3", "1", "0"],
            ["Reference entry", "4", "0", "0"],
        ],
        key="tab1",
    )
    doc.text(
        p2_left,
        "float_note",
        "* A caption counts as matched only if it is linked to the correct figure or table.",
        SMALL,
        key="tab1-note",
        relations={"note_of": "tab1"},
        gap=8,
    )
    doc.text(
        p2_left,
        "paragraph",
        [
            "Headings are matched like paragraphs but must also carry the right level: a level-2 heading reported as level 1 is",
            " a role error even when its box is perfect.",
        ],
        BODY,
        key="match-p2",
    )
    doc.text(p2_left, "section_heading", "2.2   Classes and relations", H2, key="h-relations", attributes={"level": 2}, gap=4)
    doc.text(
        p2_left,
        "paragraph",
        [
            "Each block carries exactly one class, and the class decides the default for translation. A heading such as",
            " References is an ordinary heading; the entries below it are recognized one by one, so a book with a reference",
            " list at the end of every chapter needs no special case. Relations record the",
            " links that layout alone cannot express. A caption points to its figure or table, a table note to its",
            " table, a footnote to the paragraph that holds its mark and a formula number to its formula:",
        ],
        BODY_FIRST,
        key="relations-p1",
        gap=4,
    )
    doc.display_formula(
        p2_left,
        [("z", "it", ""), ("(", "rm", ""), ("b", "it", ""), (")", "rm", ""), (" = front | body | back | page", "rm", "")],
        "(2)",
        key="eq2",
        latex=r"z(b) \in \{\mathrm{front}, \mathrm{body}, \mathrm{back}, \mathrm{page}\}",
    )
    doc.text(
        p2_left,
        "section_heading",
        "2.2.1   Storing every relation once, on the block that points to its target",
        TextStyle("bf", 8.8, 11.4),
        key="h-store",
        attributes={"level": 3},
        gap=3,
    )
    doc.text(
        p2_left,
        "paragraph",
        [
            "A relation is stored once, on the block that points, and the reverse direction is derived when the document is",
            " loaded. Storing both directions invites the two copies to disagree, which is exactly what happens today when",
            " a caption names one figure while the figure lists another caption. Relations also survive re-ordering: when",
            " the reader sorts blocks by reading order, a caption that was detected before its figure still points to the",
            " right image. The continuation relation is the one that matters most for translation, because a sentence",
            " broken by a column break is otherwise translated as two unrelated fragments. In the sample, the method",
            " paragraph starts on the first page and ends at the top of this column, and this paragraph itself is long",
            " enough to run from the left column into the right one, so both kinds of breaks appear in the reference.",
            " A normalizer that joins the halves must not move either box, since the translated text is laid out again",
            " inside the original boxes when the page is rebuilt, and an OCR service that reports the two halves as one",
            " block spanning both columns produces a box that covers the gutter and the text of the other column.",
            " Such a box is the most common failure we observe on dense layouts, and the viewer makes it easy to spot",
            " because the predicted box and the two reference boxes are drawn on top of each other in different colours.",
            " The same check applies to footnotes that continue on the next page and to long reference entries, which",
            " is why the continuation relation is allowed on those classes as well.",
        ],
        BODY,
        key="relations-p2",
        split=True,
    )

    # ---- 第 2 页右栏 ----
    doc.text(p2_right, "code_caption", "Listing 1: Greedy matching of predicted and reference blocks.", CAPTION, key="code1-cap", relations={"caption_of": ["code1"]}, gap=3)
    doc.code(
        p2_right,
        [
            "def match(pred, ref, thr=0.5):",
            "    pairs = []",
            "    for r in ref:",
            "        best = max(pred, key=lambda p: iou(p, r))",
            "        if iou(best, r) > thr:",
            "            pairs.append((best, r))",
            "    return pairs",
        ],
        key="code1",
    )
    doc.figure(p2_right, 82.0, key="fig2", seed=3, panels=2)
    doc.text(
        p2_right,
        "figure_caption",
        "Figure 2: (a) Recall by column gap. (b) Recall by line spacing. Both panels share this caption.",
        CAPTION,
        key="fig2-cap",
        relations={"caption_of": ["fig2a", "fig2b"]},
        gap=8,
    )
    doc.algorithm(
        p2_right,
        "Algorithm 1: Joining continued paragraphs before translation",
        [
            (0, [("Input: ", "bf"), ("blocks ", "rm"), ("B", "it"), (" in reading order", "rm")]),
            (0, [("P", "it"), (" := []", "rm")]),
            (0, [("for each ", "bf"), ("b", "it"), (" in ", "rm"), ("B", "it"), (" do", "bf")]),
            (1, [("if ", "bf"), ("b", "it"), (" continues the last block of ", "rm"), ("P", "it"), (" then", "bf")]),
            (2, [("append the text of ", "rm"), ("b", "it"), (" to that block", "rm")]),
            (1, [("else", "bf")]),
            (2, [("add ", "rm"), ("b", "it"), (" to ", "rm"), ("P", "it")]),
            (0, [("return ", "bf"), ("P", "it")]),
        ],
        key="algo1",
    )
    doc.text(p2_right, "section_heading", "3   结论", TextStyle("zh", 10.5, 13.5), key="h-concl", attributes={"level": 1}, lang="zh", gap=4)
    doc.text(
        p2_right,
        "paragraph",
        "人造样例让每个框的类别在生成时就确定下来，比较不同识别服务的结果时不再需要人工标注。下一步把同一套类别用于真实论文。",
        ZH_BODY,
        key="concl-zh",
        lang="zh",
        gap=7,
    )
    doc.text(p2_right, "section_heading", "Acknowledgements", H2, key="h-ack", attributes={"level": 1}, gap=3)
    doc.text(
        p2_right,
        "acknowledgement",
        "We thank the maintainers of the open-source PDF tools used to render the sample pages.",
        TextStyle("rm", 8.4, 11.0),
        key="ack",
        gap=7,
    )
    doc.text(p2_right, "section_heading", "References", H2, key="h-ref", attributes={"level": 1}, gap=3)
    for index, entry in enumerate(
        [
            "[1] Zhao, X., Li, Y.: A survey of document layout analysis. Pattern Recognition 151, 110-132 (2025)",
            "[2] Ortega, T.: Reading order in multi-column documents. In: Proc. ICDAR, pp. 44-58 (2024)",
            "[3] 王芳，陈立：中文科技文献版面识别的评测方法。中文信息学报 39(4)，12-20（2025）",
            "[4] Natarajan, P., Mei, L.: Linking captions to figures with weak supervision. arXiv:2601.01234 (2026)",
        ],
        start=1,
    ):
        zh = index == 3
        doc.text(
            p2_right,
            "reference_entry",
            entry,
            TextStyle("zh", 7.4, 10.2) if zh else REF,
            key=f"ref{index}",
            lang="zh" if zh else "en",
            gap=2,
        )
    # ---- 目录页（最后排：页码取正文里标题实际落在哪一页） ----
    toc = Region(TOC, (PAGE_W - 300.0) / 2, 300.0, 120.0, BOTTOM)
    doc.text(toc, "section_heading", "Contents  目录", TextStyle("bf", 15.0, 18.0), key="h-toc", attributes={"level": 1}, gap=18)
    by_key = {e.id: e for e in doc.elements}
    for level, key in [
        (1, "h-intro"),
        (1, "h-method"),
        (2, "h-match"),
        (2, "h-relations"),
        (3, "h-store"),
        (1, "h-concl"),
        (1, "h-ack"),
        (1, "h-ref"),
    ]:
        heading = by_key[key]
        doc.toc_entry(toc, level, heading.text, PRINTED_PAGE[heading.page], key=f"toc-{key[2:]}", target=key)

    # ---- 页边：第 1 页左边竖排的 arXiv 编号，第 2 页左边的边注，第 2 页末尾的印章 ----
    doc.vertical_note(P1, 30.0, 560.0, "arXiv:2610.01234v1  [cs.CV]  29 Oct 2026", cls="publication_info", key="arxiv-id")
    doc.text(
        Region(P2, 8.0, 40.0, 104.0, 300.0),
        "margin_note",
        "Margin note: boxes are given in PDF points, never in pixels.",
        TextStyle("it", 6.2, 7.8),
        key="margin1",
        relations={"note_of": "match-p1"},
        gap=0,
    )
    anchor = [e for e in doc.elements if e.cls == "reference_entry"][-1].bbox
    doc.seal(P2, (anchor[2] - 46.0, anchor[3] + 22.0), 30.0, key="seal1")
    return doc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, required=True, help="output directory")
    args = parser.parse_args(argv)
    pdf_path, truth_path = build().save(args.out)
    print(pdf_path)
    print(truth_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

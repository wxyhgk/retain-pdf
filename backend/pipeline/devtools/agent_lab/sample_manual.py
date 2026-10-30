"""人造样例 manual：一份软件技术手册（用户指南），A4 单栏，8 页。

虚构产品 Tidewater Backup Agent 3.2 的管理员指南：封面、目录页、编号章节到三级、步骤列表（1. 2. 3. 里嵌 a. b.）、
代码块带代码题注、命令行示例、警告 / 注意 / 提示框、跨页的参数表、截图类的图和图注、页眉页脚、附录 FAQ。

故意埋的坑：
- 正文、列表、表格单元格里夹着行内代码（`tidewater run`、`retention.keep_daily`），记成 `inline_code`，不翻；
- 目录页码要和标题实际落在的页一致（目录最后排）；
- 参数表跨页，拆成两段，第二段的题注是 "Table 1 (continued)"；
- 很多短列表项（要求清单、选项清单、步骤），编号 / 项目符号留在文字里；
- 警告框的类别：贴在代码块、表格下面、针对它们的警告记 `float_note`（note_of 指向代码块 / 表），
  正文里的注意、提示框记 `paragraph`；
- 终端输出（`[ok]`、`ERROR`、日志行）和配置文件里的 `#` 注释都在代码块里，整块不翻；
- 手册里的交叉引用：Table 1、Listing 2、Figure 2、Section 3.2、Appendix A。

    python -m devtools.agent_lab.sample_manual --out /tmp/manual   # 在 backend/pipeline 下跑
"""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path

import fitz

from devtools.ocr_viewer.complex_sample import Region
from devtools.ocr_viewer.complex_sample import SampleDocument
from devtools.ocr_viewer.sample_layout import Element
from devtools.ocr_viewer.sample_layout import TextStyle
from devtools.ocr_viewer.sample_layout import block_height
from devtools.ocr_viewer.sample_layout import draw_lines
from devtools.ocr_viewer.sample_layout import font
from devtools.ocr_viewer.sample_layout import r2
from devtools.ocr_viewer.sample_layout import tokenize
from devtools.ocr_viewer.sample_layout import union
from devtools.ocr_viewer.sample_layout import wrap

PAGE_W, PAGE_H = 595.0, 842.0  # A4
MARGIN_X, TOP, BOTTOM = 62.0, 64.0, 780.0
TEXT_W = PAGE_W - 2 * MARGIN_X
MAX_PAGES = 14
COVER, TOC_PAGE, FIRST_BODY = 0, 1, 2
PRODUCT = "Tidewater Backup Agent"
VERSION = "3.2"

BODY = TextStyle("rm", 9.5, 12.9)
LIST = TextStyle("rm", 9.5, 12.9)
CALLOUT = TextStyle("rm", 8.9, 12.0)
H1 = TextStyle("bf", 15.5, 19.0)
H2 = TextStyle("bf", 11.8, 15.0)
H3 = TextStyle("bf", 10.2, 13.4)
CAPTION = TextStyle("rm", 8.6, 11.2)
NOTE = TextStyle("rm", 7.8, 10.0)
CELL = TextStyle("rm", 8.2, 10.4)
CELL_BOLD = TextStyle("bf", 8.2, 10.4)
CELL_MONO = TextStyle("tt", 7.6, 10.4)
HEADER = TextStyle("it", 7.8, 10.0)
HEADER_RIGHT = TextStyle("it", 7.8, 10.0, align="right")
FOLIO = TextStyle("rm", 8.4, 10.0, align="right")

CODE_SIZE, CODE_LEAD, CODE_PAD = 7.8, 10.2, 5.0
TERMINAL = {"fill": (0.12, 0.13, 0.15), "ink": (0.88, 0.91, 0.93)}
LISTING = {"fill": (0.945, 0.953, 0.962), "ink": (0.1, 0.1, 0.12)}
CALLOUTS = {
    "note": {"label": "Note:", "fill": (0.92, 0.95, 1.0), "bar": (0.2, 0.4, 0.85)},
    "tip": {"label": "Tip:", "fill": (0.92, 0.97, 0.93), "bar": (0.2, 0.6, 0.3)},
    "warning": {"label": "Warning:", "fill": (1.0, 0.93, 0.9), "bar": (0.85, 0.25, 0.15)},
}
INLINE_RE = re.compile(r"(`[^`]+`|\*\*[^*]+\*\*|\{fn:[\w-]+\})")
CODE_MARK = "code:"  # 行内代码先借 inline_formula 排版，收尾时改记成 inline_code


def printed_label(page: int) -> str:
    if page == COVER:
        return "cover"
    if page == TOC_PAGE:
        return "i"
    return str(page - FIRST_BODY + 1)


class Manual:
    def __init__(self) -> None:
        self.doc = SampleDocument(pages=MAX_PAGES, size=(PAGE_W, PAGE_H), document_id="sample_manual", title=f"{PRODUCT} {VERSION} Administrator Guide")
        self.doc.flow = [Region(p, MARGIN_X, TEXT_W, TOP, BOTTOM) for p in range(MAX_PAGES)]
        self.page = FIRST_BODY
        self.footnotes: dict[str, str] = {}
        self.listing = 0

    # ---- 基础 ----
    @property
    def region(self) -> Region:
        return self.doc.flow[self.page]

    def ensure(self, height: float) -> None:
        if self.region.bottom - self.region.y < height:
            self.page += 1

    def text(self, cls: str, content, ts: TextStyle, *, key: str, gap: float = 5.0, **kwargs):
        made = self.doc.text(self.region, cls, content, ts, key=key, gap=gap, split=True, **kwargs)
        self.page = made[-1].page
        return made

    def height(self, content, ts: TextStyle, width: float = TEXT_W) -> float:
        return block_height(len(wrap(tokenize(content, ts.style), width, ts)), ts)

    def rich(self, text: str) -> list:
        """记号换成排版用的行内对象：`代码`、**粗体**、{fn:key} 脚注标记。"""
        content: list = []
        for part in INLINE_RE.split(text):
            if not part:
                continue
            if part.startswith("`"):
                code = part[1:-1]
                content.append({"math": [(code, "tt", None)], "latex": CODE_MARK + code})
            elif part.startswith("**"):
                content.append({"b": part[2:-2]})
            elif part.startswith("{fn:"):
                key = part[4:-1]
                content.append({"fn": self.footnotes[key], "target": key})
            else:
                content.append(part)
        return content

    # ---- 标题和段落 ----
    def heading(self, level: int, title: str, key: str) -> None:
        ts = {1: H1, 2: H2, 3: H3}[level]
        before = {1: 12.0, 2: 8.0, 3: 5.0}[level]
        gap = {1: 7.0, 2: 5.0, 3: 3.0}[level]
        after = block_height(1, H2) + 14.0 if level == 1 else 0.0  # 章标题后面紧跟节标题：两个标题不能留在页底
        self.ensure(block_height(1, ts) + before + gap + after + block_height(3, BODY))
        if self.region.y > TOP + 1:
            self.region.y += before
        self.text("section_heading", title, ts, key=key, gap=gap, attributes={"level": level})

    def para(self, text: str, key: str, *, footnote: tuple[str, str] | None = None, gap: float = 5.0, ts: TextStyle = BODY):
        if footnote:
            self.footnotes[footnote[0]] = str(len(self.footnotes) + 1)
        content = self.rich(text)
        need = self.height(content, ts)
        if footnote:
            note = [{"sup": self.footnotes[footnote[0]]}, " " + footnote[1]]
            note_h = self.height(note, NOTE)
            self.ensure(need + note_h + 16)
            self.doc.footnote_bottom(self.region, note, key=footnote[0], relations={"note_of": key})
        else:
            self.ensure(min(need, block_height(3, ts)) + 2)
        return self.text("paragraph", content, ts, key=key, gap=gap)

    def item(self, label: str, text: str, key: str, *, level: int = 0, bullet: bool = False, gap: float = 3.0, ensure_after: float = 0.0) -> Element:
        """一条列表项：编号 / 项目符号画在左边，也写进文字里（"1. Add …"），块的框把它包进去。"""
        label_x = MARGIN_X + (10.0 if level == 0 else 34.0)
        text_x = label_x + (14.0 if bullet else 18.0)
        content = self.rich(text)
        width = MARGIN_X + TEXT_W - text_x
        self.ensure(self.height(content, LIST, width) + gap + ensure_after)
        top = self.region.y
        inner = Region(self.page, text_x, width, top, self.region.bottom)
        el = self.doc.text(inner, "list_item", content, LIST, key=key, gap=0)[0]
        self.region.y = inner.y + gap
        page = self.doc.pages[self.page]
        f = font("rm")
        baseline = top + f.ascender * LIST.size
        shown = "•" if bullet else label
        if bullet:
            # 内置 Times 画不出圆点，自己画一个实心圆
            page.draw_circle((label_x + 2.2, baseline - LIST.size * 0.3), 1.7, color=None, fill=(0.1, 0.1, 0.12))
            lw = 4.4
        else:
            page.insert_text((label_x, baseline), shown, fontname="tiro", fontsize=LIST.size)
            lw = f.text_length(shown, LIST.size)
        box = [label_x, baseline - f.ascender * LIST.size, label_x + lw, baseline - f.descender * LIST.size]
        prefix = f"{shown} "
        el.text = prefix + el.text
        el.lines[0]["text"] = prefix + el.lines[0]["text"]
        el.lines[0]["bbox"] = r2(union([box, el.lines[0]["bbox"]]))
        el.bbox = r2(union([box, el.bbox]))
        for inline in el.inlines:
            if inline["line"] == 0:
                inline["start"] += len(prefix)
                inline["end"] += len(prefix)
        return el

    def callout(self, kind: str, text: str, key: str, *, cls: str = "paragraph", relations: dict | None = None, gap: float = 8.0, indent: float = 0.0) -> Element:
        spec = CALLOUTS[kind]
        content = [{"b": spec["label"]}, " "] + self.rich(text)
        x, width = MARGIN_X + indent, TEXT_W - indent
        pad_x, pad_y, bar = 9.0, 5.0, 3.0
        inner_w = width - 2 * pad_x - bar
        height = self.height(content, CALLOUT, inner_w) + 2 * pad_y
        self.ensure(height + gap)
        top = self.region.y
        page = self.doc.pages[self.page]
        page.draw_rect(fitz.Rect(x, top, x + width, top + height), color=None, fill=spec["fill"])
        page.draw_rect(fitz.Rect(x, top, x + bar, top + height), color=None, fill=spec["bar"])
        inner = Region(self.page, x + bar + pad_x, inner_w, top + pad_y, top + height)
        el = self.doc.text(inner, cls, content, CALLOUT, key=key, gap=0, relations=relations)[0]
        self.region.y = top + height + gap
        return el

    # ---- 代码 ----
    def code(self, source: list[str], key: str, *, theme: dict = LISTING, caption: str | None = None, indent: float = 0.0, gap: float = 7.0) -> Element:
        f = font("tt")
        width = TEXT_W - indent
        for line in source:
            if f.text_length(line, CODE_SIZE) > width - 2 * CODE_PAD:
                raise ValueError(f"code line too long for the box: {line!r}")
        height = 2 * CODE_PAD + (len(source) - 1) * CODE_LEAD + (f.ascender - f.descender) * CODE_SIZE
        cap_h = self.height(caption, CAPTION, width) + 3.0 if caption else 0.0
        self.ensure(cap_h + height + gap)
        if caption:
            self.listing += 1
            made = self.doc.text(Region(self.page, MARGIN_X + indent, width, self.region.y, self.region.bottom), "code_caption", f"Listing {self.listing}: {caption}", CAPTION, key=f"{key}-cap", relations={"caption_of": [key]}, gap=0)
            self.region.y = made[-1].bbox[3] + 4.0
        x, top = MARGIN_X + indent, self.region.y
        page = self.doc.pages[self.page]
        page.draw_rect(fitz.Rect(x, top, x + width, top + height), color=None, fill=theme["fill"])
        baseline = top + CODE_PAD + f.ascender * CODE_SIZE
        lines = []
        for text in source:
            if text.strip():
                page.insert_text((x + CODE_PAD, baseline), text, fontname="cour", fontsize=CODE_SIZE, color=theme["ink"])
                lead_space = len(text) - len(text.lstrip(" "))
                x0 = x + CODE_PAD + f.text_length(" " * lead_space, CODE_SIZE)
                lines.append({"bbox": r2([x0, baseline - f.ascender * CODE_SIZE, x + CODE_PAD + f.text_length(text, CODE_SIZE), baseline - f.descender * CODE_SIZE]), "text": text})
            baseline += CODE_LEAD
        el = self.doc.add(Element(id=key, cls="code_block", page=self.page, bbox=r2([x, top, x + width, top + height]), text="\n".join(source), lines=lines))
        self.region.y = top + height + gap
        return el

    # ---- 表 ----
    def table(self, key: str, caption: str, header: list[str], rows: list[list[str]], fractions: list[float], mono: set[int], *, min_rows: int = 3, gap: float = 6.0) -> list[Element]:
        """参数表。写不下就拆成两段：下一页接着画，表头重复，题注写 "(continued)"。"""
        widths = [fr * TEXT_W for fr in fractions]
        pad_x, pad_y = 3.0, 2.2

        def styles(col: int, is_header: bool) -> TextStyle:
            return CELL_BOLD if is_header else CELL_MONO if col in mono else CELL

        def cell_lines(col: int, text: str, is_header: bool):
            ts = styles(col, is_header)
            content = [text] if is_header else self.rich(text)
            return wrap(tokenize(content, ts.style), widths[col] - 2 * pad_x, ts), ts

        def row_height(row: list[str], is_header: bool) -> float:
            return max(block_height(len(cell_lines(c, t, is_header)[0]), styles(c, is_header)) for c, t in enumerate(row)) + 2 * pad_y

        made: list[Element] = []
        start, part = 0, 0
        while start < len(rows):
            title = caption if part == 0 else caption.replace(":", " (continued):", 1)
            part_key = key if part == 0 else f"{key}-{chr(97 + part)}"
            cap_h = self.height(title, CAPTION) + 4.0
            head_h = row_height(header, True)
            room = self.region.bottom - self.region.y - cap_h - head_h - 8.0
            count, used = 0, 0.0
            while start + count < len(rows):
                h = row_height(rows[start + count], False)
                if used + h > room:
                    break
                used += h
                count += 1
            if count < min(min_rows, len(rows) - start):
                self.page += 1
                continue
            cap = self.doc.text(self.region, "table_caption", title, CAPTION, key=f"{part_key}-cap", relations={"caption_of": [part_key]}, gap=0)
            self.region.y = cap[-1].bbox[3] + 4.0
            page = self.doc.pages[self.page]
            top = self.region.y
            x0, x1 = MARGIN_X, MARGIN_X + TEXT_W
            rule = (0.35, 0.35, 0.38)
            page.draw_line((x0, top), (x1, top), color=rule, width=0.9)
            y = top
            records = []
            for r_index, row in enumerate([header] + rows[start : start + count]):
                is_header = r_index == 0
                h = head_h if is_header else row_height(row, False)
                boxes, texts = [], []
                x = x0
                for col, text in enumerate(row):
                    lines, ts = cell_lines(col, text, is_header)
                    recs, _, _ = draw_lines(page, lines, x + pad_x, y + pad_y, widths[col] - 2 * pad_x, ts)
                    boxes += [rec["bbox"] for rec in recs]
                    texts.append(" ".join(rec["text"] for rec in recs))
                    x += widths[col]
                records.append({"bbox": r2(union(boxes)), "text": " | ".join(texts)})
                y += h
                if is_header:
                    page.draw_line((x0, y), (x1, y), color=rule, width=0.5)
                elif r_index < count:
                    page.draw_line((x0, y), (x1, y), color=(0.8, 0.8, 0.82), width=0.3)
            page.draw_line((x0, y), (x1, y), color=rule, width=0.9)
            made.append(self.doc.add(Element(id=part_key, cls="table", page=self.page, bbox=r2([x0, top - 0.5, x1, y + 0.5]), text="\n".join(r["text"] for r in records), lines=records)))
            self.region.y = y + gap
            start += count
            part += 1
            if start < len(rows):
                self.page += 1
        return made


# ---- 图 ----
def _ctext(page: fitz.Page, cx: float, y: float, text: str, size: float, *, fontname: str = "helv", color=(0.1, 0.1, 0.12)) -> None:
    width = fitz.get_text_length(text, fontname=fontname, fontsize=size)
    page.insert_text((cx - width / 2, y), text, fontname=fontname, fontsize=size, color=color)


def _arrow(page: fitz.Page, p0, p1, color=(0.25, 0.27, 0.32)) -> None:
    page.draw_line(p0, p1, color=color, width=1.1)
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = (dx * dx + dy * dy) ** 0.5 or 1.0
    ux, uy = dx / n, dy / n
    tip = fitz.Point(*p1)
    left = fitz.Point(p1[0] - 6 * ux + 3 * uy, p1[1] - 6 * uy - 3 * ux)
    right = fitz.Point(p1[0] - 6 * ux - 3 * uy, p1[1] - 6 * uy + 3 * ux)
    page.draw_polyline([tip, left, right, tip], color=color, fill=color, width=0.3)


def draw_architecture(page: fitz.Page, rect: fitz.Rect) -> None:
    ink, blue, soft = (0.15, 0.17, 0.22), (0.16, 0.36, 0.72), (0.9, 0.93, 0.98)
    page.draw_rect(rect, color=(0.85, 0.86, 0.9), width=0.4)
    mid = rect.y0 + 49
    src = fitz.Rect(rect.x0 + 12, mid - 28, rect.x0 + 98, mid + 28)
    agent = fitz.Rect(rect.x0 + 134, rect.y0 + 10, rect.x0 + 286, rect.y0 + 88)
    dst = fitz.Rect(rect.x1 - 104, mid - 28, rect.x1 - 12, mid + 28)
    index = fitz.Rect(rect.x0 + 160, rect.y1 - 21, rect.x0 + 260, rect.y1 - 6)
    for box, fill in ((src, (0.96, 0.96, 0.96)), (agent, soft), (dst, (0.96, 0.96, 0.96)), (index, (1.0, 0.97, 0.88))):
        page.draw_rect(box, color=ink, fill=fill, width=0.8)
    _ctext(page, (src.x0 + src.x1) / 2, mid - 3, "Source", 8, fontname="hebo")
    _ctext(page, (src.x0 + src.x1) / 2, mid + 9, "directories", 8)
    _ctext(page, (dst.x0 + dst.x1) / 2, mid - 3, "Storage target", 8, fontname="hebo")
    _ctext(page, (dst.x0 + dst.x1) / 2, mid + 9, "S3 / SFTP / local", 7.2)
    _ctext(page, (agent.x0 + agent.x1) / 2, agent.y0 + 12, "tidewater-agent", 8.4, fontname="hebo", color=blue)
    for i, label in enumerate(("1  Scan and compare", "2  Chunk and compress", "3  Encrypt and upload")):
        row = fitz.Rect(agent.x0 + 10, agent.y0 + 20 + i * 20, agent.x1 - 10, agent.y0 + 36 + i * 20)
        page.draw_rect(row, color=blue, fill=(1, 1, 1), width=0.5)
        _ctext(page, (row.x0 + row.x1) / 2, row.y0 + 11, label, 7.2)
    _ctext(page, (index.x0 + index.x1) / 2, index.y0 + 11, "Local index", 7.6)
    _arrow(page, (src.x1, mid), (agent.x0, mid))
    _arrow(page, (agent.x1, mid), (dst.x0, mid))
    page.draw_line(((agent.x0 + agent.x1) / 2, agent.y1), ((agent.x0 + agent.x1) / 2, index.y0), color=ink, width=0.8, dashes="[2 2] 0")
    _ctext(page, (src.x1 + agent.x0) / 2, mid - 6, "files", 7)
    _ctext(page, (agent.x1 + dst.x0) / 2, mid - 6, "chunks", 7)


def draw_dashboard(page: fitz.Page, rect: fitz.Rect) -> None:
    ink, grey, blue = (0.15, 0.17, 0.22), (0.62, 0.64, 0.68), (0.16, 0.36, 0.72)
    page.draw_rect(rect, color=(0.55, 0.57, 0.62), fill=(1, 1, 1), width=0.8)
    bar = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + 16)
    page.draw_rect(bar, color=None, fill=(0.88, 0.89, 0.92))
    for i, color in enumerate(((0.95, 0.4, 0.38), (0.96, 0.75, 0.3), (0.4, 0.78, 0.4))):
        page.draw_circle((rect.x0 + 9 + i * 11, rect.y0 + 8), 3.2, color=None, fill=color)
    _ctext(page, (rect.x0 + rect.x1) / 2, rect.y0 + 11, "Tidewater Dashboard  -  backup-eu-01", 7.4)
    side = fitz.Rect(rect.x0, rect.y0 + 16, rect.x0 + 84, rect.y1)
    page.draw_rect(side, color=None, fill=(0.95, 0.96, 0.98))
    for i, label in enumerate(("Overview", "Jobs", "Snapshots", "Settings")):
        y = rect.y0 + 36 + i * 20
        if label == "Jobs":
            page.draw_rect(fitz.Rect(side.x0 + 4, y - 11, side.x1 - 4, y + 5), color=None, fill=(0.82, 0.88, 0.98))
        page.insert_text((side.x0 + 12, y), label, fontname="hebo" if label == "Jobs" else "helv", fontsize=7.6, color=ink)
    mx = side.x1 + 14
    page.insert_text((mx, rect.y0 + 38), "Jobs", fontname="hebo", fontsize=10, color=ink)
    for i, h in enumerate(("Name", "Status", "Progress")):
        page.insert_text((mx + (0, 70, 138)[i], rect.y0 + 56), h, fontname="hebo", fontsize=6.8, color=grey)
    page.draw_line((mx, rect.y0 + 60), (rect.x1 - 12, rect.y0 + 60), color=(0.8, 0.8, 0.84), width=0.5)
    for i, (name, status, pct, color) in enumerate((("nightly", "Running", 0.62, blue), ("web-assets", "Idle", 1.0, (0.4, 0.55, 0.4)), ("db-dumps", "Failed", 0.35, (0.8, 0.25, 0.2)))):
        y = rect.y0 + 76 + i * 22
        page.insert_text((mx, y), name, fontname="helv", fontsize=7.6, color=ink)
        pill = fitz.Rect(mx + 68, y - 9, mx + 112, y + 3)
        page.draw_rect(pill, color=None, fill=color)
        _ctext(page, (pill.x0 + pill.x1) / 2, y, status, 6.6, color=(1, 1, 1))
        track = fitz.Rect(mx + 138, y - 7, mx + 238, y)
        page.draw_rect(track, color=(0.8, 0.8, 0.84), width=0.4)
        page.draw_rect(fitz.Rect(track.x0, track.y0, track.x0 + (track.x1 - track.x0) * pct, track.y1), color=None, fill=color)
    button = fitz.Rect(rect.x1 - 66, rect.y0 + 28, rect.x1 - 14, rect.y0 + 44)
    page.draw_rect(button, color=blue, fill=(1, 1, 1), width=0.8)
    _ctext(page, (button.x0 + button.x1) / 2, button.y0 + 11, "Pause", 7.6, color=blue)
    for number, (px, py) in enumerate(((mx + 48, rect.y0 + 73), (mx + 250, rect.y0 + 72), (button.x0 - 12, button.y0 + 8)), start=1):
        page.draw_circle((px, py), 6.2, color=(0.85, 0.15, 0.15), fill=(0.85, 0.15, 0.15), width=0.4)
        _ctext(page, px, py + 2.6, str(number), 7.6, fontname="hebo", color=(1, 1, 1))


def draw_logo(page: fitz.Page, center: tuple[float, float], radius: float) -> None:
    page.draw_circle(center, radius, color=None, fill=(0.1, 0.25, 0.5))
    for i, alpha in enumerate((1.0, 0.7, 0.45)):
        y = center[1] - radius * 0.25 + i * radius * 0.3
        points = []
        for step in range(25):
            t = step / 24
            x = center[0] - radius * 0.7 + t * radius * 1.4
            points.append(fitz.Point(x, y + 4.0 * math.sin(t * 6.283 * 1.5 + i)))
        page.draw_polyline(points, color=(1 - 0.5 * (1 - alpha),) * 3, width=2.4)


def figure(m: Manual, kind: str, key: str, caption: str, *, width: float, height: float, figure_type: str, gap: float = 10.0) -> None:
    cap_h = m.height(caption, CAPTION, width) + 4.0
    m.ensure(height + cap_h + gap)
    region = m.region
    x = MARGIN_X + (TEXT_W - width) / 2
    rect = fitz.Rect(x, region.y, x + width, region.y + height)
    {"architecture": draw_architecture, "dashboard": draw_dashboard}[kind](m.doc.pages[m.page], rect)
    m.doc.add(Element(id=key, cls="figure", page=m.page, bbox=r2(rect), text="", lines=[], attributes={"figure_type": figure_type}))
    region.y += height + 4.0
    made = m.doc.text(Region(m.page, x, width, region.y, region.bottom), "figure_caption", caption, TextStyle("rm", 8.6, 11.2, align="center"), key=f"{key}-cap", relations={"caption_of": [key]}, gap=0)
    region.y = made[-1].bbox[3] + gap


# ---- 正文 ----
PARAMETERS = [
    ["storage.type", "string", "s3", "Storage back end. One of `s3`, `sftp` or `local`."],
    ["storage.bucket", "string", "none", "Name of the bucket (S3) or the remote directory (SFTP) that receives the backups."],
    ["storage.prefix", "string", "empty", "Path inside the bucket under which all snapshots are stored. Give every machine its own prefix."],
    ["storage.endpoint", "url", "none", "Address of an S3-compatible service. Leave it empty to use Amazon S3."],
    ["storage.region", "string", "us-east-1", "Region of the S3 bucket. Ignored by the other back ends."],
    ["storage.timeout", "duration", "30s", "How long to wait for a reply from the storage target before a request is retried."],
    ["agent.listen*", "address", "127.0.0.1:7443", "Address on which the local control interface listens. Never expose it to a network."],
    ["agent.workers*", "integer", "4", "Number of files uploaded in parallel. Raise it on fast links and lower it on slow ones."],
    ["agent.tls_verify", "boolean", "true", "Check the certificate of the storage target. Turn it off only for tests."],
    ["agent.cache_size", "size", "2G", "Largest size of the local cache. The oldest entries are removed first."],
    ["agent.bandwidth", "size/s", "unlimited", "Upper limit for the upload speed, for example `20M`."],
    ["jobs.<name>.paths", "list", "none", "Directories to back up. At least one is required for every job."],
    ["jobs.<name>.exclude", "list", "empty", "Patterns of files to skip. A pattern without a leading slash matches at any depth."],
    ["jobs.<name>.schedule", "cron", "none", "When to start the job, in five-field cron syntax. A job without a schedule only runs on request."],
    ["retention.keep_daily", "integer", "7", "Number of daily snapshots to keep."],
    ["retention.keep_weekly", "integer", "4", "Number of weekly snapshots to keep."],
    ["retention.keep_monthly", "integer", "0", "Number of monthly snapshots to keep. Zero turns monthly snapshots off."],
    ["log.level", "string", "info", "One of `debug`, `info`, `warn` or `error`. Same as the variable `TIDEWATER_LOG_LEVEL`."],
    ["log.file", "path", "stderr", "File that receives the log output. Rotation is left to `logrotate`."],
]

ERRORS = [
    ["E101", "The configuration file cannot be parsed.", "Run `tidewater config check` and fix the line it reports."],
    ["E204", "The storage target rejected the credentials.", "Renew the access token and restart the agent."],
    ["E207", "The request was rejected because the clock is wrong.", "Synchronize the clock with NTP; the limit is five seconds."],
    ["E312", "A source directory cannot be read.", "Give the `tidewater` user read access to the directory, or exclude it."],
    ["E405", "The local index is damaged.", "Stop the agent and run `tidewater index rebuild`. The next job takes longer."],
    ["E518", "The encryption key does not match the snapshot.", "Restore the key that was used when the snapshot was made."],
]


def write_body(m: Manual) -> None:
    # ---- 1 Introduction ----
    m.heading(1, "1   Introduction", "h-intro")
    m.heading(2, "1.1   About this guide", "h-about")
    m.para(
        f"This guide is written for system administrators who install and operate {PRODUCT}, a self-hosted service that copies files from servers and workstations to remote storage on a schedule. It describes installation on Linux, the configuration file, the `tidewater` command-line tool and the most common problems. It does not describe the web dashboard in depth; see the Dashboard Reference for that.{{fn:fn-ref}}",
        "intro-1",
        footnote=("fn-ref", "The Dashboard Reference is a separate document and is revised independently of this guide, so its revision number may differ from the one printed on the cover."),
    )
    m.para(
        "Commands that you type are shown in a monospaced typeface and start with a `$` prompt when they run as a normal user, or with a `#` prompt when they need root privileges. Do not type the prompt itself. Names of files, options and configuration keys, such as `retention.keep_daily`, appear in the same typeface inside running text.",
        "intro-2",
    )
    m.heading(2, "1.2   System requirements", "h-reqs")
    m.para("Before you begin, check that every machine you plan to protect meets the following requirements:", "reqs-intro", gap=3.0)
    for i, text in enumerate(
        [
            "A 64-bit Linux distribution with kernel 4.19 or later.",
            "At least 512 MB of free memory and 200 MB of free disk space for the agent and its cache.",
            "Outbound network access to your storage target on port `443` (S3) or `22` (SFTP).",
            "A user account that may read every directory you want to back up.",
            "No Python or Java runtime: the agent is a single static binary.",
        ],
        start=1,
    ):
        m.item("", text, f"req-{i}", bullet=True, gap=2.5)
    m.region.y += 4.0
    m.callout(
        "note",
        "The agent keeps a local index of every file it has seen. On a machine with several million files, plan for roughly 1 GB of disk space for the index, in addition to the 200 MB listed above.",
        "note-index",
    )
    m.heading(2, "1.3   How the agent works", "h-how")
    m.para(
        "Figure 1 shows the main parts. The agent runs as a background service named `tidewater-agent`. Each time a job starts, it scans the source directories, compares the result with its local index and uploads only the files that have changed. Uploaded data is split into chunks, compressed, encrypted with your key and sent to the storage target. A small catalog that describes the snapshot is uploaded last, so an interrupted job never leaves a snapshot that looks complete.",
        "how-1",
    )
    figure(m, "architecture", "fig-arch", "Figure 1: Main components of the agent and the direction of the data flow.", width=410.0, height=108.0, figure_type="diagram")

    # ---- 2 Installation ----
    m.heading(1, "2   Installation", "h-install")
    m.heading(2, "2.1   Installing on Linux", "h-linux")
    m.para(
        "Tidewater provides packages for Debian-based and RPM-based distributions, and a tarball for everything else. Use the package repository whenever you can, because updates then arrive together with your other system updates. The repository is signed, and your package manager checks the signature of every package before it installs it. Tarball downloads are signed in the same way: the signature file is named `tidewater-3.2.tar.gz.sig` and can be checked with `gpg --verify`. Whichever method you choose, install the same version on every machine, because agents of different versions cannot read each other's catalogs.",
        "linux-1",
    )
    m.heading(3, "2.1.1   Installing from the package repository", "h-repo")
    m.para("Follow these steps as `root` on each machine:", "repo-intro", gap=3.0)
    m.item("1.", "Add the Tidewater signing key and the repository.", "step-1")
    m.item("a.", "Download the key with the first command in Listing 1 and compare its fingerprint with the one on the customer portal.", "step-1a", level=1)
    m.item("b.", "Create the repository file for your distribution, as in the second command of the listing.", "step-1b", level=1, ensure_after=60.0)
    m.code(
        [
            "# curl -fsSL https://pkg.tidewater.example/key.asc \\",
            "      -o /etc/apt/keyrings/tidewater.asc",
            "# echo 'deb [signed-by=/etc/apt/keyrings/tidewater.asc]' \\",
            "      'https://pkg.tidewater.example/apt stable main' \\",
            "      > /etc/apt/sources.list.d/tidewater.list",
        ],
        "code-repo",
        caption="Adding the package repository on Debian and Ubuntu.",
        indent=34.0,
    )
    m.item("2.", "Install the package with `apt-get update && apt-get install tidewater-agent`.", "step-2")
    m.item("a.", "When asked, accept the creation of the `tidewater` system user.", "step-2a", level=1)
    m.item("b.", "Wait for the installer to finish. It enables the service but does not start it.", "step-2b", level=1)
    m.item("3.", "Create the encryption key that protects your backups.", "step-3", ensure_after=110.0)
    m.code(
        [
            "# tidewater key create --output /etc/tidewater/key.pem",
            "Key written to /etc/tidewater/key.pem (mode 0600)",
            "Fingerprint: 9F2A-71C4-0B8D-E63A",
        ],
        "code-key",
        theme=TERMINAL,
        indent=26.0,
        gap=4.0,
    )
    m.callout(
        "warning",
        "The key cannot be recovered. If you lose the file `/etc/tidewater/key.pem` and have no copy of it, every backup made with it becomes unreadable. Keep a copy in a password manager or on offline media before you start the first job.",
        "warn-key",
        cls="float_note",
        relations={"note_of": "code-key"},
        indent=26.0,
    )
    m.item("4.", "Start the service.", "step-4", ensure_after=30.0)
    m.item("a.", "Run `systemctl enable --now tidewater-agent` as `root`.", "step-4a", level=1)
    m.item("b.", "Check that the service is active with `systemctl status tidewater-agent`.", "step-4b", level=1)
    m.region.y += 4.0
    m.heading(3, "2.1.2   Installing from a tarball", "h-tarball")
    m.para(
        "On distributions without a supported package manager, download the tarball from the customer portal and unpack it under `/opt/tidewater`.{fn:fn-portal} The tarball contains the `tidewater` binary, a sample configuration file and a systemd unit file. Copy the unit file to `/etc/systemd/system/`, run `systemctl daemon-reload` and continue with step 3 above.",
        "tarball-1",
        footnote=("fn-portal", "The customer portal needs an account. If your company does not have one yet, ask your Tidewater contact to create it."),
    )
    m.heading(2, "2.2   Verifying the installation", "h-verify")
    m.para("Run the built-in self test to confirm that the agent can read its configuration, reach its storage target and write a small test object:", "verify-1", gap=4.0)
    m.code(
        [
            "$ tidewater doctor",
            "[ok]   configuration file found: /etc/tidewater/agent.yaml",
            "[ok]   encryption key readable (fingerprint 9F2A-71C4-0B8D-E63A)",
            "[ok]   storage target reachable: s3://backup-eu-west/tw",
            "[warn] clock offset is 2.4 s (limit 5 s)",
            "4 checks passed, 1 warning, 0 failed",
        ],
        "code-doctor",
        theme=TERMINAL,
    )
    m.para(
        "A warning does not stop backups from running, but a clock offset above the limit makes the storage target reject uploads with error E207 (see Table 2). If you see it, synchronize the clock with NTP.",
        "verify-2",
    )

    # ---- 3 Configuration ----
    m.heading(1, "3   Configuration", "h-config")
    m.heading(2, "3.1   The configuration file", "h-file")
    m.para(
        "The agent reads its settings from `/etc/tidewater/agent.yaml` when it starts. The file is plain YAML; keys that you leave out take the defaults listed in Table 1. Changes take effect after `tidewater reload`, except for the parameters marked with an asterisk. Listing 2 shows a minimal file that backs up two directories to an S3 bucket every night.",
        "file-1",
        gap=6.0,
    )
    m.code(
        [
            "storage:",
            "  type: s3",
            "  bucket: backup-eu-west      # must already exist",
            "  prefix: tw",
            "  region: eu-west-1",
            "jobs:",
            "  nightly:",
            "    paths: [/home, /var/www]",
            "    exclude: ['*.tmp', /home/*/.cache]",
            "    schedule: '0 2 * * *'      # every day at 02:00",
            "retention:",
            "  keep_daily: 14",
            "  keep_weekly: 8",
        ],
        "code-config",
        caption="A minimal configuration file with one nightly job.",
    )
    m.heading(2, "3.2   Configuration parameters", "h-params")
    m.para(
        "Table 1 lists the parameters that administrators change most often. Durations are written as a number followed by `s`, `m`, `h` or `d`, and sizes as a number followed by `K`, `M` or `G`. The name of a job takes the place of `<name>`.",
        "params-1",
    )
    parts = m.table(
        "tab-params",
        "Table 1: Frequently used configuration parameters.",
        ["Parameter", "Type", "Default", "Description"],
        PARAMETERS,
        [0.23, 0.09, 0.17, 0.51],
        {0, 2},
    )
    m.callout(
        "warning",
        "* These parameters are read only when the agent starts. Run `systemctl restart tidewater-agent` after changing them; `tidewater reload` has no effect on them.",
        "tab-params-note",
        cls="float_note",
        relations={"note_of": parts[-1].id},
        gap=8.0,
    )
    m.heading(2, "3.3   Environment variables", "h-env")
    m.para("Some settings can also be given as environment variables, which is convenient in containers. An environment variable overrides the same setting in the configuration file.", "env-1", gap=3.0)
    for i, text in enumerate(
        [
            "`TIDEWATER_HOME` - directory for the local index and cache. Default: `/var/lib/tidewater`.",
            "`TIDEWATER_LOG_LEVEL` - same as `log.level`.",
            "`TIDEWATER_TOKEN` - access token for the storage target. Use it instead of writing credentials into the file.",
            "`TIDEWATER_NO_COLOR` - set it to any value to turn off colored output.",
        ],
        start=1,
    ):
        m.item("", text, f"env-li{i}", bullet=True, gap=2.5)
    m.region.y += 4.0
    m.callout(
        "tip",
        "Do not put `TIDEWATER_TOKEN` into a world-readable file such as `/etc/environment`. Use a systemd drop-in file with mode `0600`, or a secrets manager, instead.",
        "tip-token",
    )

    # ---- 4 Running backups ----
    m.heading(1, "4   Running backups", "h-run")
    m.heading(2, "4.1   Creating and running a job", "h-job")
    m.para(
        "Jobs normally start from their schedule, but you can also start one by hand, which is a good way to test a new configuration. Add `--dry-run` to see what would be uploaded without sending anything.",
        "job-1",
        gap=3.0,
    )
    m.item("1.", "Validate the configuration with `tidewater config check`.", "run-1")
    m.item("a.", "Fix every error it reports and run the command again.", "run-1a", level=1)
    m.item("b.", "Warnings can be ignored for the first run.", "run-1b", level=1)
    m.item("2.", "Start the job `nightly` as a dry run.", "run-2", ensure_after=70.0)
    m.code(
        [
            "$ tidewater run nightly --dry-run",
            "nightly: 18,204 files (3.1 GiB) would be uploaded",
            "nightly: 211 files (40 MiB) unchanged since snapshot 2026-10-11",
        ],
        "code-dry",
        theme=TERMINAL,
        indent=26.0,
    )
    m.item("3.", "Run the job for real by leaving out `--dry-run`. The first run uploads everything and can take hours; later runs upload only what has changed.", "run-3")
    m.item("a.", "Follow the progress with `tidewater status`, or on the Jobs page shown in Figure 2.", "run-3a", level=1)
    m.item("b.", "You can interrupt the job with Ctrl+C at any time. The next run continues where it stopped.", "run-3b", level=1)
    m.region.y += 4.0
    figure(
        m,
        "dashboard",
        "fig-dash",
        "Figure 2: The Jobs page of the dashboard. (1) A running job, (2) its progress, (3) the Pause button.",
        width=360.0,
        height=128.0,
        figure_type="photo",
    )
    m.heading(2, "4.2   Command-line reference", "h-cli")
    m.para("These are the commands you will use most. Run any command with `--help` to see all of its options.", "cli-1", gap=3.0)
    for i, text in enumerate(
        [
            "`tidewater run <job>` - start a job now.",
            "`tidewater status` - show running jobs and their progress.",
            "`tidewater snapshots <job>` - list the snapshots of a job.",
            "`tidewater restore <snapshot>` - copy files back from a snapshot.",
            "`tidewater prune` - delete snapshots that the retention rules no longer keep.",
        ],
        start=1,
    ):
        m.item("", text, f"cli-li{i}", bullet=True, gap=2.5)
    m.region.y += 3.0
    m.para("Three options work with every command:", "cli-2", gap=3.0)
    for i, text in enumerate(
        [
            "`-c, --config <file>` - read this configuration file instead of the default one.",
            "`-v, --verbose` - print more detail while the command runs.",
            "`--json` - print the result as JSON, for use in scripts.",
        ],
        start=1,
    ):
        m.item("", text, f"opt-li{i}", bullet=True, gap=2.5)
    m.region.y += 4.0
    m.heading(3, "4.2.1   Restoring files", "h-restore")
    m.para(
        "To restore a single file, name the snapshot (or `latest`), the job and the path, and give a target directory. Always restore into an empty temporary directory first and check the result before you copy anything back.",
        "restore-1",
        gap=4.0,
    )
    m.code(
        [
            "$ tidewater restore latest --job nightly \\",
            "      --path /home/alice/report.odt --target /tmp/restore",
            "Restoring 1 file (86 KiB) ...",
            "Done in 1.2 s. Files restored: 1, skipped: 0",
        ],
        "code-restore",
        theme=TERMINAL,
        gap=4.0,
    )
    m.callout(
        "warning",
        "Without `--target`, files are written back to their original location and overwrite newer versions. There is no undo.",
        "warn-restore",
        cls="float_note",
        relations={"note_of": "code-restore"},
    )
    m.heading(2, "4.3   Scheduling and retention", "h-retention")
    m.para(
        "The retention rules decide which snapshots `tidewater prune` deletes. A snapshot is kept if any rule keeps it: with the settings from Listing 2, the agent keeps the newest snapshot of each of the last 14 days and of each of the last 8 weeks, and removes everything else. Pruning never runs by itself: add `tidewater prune` to a weekly cron entry once you are satisfied with the rules, and try it with `--dry-run` first, because it lists what would be removed and deletes nothing.",
        "ret-1",
    )

    # ---- 5 Troubleshooting ----
    m.heading(1, "5   Troubleshooting", "h-trouble")
    m.heading(2, "5.1   Reading the logs", "h-logs")
    m.para(
        "By default the agent writes its log to the system journal. To follow it live, run `journalctl -u tidewater-agent -f`. Each line starts with a timestamp, a level and the name of the job. A failed upload looks like this:",
        "logs-1",
        gap=4.0,
    )
    m.code(
        [
            "2026-10-12T02:00:03Z INFO  nightly  scan started (2 paths)",
            "2026-10-12T02:04:51Z WARN  nightly  /var/www/cache/tmp.lock: permission denied, skipped",
            "2026-10-12T02:19:27Z ERROR nightly  upload failed: storage timeout after 30s (attempt 3 of 5)",
        ],
        "code-log",
        theme=TERMINAL,
    )
    m.heading(2, "5.2   Common error codes", "h-codes")
    m.para("Table 2 lists the errors that support sees most often, with the usual remedy for each.", "codes-1")
    m.table(
        "tab-errors",
        "Table 2: Common error codes and what to do about them.",
        ["Code", "Meaning", "What to do"],
        ERRORS,
        [0.10, 0.36, 0.54],
        {0},
    )
    m.heading(2, "5.3   Getting help", "h-help")
    m.para("If you cannot solve a problem yourself, send a diagnostic bundle to support.", "help-1", gap=3.0)
    m.item("1.", "Run `tidewater doctor --bundle` to create the bundle.", "help-1a")
    m.item("2.", "Check that it contains no data you are not allowed to share. Secrets are removed automatically, file names are not.", "help-2")
    m.item("3.", "Attach the bundle to your support request and describe what you did before the problem appeared.", "help-3")

    # ---- Appendix A ----
    m.heading(1, "Appendix A   Frequently asked questions", "h-faq")
    m.heading(2, "A.1   Backups and storage", "h-faq-backup")
    qa = [
        ("faq-1", "Can I back up a database while it is running?", "Not by copying its files: the copy can be inconsistent. Create a dump with a pre-job hook, as in the example below, and back up the dump instead."),
    ]
    for key, q, a in qa:
        m.para(f"**Q.** {q}", f"{key}-q", gap=2.0)
        m.para(f"**A.** {a}", f"{key}-a", gap=4.0)
    m.code(
        [
            "hooks:",
            "  pre: pg_dump mydb > /var/backups/mydb.sql",
        ],
        "code-hook",
        indent=18.0,
    )
    for key, q, a in [
        ("faq-2", "How much storage will I need?", "Plan for about 1.3 times the size of the data being protected, plus the changes you expect between snapshots. Compression usually saves more than the deduplication overhead costs."),
        ("faq-3", "Can two machines share one bucket?", "Yes, as long as each machine uses its own `storage.prefix`. Two agents with the same prefix will overwrite each other's catalogs."),
    ]:
        m.para(f"**Q.** {q}", f"{key}-q", gap=2.0)
        m.para(f"**A.** {a}", f"{key}-a", gap=4.0)
    m.heading(2, "A.2   Restoring and security", "h-faq-restore")
    for key, q, a in [
        ("faq-4", "I lost my encryption key. Can support recover my data?", "No. The key never leaves your machine, and without it the data cannot be decrypted, not even by us. See the warning in Section 2.1.1."),
        ("faq-5", "Does the agent work behind a proxy?", "Yes. Set `HTTPS_PROXY` in the environment of the service. The agent does not read proxy settings from `agent.yaml`."),
    ]:
        m.para(f"**Q.** {q}", f"{key}-q", gap=2.0)
        m.para(f"**A.** {a}", f"{key}-a", gap=4.0)


# ---- 封面、目录、页眉页脚 ----
def cover(m: Manual) -> None:
    doc = m.doc
    draw_logo(doc.pages[COVER], (PAGE_W / 2, 190.0), 44.0)
    doc.add(Element(id="logo", cls="figure", page=COVER, bbox=[PAGE_W / 2 - 44, 146.0, PAGE_W / 2 + 44, 234.0], text="", lines=[], attributes={"figure_type": "diagram"}))
    mid = lambda y, w=420.0: Region(COVER, (PAGE_W - w) / 2, w, y, BOTTOM)  # noqa: E731
    doc.text(mid(290.0), "doc_title", PRODUCT, TextStyle("bf", 30.0, 36.0, align="center"), key="title", gap=0)
    doc.text(mid(336.0), "doc_title", "Administrator Guide", TextStyle("it", 16.0, 20.0, align="center"), key="subtitle", gap=0)
    doc.text(mid(380.0), "publication_info", f"Version {VERSION}  ·  Document revision 4  ·  October 2026", TextStyle("rm", 9.5, 12.0, align="center"), key="edition", gap=0)
    doc.rule(COVER, PAGE_W / 2 - 60, PAGE_W / 2 + 60, 412.0, 0.8)
    doc.text(
        mid(436.0, 340.0),
        "paragraph",
        "How to install, configure and run a self-hosted backup service for servers and workstations, and what to do when something goes wrong.",
        TextStyle("rm", 10.5, 14.5, align="center"),
        key="cover-blurb",
        gap=0,
    )
    doc.text(mid(700.0), "author", "Tidewater Software Ltd. · Documentation Team", TextStyle("rm", 10.0, 13.0, align="center"), key="cover-author", gap=0)
    doc.text(
        mid(730.0, 400.0),
        "paragraph",
        "Tidewater is a trademark of Tidewater Software Ltd. The information in this document is subject to change without notice.",
        TextStyle("rm", 7.8, 10.2, align="center"),
        key="cover-legal",
        gap=0,
    )


def contents(m: Manual) -> None:
    toc = Region(TOC_PAGE, MARGIN_X + 10, TEXT_W - 20, 96.0, BOTTOM)
    m.doc.text(toc, "section_heading", "Contents", H1, key="h-toc", attributes={"level": 1}, gap=16)
    by_id = {e.id: e for e in m.doc.elements}
    for e in [e for e in m.doc.elements if e.cls == "section_heading" and e.id.startswith("h-") and e.id != "h-toc"]:
        level = e.attributes["level"]
        m.doc.toc_entry(toc, level, e.text, printed_label(e.page), key=f"toc-{e.id[2:]}", target=e.id)
    assert by_id


def furniture(m: Manual, last_page: int) -> None:
    """页眉、页脚、页码：最后画，要等知道每页在哪一章。"""
    doc = m.doc
    chapter_of: dict[int, str] = {TOC_PAGE: "Contents"}
    current = ""
    for page in range(FIRST_BODY, last_page + 1):
        # 页眉写这一页开头所在的章：页面最上面是章标题就写它，否则沿用上一页的
        heads = sorted([e for e in doc.elements if e.page == page and e.cls == "section_heading" and e.attributes.get("level") == 1], key=lambda e: e.bbox[1])
        top = min((e.bbox[1] for e in doc.elements if e.page == page and e.cls not in ("running_header", "running_footer", "page_number")), default=0)
        if heads and heads[0].bbox[1] <= top + 1:
            current = heads[0].text
        chapter_of[page] = current
        if heads:
            current = heads[-1].text
    for page in range(TOC_PAGE, last_page + 1):
        band = Region(page, MARGIN_X, 220.0, 34.0, BOTTOM)
        doc.text(band, "running_header", f"{PRODUCT} {VERSION}", HEADER, key=f"header-{page}", gap=0)
        right = Region(page, MARGIN_X + TEXT_W - 240.0, 240.0, 34.0, BOTTOM)
        doc.text(right, "running_header", chapter_of[page], HEADER_RIGHT, key=f"header-r-{page}", gap=0)
        doc.rule(page, MARGIN_X, MARGIN_X + TEXT_W, 50.0, 0.4)
        doc.rule(page, MARGIN_X, MARGIN_X + TEXT_W, 796.0, 0.4)
        doc.text(Region(page, MARGIN_X, 300.0, 803.0, 830.0), "running_footer", "© 2026 Tidewater Software Ltd. All rights reserved.", HEADER, key=f"footer-{page}", gap=0)
        doc.text(Region(page, MARGIN_X + TEXT_W - 60.0, 60.0, 803.0, 830.0), "page_number", printed_label(page), FOLIO, key=f"folio-{page}", gap=0)


def build() -> SampleDocument:
    m = Manual()
    cover(m)
    write_body(m)
    last = max(e.page for e in m.doc.elements)
    contents(m)
    furniture(m, last)
    m.doc.pdf.delete_pages(from_page=last + 1, to_page=MAX_PAGES - 1)
    # 行内代码：排版时借 inline_formula 的写法，这里改记成 inline_code（不翻，不带 latex）
    for e in m.doc.elements:
        for inline in e.inlines:
            if inline.get("latex", "").startswith(CODE_MARK):
                inline["class"] = "inline_code"
                del inline["latex"]
    m.doc.page_labels = {page: printed_label(page) for page in range(last + 1)}
    return m.doc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    doc = build()
    pdf_path, truth_path = doc.save(args.out)
    print(pdf_path, f"{len(doc.page_labels)} pages, {len(doc.elements)} elements")
    print(truth_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

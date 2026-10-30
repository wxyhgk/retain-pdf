"""造一篇 A4 双栏会议论文（约 8 页）当翻译 agent 的测试样例，每个块按 `taxonomy.py` 记下标准答案。

文档类型的特点（和 3 页样例、A5 小书不同的地方）：
- 通栏的标题、三位作者并排、摘要缩进；正文两栏，页码按会议论文集接着印（211 起）。
- 多级章节（含 3.1.1），行间公式带编号，正文里写"Eq. (3)""Figure 1""Table 2""Algorithm 1"这类交叉引用。
- 图、表浮动：引用它们的段落在前一页，图表落在后一页的栏顶；大表通栏，跨过两栏。
- 段落跨栏又跨页；参考文献 20 条在两栏里跨栏、跨页，有的条目自己也被拆开；附录 A 在参考文献之后，小节编号 A.1、A.2……

    python -m devtools.agent_lab.sample_conference --out /tmp/conference   # 在 backend/pipeline 下跑
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import fitz

from devtools.ocr_viewer.complex_sample import Region
from devtools.ocr_viewer.complex_sample import SampleDocument
from devtools.ocr_viewer.sample_layout import SUB
from devtools.ocr_viewer.sample_layout import SUP
from devtools.ocr_viewer.sample_layout import Element
from devtools.ocr_viewer.sample_layout import TextStyle
from devtools.ocr_viewer.sample_layout import block_height
from devtools.ocr_viewer.sample_layout import font
from devtools.ocr_viewer.sample_layout import r2
from devtools.ocr_viewer.sample_layout import union

PAGE_W, PAGE_H = 595.0, 842.0  # A4
MARGIN_X, TOP, BOTTOM = 56.0, 64.0, 772.0
GUTTER = 18.0
FULL_W = PAGE_W - 2 * MARGIN_X
COL_W = (FULL_W - GUTTER) / 2
MAX_PAGES = 12
FIG3_PAGE = 5  # Figure 3 落在第几页（下标）；比引用它的"误差分析"晚一页
FIRST_PAGE_NUMBER = 211  # 会议论文集：这篇从第 211 页印起
INK = (0.1, 0.1, 0.12)

BODY = TextStyle("rm", 10.4, 13.2, indent=10.0)
BODY_FIRST = TextStyle("rm", 10.4, 13.2)
H1 = TextStyle("bf", 12.0, 15.0)
H2 = TextStyle("bf", 10.8, 13.6)
H3 = TextStyle("bf", 10.4, 13.2)
CAPTION = TextStyle("rm", 8.8, 10.8)
NOTE = TextStyle("rm", 8.0, 10.0)
REF = TextStyle("rm", 9.0, 11.4)
ABSTRACT = TextStyle("rm", 9.4, 11.8)

CONFERENCE = "Synthetic Conference on Document Engineering (SCDE 2026)"
TITLE = "Budgeted Reflow: Fitting Translated Text Back into the Original Layout of Scientific Papers"

FOOTNOTE_NUMBERS = {"fn-block": "1", "fn-timing": "2", "fn-release": "3"}
FOOTNOTE_TEXT = {
    "fn-block": "Throughout the paper a block is the unit returned by the layout detector: a paragraph, a caption, a list item or a table note.",
    "fn-timing": "All timings were measured on one 8-core CPU without a GPU. Time spent waiting for rewrite requests is not included.",
    "fn-release": "The page-level annotations and the code of the length model will be released after the review period; the fixture pages are synthetic.",
}

REFERENCES = [
    "Brandt, A., Ilyin, C.: Length ratios between English and eleven target languages in scientific prose. Comput. Linguist. Rev. 12(3), 201-224 (2023)",
    "Fernandez, L., Kowalski, J., Osei, B.: Sentence length drift in machine translation of research articles. In: Proc. Workshop on Scholarly Text Processing, pp. 33-42 (2024)",
    "Nakamura, T., Rossi, G.: Shrink to fit: automatic font scaling for translated slides. In: Proc. DocEng, pp. 112-121 (2022)",
    "Haddad, M., Weiss, P.: Truncation strategies for subtitle and caption translation. Trans. Multimedia Lang. Process. 7(2), 55-71 (2021)",
    "Choi, S., Petrov, A., Mbeki, N.: Joint box and role prediction for page layout. In: Proc. SCDE, pp. 1-10 (2025)",
    "Yamada, K., Duarte, F.: A unified detector for scientific document layouts. Pattern Anal. Doc. Struct. 18(1), 14-39 (2024)",
    "Larsen, E., Ng, W.: SciPage: a benchmark of annotated pages from 5,000 papers. In: Proc. Datasets and Benchmarks Track, pp. 410-425 (2025)",
    "Whitfield, R.: Binary search for the font size in bounded text regions. Softw. Pract. Exp. 49(6), 987-1003 (2019)",
    "Aalto, V., Ferreira, D.: Optimal line breaking with bounded raggedness. J. Algorithms Typogr. 3(4), 301-322 (2018)",
    "Lindqvist, O., Sato, H.: Tolerant letter spacing for constrained layouts. In: Proc. DocEng, pp. 77-86 (2020)",
    "Schreiber, M., Tan, Y.: Length-aware beam search for neural machine translation. In: Proc. Conf. Empirical Methods in Natural Language Processing, pp. 5120-5133 (2021)",
    "Obi, C., Lemaire, F.: Prompting language models with explicit length targets. In: Findings of the Association for Computational Linguistics, pp. 2204-2219 (2024)",
    "Vasquez, I., Murata, D.: Compressing over-long translations with a second-pass editor. Mach. Transl. 38(2), 145-168 (2024)",
    "Berg, A., Chakraborty, S.: Translating PDF documents without losing their pages. In: Proc. SCDE, pp. 301-310 (2023)",
    "Kim, J., Delacroix, P., Ahmed, R.: Equation-aware translation of research papers. In: Proc. Workshop on Mathematical Document Understanding, pp. 9-18 (2025)",
    "Ortiz, M., Halvorsen, K.: Perceived legibility of reduced type sizes on screen. Int. J. Hum.-Comput. Stud. 142, 102471 (2020)",
    "Tanaka, R., Okonkwo, E.: Advance width statistics of CJK and Latin typefaces. J. Typogr. Res. 11(1), 5-27 (2022)",
    "Peretz, N., Wang, L.: Evaluating the layout fidelity of translated documents. In: Proc. Int. Conf. Document Analysis Systems, pp. 188-202 (2022)",
    "Hartmann, G.: The cost of reflow: page budgets in automated typesetting. J. Autom. Typesetting 6(2), 90-104 (2017)",
    "Sandoval, A., Li, M.: A user study on bilingual reading of scientific papers. In: Proc. Symposium on Reading and Interaction, pp. 66-79 (2023)",
]


# ---------------------------------------------------------------- 行内记号

INLINE_RE = re.compile(r"(\[\d+(?:,\s*\d+)*\]|\{fn:[\w-]+\}|\$[^$]+\$|\*\*[^*]+\*\*)")


def parse_math(src: str) -> list[tuple[str, str, str]]:
    """把 `r_i`、`f_i^0`、`\\max_{b}` 这种简写排成 (文字, 字体, 上下标) 片段。只用 Latin-1 字符，内置字体画得出来。"""
    pieces: list[tuple[str, str, str]] = []

    def add(text: str, style: str, script: str = "") -> None:
        if pieces and pieces[-1][1] == style and pieces[-1][2] == script:
            pieces[-1] = (pieces[-1][0] + text, style, script)
        else:
            pieces.append((text, style, script))

    def style_of(ch: str) -> str:
        return "it" if ch.isalpha() else "rm"

    i = 0
    while i < len(src):
        ch = src[i]
        if ch == "\\":
            j = i + 1
            while j < len(src) and src[j].isalpha():
                j += 1
            add(src[i + 1 : j], "rm")
            i = j
        elif ch in "_^":
            script = SUB if ch == "_" else SUP
            if src[i + 1] == "{":
                end = src.index("}", i)
                arg = src[i + 2 : end]
                i = end + 1
            else:
                arg = src[i + 1]
                i += 2
            if len(arg) > 1 and arg.isalpha():
                add(arg, "rm", script)
            else:
                for c in arg:
                    add(c, style_of(c), script)
        else:
            add(ch, style_of(ch))
            i += 1
    return pieces


def inline_math(src: str) -> dict:
    return {"math": parse_math(src), "latex": src}


def rich(text: str) -> list:
    """正文里的记号换成排版用的行内对象：`$公式$`、`[3, 4]` 引用、`{fn:key}` 脚注标记、`**粗体**`。"""
    content: list = []
    for part in INLINE_RE.split(text):
        if not part:
            continue
        if part.startswith("**"):
            content.append({"b": part[2:-2]})
        elif part.startswith("["):
            content.append({"cite": part})
        elif part.startswith("{fn:"):
            key = part[4:-1]
            content.append({"fn": FOOTNOTE_NUMBERS[key], "target": key})
        elif part.startswith("$"):
            content.append(inline_math(part[1:-1]))
        else:
            content.append(part)
    return content


# ---------------------------------------------------------------- 图和大表

def _arrow(page: fitz.Page, a: tuple[float, float], b: tuple[float, float], *, dashed: bool = False) -> None:
    page.draw_line(a, b, color=INK, width=0.7, dashes="[2 1.5] 0" if dashed else None)
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** 0.5 or 1.0
    ux, uy = dx / n, dy / n
    head = [
        fitz.Point(*b),
        fitz.Point(b[0] - 4.5 * ux + 2.2 * uy, b[1] - 4.5 * uy - 2.2 * ux),
        fitz.Point(b[0] - 4.5 * ux - 2.2 * uy, b[1] - 4.5 * uy + 2.2 * ux),
    ]
    page.draw_polyline(head + [head[0]], color=INK, fill=INK, width=0.3)


def figure_pipeline(doc: SampleDocument, region: Region, height: float, *, key: str, gap: float = 4.0) -> Element:
    """Figure 1：整条流程的示意图（方框和箭头），算图的一部分，图里的字不单独出块。"""
    page = doc.pages[region.page]
    rect = fitz.Rect(region.x, region.y, region.x + region.width, region.y + height)
    page.draw_rect(rect, color=(0.82, 0.84, 0.88), width=0.4)
    bw, bh = 62.0, 24.0
    xs = [rect.x0 + 8, rect.x0 + 8 + (rect.width - 16 - bw) / 2, rect.x1 - 8 - bw]
    y1, y2 = rect.y0 + 14, rect.y0 + height - 14 - bh
    boxes = {
        "src": (xs[0], y1, "Source blocks"),
        "tr": (xs[1], y1, "Translation"),
        "len": (xs[2], y1, "Length model"),
        "search": (xs[2], y2, "Budgeted search"),
        "cand": (xs[1], y2, "Feasible scales"),
        "out": (xs[0], y2, "Typeset page"),
    }
    for x, y, label in boxes.values():
        r = fitz.Rect(x, y, x + bw, y + bh)
        page.draw_rect(r, color=INK, fill=(0.93, 0.95, 0.98), width=0.7)
        width = font("sf").text_length(label, 6.4)
        page.insert_text((x + (bw - width) / 2, y + bh / 2 + 2.3), label, fontname="helv", fontsize=6.4)

    def mid(name: str, side: str) -> tuple[float, float]:
        x, y, _ = boxes[name]
        return {"r": (x + bw, y + bh / 2), "l": (x, y + bh / 2), "b": (x + bw / 2, y + bh), "t": (x + bw / 2, y)}[side]

    _arrow(page, mid("src", "r"), mid("tr", "l"))
    _arrow(page, mid("tr", "r"), mid("len", "l"))
    _arrow(page, mid("len", "b"), mid("search", "t"))
    _arrow(page, mid("search", "l"), mid("cand", "r"))
    _arrow(page, mid("cand", "l"), mid("out", "r"))
    # 回到翻译的虚线：改写请求
    a, b = (xs[1] + bw * 0.5, y2), (xs[1] + bw * 0.5, y1 + bh)
    _arrow(page, a, b, dashed=True)
    page.insert_text((a[0] + 3, (a[1] + b[1]) / 2 + 2.5), "rewrite request", fontname="helv", fontsize=5.6)
    element = doc.add(
        Element(id=key, cls="figure", page=region.page, bbox=r2(rect), text="", lines=[], attributes={"figure_type": "diagram"})
    )
    region.y += height + gap
    return element


def wide_table(
    doc: SampleDocument,
    region: Region,
    groups: list[tuple[str, int, int]],
    header: list[str],
    rows: list[list[str]],
    widths: list[float],
    *,
    key: str,
    bold_row: int | None = None,
    gap: float = 4.0,
) -> Element:
    """通栏大表：上面一行是跨列的分组表头，下面是列名和数据；第一列靠左，其余靠右。"""
    page = doc.pages[region.page]
    size, row_h = 7.8, 11.6
    total = sum(widths)
    col_w = [region.width * w / total for w in widths]
    starts = [region.x + sum(col_w[:i]) for i in range(len(col_w))]
    top = region.y

    def rule(y: float, w: float) -> None:
        doc.rule(region.page, region.x, region.x + region.width, y, w)

    rule(top, 0.9)
    y = top + 2.0
    lines: list[dict] = []

    def draw_row(cells: list[tuple[str, int, int]], style: str, align_first_left: bool) -> None:
        nonlocal y
        f = font(style)
        baseline = y + f.ascender * size
        boxes = []
        for text, c0, c1 in cells:
            x0, x1 = starts[c0], starts[c1] + col_w[c1]
            tw = f.text_length(text, size)
            if c0 == 0 and align_first_left:
                x = x0 + 2.0
            elif c0 != c1:
                x = x0 + (x1 - x0 - tw) / 2
            else:
                x = x1 - tw - 4.0
            page.insert_text((x, baseline), text, fontname="tibo" if style == "bf" else "tiro", fontsize=size)
            boxes.append([x, baseline - f.ascender * size, x + tw, baseline - f.descender * size])
        lines.append({"bbox": r2(union(boxes)), "text": " | ".join(t for t, _, _ in cells)})
        y += row_h

    # 分组表头：第一列留空，不记成文字
    f = font("bf")
    baseline = y + f.ascender * size
    group_boxes = []
    for label, c0, c1 in groups:
        x0, x1 = starts[c0], starts[c1] + col_w[c1]
        tw = f.text_length(label, size)
        x = x0 + (x1 - x0 - tw) / 2
        page.insert_text((x, baseline), label, fontname="tibo", fontsize=size)
        group_boxes.append([x, baseline - f.ascender * size, x + tw, baseline - f.descender * size])
        page.draw_line((x0 + 3, y + row_h - 0.5), (x1 - 3, y + row_h - 0.5), color=(0.35, 0.35, 0.38), width=0.4)
    lines.append({"bbox": r2(union(group_boxes)), "text": " | ".join(label for label, _, _ in groups)})
    y += row_h + 1.0
    draw_row([(text, i, i) for i, text in enumerate(header)], "bf", True)
    rule(y + 0.5, 0.5)
    y += 2.5
    for index, row in enumerate(rows):
        draw_row([(text, i, i) for i, text in enumerate(row)], "bf" if index == bold_row else "rm", True)
    bottom = y + 1.5
    rule(bottom, 0.9)
    element = doc.add(
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


# ---------------------------------------------------------------- 排版器

class Writer:
    """在一串栏位里依次往下排。`idx` 指向当前栏；段落写不下会自己接到下一栏，排完再把 `idx` 对齐到它实际结束的栏。"""

    def __init__(self, doc: SampleDocument) -> None:
        self.doc = doc
        self.idx = 0
        self.tops: dict[int, float] = {}
        self.flush_left = True  # 标题、公式、图表之后的段落不缩进

    @property
    def region(self) -> Region:
        return self.doc.flow[self.idx]

    def remaining(self) -> float:
        return self.region.bottom - self.region.y

    def ensure(self, height: float) -> None:
        while self.remaining() < height and self.idx < len(self.doc.flow) - 1:
            self.idx += 1

    def _sync(self, last: Element) -> None:
        x0 = last.bbox[0]
        for k, r in enumerate(self.doc.flow):
            if r.page == last.page and r.x - 1.0 <= x0 < r.x + r.width:
                self.idx = k

    def text(self, cls: str, content, ts: TextStyle, *, key: str, gap: float = 4.0, **kwargs) -> list[Element]:
        made = self.doc.text(self.region, cls, content, ts, key=key, gap=gap, split=True, **kwargs)
        self._sync(made[-1])
        return made

    def h(self, level: int, title: str, key: str) -> None:
        ts = {1: H1, 2: H2, 3: H3}[level]
        self.ensure(block_height(1, ts) + 4 + 2 * BODY.leading + 8)
        if self.region.y > self.tops.get(self.idx, 1e9) + 0.5:
            self.region.y += {1: 7.0, 2: 5.0, 3: 3.0}[level]
        self.text("section_heading", title, ts, key=key, attributes={"level": level}, gap=4 if level == 1 else 3)
        self.flush_left = True

    def p(self, text: str, key: str, *, gap: float = 4.0) -> list[Element]:
        self.ensure(2 * BODY.leading + 2)
        made = self.text("paragraph", rich(text), BODY_FIRST if self.flush_left else BODY, key=key, gap=gap)
        self.flush_left = False
        return made

    def eq(self, pieces, number: str, key: str, latex: str) -> None:
        self.ensure(30.0)
        self.doc.display_formula(self.region, pieces, number, key=key, latex=latex)
        self.flush_left = True

    def items(self, entries: list[str], key: str) -> None:
        """缩进的编号列表，一项一个块。每项都不跨栏，开头先留够位置。"""
        for n, entry in enumerate(entries, start=1):
            self.ensure(3 * BODY.leading + 6)
            r = self.region
            sub = Region(r.page, r.x + 10, r.width - 10, r.y, r.bottom)
            made = self.doc.text(sub, "list_item", rich(f"({n})  {entry}"), BODY_FIRST, key=f"{key}-{n}", gap=2)
            r.y = sub.y
        self.region.y += 2.0
        self.flush_left = True

    def table(self, caption: str, rows: list[list[str]], key: str, *, note: str | None = None) -> None:
        self.ensure(len(rows) * 12.0 + 62.0)
        self.text("table_caption", rich(caption), CAPTION, key=f"{key}-cap", relations={"caption_of": [key]}, gap=3)
        self.doc.table(self.region, rows, key=key, gap=2)
        if note:
            self.text("float_note", rich(note), NOTE, key=f"{key}-note", relations={"note_of": key}, gap=2)
        self.region.y += 6.0
        self.flush_left = True

    def algorithm(self, caption: str, body, key: str) -> None:
        self.ensure(len(body) * 10.6 + 56.0)
        self.doc.algorithm(self.region, caption, body, key=key)
        self.flush_left = True


def _pieces(src: str) -> list[tuple[str, str, str]]:
    return parse_math(src)


# ---------------------------------------------------------------- 整篇论文

def _build(places: dict[str, tuple[int, int]]) -> SampleDocument:
    doc = SampleDocument(pages=MAX_PAGES, size=(PAGE_W, PAGE_H), document_id="sample_conference", title=TITLE)
    full = lambda y, page=0, bottom=BOTTOM: Region(page, MARGIN_X, FULL_W, y, bottom)  # noqa: E731

    # ---- 第 1 页：通栏的标题、三位作者并排、出版信息、摘要、关键词 ----
    top = full(TOP)
    made = doc.text(
        Region(0, 70.0, PAGE_W - 140.0, TOP, BOTTOM),
        "doc_title",
        TITLE,
        TextStyle("bf", 16.0, 19.5, align="center"),
        key="title",
        gap=8,
    )
    top.y = made[-1].bbox[3] + 9.0
    authors = [
        ("Hannah Okafor", "1", "Department of Computer Science, Northfield University, Leeds, United Kingdom. h.okafor@northfield.example"),
        ("Daniel Reyes", "2", "Language Technology Laboratory, Meridian Institute, Toronto, Canada. d.reyes@meridian.example"),
        ("Mingyu Zhao", "1", "Department of Computer Science, Northfield University, Leeds, United Kingdom. m.zhao@northfield.example"),
    ]
    band_w = FULL_W / 3
    bottom_y = top.y
    for index, (name, mark, affil) in enumerate(authors, start=1):
        col = Region(0, MARGIN_X + (index - 1) * band_w + 6, band_w - 12, top.y, BOTTOM)
        doc.text(col, "author", [name, {"sup": mark}], TextStyle("rm", 10.5, 13.0, align="center"), key=f"author-{index}", gap=2)
        doc.text(col, "affiliation", affil, TextStyle("it", 8.0, 9.8, align="center"), key=f"affil-{index}", gap=0)
        bottom_y = max(bottom_y, col.y)
    top.y = bottom_y + 7.0
    doc.text(
        top,
        "publication_info",
        "Proceedings of the 14th Synthetic Conference on Document Engineering (SCDE 2026), 14-18 September 2026, Valencia, Spain  -  doi:10.0000/scde.2026.0211",
        TextStyle("rm", 7.6, 9.6, align="center"),
        key="pubinfo",
        gap=9,
    )
    abstract = Region(0, MARGIN_X + 26, FULL_W - 52, top.y, BOTTOM)
    doc.text(abstract, "section_heading", "Abstract", TextStyle("bf", 9.6, 12.0, align="center"), key="h-abstract", attributes={"level": 1}, gap=3)
    doc.text(
        abstract,
        "abstract",
        rich(
            "Translating a scientific paper while keeping its page layout is harder than translating its text: translated sentences are rarely "
            "as long as their sources, and the boxes they have to return to are fixed. We study this fitting problem and propose Budgeted Reflow, "
            "a method that chooses a font scale, a line spacing and, when nothing else works, a rewrite request for every text block under a "
            "shared page budget. The method rests on a small length model that predicts the number of lines a translated block needs "
            "from its character count and the metrics of the font; the prediction is off by 0.31 lines on average. On 412 pages from 38 papers "
            "translated into four languages, Budgeted Reflow lowers the share of overflowing blocks from 17.8% to 3.1% at a median font "
            "reduction of 5.8%, where shrinking every block until it fits needs a reduction of 19.7%. A study with 12 readers confirms "
            "that the pages remain easy to read."
        ),
        ABSTRACT,
        key="abstract",
        gap=4,
    )
    doc.text(
        abstract,
        "keywords",
        "Keywords: document translation; layout preservation; text fitting; typesetting; scientific PDF",
        TextStyle("rm", 8.6, 10.8),
        key="keywords",
        gap=0,
    )
    columns_top = abstract.y + 9.0
    doc.rule(0, MARGIN_X, PAGE_W - MARGIN_X, columns_top - 4.5, 0.5)

    # ---- 栏位：每页两栏，第 1 页在前言下面 ----
    flow: list[Region] = []
    for page in range(MAX_PAGES):
        y0 = columns_top if page == 0 else TOP
        flow.append(Region(page, MARGIN_X, COL_W, y0, BOTTOM))
        flow.append(Region(page, MARGIN_X + COL_W + GUTTER, COL_W, y0, BOTTOM))
    doc.flow = flow
    w = Writer(doc)
    for k, r in enumerate(flow):
        w.tops[k] = r.y

    def column(page: int, side: int) -> Region:
        return flow[page * 2 + side]

    def full_band(page: int, y: float | None = None) -> Region:
        return Region(page, MARGIN_X, FULL_W, TOP if y is None else y, BOTTOM)

    # ---- 先排会"浮"到后面栏顶或栏底的东西：脚注、图、通栏大表 ----
    # 脚注要先占好栏底，正文才会停在它上面；图表放在引用它们的段落之后的栏顶。
    for key, (page, side) in places.items():
        doc.footnote_bottom(
            column(page, side),
            [{"sup": FOOTNOTE_NUMBERS[key]}, " " + FOOTNOTE_TEXT[key]],
            key=key,
            relations={},  # 挂在哪一块上，等正文排完看标记落在哪块再补
        )

    # Figure 1（流程图）：引言里提到，落在第 2 页右栏顶
    r = column(1, 1)
    figure_pipeline(doc, r, 106.0, key="fig1")
    doc.text(
        r,
        "figure_caption",
        rich("**Figure 1:** Overview of Budgeted Reflow. Translated blocks pass through a length model; the search picks a feasible scale for each block and sends a rewrite request back to the translator when none exists."),
        CAPTION,
        key="fig1-cap",
        relations={"caption_of": ["fig1"]},
        gap=8,
    )

    # Table 2（通栏大表）：第 4 页顶，跨过两栏；正文在第 3 页末尾提到它
    band = full_band(3)
    doc.text(
        band,
        "table_caption",
        rich("**Table 2:** Overflow rate (OR, %) and median font reduction (MFR, %) per target language, averaged over 38 papers. Lower is better in every column; the last column is the time per page."),
        CAPTION,
        key="tab2-cap",
        relations={"caption_of": ["tab2"]},
        gap=3,
    )
    wide_table(
        doc,
        band,
        [("Chinese", 1, 2), ("German", 3, 4), ("Japanese", 5, 6), ("Spanish", 7, 8), ("Mean", 9, 10)],
        ["Method", "OR", "MFR", "OR", "MFR", "OR", "MFR", "OR", "MFR", "OR", "MFR", "Time (s)"],
        [
            ["Fixed scale 0.9", "11.2", "10.0", "24.6", "10.0", "9.9", "10.0", "25.5", "10.0", "17.8", "10.0", "0.02"],
            ["Shrink to fit", "0.4", "14.1", "0.8", "24.9", "0.3", "13.2", "0.9", "26.7", "0.6", "19.7", "0.05"],
            ["Rewrite only", "6.3", "0.0", "9.4", "0.0", "5.9", "0.0", "10.8", "0.0", "8.1", "0.0", "4.10"],
            ["Per-block search*", "2.9", "6.8", "5.2", "11.9", "2.5", "6.3", "5.8", "12.7", "4.1", "9.4", "0.31"],
            ["Budgeted Reflow", "1.7", "3.9", "4.6", "7.8", "1.5", "3.5", "4.6", "8.0", "3.1", "5.8", "0.42"],
        ],
        [2.3, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 1.1],
        key="tab2",
        bold_row=4,
        gap=2,
    )
    doc.text(
        band,
        "float_note",
        rich("* Per-block search picks the best candidate of each block independently and has no page budget."),
        NOTE,
        key="tab2-note",
        relations={"note_of": "tab2"},
        gap=0,
    )
    for side in (0, 1):
        column(3, side).y = band.y + 10.0
        w.tops[3 * 2 + side] = column(3, side).y

    # Figure 2（两张子图共用一个图注）：第 5 页左栏顶，对应第 4 页的结果段
    r = column(4, 0)
    doc.figure(r, 92.0, key="fig2", seed=2, panels=2, gap=4)
    doc.text(
        r,
        "figure_caption",
        rich("**Figure 2:** (a) Overflow rate by expansion ratio of the block. (b) Median font reduction by page budget. Both panels share this caption."),
        CAPTION,
        key="fig2-cap",
        relations={"caption_of": ["fig2a", "fig2b"]},
        gap=8,
    )

    # Figure 3（通栏，三张子图共用一个图注）：误差分析一节在前一页，图落在这一页的栏顶
    band = full_band(FIG3_PAGE)
    doc.figure(band, 104.0, key="fig3", seed=5, panels=3, gap=4)
    doc.text(
        band,
        "figure_caption",
        rich("**Figure 3:** Cumulative share of overflowing blocks, sorted by block length, for (a) German, (b) Spanish and (c) Japanese. The three panels share this caption."),
        CAPTION,
        key="fig3-cap",
        relations={"caption_of": ["fig3a", "fig3b", "fig3c"]},
        gap=0,
    )
    for side in (0, 1):
        column(FIG3_PAGE, side).y = band.y + 8.0
        w.tops[FIG3_PAGE * 2 + side] = column(FIG3_PAGE, side).y

    # ---------------------------------------------------------------- 正文
    w.h(1, "1   Introduction", "h-intro")
    w.p(
        "Scientific papers are read across language boundaries more and more, and a faithful translation is only the first requirement of a "
        "useful one. Readers navigate by figures, equations and tables, and they expect the translated page to look like the page they know. "
        "Layout-preserving translation therefore tries to put every translated block back into the box it came from, so that Figure 1 still "
        "sits beside the paragraph that explains it and the equation numbers still line up with the sentences that cite them.{fn:fn-block} "
        "Figure 1 gives an overview of the approach we study in this paper.",
        "intro-1",
    )
    w.p(
        "The difficulty is that translation changes length. English to German typically widens running text by 15 to 25 percent, English to "
        "Chinese narrows it by a similar amount, and the amount varies strongly from block to block [1, 2]. A box that holds an English "
        "paragraph exactly will overflow after translation into German and leave a blank band after translation into Chinese. The usual "
        "remedies are blunt: shrink the font until everything fits [3], truncate the translation [4], or apply one global scale to the whole "
        "document. Each of them hurts readability somewhere, and none of them knows how much room the neighbouring blocks have left.",
        "intro-2",
    )
    w.p(
        "We treat fitting as a budgeted decision problem. For each block we enumerate a small set of typographic candidates, a font scale "
        "and a line spacing, discard those that violate the box constraint of Eq. (3), and choose among the rest so that the total loss of "
        "legibility on the page is small and no single block suffers much more than the others. When a block has no feasible candidate we "
        "ask the translator for a shorter rewrite instead of shrinking the text below a readable size. A page-level budget keeps the local "
        "decisions from adding up to a page that is uniformly too small. In summary, this paper makes three contributions:",
        "intro-3",
    )
    w.items(
        [
            "a length model that predicts the number of lines a translated block needs from its character count and the font metrics, with an average error of 0.31 lines;",
            "Budgeted Reflow, a search procedure with a page-level shrink budget and a rewrite fallback;",
            "an evaluation on 412 pages from 38 papers in four target languages, together with a study of reader-perceived legibility.",
        ],
        "contrib",
    )
    w.p(
        "Section 2 reviews related work, Section 3 formalizes the problem, Section 4 describes the method and Section 5 reports the "
        "experiments. Limitations and open questions are discussed in Section 6.",
        "intro-4",
    )

    w.h(1, "2   Related Work", "h-related")
    w.p(
        "**Layout analysis.** Detecting blocks and their roles on a page has been studied for decades. Recent detectors predict boxes and "
        "classes jointly [5, 6], and benchmarks now cover scientific papers, forms and slides [7]. We take the detector as given and assume that "
        "blocks, captions and their relations are available as input.",
        "rw-1",
    )
    w.p(
        "**Text fitting.** Fitting text into a fixed region appears in subtitle placement, poster generation and responsive typography. Classical "
        "approaches choose the font size by binary search so that a paragraph fills its box [8], and optimal line breaking minimizes raggedness "
        "over a whole paragraph [9]. Lindqvist and Sato [10] adjust the letter spacing inside a tolerance, a trick we also use at the margin of "
        "what is legible. These methods optimize one block at a time and have no notion of a page budget.",
        "rw-2",
    )
    w.p(
        "**Typography and legibility.** Studies of reading on screen find that legibility falls quickly below about 6.5 points, and that "
        "readers tolerate a smaller size better when it is applied consistently across a page than when single blocks shrink on their own "
        "[16]. Mean advance widths differ by script: the advances of common CJK faces are close to one em, while Latin text faces average "
        "between 0.42 and 0.50 em [17]. Both findings enter our method, the first as a floor on the font size and a preference for balanced "
        "reductions, the second through the mean advance $c$ of Section 3.1.",
        "rw-typo",
    )
    w.p(
        "**Length-controlled translation.** A parallel line of work asks the translation model itself to respect a length limit, through "
        "length-aware decoding [11], prompts that state a target length [12], or a second pass that compresses an over-long sentence [13]. "
        "Rewriting changes the meaning more easily than rescaling does, so we use it only as a fallback and report how often it is needed.",
        "rw-3",
    )
    w.p(
        "**Layout-preserving document translation.** Several systems translate PDF documents while keeping figures and equations in place "
        "[14, 15]. Their evaluation is mostly visual. To our knowledge no benchmark reports overflow and font reduction per block, the two "
        "quantities on which we focus [18].",
        "rw-4",
    )

    w.h(1, "3   Problem Formulation", "h-problem")
    w.h(2, "3.1   Blocks and Boxes", "h-blocks")
    w.p(
        "A page contains $N$ text blocks. Block $i$ has a box of width $w_i$ and height $h_i$ in points, a source text of $n_i$ characters set "
        "at font size $f_i^0$, and a translation of $m_i$ characters. The translation may be set in another typeface, a CJK face for instance, "
        "so we describe a font by its mean advance $c$, the width of an average character in units of the font size [17]. The source font "
        "has the advance $c_0$.",
        "blocks-1",
    )
    w.h(3, "3.1.1   Expansion ratio", "h-ratio")
    w.p(
        "The expansion ratio of block $i$ is the width of the translation divided by the width of the source at the same font size:",
        "ratio-1",
    )
    w.eq(
        _pieces("r_i = c m_i / (c_0 n_i)"),
        "(1)",
        "eq1",
        r"r_i = \frac{c\, m_i}{c_0\, n_i}",
    )
    w.p(
        "Values above 1 mean that the translation is wider than the source. Across our data $r_i$ ranges from 0.52 to 2.30; Table 1 "
        "summarizes its distribution per language. The ratio belongs to the translation and the font and not to the layout, so it can be "
        "computed before any box is touched. Short blocks vary more than long ones: the standard deviation of $r_i$ for blocks under 40 "
        "characters is 0.41, compared with 0.12 above 200 characters. Captions and headings are therefore the first blocks to overflow.",
        "ratio-2",
    )
    w.table(
        "**Table 1:** Blocks and expansion ratio per target language (English source).",
        [
            ["Language", "Blocks", "Mean r", "r > 1.2 (%)"],
            ["Chinese", "9,412", "0.93", "13.5"],
            ["German", "9,412", "1.19", "44.8"],
            ["Japanese", "9,412", "0.97", "15.2"],
            ["Spanish", "9,412", "1.16", "41.3"],
        ],
        "tab1",
    )
    w.h(2, "3.2   Feasible Candidates", "h-feasible")
    w.p(
        "Let $f$ be a font size and $k$ a line spacing factor. If a line holds $w_i / (c f)$ characters, the translation needs at least",
        "feasible-1",
    )
    w.eq(
        _pieces(r"l_i(f) = \ceil(c m_i f / w_i)"),
        "(2)",
        "eq2",
        r"l_i(f) = \lceil c\, m_i f / w_i \rceil",
    )
    w.p(
        "lines. A candidate $(f, k)$ is feasible for block $i$ when the lines fit into the box:",
        "feasible-2",
    )
    w.eq(
        _pieces("k f l_i(f) <= h_i"),
        "(3)",
        "eq3",
        r"k\, f\, l_i(f) \le h_i",
    )
    w.p(
        "Because real line breaking happens at word boundaries, Eq. (2) is a lower bound on the number of lines. Appendix A shows that the "
        "gap is below one line in expectation, so we add a safety margin of one line for blocks with more than two lines and none for "
        "shorter ones. Inline formulas, citation markers such as [16] and footnote marks are kept as atoms: their width counts in $m_i$ and "
        "they are never split.",
        "feasible-3",
    )
    w.h(2, "3.3   Page Budget", "h-budget")
    w.p(
        "Choosing a candidate with font size $f_i$ costs the relative reduction of the size, squared so that one very small block is worse "
        "than several slightly smaller ones:",
        "budget-1",
    )
    w.eq(
        _pieces("D_i(f) = (1 - f / f_i^0)^2"),
        "(4)",
        "eq4",
        r"D_i(f) = \left(1 - f / f_i^0\right)^2",
    )
    w.p(
        "The page objective adds the worst block to the mean, which keeps the reduction balanced across the page, and the mean is limited "
        "by a budget $b$ that the user can set [19]:",
        "budget-2",
    )
    w.eq(
        _pieces(r"J(f) = E_i[D_i(f_i)] + a \max_i D_i(f_i)"),
        "(5)",
        "eq5",
        r"J(f) = \mathbb{E}_i\left[D_i(f_i)\right] + a \max_i D_i(f_i)",
    )
    w.p(
        "subject to Eq. (3) for every block and $E_i[D_i(f_i)] <= b$. Table 2 shows that a budget of $b = 0.01$ is enough for most pages.",
        "budget-3",
    )

    w.h(2, "3.4   Assumptions", "h-assume")
    w.p(
        "We assume that (i) the layout detector provides the boxes of all text blocks and their reading order, (ii) a block may change its "
        "font size and line spacing but not its box, and (iii) the translation of a block is available before fitting starts. "
        "Assumption (ii) rules out the common trick of letting a paragraph grow into the white space below it; we return to this in "
        "Section 7. Assumption (iii) means that a rewrite changes the translation of one block only and never that of its neighbours, "
        "which keeps the fitting step local and makes its result easy to reproduce.",
        "assume-1",
    )

    w.h(1, "4   Method", "h-method")
    w.h(2, "4.1   Candidate Generation", "h-cands")
    w.p(
        "The candidate set contains the font scales 1.00, 0.95, 0.90, 0.85 and 0.80 of the original size, each with the line spacings 1.20, "
        "1.10 and 1.00, fifteen pairs in all. Sizes below 6.5 points are never offered, because readers report a sharp drop in "
        "legibility there [16]. For a block that is already below this size, the original size is the only candidate. Candidates are "
        "evaluated with Eq. (2) and Eq. (3); the cost of a block is the cost of its cheapest feasible candidate.",
        "cands-1",
    )
    w.h(2, "4.2   Budgeted Search", "h-search")
    w.p(
        "Choosing each block's cheapest candidate would minimize the mean of Eq. (4) but not the maximum in Eq. (5), and it would ignore the "
        "budget. Algorithm 1 therefore visits the blocks in order of increasing slack, that is the number of candidates that stay feasible, and "
        "freezes a block at its current size as soon as the shrink accumulated on the page reaches the budget $b$.",
        "search-1",
    )
    w.algorithm(
        "Algorithm 1: Budgeted search over feasible scales",
        [
            (0, [("Input: ", "bf"), ("blocks ", "rm"), ("B", "it"), (", candidates ", "rm"), ("F", "it"), (", budget ", "rm"), ("b", "it")]),
            (0, [("for each ", "bf"), ("i", "it"), (" in ", "rm"), ("B", "it"), (" do", "bf")]),
            (1, [("C", "it"), ("(i)", "rm"), (" := candidates in ", "rm"), ("F", "it"), (" that satisfy Eq. (3)", "rm")]),
            (1, [("if ", "bf"), ("C", "it"), ("(i)", "rm"), (" is empty then request a rewrite of ", "rm"), ("i", "it")]),
            (0, [("sort ", "bf"), ("B", "it"), (" by slack, smallest first", "rm")]),
            (0, [("for each ", "bf"), ("i", "it"), (" in ", "rm"), ("B", "it"), (" do", "bf")]),
            (1, [("choose the candidate in ", "rm"), ("C", "it"), ("(i)", "rm"), (" that minimizes ", "rm"), ("J", "it")]),
            (1, [("if the shrink so far exceeds ", "rm"), ("b", "it"), (" then freeze ", "rm"), ("i", "it")]),
            (0, [("return ", "bf"), ("the chosen candidates", "rm")]),
        ],
        "algo1",
    )
    w.p(
        "Sorting by slack lets the blocks with the fewest options choose first, which is the usual heuristic for constraint problems of this "
        "kind. The loop runs in $O(N |F|)$ time; on a page with 70 blocks it takes 0.4 seconds, less than one tenth of the time that "
        "re-translating a single block takes. After the loop, a second pass tries to grow each shrunk block by one step as long as Eq. (3) still holds, because the "
        "early choices on a page were made before the sizes of the later blocks were known; this pass changed fewer than 2% of the decisions "
        "in our data.",
        "search-2",
    )
    w.h(2, "4.3   Rewrite Requests", "h-rewrite")
    w.p(
        "If a block has no feasible candidate, the translator receives the translation, the box and the number of characters that fit at the "
        "smallest allowed size, and is asked for a shorter version [12, 13]. The rewrite is accepted when a similarity check between the old and "
        "the new translation scores above 0.85. Otherwise we keep the original translation, take the candidate with the smallest overflow "
        "and mark the block so that a human can look at it. In our experiments 2.4% of the blocks needed a rewrite request and 0.6% ended "
        "up marked.",
        "rewrite-1",
    )
    w.h(2, "4.4   Implementation", "h-impl")
    w.p(
        "Budgeted Reflow runs after translation and before typesetting. Text is set with the PDF library that produced the page, glyph "
        "advances come from the embedded font, and the mean advance $c$ is measured on the translated text itself instead of a table, "
        "which matters for Japanese and Chinese where punctuation and Latin words occupy very different widths. Each block keeps its "
        "original position; only the font size and the line spacing change, so figures, tables and equation numbers stay where they were.",
        "impl-1",
    )

    w.h(2, "4.5   A Bound on the Budget", "h-bound")
    w.p(
        "**Proposition 1.** Let $s_{max}$ be the largest single-step increase of $D_i$ between two candidates of the same block. When "
        "Algorithm 1 stops, the mean shrink on the page exceeds the budget $b$ by at most $s_{max} / N$. The proof is given in Appendix A.2. "
        "The proposition lets a user predict the worst case before a page is processed: with the candidates of Section 4.1 the largest step "
        "of Eq. (4) is 0.04, so a page of 70 blocks cannot exceed its budget by more than 0.0006.",
        "bound-1",
    )
    w.p(
        "The bound is loose in a useful direction. It holds for any visiting order, but the order by slack makes it rare that the last blocks "
        "of the loop are the ones with many options; in our data the budget was exceeded on 3.9% of the pages and never by more than "
        "0.0004. Pages that are exceeded by the full step are almost always pages with a block that has a single feasible candidate far "
        "below its original size, and these are the pages for which a rewrite request is cheaper than any amount of shrinking.",
        "bound-2",
    )

    w.h(1, "5   Experiments", "h-exp")
    w.h(2, "5.1   Data and Setup", "h-data")
    w.p(
        "We collected 38 open-access papers in computer science, physics and economics, 412 pages in all, and translated them from English into "
        "Chinese, German, Japanese and Spanish with the same translation model. Block boxes and roles come from the detector of [6] and were "
        "corrected by hand on a sample of 40 pages. Headers, footers, figures and tables are not translated and are kept as they are; "
        "equations stay untouched. Table 1 lists the number of blocks and the expansion ratios.{fn:fn-timing}",
        "data-1",
    )
    w.h(2, "5.2   Baselines and Metrics", "h-base")
    w.p(
        "We compare against four baselines. Fixed scale applies one factor of 0.9 to every block. Shrink to fit lowers the size of each block "
        "until the text fits, down to a floor of 4 points. Rewrite only keeps the font and asks the translator to shorten every block that "
        "overflows. Per-block search is our method without the page budget and without the balancing term of Eq. (5). We report the "
        "overflow rate (OR), the share of blocks whose text does not fit into its box, and the median font reduction (MFR) over all "
        "blocks, as well as the time per page without the translator.",
        "base-1",
    )
    w.h(2, "5.3   Main Results", "h-results")
    w.p(
        "Table 2 reports the results per language. Fixed scale overflows on one block in six and does so mostly in German and Spanish, where "
        "$r_i$ is large. Shrink to fit almost never overflows, but only because it is willing to reduce the font by a fifth: its median "
        "reduction is 19.7% against 5.8% for Budgeted Reflow, and for German and Spanish it exceeds 24%. Rewrite only keeps the "
        "font size but overflows on 8.1% of the blocks, since the translator cannot always shorten a sentence enough without losing a "
        "term that must be kept. Budgeted Reflow has an overflow rate of 3.1% and needs a much smaller reduction than the "
        "baselines that overflow less.",
        "results-1",
    )
    w.p(
        "Figure 2 shows where the remaining overflows come from. Panel (a) plots the overflow rate against the expansion ratio of "
        "the block: below 1.3 almost nothing overflows, and the rate grows quickly above 1.6, where the translation is more than half "
        "again as wide as the source and the box has no room left. Panel (b) shows the effect of the page budget $b$. The median "
        "reduction rises almost linearly up to $b = 0.01$ and flattens afterwards, because beyond that point the neighbours of the "
        "overflowing blocks have no slack to give. The budget therefore protects short blocks, which have the largest variance of $r_i$, from "
        "being shrunk at the expense of long paragraphs that could have taken a small reduction.",
        "results-2",
    )
    w.p(
        "The differences between languages follow the expansion ratios of Table 1. Japanese and Chinese blocks are narrower than their "
        "sources on average, and the few that overflow contain long Latin terms and inline formulas, which keep their width. German "
        "compounds produce long words that cannot be broken, so a narrow box fails even when the total width would fit; we count these "
        "cases as overflow, and they account for about a third of the German failures. The per-page time of 0.42 seconds is "
        "dominated by font measurements and is independent of the language.",
        "results-3",
    )
    w.h(2, "5.4   Ablation", "h-ablation")
    w.p(
        "Table 3 removes one component at a time. Without rewrite requests the overflow rate nearly doubles, which shows that "
        "some blocks cannot be fitted by typography alone. Dropping the balancing term of Eq. (5) hurts the font reduction most, from 5.8% to "
        "9.4%, since the search then happily shrinks a single block to the allowed floor. Fixing the line spacing at 1.2 costs "
        "0.7 points of overflow.",
        "ablation-1",
    )
    w.table(
        "**Table 3:** Ablation of Budgeted Reflow on all four languages. LS is the legibility score on a scale from 1 to 5.",
        [
            ["Variant", "OR (%)", "MFR (%)", "LS"],
            ["Full method", "3.1", "5.8", "4.4"],
            ["No rewrite requests", "5.7", "6.2", "4.3"],
            ["No balancing, Eq. (5)", "4.1", "9.4", "4.0"],
            ["Fixed line spacing", "3.8", "7.9", "4.2"],
        ],
        "tab3",
        note="LS: mean rating of 12 readers, who saw each page without knowing the method.",
    )
    w.h(2, "5.5   Reader Study", "h-study")
    w.p(
        "Twelve readers, all fluent in at least two of the four languages, rated 96 translated pages for how easy they were to read, "
        "without being told which method produced them [20]. Pages produced by Budgeted Reflow scored 4.4 out of 5, those by "
        "shrink to fit 3.6 and those by fixed scale 3.9. Readers named three reasons for low scores: text that is clearly smaller than "
        "the text around it, lines that touch the edge of a figure, and headings that were shortened so much that their meaning changed. "
        "The first two are what the budget and the balancing term are meant to prevent; the third is a risk of rewrite requests that we "
        "discuss next.",
        "study-1",
    )

    w.h(2, "5.6   Sensitivity to the Budget", "h-sens")
    w.p(
        "Table 4 varies the budget $b$ from 0.002 to 0.03. A budget of 0.002 lets almost no block shrink, so overflow is resolved "
        "by rewrite requests and their share rises to 7.9%. Raising $b$ to 0.01 cuts the rewrite rate to 2.4% while the median reduction "
        "grows from 3.1% to 5.8%. Beyond 0.02 the overflow rate no longer falls, and the font reduction keeps growing; we therefore "
        "recommend $b = 0.01$ as the default.",
        "sens-1",
    )
    w.table(
        "**Table 4:** Effect of the page budget $b$ on all four languages. The last column is the share of blocks with a rewrite request.",
        [
            ["Budget b", "OR (%)", "MFR (%)", "Rewrite (%)"],
            ["0.002", "4.6", "3.1", "7.9"],
            ["0.005", "3.6", "4.4", "4.1"],
            ["0.010", "3.1", "5.8", "2.4"],
            ["0.020", "3.0", "7.5", "2.1"],
            ["0.030", "3.0", "9.1", "2.0"],
        ],
        "tab4",
    )
    w.h(2, "5.7   Error Analysis", "h-errors")
    w.p(
        "We inspected all 1,167 blocks that still overflowed after Budgeted Reflow and sorted them by cause. The largest group, 41%, "
        "are blocks that contain an unbreakable string such as a URL, a chemical name or a German compound that is wider than the box. "
        "Another 27% are one-line headings and captions whose translation is longer than the box even at the smallest allowed size. "
        "In 19% of the cases the box of the detector is too small, for example because it cut off the last line of a paragraph, and "
        "the remaining 13% come from line breaking that the lower bound of Eq. (2) could not foresee.",
        "errors-1",
    )
    w.p(
        "Figure 3 plots, for three languages, how the overflow accumulates over blocks sorted by length. In German and Spanish the "
        "curve rises early because short blocks overflow first; in Japanese it stays flat for the first third of the blocks and "
        "then follows the same shape. The causes differ by language, but the remedy is the same in every case: the rewrite fallback "
        "removes the one-line headings from the list, and a better box would remove the detector errors. Neither is a problem of "
        "the search itself.",
        "errors-2",
    )

    w.h(1, "6   Discussion", "h-discussion")
    w.p(
        "Budgeted Reflow trades a little font size for a lot of fitted text, and it does so predictably: the budget $b$ is the only "
        "parameter a user has to understand. The method works because translated text is hard to predict but not hard to measure; "
        "once the translation exists, its width is known exactly and the whole question is how to distribute the available room. "
        "We believe that the same view helps other fixed-layout tasks, such as localizing slides or forms.{fn:fn-release}",
        "disc-1",
    )
    w.p(
        "The method has limits. Blocks that contain a single very long unbreakable string, such as a URL or a German compound, can overflow "
        "at any size. Rotated text, text on curved paths and text inside figures are outside our scope. Rewrite requests raise a "
        "question of fidelity, because a shorter sentence is not always an equal one, and our similarity check is only a proxy for "
        "meaning. Finally, the evaluation uses one translation model; a model that writes longer or shorter sentences would shift "
        "$r_i$ for all blocks, and the budget would have to be set again.",
        "disc-2",
    )

    w.h(2, "6.1   Where the Method Fails", "h-fail")
    w.p(
        "The error analysis points to two situations in which fitting is the wrong tool. When a word is wider than the box, only a "
        "different box, a hyphenation rule or a different word helps, and none of the three is in the hands of a reflow method. When a "
        "heading is longer than its box at the smallest size, the translator has to choose a shorter heading, and the quality of that "
        "choice is a translation question that our similarity check measures only coarsely. We therefore report the marked blocks "
        "separately and recommend that a pipeline sends them to a human instead of pushing the font size lower.",
        "fail-1",
    )
    w.h(2, "6.2   Deployment Notes", "h-deploy")
    w.p(
        "In a production pipeline the method runs once per page, so pages can be processed in parallel and the page budget can be exposed "
        "as a single setting for users who prefer tight or loose pages. Because Algorithm 1 does not depend on the translator, a "
        "translation memory can be reused across documents, and a change of the budget only repeats the search, not the translation. "
        "We also found it useful to log the expansion ratio of every block: a document whose mean ratio is far from the values of "
        "Table 1 usually has a problem with its source language detection or with a missing font, and the log shows it before any page is set.",
        "deploy-1",
    )

    w.h(1, "7   Conclusion", "h-conclusion")
    w.p(
        "We described Budgeted Reflow, a way to fit translated blocks into the layout of the original page. A length model, a "
        "per-page budget and a rewrite fallback together cut the overflow of translated blocks from 17.8% to 3.1% while keeping the "
        "median font reduction at 5.8%. Next we want to learn the length model from the pages themselves and to extend the search to "
        "blocks that may move by a few points, so that two neighbours can share their slack.",
        "concl-1",
    )

    w.h(1, "Acknowledgements", "h-ack")
    w.text(
        "acknowledgement",
        rich(
            "We thank the twelve readers who rated the pages, the maintainers of the open-source PDF libraries on which the implementation "
            "builds, and the anonymous reviewers of SCDE 2026 for their comments. This work was supported by the Northfield Research "
            "Fund (grant NRF-2025-114)."
        ),
        TextStyle("rm", 9.8, 12.4),
        key="ack",
        gap=6,
    )

    w.h(1, "References", "h-refs")
    for index, entry in enumerate(REFERENCES, start=1):
        w.ensure(2 * REF.leading + 2)
        w.text("reference_entry", f"[{index}] {entry}", REF, key=f"ref{index:02d}", gap=2.2)

    # ---- 附录 A：接在参考文献之后，小节编号 A.1、A.2、A.3 ----
    w.region.y += 6.0
    w.h(1, "A   Appendix: Derivation of the Length Model", "h-appendix")
    w.h(2, "A.1   Expected number of lines", "h-a1")
    w.p(
        "Let a line hold $q = w_i / (c f)$ characters on average and let the words of the translation have a mean length of $u$ "
        "characters including the following space. A line breaks at the last word boundary before the line is full, so each line "
        "wastes on average $u / 2$ characters at its end. The number of lines is then bounded by",
        "a1-1",
    )
    w.eq(
        _pieces("E[l_i] <= m_i / (q - u/2) + 1"),
        "(A.1)",
        "eqA1",
        r"\mathbb{E}[l_i] \le \frac{m_i}{q - u/2} + 1",
    )
    w.p(
        "For $q = 52$ and $u = 6.4$, values that are typical for the body text of a two-column paper, the factor in front of $m_i$ is "
        "within 7% of $1 / q$, and the term $+1$ covers the last line. Dividing by $q$ gives Eq. (2); the difference to Eq. (A.1) is "
        "below one line for all blocks with fewer than 14 lines, which is why a margin of one line is enough.",
        "a1-2",
    )
    w.h(2, "A.2   Proof of Proposition 1", "h-a2proof")
    w.p(
        "Let $S_t$ be the total of $D_i(f_i)$ over the first $t$ blocks in the visiting order. Algorithm 1 freezes a block when the shrink so "
        "far exceeds $b N$ and chooses a cheapest candidate before that, so the total is monotone in $t$. Let $t^*$ be the first step with "
        "$S_{t^*} > b N$. The step before it satisfied the budget, and the last step added at most one candidate change per block, "
        "so that",
        "a2-1",
    )
    w.eq(
        _pieces("S_t < b N + s_{max}"),
        "(A.2)",
        "eqA2",
        r"S_{t^*} < b N + s_{\max}",
    )
    w.p(
        "Frozen blocks keep their size for the rest of the loop, hence the total after the last block equals $S_{t^*}$. Dividing by $N$ gives "
        "the claim of Proposition 1. The second pass of the algorithm can only lower the total, because it only grows blocks, "
        "and growing a block lowers $D_i$; it therefore does not affect the bound.",
        "a2-2",
    )
    w.h(2, "A.3   Parameter values", "h-a2")
    w.p(
        "All experiments use the budget $b = 0.01$, the balancing weight $a = 0.5$, the similarity threshold 0.85 and the size floor "
        "of 6.5 points. The values were set on a development set of 6 papers that is not part of the 38 papers of the evaluation. We "
        "varied $a$ between 0.1 and 1.0 and $b$ between 0.005 and 0.03 and found the results to change by less than 0.4 points of overflow.",
        "a3-1",
    )
    w.h(2, "A.4   Fixture pages", "h-a4")
    w.p(
        "The 40 hand-corrected pages cover the layouts that occur most often in our data: single-column and two-column body text, "
        "full-width tables that span both columns, figures with several panels that share one caption, and pages with footnotes. For "
        "each page we recorded the detector output and the corrected boxes, so that errors of the detector and errors of the fitting "
        "can be told apart. Table 5 gives the results on the six papers of the development set.",
        "a4-1",
    )
    w.table(
        "**Table 5:** Results on the six development papers, averaged over the four languages.",
        [
            ["Paper", "Pages", "OR (%)", "MFR (%)"],
            ["Dev 1 (language)", "11", "2.8", "5.1"],
            ["Dev 2 (physics)", "9", "3.6", "6.4"],
            ["Dev 3 (economics)", "14", "2.9", "5.3"],
            ["Dev 4 (vision)", "8", "3.3", "6.0"],
            ["Dev 5 (systems)", "12", "2.5", "4.9"],
            ["Dev 6 (theory)", "10", "4.0", "6.8"],
        ],
        "tab5",
    )
    w.h(2, "A.5   Rewrite procedure", "h-a5")
    w.p(
        "Algorithm 2 spells out the rewrite request of Section 4.3. The number of characters that fit is computed from Eq. (2) at the "
        "smallest allowed size, and the check against the original translation is the only place where the meaning of the text is "
        "looked at. When the check fails the block keeps its translation and is marked for review.",
        "a5-1",
    )
    w.algorithm(
        "Algorithm 2: Rewrite request for a block without feasible candidate",
        [
            (0, [("Input: ", "bf"), ("block ", "rm"), ("i", "it"), (", translation ", "rm"), ("t", "it"), (", minimum size ", "rm"), ("f", "it")]),
            (0, [("q", "it"), (" := characters that fit at the floor, by Eq. (2)", "rm")]),
            (0, [("t'", "it"), (" := rewrite of ", "rm"), ("t", "it"), (" with at most ", "rm"), ("q", "it"), (" characters", "rm")]),
            (0, [("if ", "bf"), ("sim(", "rm"), ("t", "it"), (", ", "rm"), ("t'", "it"), (") > 0.85 then return ", "rm"), ("t'", "it")]),
            (0, [("else", "bf")]),
            (1, [("mark block ", "rm"), ("i", "it"), (" for review", "rm")]),
            (1, [("return ", "bf"), ("t", "it"), (" with the smallest overflow", "rm")]),
        ],
        "algo2",
    )

    # ---- 页眉、页脚、页码：最后画，要等知道一共几页 ----
    last = max(e.page for e in doc.elements)
    for page in range(last + 1):
        label = str(FIRST_PAGE_NUMBER + page)
        left = doc.text(Region(page, MARGIN_X, 220.0, 28.0, 60.0), "running_header", "SCDE 2026", TextStyle("it", 7.8, 10.0), key=f"hdr-l-{page}", gap=0)[0]
        doc.text(
            Region(page, PAGE_W - MARGIN_X - 250.0, 250.0, 28.0, 60.0),
            "running_header",
            "Okafor, Reyes and Zhao  -  Budgeted Reflow",
            TextStyle("it", 7.8, 10.0, align="right"),
            key=f"hdr-r-{page}",
            gap=0,
        )
        doc.rule(page, MARGIN_X, PAGE_W - MARGIN_X, left.bbox[3] + 3.0, 0.5)
        if page == 0:
            doc.text(
                Region(page, MARGIN_X, FULL_W, 796.0, 836.0),
                "running_footer",
                "Permission to make digital or hard copies of all or part of this work for personal use is granted without fee provided that copies "
                "are not made or distributed for profit. SCDE '26, 14-18 September 2026, Valencia, Spain.",
                TextStyle("it", 7.0, 8.8),
                key="footer-0",
                gap=0,
            )
        else:
            doc.text(Region(page, MARGIN_X, FULL_W, 796.0, 836.0), "running_footer", CONFERENCE, TextStyle("it", 7.0, 8.8), key=f"footer-{page}", gap=0)
        doc.text(Region(page, PAGE_W / 2 - 20.0, 40.0, 816.0, 836.0), "page_number", label, TextStyle("rm", 8.4, 10.4, align="center"), key=f"folio-{page}", gap=0)

    # ---- 脚注挂在哪个块上：看标记实际落在哪块 ----
    holders = {}
    for element in doc.elements:
        for inline in element.inlines:
            if inline["class"] == "footnote_mark":
                holders[inline["target"]] = element.id
    found: dict[str, tuple[int, int]] = {}
    for element in doc.elements:
        if element.cls == "footnote":
            element.relations["note_of"] = holders[element.id]
            holder = next(e for e in doc.elements if e.id == holders[element.id])
            found[element.id] = (holder.page, 0 if holder.bbox[0] < MARGIN_X + COL_W else 1)
    doc.footnote_places = found

    doc.pdf.delete_pages(from_page=last + 1, to_page=MAX_PAGES - 1)
    doc.page_labels = {page: str(FIRST_PAGE_NUMBER + page) for page in range(last + 1)}
    return doc


def build() -> SampleDocument:
    """脚注要在正文之前占好栏底，所以得先知道标记落在哪一栏：排一遍，看标记在哪，把脚注挪过去再排，直到不再变。"""
    places = {"fn-block": (0, 0), "fn-timing": (2, 1), "fn-release": (4, 0)}
    for _ in range(6):
        doc = _build(places)
        if doc.footnote_places == places:
            return doc
        places = doc.footnote_places
    raise RuntimeError(f"footnote places did not settle: {places}")


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

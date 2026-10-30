"""造一章教科书：B5 单栏、宽页边，8 页，奇偶页版心和页边注左右镜像。

内容是一本人造统计入门《Introductory Statistics: Thinking with Data》的第 3 章（抽样分布与中心极限定理）。
用到的类别：章标题和节标题（level 1/2/3）、段落（含定义、定理、例题，编号写在文字里）、列表项（学习目标、小结、习题 3.1-3.12）、
边注（margin_note）、行间公式和编号、图（三张子图共用一个图注）和图注、表和表题和表注、脚注、页眉（奇偶页不同）、页码；
行内的有行内公式、脚注标记、引用标记。

故意埋的坑：
- 页边注挂在某一段上（`note_of`），位置在版心外侧；奇数页在右、偶数页在左，按版面左右半边读会把它排到所有正文前面或后面；
- 例题跨页（接续组）；习题列表跨页，其中还有一条习题自己被切成两半；
- 术语第一次在定义处加粗（`doc.bold_terms` 记着哪个术语在哪一块加粗），学习目标里已经提前用过这些词，之后的正文里是普通字体；
- 定义、定理、例题都是段落，开头的 "Definition 3.2 (…)" 编号写在文字里，正文里又会回头引用 "Example 3.4"、"Figure 3.1"、"Exercise 3.7"；
- 希腊字母、上下标全是行内公式，句末逗号紧跟着公式；
- 奇偶页页眉不同（偶数页书名、奇数页节名），章首页没有页眉。

    python -m devtools.agent_lab.sample_textbook --out /tmp/sample_textbook   # 在 backend/pipeline 下跑
"""

from __future__ import annotations

import argparse
import math
import random
import re
from pathlib import Path

import fitz

from devtools.ocr_viewer.complex_sample import Region
from devtools.ocr_viewer.complex_sample import SampleDocument
from devtools.ocr_viewer.sample_layout import FONTS
from devtools.ocr_viewer.sample_layout import SUB
from devtools.ocr_viewer.sample_layout import SUP
from devtools.ocr_viewer.sample_layout import Element
from devtools.ocr_viewer.sample_layout import TextStyle
from devtools.ocr_viewer.sample_layout import block_height
from devtools.ocr_viewer.sample_layout import font
from devtools.ocr_viewer.sample_layout import r2
from devtools.ocr_viewer.sample_layout import tokenize
from devtools.ocr_viewer.sample_layout import union
from devtools.ocr_viewer.sample_layout import wrap

DOCUMENT_ID = "sample_textbook"
BOOK_TITLE = "Introductory Statistics: Thinking with Data"
PAGES = 9  # 先排在 9 页里，用不完的删掉
FIRST_LABEL = 71  # 章首页印的页码（奇数页，右页）

PAGE_W, PAGE_H = 499.0, 709.0  # B5
TEXT_W = 270.0
RECTO_X, VERSO_X = 60.0, 169.0  # 右页（奇数页）装订在左，版心靠左；左页版心靠右
MARGIN_W = 122.0
RECTO_MARGIN_X, VERSO_MARGIN_X = 344.0, 33.0
TOP, BOTTOM = 72.0, 636.0
OPENER_TOP = 104.0

BODY = TextStyle("rm", 10.2, 14.3, indent=12.0)
BODY_FIRST = TextStyle("rm", 10.2, 14.3)
H1 = TextStyle("bf", 21.0, 26.0)
H2 = TextStyle("bf", 12.6, 16.0)
H3 = TextStyle("bf", 10.6, 14.0)
CAPTION = TextStyle("rm", 8.8, 11.6)
NOTE = TextStyle("rm", 8.2, 10.8)
MARGIN = TextStyle("rm", 8.2, 10.8)
LIST = TextStyle("rm", 10.0, 13.8)
HEADER = TextStyle("it", 8.4, 10.4)
HEADER_RIGHT = TextStyle("it", 8.4, 10.4, align="right")
FOLIO_LEFT = TextStyle("rm", 9.0, 11.0)
FOLIO_RIGHT = TextStyle("rm", 9.0, 11.0, align="right")

DEFINITION_FILL = (0.92, 0.94, 0.98)
THEOREM_FILL = (0.98, 0.94, 0.89)
EXAMPLE_BAR = (0.45, 0.55, 0.72)
INK = (0.1, 0.1, 0.12)

# ---- 行内公式：LaTeX 的一个小子集 → 排版片段（文字、字体、上下标） ----
_SYMBOLS = {
    "mu": ("μ", "zh"),
    "sigma": ("σ", "zh"),
    "tau": ("τ", "zh"),
    "alpha": ("α", "zh"),
    "ge": ("≥", "zh"),
    "le": ("≤", "zh"),
    "approx": ("≈", "zh"),
    "to": ("→", "zh"),
    "infty": ("∞", "zh"),
    "times": ("×", "rm"),
    "pm": ("±", "rm"),
    "cdots": ("...", "rm"),
}
_SPACED_SYMBOLS = {"ge", "le", "approx", "to", "times", "pm"}


def _group(src: str, pos: int) -> tuple[str, int]:
    """取 pos 处的一个参数：{...} 或单个字符。"""
    if src[pos] == "{":
        depth, end = 0, pos
        while True:
            depth += src[end] == "{"
            depth -= src[end] == "}"
            end += 1
            if depth == 0:
                return src[pos + 1 : end - 1], end
    return src[pos], pos + 1


def math_pieces(latex: str, script: str = "") -> list[tuple[str, str, str]]:
    pieces: list[tuple[str, str, str]] = []

    def add(text: str, style: str, sc: str = script) -> None:
        if pieces and pieces[-1][1] == style and pieces[-1][2] == sc and style != "it":
            pieces[-1] = (pieces[-1][0] + text, style, sc)
        else:
            pieces.append((text, style, sc))

    pos = 0
    while pos < len(latex):
        ch = latex[pos]
        if ch == "\\":
            match = re.match(r"\\([A-Za-z]+)", latex[pos:])
            name = match.group(1)
            pos += len(match.group(0))
            if name in ("bar", "hat"):
                arg, pos = _group(latex, pos)
                add(arg, "it")
                add("¯" if name == "bar" else "^", "rm", SUP if name == "hat" else script)
            elif name == "sqrt":
                arg, pos = _group(latex, pos)
                add("√", "zh")
                inner = math_pieces(arg, script)
                if len(arg) > 1:
                    add("(", "rm")
                for part in inner:
                    add(*part)
                if len(arg) > 1:
                    add(")", "rm")
            else:
                text, style = _SYMBOLS[name]
                if name in _SPACED_SYMBOLS:
                    add(" ", "rm")
                add(text, style)
                if name in _SPACED_SYMBOLS:
                    add(" ", "rm")
        elif ch in "^_":
            arg, pos = _group(latex, pos + 1)
            for part in math_pieces(arg, SUP if ch == "^" else SUB):
                add(*part)
        elif ch.isalpha():
            add(ch, "it")
            pos += 1
        elif ch == " ":
            pos += 1
        elif ch in "=+-/<>":
            unary = ch == "-" and (not latex[:pos].strip() or latex[:pos].rstrip()[-1] in "=<>(+")
            add(f" {ch} " if ch in "=+-<>" and not unary else ch, "rm")
            pos += 1
        elif ch == ",":
            add(", ", "rm")
            pos += 1
        else:
            add(ch, "rm")
            pos += 1
    return [(text.replace("  ", " "), style, sc) for text, style, sc in pieces]


# ---- 正文 ----
# 记号：`**术语**` 第一次出现的术语（加粗并登记到 doc.bold_terms）、`##标签##` 定义/例题/定理的编号标签（加粗，不登记）、
# `$latex$` 行内公式、`{fn:key}` 脚注标记、`{cite:(Laplace, 1810)}` 引用标记。
FOOTNOTES = {
    "fn-srs": "Throughout this book, \"random sample\" means a simple random sample unless we say otherwise: every group of n individuals is equally likely to be the one chosen.",
    "fn-sleep": "The 12,000 sleep times in this chapter were generated by computer. They are realistic but not real data, which is what lets us know the true mean.",
    "fn-clt": "The name was chosen by George Polya in 1920. \"Central\" modifies \"theorem\", not \"limit\": it is the theorem that is central to probability.",
    "fn-indep": "Informally, learning one student's answer should tell you nothing about another's.",
}

MARGIN_NOTES = {
    "m-why": "##Why \"normal\"?## The curve is not normal in the sense of typical. It is normal in the sense of being a norm, a standard shape that other distributions are measured against.",
    "m-notation": "##Notation.## Greek letters such as $\\mu$ and $\\sigma$ name parameters; Latin letters such as $\\bar{x}$ and $s$ name statistics. The habit prevents a surprising amount of confusion.",
    "m-sim": "##Try it.## Any spreadsheet can repeat Example 3.4. Draw 40 random numbers, average them, write the average down, and do it 200 times.",
    "m-se": "##Say it aloud.## Standard deviation describes the spread of individuals; standard error describes the spread of a statistic. Quadrupling n only halves the standard error.",
    "m-thirty": "##Rule of thumb.## Thirty is not magic. A population with a long tail may need hundreds of observations; a symmetric one often needs fewer than ten.",
    "m-table": "##Check.## Use Table 3.1 to confirm Example 3.4: with $n = 40$ the standard error is 0.19 hours.",
    "m-poll": "##Margin of error.## The \"plus or minus three points\" printed beneath a poll is usually 1.96 standard errors of the sample proportion, rounded up.",
    "m-ex": "##Hint.## For Exercises 3.5 and 3.6, sketch the sampling distribution first and shade the region whose probability you need.",
}

# 每项：("h2", 标题) ("h3", 标题) ("p", key, 文字) ("lead", key, 文字) ("def"/"thm"/"ex", key, [段落…]) ("list", key, 文字)
#      ("fig", ...) ("formula", ...)，下面的 `Textbook.chapter` 按种类排版
EXERCISES = [
    "A university has 20,000 students and a survey firm asks 500 of them how many hours they work each week. Identify the population, the sample, the parameter of interest and the statistic.",
    "Explain in two sentences why $\\bar{x}$ is a random variable before the sample is drawn but a fixed number afterwards.",
    "The scores 1, 3, 5, 7 form a population. List all 16 samples of size $n = 2$ drawn with replacement, compute $\\bar{x}$ for each, and check that the average of the sample means equals $\\mu$.",
    "For the population in Exercise 3.3, find $\\sigma$ and verify that the standard deviation of the 16 sample means equals $\\sigma/\\sqrt{n}$.",
    "The weights of apples have mean $\\mu = 150$ g and standard deviation $\\sigma = 24$ g. What is the standard error of the mean weight of a bag of 16 apples? Of a bag of 64?",
    "Using the apples of Exercise 3.5, find the probability that the mean weight of 36 randomly chosen apples exceeds 155 g. State which result justifies your calculation.",
    "In Figure 3.1, why does the histogram in panel (a) look so different from the one in panel (c), although both come from the same population? Use the words \"sample size\" in your answer.",
    "A pollster claims that a sample of 2,000 people is \"four times as accurate\" as a sample of 500. Use the standard error to say whether that is right.",
    "A researcher surveys 60 students, all of them members of one fraternity, about alcohol use. Does the Central Limit Theorem make her sample mean approximately normal for the campus as a whole? Explain.",
    "Suppose $\\sigma = 8$ and you want a standard error of at most 0.5. How large must $n$ be?",
    "Show that doubling $\\sigma$ and quadrupling $n$ leaves the standard error of $\\bar{x}$ unchanged.",
    "Write a short paragraph, without using any formula, explaining to a friend why averages of large samples are less variable than single observations. Mention at least one everyday example.",
]


class Textbook:
    def __init__(self) -> None:
        self.doc = SampleDocument(pages=PAGES, size=(PAGE_W, PAGE_H), document_id=DOCUMENT_ID, title=BOOK_TITLE)
        self.doc.flow = [Region(p, self.text_x(p), TEXT_W, TOP, BOTTOM) for p in range(PAGES)]
        self.page = 0
        self.margin_y = {p: TOP for p in range(PAGES)}
        self.footnote_numbers: dict[str, str] = {}
        self.pending_terms: list[str] = []
        self.bold_terms: dict[str, str] = {}
        self.sections: dict[int, str] = {}  # 页 → 这一页上第一个节标题（页眉用）
        self.openers = {0}
        self.floats: list[tuple[int, float, object]] = []  # 放不下、挪到下一页的图和表：(页, 高度, 排版函数)

    # ---- 版面 ----
    @staticmethod
    def recto(page: int) -> bool:
        return page % 2 == 0

    def text_x(self, page: int) -> float:
        return RECTO_X if self.recto(page) else VERSO_X

    def margin_x(self, page: int) -> float:
        return RECTO_MARGIN_X if self.recto(page) else VERSO_MARGIN_X

    @property
    def region(self) -> Region:
        return self.doc.flow[self.page]

    def next_page(self) -> None:
        self.page += 1

    def ensure(self, height: float) -> None:
        if self.region.bottom - self.region.y < height:
            self.next_page()

    def float_(self, height: float, place) -> None:
        """图和表：这一页放得下就放，放不下先欠着，下一页开头补上，正文接着往下排。"""
        if self.region.bottom - self.region.y >= height:
            place()
        else:
            self.floats.append((self.page, height, place))

    def flush_floats(self) -> None:
        while self.floats and self.floats[0][0] < self.page and self.region.bottom - self.region.y >= self.floats[0][1]:
            _, _, place = self.floats.pop(0)
            place()

    def prepare(self, height: float) -> None:
        self.ensure(height)
        if self.floats and self.floats[0][0] < self.page:
            before = self.page
            self.flush_floats()
            self.ensure(height)
            assert self.page >= before

    def lines_of(self, content, ts: TextStyle) -> int:
        return len(wrap(tokenize(content, ts.style), TEXT_W, ts))

    # ---- 记号 → 排版用的行内对象 ----
    def rich(self, text: str) -> list:
        content: list = []
        pattern = r"(\*\*[^*]+\*\*|##[^#]+##|\$[^$]+\$|\{fn:[\w-]+\}|\{cite:[^}]+\})"
        for part in re.split(pattern, text):
            if not part:
                continue
            if part.startswith("**"):
                self.pending_terms.append(part[2:-2])
                content.append({"b": part[2:-2]})
            elif part.startswith("##"):
                content.append({"b": part[2:-2]})
            elif part.startswith("$"):
                content.append({"math": math_pieces(part[1:-1]), "latex": part[1:-1]})
            elif part.startswith("{fn:"):
                key = part[4:-1]
                if key not in self.footnote_numbers:
                    self.footnote_numbers[key] = str(len(self.footnote_numbers) + 1)
                content.append({"fn": self.footnote_numbers[key], "target": key})
            elif part.startswith("{cite:"):
                content.append({"cite": part[6:-1]})
            else:
                content.append(part)
        return content

    def need(self, text: str, ts: TextStyle) -> float:
        """这段文字（连同要排在这一页的脚注）排下去至少要多高，给"标题不落单"用。"""
        content = self.rich(text)
        marks = re.findall(r"\{fn:([\w-]+)\}", text)
        n = self.lines_of(content, ts)
        if not marks:
            return block_height(min(n, 3), ts)
        notes = sum(block_height(self.lines_of([{"sup": "1"}, " " + FOOTNOTES[k]], NOTE_FOR_FOOTNOTE), NOTE_FOR_FOOTNOTE) + 13.0 for k in marks)
        return block_height(n, ts) + notes

    # ---- 一个文字块 ----
    def emit(self, cls: str, text: str, ts: TextStyle, key: str, *, gap: float = 5.0, relations: dict | None = None,
             attributes: dict | None = None, keep: bool = False, margin: str | None = None, min_lines: int = 2,
             with_next: float = 0.0) -> list[Element]:
        self.pending_terms = []
        content = self.rich(text)
        n = self.lines_of(content, ts)
        marks = [p for p in re.findall(r"\{fn:([\w-]+)\}", text)]
        note_height = 0.0
        for fn_key in marks:
            note_height += block_height(self.lines_of([{"sup": "1"}, " " + FOOTNOTES[fn_key]], NOTE_FOR_FOOTNOTE), NOTE_FOR_FOOTNOTE) + 13.0
        if keep or marks:
            self.prepare(block_height(n, ts) + note_height)
        else:
            self.prepare(block_height(min(n, min_lines), ts) + with_next)
        for fn_key in marks:
            self.doc.footnote_bottom(
                self.region,
                [{"sup": self.footnote_numbers[fn_key]}, " " + FOOTNOTES[fn_key]],
                key=fn_key,
                relations={"note_of": key},
            )
        top, start_page = self.region.y, self.page
        made = self.doc.text(self.region, cls, content, ts, key=key, gap=gap, split=not (keep or marks), relations=relations, attributes=attributes)
        self.page = made[-1].page
        joined = " ".join(m.text for m in made)
        for term in self.pending_terms:
            if not re.search(rf"\b{re.escape(term)}\b", joined):
                raise RuntimeError(f"bold term {term!r} is not in {key}")
            self.bold_terms[term] = next(m.id for m in made if re.search(rf"\b{re.escape(term)}\b", m.text) or term.split()[0] in m.text)
        if margin:
            self.margin_note(start_page, top, margin, key)
        return made

    def margin_note(self, page: int, top: float, note_key: str, anchor: str) -> Element:
        self.pending_terms = []
        content = self.rich(MARGIN_NOTES[note_key])
        y = max(top, self.margin_y[page])
        region = Region(page, self.margin_x(page), MARGIN_W, y, BOTTOM)
        made = self.doc.text(region, "margin_note", content, MARGIN, key=note_key, gap=0, relations={"note_of": anchor})
        self.margin_y[page] = region.y + 6.0
        self.pending_terms = []
        return made[0]

    # ---- 定义、定理、例题的底色 ----
    def shade(self, elements: list[Element], fill: tuple[float, float, float] | None, bar: tuple[float, float, float] | None = None) -> None:
        by_page: dict[int, list[Element]] = {}
        for element in elements:
            if element.cls in ("paragraph", "display_formula", "formula_number", "list_item"):
                by_page.setdefault(element.page, []).append(element)
        for page, parts in by_page.items():
            box = union([e.bbox for e in parts])
            x = self.text_x(page)
            if fill:
                rect = fitz.Rect(x - 6.0, box[1] - 4.0, x + TEXT_W + 6.0, box[3] + 4.0)
                self.doc.pages[page].draw_rect(rect, color=None, fill=fill, overlay=False)
            if bar:
                self.doc.pages[page].draw_line((x - 7.0, box[1] - 2.0), (x - 7.0, box[3] + 2.0), color=bar, width=1.8)

    def display(self, key: str, pieces: list, number: str, latex: str, *, gap: float = 7.0) -> list[Element]:
        """行间公式加右边的编号。字体表比 `SampleDocument.display_formula` 多了希腊字母用的 zh。"""
        self.ensure(26.0)
        region, page = self.region, self.doc.pages[self.region.page]
        size, base = 11.0, font("rm")
        sizes = [size * (0.68 if script else 1.0) for _, _, script in pieces]
        width = sum(font(style).text_length(text, s) for (text, style, _), s in zip(pieces, sizes))
        x = region.x + (region.width - width) / 2
        baseline = region.y + base.ascender * size + 3.0
        boxes = []
        for (text, style, script), psize in zip(pieces, sizes):
            shift = {SUP: -0.38, SUB: 0.22}.get(script, 0.0) * size
            f = font(style)
            page.insert_text((x, baseline + shift), text, fontname=FONTS[style], fontsize=psize)
            w = f.text_length(text, psize)
            boxes.append([x, baseline + shift - f.ascender * psize, x + w, baseline + shift - f.descender * psize])
            x += w
        box = union(boxes)
        text = "".join(p[0] for p in pieces)
        formula = self.doc.add(
            Element(id=key, cls="display_formula", page=region.page, bbox=r2(box), text=text,
                    lines=[{"bbox": r2(box), "text": text}], attributes={"latex": latex})
        )
        nw = base.text_length(number, 9.4)
        nx = region.x + region.width - nw
        page.insert_text((nx, baseline), number, fontname="tiro", fontsize=9.4)
        nbox = [nx, baseline - base.ascender * 9.4, nx + nw, baseline - base.descender * 9.4]
        numbered = self.doc.add(
            Element(id=f"{key}-no", cls="formula_number", page=region.page, bbox=r2(nbox), text=number,
                    lines=[{"bbox": r2(nbox), "text": number}], relations={"number_of": key})
        )
        region.y = max(box[3], nbox[3]) + gap
        return [formula, numbered]

    # ---- 章 ----
    def chapter(self) -> None:
        region = self.region
        region.y = OPENER_TOP
        self.emit("section_heading", "3   Sampling Distributions and the Central Limit Theorem", H1, "h-ch3", gap=22.0, attributes={"level": 1}, keep=True)
        self.emit(
            "paragraph",
            "Every opinion poll, clinical trial and quality-control check starts from the same predicament: we can look at only a small part of the world, "
            "yet we want to say something about the whole of it.{fn:fn-srs} The 25 students we questioned, the 50 light bulbs we burned until they failed "
            "and the 1,200 voters we telephoned are all standing in for something much larger. This chapter explains why such a leap can be trusted at all, "
            "and how far.",
            BODY_FIRST, "intro-1", margin="m-why", gap=5.0,
        )
        self.emit(
            "paragraph",
            "The answer rests on a single idea. A number computed from a random selection is itself random, and its behaviour over many imagined repetitions "
            "can be described exactly. Most of the chapter is about that description. Its main result, the Central Limit Theorem, explains why the "
            "bell-shaped normal curve turns up in so many places that have nothing to do with bells.",
            BODY, "intro-2", gap=12.0,
        )
        self.emit("section_heading", "Learning objectives", H2, "h-objectives", gap=6.0, attributes={"level": 2}, keep=True)
        self.emit("paragraph", "After working through this chapter you should be able to:", BODY_FIRST, "objectives-lead", gap=4.0)
        for index, item in enumerate(
            [
                "tell a parameter from a statistic, and say which of the two is a random variable;",
                "describe the sampling distribution of a sample mean through its centre, spread and shape;",
                "compute and interpret a standard error;",
                "state the Central Limit Theorem and say when it can and cannot be applied;",
                "use a normal approximation to find the probability that a sample mean falls in a given interval.",
            ],
            start=1,
        ):
            self.emit("list_item", f"({index})  {item}", LIST, f"obj-{index}", gap=2.5, keep=True)
        self.region.y += 12.0

        # ---- 3.1 ----
        text_31 = (
            "Suppose a university registrar wants to know how many hours its 12,000 undergraduates sleep on a weeknight.{fn:fn-sleep} Asking everyone is out of "
            "the question, so she emails a questionnaire to 40 students chosen at random. The group of all undergraduates is the **population**; the 40 who "
            "are asked form a **sample**. The average she computes from their answers will not be exactly the average for all 12,000, and a second sample of "
            "40 would give a different number again. This unavoidable difference from sample to sample is called **sampling variability**."
        )
        self.emit("section_heading", "3.1   Parameters, statistics and sampling variability", H2, "h-31", gap=6.0, attributes={"level": 2}, with_next=self.need(text_31, BODY_FIRST))
        self.emit("paragraph", text_31, BODY_FIRST, "p-31-1", gap=7.0)
        made = self.emit(
            "paragraph",
            "##Definition 3.1 (Parameter and statistic).## A **parameter** is a number that describes a population, such as the population mean $\\mu$ or the "
            "population standard deviation $\\sigma$. A **statistic** is a number computed from a sample, such as the sample mean $\\bar{x}$ or the sample "
            "standard deviation $s$. A parameter is fixed but usually unknown; a statistic is known once the sample is drawn, but it changes from sample to sample.",
            BODY_FIRST, "def-31", gap=10.0, keep=True, margin="m-notation",
        )
        self.shade(made, DEFINITION_FILL)
        self.emit(
            "paragraph",
            "Notice the asymmetry. Before the sample is drawn, $\\bar{x}$ is uncertain, so we treat it as a random variable and ask which values it is likely "
            "to take. After the sample is drawn it is just a number. A good deal of the confusion in an introductory course comes from mixing up these two moments.",
            BODY_FIRST, "p-31-2", gap=7.0,
        )
        made = self.emit(
            "paragraph",
            "##Definition 3.2 (Sampling distribution).## The **sampling distribution** of a statistic is the distribution of the values that the statistic takes "
            "over all possible samples of the same size $n$ drawn from the same population.",
            BODY_FIRST, "def-32", gap=10.0, keep=True,
        )
        self.shade(made, DEFINITION_FILL)

        made = self.emit(
            "paragraph",
            "##Example 3.3 (A very small population).## A population consists of five quiz scores: 2, 4, 6, 8 and 10, so $\\mu = 6$ and $\\sigma = 2.83$. "
            "List every sample of size $n = 2$ drawn with replacement; there are 25 of them. The sample mean $\\bar{x}$ is 2 for one sample, 6 for five "
            "of them and 10 for one, and it never takes a value that single scores could not. The 25 sample means average exactly 6, which is $\\mu$. "
            "Their standard deviation, however, is 2.00, noticeably smaller than $\\sigma$. Averaging has pulled the values toward the middle.",
            BODY_FIRST, "ex-33", gap=10.0, min_lines=2,
        )
        self.shade(made, None, EXAMPLE_BAR)

        made = self.emit(
            "paragraph",
            "##Example 3.4 (Repeating the registrar's survey).## A computer was asked to draw 1,000 samples of size $n = 40$ from a population of 12,000 sleep "
            "times with $\\mu = 7.1$ hours and $\\sigma = 1.2$ hours, and to record $\\bar{x}$ each time. Individual students slept anywhere between 4 and 11 hours.",
            BODY_FIRST, "ex-34", gap=4.0, margin="m-sim", min_lines=3,
        )
        made += self.emit(
            "paragraph",
            "The 1,000 sample means ranged only from 6.67 to 7.52 hours. Their average was 7.10 hours, matching $\\mu$, and their standard deviation was 0.19 hours. "
            "Almost every sample mean fell within 0.4 hours of the truth, although the individual answers were spread over seven hours. Figure 3.1 shows "
            "the same experiment for three different sample sizes.",
            BODY_FIRST, "ex-34-b", gap=10.0,
        )
        self.shade(made, None, EXAMPLE_BAR)

        # ---- 3.2 ----
        self.emit("section_heading", "3.2   The centre and spread of the sample mean", H2, "h-32", gap=6.0, attributes={"level": 2}, with_next=150.0)
        made = self.emit(
            "paragraph",
            "##Theorem 3.5 (Mean and standard deviation of the sample mean).## Let $\\bar{x}$ be the mean of a random sample of size $n$ from a population with mean "
            "$\\mu$ and standard deviation $\\sigma$. Then the sampling distribution of $\\bar{x}$ has",
            BODY_FIRST, "thm-35", gap=2.0, keep=True,
        )
        made += self.display("eq-31", math_pieces("\\mu_{\\bar{x}} = \\mu"), "(3.1)", "\\mu_{\\bar{x}} = \\mu", gap=3.0)
        made += self.display("eq-32", math_pieces("\\sigma_{\\bar{x}} = \\sigma/\\sqrt{n}"), "(3.2)", "\\sigma_{\\bar{x}} = \\sigma/\\sqrt{n}", gap=6.0)
        made += self.emit(
            "paragraph",
            "The second formula is exact when we sample with replacement, and a good approximation when the sample is less than a tenth of the population.",
            BODY_FIRST, "thm-35-b", gap=10.0, keep=True,
        )
        self.shade(made, THEOREM_FILL)
        self.emit(
            "paragraph",
            "The idea behind (3.2) takes one line. The observations in a random sample do not influence one another, so the variances of $x_1, x_2, \\cdots, x_n$ "
            "simply add, and dividing the total by $n$ divides the variance by $n^2$:",
            BODY_FIRST, "p-32-1", gap=2.0, keep=True,
        )
        self.display("eq-33", math_pieces("\\sigma_{\\bar{x}}^2 = n\\sigma^2/n^2 = \\sigma^2/n"), "(3.3)", "\\sigma_{\\bar{x}}^2 = n\\sigma^2/n^2 = \\sigma^2/n", gap=5.0)
        made = self.emit(
            "paragraph",
            "##Definition 3.6 (Standard error).## The **standard error** of a statistic is the standard deviation of its sampling distribution. For the sample "
            "mean it equals $\\sigma/\\sqrt{n}$; when $\\sigma$ is unknown it is estimated by $s/\\sqrt{n}$.",
            BODY_FIRST, "def-36", gap=10.0, keep=True, margin="m-se",
        )
        self.shade(made, DEFINITION_FILL)
        self.emit(
            "paragraph",
            "Table 3.1 shows how slowly the standard error shrinks. Because $n$ sits under a square root, every extra digit of accuracy costs a hundred times "
            "as much data.",
            BODY_FIRST, "p-32-2", gap=5.0, margin="m-table",
        )

        def place_table() -> None:
            table_key = "tab-31"
            self.emit("table_caption", "##Table 3.1:## Standard error of the sample mean when the population standard deviation is 1.2 hours.", CAPTION, "tab-31-cap",
                      relations={"caption_of": [table_key]}, gap=3.0, keep=True)
            self.doc.table(
                self.region,
                [["Sample size n", "SE (hours)", "Margin (hours)", "Relative"], ["10", "0.38", "0.74", "1.00"], ["40", "0.19", "0.37", "0.50"],
                 ["160", "0.09", "0.19", "0.25"], ["640", "0.05", "0.09", "0.13"]],
                key=table_key, gap=3.0,
            )
            self.emit("float_note", "Margin = 1.96 × SE, the half-width of the interval that holds about 95% of sample means.", NOTE, "tab-31-note",
                      relations={"note_of": table_key}, gap=12.0, keep=True)

        self.float_(135.0, place_table)

        # ---- 3.3 ----
        text_33 = (
            "So far we have described the centre and the spread of the sampling distribution of $\\bar{x}$. What about its shape? If the population is itself "
            "normal, the answer is easy: $\\bar{x}$ is normal too, whatever the sample size. The surprise is that for large samples it hardly matters what the "
            "population looks like. Laplace proved a version of this result {cite:(Laplace, 1810)}, and it is now known as the **Central Limit Theorem**.{fn:fn-clt}"
        )
        self.emit("section_heading", "3.3   The Central Limit Theorem", H2, "h-33", gap=6.0, attributes={"level": 2}, with_next=self.need(text_33, BODY_FIRST))
        self.emit("paragraph", text_33, BODY_FIRST, "p-33-1", gap=7.0)
        made = self.emit(
            "paragraph",
            "##Theorem 3.7 (Central Limit Theorem).## Let $x_1, \\cdots, x_n$ be a random sample from any population with finite mean $\\mu$ and standard deviation "
            "$\\sigma$. As $n$ grows, the distribution of the standardized sample mean approaches the standard normal distribution:",
            BODY_FIRST, "thm-37", gap=2.0, keep=True,
        )
        made += self.display("eq-34", math_pieces("Z_n = (\\bar{x} - \\mu)/(\\sigma/\\sqrt{n}) \\to N(0, 1)"), "(3.4)",
                             "Z_n = (\\bar{x} - \\mu)/(\\sigma/\\sqrt{n}) \\to N(0, 1)", gap=5.0)
        made += self.emit(
            "paragraph",
            "In practice we say that $\\bar{x}$ is approximately normal with mean $\\mu$ and standard deviation $\\sigma/\\sqrt{n}$.",
            BODY_FIRST, "thm-37-b", gap=10.0, keep=True, margin="m-thirty",
        )
        self.shade(made, THEOREM_FILL)
        # 图 3.1：三张子图共用一个图注

        def place_hist() -> None:
            figures = histogram_figure(self.doc, self.region, "fig-31", height=96.0)
            self.emit(
                "figure_caption",
                "##Figure 3.1:## Sampling distribution of the sample mean for samples of size (a) $n = 1$, (b) $n = 5$ and (c) $n = 30$ from a right-skewed "
                "population. Each histogram shows 10,000 simulated samples.",
                CAPTION, "fig-31-cap", relations={"caption_of": [f.id for f in figures]}, gap=9.0, keep=True,
            )

        self.float_(150.0, place_hist)
        self.emit(
            "paragraph",
            "Panel (a) is the population itself: skewed, with a long tail to the right. By $n = 5$ the tail has already shortened, and by $n = 30$ the histogram is "
            "hard to tell from a bell. The common rule that $n \\ge 30$ is \"large enough\" comes from pictures like this one, but see the warning at the end of "
            "this section.",
            BODY_FIRST, "p-33-2", gap=7.0,
        )
        made = self.emit(
            "paragraph",
            "##Example 3.8 (Loaves of bread).## A bakery's loaves have mean weight $\\mu = 500$ g and standard deviation $\\sigma = 20$ g, and their weights are "
            "slightly skewed. A restaurant buys 36 loaves at random. What is the probability that their mean weight is below 495 g? Treat the weights of different loaves as independent. The chef is hoping for loaves that are at least as heavy as advertised.",
            BODY_FIRST, "ex-38", gap=4.0, min_lines=3,
        )
        made += self.emit(
            "paragraph",
            "##Solution.## The standard error is $20/\\sqrt{36} = 3.33$ g. By the Central Limit Theorem $\\bar{x}$ is approximately normal, so we standardize:",
            BODY_FIRST, "ex-38-b", gap=2.0, min_lines=2,
        )
        made += self.display("eq-35", math_pieces("z = (495 - 500)/3.33 = -1.50"), "(3.5)", "z = (495 - 500)/3.33 = -1.50", gap=4.0)
        made += self.emit(
            "paragraph",
            "The normal table gives $P(Z < -1.50) = 0.0668$. There is about a 6.7% chance that the restaurant's loaves average less than 495 g, even though "
            "the bakery's claim of 500 g is true. Figure 3.2 shows the area we have just computed.",
            BODY_FIRST, "ex-38-c", gap=10.0, keep=True, margin="m-ex",
        )
        self.shade(made, None, EXAMPLE_BAR)

        def place_bell() -> None:
            bell = bell_figure(self.doc, self.region, "fig-32", height=86.0)
            self.emit(
                "figure_caption",
                "##Figure 3.2:## The sampling distribution of the mean weight of 36 loaves. The shaded tail below 495 g has area 0.067.",
                CAPTION, "fig-32-cap", relations={"caption_of": [bell.id]}, gap=10.0, keep=True,
            )

        self.float_(130.0, place_bell)
        text_fail = (
            "The Central Limit Theorem has conditions, and ignoring them is the commonest way to misuse it. A population with extremely heavy tails, such as incomes, "
            "can need thousands of observations before $\\bar{x}$ looks normal. More seriously, the theorem assumes that the observations are independent.{fn:fn-indep} "
            "Sixty students taken from one fraternity house are not sixty independent draws from the campus, and no sample size can repair that."
        )
        self.emit("section_heading", "When the approximation fails", H3, "h-33-1", gap=4.0, attributes={"level": 3}, with_next=self.need(text_fail, BODY_FIRST))
        self.emit("paragraph", text_fail, BODY_FIRST, "p-33-3", gap=8.0)

        # ---- 3.4 ----
        self.emit("section_heading", "3.4   Proportions are means in disguise", H2, "h-34", gap=6.0, attributes={"level": 2}, with_next=150.0)
        self.emit(
            "paragraph",
            "Pollsters report proportions rather than means, but nothing new is needed. Code every respondent as 1 if she supports a proposal and 0 if she does not. "
            "The sample proportion $\\hat{p}$ is then simply the mean of a list of zeros and ones, and the Central Limit Theorem applies to it as it does to any "
            "other mean.",
            BODY_FIRST, "p-34-1", gap=7.0, margin="m-poll",
        )
        made = self.emit(
            "paragraph",
            "##Theorem 3.9 (Sample proportion).## If a fraction $p$ of the population has some property, the proportion $\\hat{p}$ found in a random sample of size "
            "$n$ has mean $p$ and standard error",
            BODY_FIRST, "thm-39", gap=2.0, keep=True,
        )
        made += self.display("eq-36", math_pieces("\\sigma_{\\hat{p}} = \\sqrt{p(1 - p)/n}"), "(3.6)", "\\sigma_{\\hat{p}} = \\sqrt{p(1 - p)/n}", gap=5.0)
        made += self.emit(
            "paragraph",
            "and its distribution is approximately normal provided that both $np \\ge 10$ and $n(1 - p) \\ge 10$.",
            BODY_FIRST, "thm-39-b", gap=10.0, keep=True,
        )
        self.shade(made, THEOREM_FILL)
        made = self.emit(
            "paragraph",
            "##Example 3.10 (An opinion poll).## A city councillor believes that 40% of voters support a new tram line. A poll asks 900 randomly chosen voters. "
            "What is the probability that the poll shows 43% or more in favour?",
            BODY_FIRST, "ex-310", gap=4.0, keep=True,
        )
        made += self.emit(
            "paragraph",
            "##Solution.## If the councillor is right, $p = 0.40$ and the standard error is $\\sqrt{0.4 \\times 0.6/900} = 0.0163$. Both $np = 360$ and "
            "$n(1 - p) = 540$ exceed 10, so $\\hat{p}$ is approximately normal, and the observed 43% lies $(0.43 - 0.40)/0.0163 = 1.84$ standard errors above $p$. "
            "The normal table gives $P(Z > 1.84) = 0.0329$: a poll like this would overshoot by three points in about one case in thirty, so the councillor "
            "should not be surprised if it does not.",
            BODY_FIRST, "ex-310-b", gap=10.0, keep=True,
        )
        self.shade(made, None, EXAMPLE_BAR)

        # ---- 小结、习题 ----
        self.emit("section_heading", "Chapter summary", H2, "h-summary", gap=6.0, attributes={"level": 2}, with_next=60.0)
        for index, item in enumerate(
            [
                "A parameter describes a population and is fixed; a statistic describes a sample and varies from sample to sample.",
                "The sampling distribution of a statistic shows how it behaves over all samples of a given size.",
                "The sample mean has mean $\\mu$ and standard error $\\sigma/\\sqrt{n}$, so larger samples give less variable averages.",
                "By the Central Limit Theorem, $\\bar{x}$ is approximately normal for large $n$ whatever the shape of the population, provided the observations are independent.",
                "A sample proportion is a mean of zeros and ones, with standard error $\\sqrt{p(1 - p)/n}$, and can be treated the same way.",
            ],
            start=1,
        ):
            self.emit("list_item", f"{index}.  {item}", LIST, f"sum-{index}", gap=1.5, keep=True)
        self.region.y += 10.0
        self.emit("section_heading", "Exercises", H2, "h-exercises", gap=6.0, attributes={"level": 2}, with_next=50.0)
        self.emit(
            "paragraph",
            "Answers to the odd-numbered exercises are on the companion website. Exercises 3.3 to 3.6 need nothing more than a calculator and a normal table. Exercises 3.9 and 3.12 are for discussion: there is no single right answer, but plenty of wrong ones.",
            BODY_FIRST, "exercises-lead", gap=3.0,
        )
        for index, text in enumerate(EXERCISES, start=1):
            number = f"3.{index}"
            self.emit("list_item", f"##{number}##  {text}", LIST, f"ex-{number}", gap=4.0, min_lines=2)

        # ---- 上机题：一段代码和它的题注 ----
        self.emit("section_heading", "Computer project", H2, "h-project", gap=6.0, attributes={"level": 2}, with_next=60.0)
        self.emit(
            "paragraph",
            "The listing below repeats the experiment of Figure 3.1(c) in a few lines of Python. Run it with $n = 1$, 5 and 30, and compare the standard deviation "
            "of the 10,000 sample means with $\\sigma/\\sqrt{n}$, where $\\sigma = 1$ for this population. Then change the population to something of your own "
            "choosing and decide how large $n$ must be before the histogram of sample means looks normal.",
            BODY_FIRST, "p-project", gap=6.0,
        )
        code_key = "code-31"
        self.ensure(125.0)
        self.emit("code_caption", "##Listing 3.1:## Simulating the sampling distribution of a sample mean.", CAPTION, "code-31-cap",
                  relations={"caption_of": [code_key]}, gap=3.0, keep=True)
        self.doc.code(
            self.region,
            [
                "import random, statistics",
                "random.seed(1)",
                "",
                "def sample_mean(n):",
                "    draws = (random.expovariate(1) for _ in range(n))",
                "    return statistics.mean(draws)",
                "",
                "means = [sample_mean(30) for _ in range(10_000)]",
                "print(round(statistics.mean(means), 2))   # near 1.00",
                "print(round(statistics.stdev(means), 2))  # near 0.18",
            ],
            key=code_key,
            gap=8.0,
        )

        # 每页上的第一个节标题，页眉要用
        for element in self.doc.elements:
            if element.cls == "section_heading" and element.attributes.get("level") == 2:
                self.sections.setdefault(element.page, element.text)

    # ---- 页眉、页码 ----
    def furniture(self, last_page: int) -> None:
        d = self.doc
        current = ""
        for page in range(last_page + 1):
            current = self.sections.get(page, current)
            label = str(FIRST_LABEL + page)
            x = self.text_x(page)
            folio_style = FOLIO_RIGHT if self.recto(page) else FOLIO_LEFT
            d.text(Region(page, x, TEXT_W, 668.0, 690.0), "page_number", label, folio_style, key=f"folio-{page}", gap=0)
            if page in self.openers:
                continue
            band = Region(page, x, TEXT_W, 32.0, BOTTOM)
            if self.recto(page):
                d.text(band, "running_header", current, HEADER_RIGHT, key=f"header-{page}", gap=0)
            else:
                d.text(band, "running_header", BOOK_TITLE, HEADER, key=f"header-{page}", gap=0)
            d.rule(page, x, x + TEXT_W, 47.0, 0.4)


NOTE_FOR_FOOTNOTE = TextStyle("rm", 7.4, 9.6)  # 和 SampleDocument.footnote_bottom 里用的 SMALL 一样


# ---- 两张图 ----
def _axes(page: fitz.Page, rect: fitz.Rect, ticks: list[str], label: str) -> tuple[float, float, float, float]:
    page.draw_rect(rect, color=(0.82, 0.84, 0.88), width=0.4)
    left, right, top, bottom = rect.x0 + 8, rect.x1 - 8, rect.y0 + 14, rect.y1 - 14
    page.draw_line((left, bottom), (right, bottom), color=INK, width=0.6)
    for i, tick in enumerate(ticks):
        x = left + i * (right - left) / (len(ticks) - 1)
        page.draw_line((x, bottom), (x, bottom + 2), color=INK, width=0.5)
        page.insert_text((x - 3 * len(tick), bottom + 9), tick, fontname="helv", fontsize=5)
    page.insert_text((rect.x0 + 5, rect.y0 + 9), label, fontname="hebo", fontsize=6.5)
    return left, right, top, bottom


def histogram_figure(doc: SampleDocument, region: Region, key: str, *, height: float) -> list[Element]:
    """三张直方图：同一个右偏总体，样本量 1、5、30 的样本均值。"""
    rng = random.Random(3)
    panels = [(1, "(a) n = 1"), (5, "(b) n = 5"), (30, "(c) n = 30")]
    gap = 10.0
    width = (region.width - gap * 2) / 3
    made = []
    for index, (n, label) in enumerate(panels):
        x0 = region.x + index * (width + gap)
        rect = fitz.Rect(x0, region.y, x0 + width, region.y + height)
        page = doc.pages[region.page]
        left, right, top, bottom = _axes(page, rect, ["0", "1", "2", "3", "4"], label)
        means = [sum(rng.expovariate(1.0) for _ in range(n)) / n for _ in range(3000)]
        bins = 24
        counts = [0] * bins
        for m in means:
            counts[min(bins - 1, int(m / 4.0 * bins))] += 1
        peak = max(counts)
        bar_w = (right - left) / bins
        for b, count in enumerate(counts):
            h = (bottom - top - 4) * count / peak
            page.draw_rect(fitz.Rect(left + b * bar_w, bottom - h, left + (b + 1) * bar_w, bottom), color=(0.25, 0.4, 0.7), fill=(0.62, 0.72, 0.88), width=0.3)
        made.append(
            doc.add(Element(id=f"{key}{chr(97 + index)}", cls="figure", page=region.page, bbox=r2(rect), text="", lines=[], attributes={"figure_type": "chart"}))
        )
    region.y += height + 5.0
    return made


def bell_figure(doc: SampleDocument, region: Region, key: str, *, height: float) -> Element:
    """正态曲线，495 克以下的尾部涂色。"""
    width = 210.0
    x0 = region.x + (region.width - width) / 2
    rect = fitz.Rect(x0, region.y, x0 + width, region.y + height)
    page = doc.pages[region.page]
    left, right, top, bottom = _axes(page, rect, ["488", "492", "496", "500", "504", "508", "512"], "")
    mu, sd = 500.0, 3.33

    def point(value: float) -> fitz.Point:
        x = left + (value - 488.0) / 24.0 * (right - left)
        density = math.exp(-0.5 * ((value - mu) / sd) ** 2)
        return fitz.Point(x, bottom - density * (bottom - top - 6))

    curve = [point(488.0 + i * 0.5) for i in range(49)]
    tail = [point(488.0 + i * 0.5) for i in range(int((495.0 - 488.0) / 0.5) + 1)]
    page.draw_polyline(tail + [fitz.Point(tail[-1].x, bottom), fitz.Point(tail[0].x, bottom)], color=None, fill=(0.62, 0.72, 0.88), closePath=True)
    page.draw_polyline(curve, color=(0.18, 0.3, 0.6), width=1.0)
    page.insert_text((left + 2, top + 8), "mean = 500 g", fontname="helv", fontsize=5.5)
    element = doc.add(Element(id=key, cls="figure", page=region.page, bbox=r2(rect), text="", lines=[], attributes={"figure_type": "chart"}))
    region.y += height + 5.0
    return element


def build() -> SampleDocument:
    book = Textbook()
    book.chapter()
    last = max(e.page for e in book.doc.elements)
    book.furniture(last)
    book.doc.pdf.delete_pages(from_page=last + 1, to_page=PAGES - 1)
    book.doc.page_labels = {page: str(FIRST_LABEL + page) for page in range(last + 1)}
    book.doc.bold_terms = dict(book.bold_terms)
    return book.doc


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

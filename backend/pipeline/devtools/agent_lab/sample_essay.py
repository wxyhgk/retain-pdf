"""人造样例 `sample_essay`：一篇人文学科期刊文章（文学评论），Letter 纸、单栏、8 页，页码印 211-218。

特有的东西：题记、罗马数字小节标题（I. II. ...）、法文和德文的整块引文（块上带 `language` 属性，`lang` 记 fr / de）、
很多脚注（每页 2-4 个，写不下的长脚注接到下一页，后半段记 `continues`）、正文里的斜体书名、一张历史版画和图注、文末参考书目。
长句、保留语气（perhaps、it seems、one might argue）、第一人称。

脚注的排法：正文段落排下去之前，先看这一段这一页能放下几行、其中有哪些脚注标记，把这些脚注先留在页底，正文才往下排。
所以脚注永远和标记在同一页（写不下的长脚注除外，前半段在标记所在的页，后半段接到下一页的脚注区最前面）。

    python -m devtools.agent_lab.sample_essay --out /tmp/essay   # 在 backend/pipeline 下跑
"""

from __future__ import annotations

import argparse
import math
import random
import re
from dataclasses import dataclass
from pathlib import Path

import fitz

from devtools.agent_lab import essay_text as text
from devtools.ocr_viewer.complex_sample import Region
from devtools.ocr_viewer.complex_sample import SampleDocument
from devtools.ocr_viewer.complex_sample import _join_lines
from devtools.ocr_viewer.sample_layout import Atom
from devtools.ocr_viewer.sample_layout import Element
from devtools.ocr_viewer.sample_layout import TextStyle
from devtools.ocr_viewer.sample_layout import atom_width
from devtools.ocr_viewer.sample_layout import block_height
from devtools.ocr_viewer.sample_layout import draw_lines
from devtools.ocr_viewer.sample_layout import r2
from devtools.ocr_viewer.sample_layout import space_width
from devtools.ocr_viewer.sample_layout import tokenize
from devtools.ocr_viewer.sample_layout import union

PAGE_W, PAGE_H = 612.0, 792.0  # Letter
MARGIN_X, TOP, BOTTOM = 68.0, 78.0, 722.0
TEXT_W = PAGE_W - 2 * MARGIN_X
MAX_PAGES = 12
FIRST_LABEL = 211
NOTE_GAP, NOTE_TO_BODY = 2.8, 9.0  # 脚注之间、脚注区和正文之间的空
MIN_SPLIT = 2  # 脚注拆到两页时，每一页至少留几行

BODY = TextStyle("rm", 10.6, 14.6, indent=14.0)
BODY_FIRST = TextStyle("rm", 10.6, 14.6)
QUOTE = TextStyle("rm", 9.8, 13.4)
H1 = TextStyle("bf", 12.2, 16.0)
CAPTION = TextStyle("rm", 8.8, 11.6)
NOTE = TextStyle("rm", 8.2, 10.4)
REF = TextStyle("rm", 9.2, 12.0)

MARK_RE = re.compile(r"(\{fn:[\w-]+\}|<i>.*?</i>)")


def printed_label(page: int) -> str:
    return str(FIRST_LABEL + page)


def wrap_glued(atoms: list[Atom], width: float, ts: TextStyle) -> list[list[Atom]]:
    """和 `sample_layout.wrap` 一样折行，但贴着前一个词的东西（脚注标记、斜体后面的标点）不许单独换到下一行开头。"""
    units: list[list[Atom]] = []
    for atom in atoms:
        if units and not atom.space_before:
            units[-1].append(atom)
        else:
            units.append([atom])
    lines: list[list[Atom]] = []
    current: list[Atom] = []
    used = ts.indent
    for unit in units:
        w = sum(atom_width(a, ts.size) for a in unit)
        gap = space_width(ts.style, ts.size) if (current and unit[0].space_before) else 0.0
        if current and used + gap + w > width + 0.01:
            lines.append(current)
            current, used = list(unit), w
            continue
        current += unit
        used += gap + w
    if current:
        lines.append(current)
    return lines


@dataclass
class Note:
    """页底的一条脚注（或它拆开后的一半）。"""

    id: str
    base: str
    lines: list[list[Atom]]
    shown: int
    relations: dict
    part: int = 0

    def height(self) -> float:
        return block_height(self.shown, NOTE)


def notes_height(notes: list[Note]) -> float:
    if not notes:
        return 0.0
    return sum(n.height() for n in notes) + NOTE_GAP * (len(notes) - 1)


class EssayWriter:
    def __init__(self) -> None:
        self.doc = SampleDocument(pages=MAX_PAGES, size=(PAGE_W, PAGE_H), document_id="sample_essay", title=text.TITLE)
        self.regions = [Region(p, MARGIN_X, TEXT_W, TOP, BOTTOM) for p in range(MAX_PAGES)]
        self.doc.flow = self.regions
        self.page = 0
        self.notes: dict[int, list[Note]] = {p: [] for p in range(MAX_PAGES)}
        self.numbers = self._number_footnotes()
        self.deferred: list[tuple] = []  # 放不下、挪到下一页顶上的浮动图
        self.counter: dict[str, int] = {}

    # ---- 脚注编号：按正文里出现的顺序 ----
    def _number_footnotes(self) -> dict[str, int]:
        numbers: dict[str, int] = {}
        for item in text.BODY:
            if item[0] in ("p", "quote"):
                for key in re.findall(r"\{fn:([\w-]+)\}", item[2] if item[0] == "quote" else item[1]):
                    numbers[key] = len(numbers) + 1
        missing = set(text.FOOTNOTES) - set(numbers)
        if missing:
            raise RuntimeError(f"footnotes never referenced: {sorted(missing)}")
        return numbers

    @property
    def region(self) -> Region:
        return self.regions[self.page]

    def rich(self, source: str) -> list:
        content: list = []
        for part in MARK_RE.split(source):
            if not part:
                continue
            if part.startswith("{fn:"):
                number = self.numbers[part[4:-1]]
                content.append({"fn": str(number), "target": f"fn{number}"})
            elif part.startswith("<i>"):
                content.append({"i": part[3:-4]})
            else:
                content.append(part)
        return content

    # ---- 页的开始和结束 ----
    def new_page(self) -> None:
        self.finish_page(self.page)
        self.page += 1
        if self.page >= MAX_PAGES:
            raise RuntimeError("ran out of pages")
        self.begin_page()

    def begin_page(self) -> None:
        self.sync_bottom()
        while self.deferred:
            self.place_figure(*self.deferred.pop(0), allow_defer=False)

    def sync_bottom(self) -> None:
        notes = self.notes[self.page]
        self.region.bottom = BOTTOM - (notes_height(notes) + NOTE_TO_BODY if notes else 0.0)

    def finish_page(self, page: int) -> None:
        """把这一页的脚注画到页底；没排完的接到下一页脚注区的最前面。"""
        notes = self.notes[page]
        if not notes:
            return
        y = BOTTOM - notes_height(notes)
        self.doc.rule(page, MARGIN_X, MARGIN_X + 72, y - 4.0, 0.5)
        carry: list[Note] = []
        for note in notes:
            shown = note.lines[: note.shown]
            records, _, _ = draw_lines(self.doc.pages[page], shown, MARGIN_X, y, TEXT_W, NOTE)
            self.doc.add(
                Element(
                    id=note.id,
                    cls="footnote",
                    page=page,
                    bbox=r2(union([r["bbox"] for r in records])),
                    text=_join_lines([r["text"] for r in records], "en"),
                    lines=records,
                    relations=dict(note.relations),
                )
            )
            y += note.height() + NOTE_GAP
            if note.shown < len(note.lines):
                rest = note.lines[note.shown :]
                carry.append(
                    Note(
                        id=f"{note.base}-cont{note.part + 1}",
                        base=note.base,
                        lines=rest,
                        shown=len(rest),
                        relations={"continues": note.id},
                        part=note.part + 1,
                    )
                )
        self.notes[page + 1] = carry + self.notes[page + 1]

    # ---- 排一个会换页的文字块（正文段落、引文、参考书目条目） ----
    def flow(
        self,
        cls: str,
        content,
        ts: TextStyle,
        *,
        key: str,
        x: float = MARGIN_X,
        width: float = TEXT_W,
        gap: float = 6.0,
        attributes: dict | None = None,
        lang: str = "en",
    ) -> list[Element]:
        lines = wrap_glued(tokenize(content, ts.style), width, ts)
        marks = [[a.target for a in line if a.inline == "footnote_mark"] for line in lines]
        made: list[Element] = []
        start = 0
        fresh_page_tries = 0
        while start < len(lines):
            remaining = len(lines) - start
            choice = None
            for fit in range(remaining, 0, -1):
                if fit < remaining and (fit < 2 or remaining - fit < 2):  # 孤行、寡行
                    continue
                keys = [k for line in marks[start : start + fit] for k in line]
                choice = self._try_fit(ts, fit, keys)
                if choice:
                    break
            if not choice:
                if self.region.y <= TOP + 0.5 and not self.notes[self.page]:
                    raise RuntimeError(f"{key} cannot be placed even on an empty page")
                fresh_page_tries += 1
                if fresh_page_tries > 3:
                    raise RuntimeError(f"{key} cannot be placed")
                self.new_page()
                continue
            fit, new_notes = choice
            part_id = key if not made else f"{key}-cont{len(made)}"
            for note in new_notes:
                note.relations = {"note_of": part_id}
            self.notes[self.page].extend(new_notes)
            self.sync_bottom()
            region = self.region
            records, inlines, next_top = draw_lines(
                self.doc.pages[self.page], lines[start : start + fit], x, region.y, width, ts, first_index=start
            )
            element = Element(
                id=part_id,
                cls=cls,
                page=self.page,
                bbox=r2(union([r["bbox"] for r in records])),
                text=_join_lines([r["text"] for r in records], lang),
                lines=records,
                inlines=inlines,
                attributes=dict(attributes or {}),
                lang=lang,
            )
            if made:
                element.relations["continues"] = made[-1].id
            made.append(self.doc.add(element))
            region.y = next_top - ts.leading + block_height(1, ts) + gap
            start += fit
            if start < len(lines):
                self.new_page()
        return made

    def _try_fit(self, ts: TextStyle, fit: int, keys: list[str]) -> tuple[int, list[Note]] | None:
        """这一页放 `fit` 行、顺带留下这些脚注，放得下吗？放不下就试着把最后一条脚注拆到下一页。"""
        existing = self.notes[self.page]
        new = [self._make_note(k) for k in keys]
        need = block_height(fit, ts)

        def room(notes: list[Note]) -> float:
            total = notes_height(notes)
            return BOTTOM - (total + NOTE_TO_BODY if notes else 0.0) - self.region.y

        if need <= room(existing + new):
            return fit, new
        if new and len(new[-1].lines) >= 2 * MIN_SPLIT + 1:
            last = new[-1]
            for shown in range(len(last.lines) - MIN_SPLIT, MIN_SPLIT - 1, -1):
                trial = Note(last.id, last.base, last.lines, shown, {})
                if need <= room(existing + new[:-1] + [trial]):
                    return fit, new[:-1] + [trial]
        return None

    def _make_note(self, target: str) -> Note:
        number = int(target[2:])
        key = next(k for k, n in self.numbers.items() if n == number)
        content = [{"sup": str(number)}, " "] + self.rich(text.FOOTNOTES[key])
        lines = wrap_glued(tokenize(content, NOTE.style), TEXT_W, NOTE)
        return Note(target, target, lines, len(lines), {})

    # ---- 其它块 ----
    def ensure(self, height: float) -> None:
        if self.region.bottom - self.region.y < height:
            self.new_page()

    def heading(self, number: str | None, title: str) -> None:
        self.counter["h"] = self.counter.get("h", 0) + 1
        # 标题和后面至少三行正文在同一页，否则整个挪到下一页
        self.ensure(block_height(1, H1) + 18.0 + block_height(3, BODY) + 40.0)
        self.region.y += 6.0
        label = f"{number}. {title}" if number else title
        attributes = {"level": 1}
        if number:
            attributes["number"] = number
        key = f"h-{number.lower()}" if number else "h-works"
        self.doc.text(self.region, "section_heading", label, H1, key=key, attributes=attributes, gap=7.0)

    def figure(self) -> None:
        self.place_figure(320.0, 196.0, allow_defer=True)

    def place_figure(self, width: float, height: float, *, allow_defer: bool) -> None:
        region = self.region
        caption_lines = len(
            wrap_glued(tokenize([{"b": "Figure 1."}, " " + text.FIGURE_CAPTION], CAPTION.style), TEXT_W - 60, CAPTION)
        )
        need = height + 6.0 + block_height(caption_lines, CAPTION) + 16.0
        if region.bottom - region.y < need:
            if not allow_defer:
                raise RuntimeError("figure does not fit at the top of a page")
            self.deferred.append((width, height))
            return
        region.y += 4.0
        rect = fitz.Rect(MARGIN_X + (TEXT_W - width) / 2, region.y, MARGIN_X + (TEXT_W + width) / 2, region.y + height)
        draw_engraving(self.doc.pages[self.page], rect)
        self.doc.add(
            Element(
                id="fig1",
                cls="figure",
                page=self.page,
                bbox=r2(rect),
                text="",
                lines=[],
                attributes={"figure_type": "photo", "medium": "wood engraving"},
            )
        )
        region.y = rect.y1 + 6.0
        caption_region = Region(self.page, MARGIN_X + 30, TEXT_W - 60, region.y, region.bottom)
        self.doc.text(
            caption_region,
            "figure_caption",
            [{"b": "Figure 1."}, " " + text.FIGURE_CAPTION],
            CAPTION,
            key="fig1-cap",
            relations={"caption_of": ["fig1"]},
            gap=0,
        )
        region.y = caption_region.y + 14.0


def draw_engraving(page: fitz.Page, rect: fitz.Rect) -> None:
    """一张仿十九世纪木刻版画的阅览室：书架、门上的大钟、长桌和灯、柜台前的人，棕褐色，加细密的排线。"""
    rnd = random.Random(1862)
    x0, y0, w, h = rect.x0, rect.y0, rect.width, rect.height
    ink = (0.22, 0.15, 0.09)
    page.draw_rect(rect, color=ink, fill=(0.93, 0.88, 0.77), width=1.2)
    inner = fitz.Rect(x0 + 5, y0 + 5, rect.x1 - 5, rect.y1 - 5)
    page.draw_rect(inner, color=ink, width=0.4)
    wall_bottom = y0 + h * 0.60
    page.draw_rect(fitz.Rect(inner.x0, inner.y0, inner.x1, wall_bottom), color=None, fill=(0.86, 0.79, 0.65))
    # 地板：斜线汇向远处
    vx, vy = x0 + w * 0.5, wall_bottom - 10
    page.draw_rect(fitz.Rect(inner.x0, wall_bottom, inner.x1, inner.y1), color=None, fill=(0.76, 0.67, 0.52))
    for i in range(-8, 9):
        bottom_x = vx + i * (inner.width / 16.0)
        page.draw_line((vx + (bottom_x - vx) * 0.25, wall_bottom), (bottom_x, inner.y1), color=ink, width=0.25)
    # 书架：左墙、右墙各五层，书脊高低、颜色不一
    spines = [(0.35, 0.18, 0.12), (0.2, 0.28, 0.2), (0.45, 0.3, 0.16), (0.3, 0.22, 0.28), (0.5, 0.4, 0.25)]
    for shelf_x0, shelf_x1 in ((inner.x0 + 6, x0 + w * 0.40), (x0 + w * 0.68, inner.x1 - 6)):
        for row in range(5):
            base = inner.y0 + 22 + row * 20
            page.draw_line((shelf_x0, base), (shelf_x1, base), color=ink, width=0.7)
            x = shelf_x0 + 1
            while x < shelf_x1 - 3:
                bw = rnd.uniform(2.2, 4.6)
                bh = rnd.uniform(11, 17)
                page.draw_rect(fitz.Rect(x, base - bh, x + bw, base), color=ink, fill=rnd.choice(spines), width=0.25)
                x += bw + 0.3
    # 门和门上的钟（画得比透视该有的大一点）
    door = fitz.Rect(x0 + w * 0.43, inner.y0 + 38, x0 + w * 0.62, wall_bottom)
    page.draw_rect(door, color=ink, fill=(0.55, 0.42, 0.28), width=0.8)
    page.draw_rect(fitz.Rect(door.x0 + 5, door.y0 + 6, door.x1 - 5, door.y0 + 30), color=ink, width=0.4)
    clock = fitz.Point((door.x0 + door.x1) / 2, inner.y0 + 22)
    page.draw_circle(clock, 13, color=ink, fill=(0.95, 0.92, 0.84), width=1.0)
    for tick in range(12):
        angle = tick * math.pi / 6
        page.draw_line(
            (clock.x + 10.5 * math.sin(angle), clock.y - 10.5 * math.cos(angle)),
            (clock.x + 12 * math.sin(angle), clock.y - 12 * math.cos(angle)),
            color=ink,
            width=0.5,
        )
    page.draw_line(clock, (clock.x + 1, clock.y - 8), color=ink, width=0.9)
    page.draw_line(clock, (clock.x + 6, clock.y + 3), color=ink, width=0.9)
    # 柜台、馆员、两位站着的女士
    counter = fitz.Rect(x0 + w * 0.55, wall_bottom + 4, inner.x1 - 8, wall_bottom + 30)
    page.draw_rect(counter, color=ink, fill=(0.42, 0.3, 0.19), width=0.8)
    page.draw_circle(fitz.Point(counter.x0 + 28, counter.y0 - 22), 6.5, color=ink, fill=(0.88, 0.76, 0.62), width=0.6)
    page.draw_rect(fitz.Rect(counter.x0 + 20, counter.y0 - 15, counter.x0 + 36, counter.y0), color=ink, fill=(0.2, 0.17, 0.15), width=0.5)
    for cx, tone in ((x0 + w * 0.80, (0.28, 0.2, 0.2)), (x0 + w * 0.90 - 6, (0.2, 0.22, 0.3))):
        page.draw_circle(fitz.Point(cx, wall_bottom - 8), 6, color=ink, fill=(0.88, 0.76, 0.62), width=0.6)
        page.draw_polyline([fitz.Point(cx - 6, wall_bottom - 14), fitz.Point(cx + 6, wall_bottom - 14), fitz.Point(cx + 16, wall_bottom + 34), fitz.Point(cx - 16, wall_bottom + 34), fitz.Point(cx - 6, wall_bottom - 14)], color=ink, fill=tone, width=0.7)
    # 长桌、灯、睡着的先生
    table = [fitz.Point(x0 + 14, inner.y1 - 40), fitz.Point(x0 + w * 0.62, inner.y1 - 40), fitz.Point(x0 + w * 0.70, inner.y1 - 10), fitz.Point(x0 + 4, inner.y1 - 10)]
    page.draw_polyline(table + [table[0]], color=ink, fill=(0.4, 0.28, 0.17), width=0.9)
    page.draw_line((x0 + 50, inner.y1 - 40), (x0 + 50, inner.y1), color=ink, width=1.2)
    lamp = fitz.Point(x0 + w * 0.40, inner.y1 - 62)
    page.draw_circle(lamp, 17, color=None, fill=(0.97, 0.93, 0.7))
    page.draw_circle(lamp, 7, color=ink, fill=(0.99, 0.97, 0.82), width=0.6)
    page.draw_line((lamp.x, lamp.y + 7), (lamp.x, inner.y1 - 40), color=ink, width=1.1)
    page.draw_circle(fitz.Point(x0 + 70, inner.y1 - 56), 7, color=ink, fill=(0.88, 0.76, 0.62), width=0.6)
    page.draw_polyline([fitz.Point(x0 + 56, inner.y1 - 49), fitz.Point(x0 + 88, inner.y1 - 49), fitz.Point(x0 + 94, inner.y1 - 38), fitz.Point(x0 + 50, inner.y1 - 38), fitz.Point(x0 + 56, inner.y1 - 49)], color=ink, fill=(0.2, 0.17, 0.15), width=0.6)
    page.draw_rect(fitz.Rect(x0 + 100, inner.y1 - 46, x0 + 128, inner.y1 - 40), color=ink, fill=(0.9, 0.86, 0.74), width=0.5)
    # 木刻的排线：墙上细横线、地上细斜线，边角压暗
    for i in range(0, int(wall_bottom - inner.y0), 3):
        y = inner.y0 + i
        page.draw_line((inner.x0, y), (inner.x0 + 12 + rnd.uniform(0, 8), y), color=ink, width=0.2)
        page.draw_line((inner.x1 - 12 - rnd.uniform(0, 8), y), (inner.x1, y), color=ink, width=0.2)
    for i in range(0, int(inner.width), 4):
        page.draw_line((inner.x0 + i, inner.y1 - rnd.uniform(1, 6)), (inner.x0 + i + 3, inner.y1), color=ink, width=0.2)


def build() -> SampleDocument:
    writer = EssayWriter()
    doc = writer.doc
    writer.begin_page()
    _front_matter(writer)

    first_after = True  # 标题、引文、图之后的段落不缩进
    para = 0
    section = 0
    for item in text.BODY:
        kind = item[0]
        if kind == "h":
            writer.heading(item[1], item[2])
            section += 1
            para = 0
            first_after = True
        elif kind == "p":
            para += 1
            flag = len(item) > 2 and item[2] == "first"
            style = BODY_FIRST if first_after or flag else BODY
            writer.flow("paragraph", writer.rich(item[1]), style, key=f"s{section}-p{para}", gap=4.0)
            first_after = False
        elif kind == "quote":
            para += 1
            _, lang, source, _origin = item
            writer.region.y += 2.0
            writer.flow(
                "paragraph",
                writer.rich(source),
                QUOTE,
                key=f"s{section}-q{para}",
                x=MARGIN_X + 28.0,
                width=TEXT_W - 56.0,
                gap=9.0,
                lang=lang,
                attributes={"role": "block_quote", "language": lang},
            )
            first_after = True
        elif kind == "figure":
            writer.figure()
            first_after = True
        elif kind == "refs":
            for index, entry in enumerate(item[1], start=1):
                writer.flow("reference_entry", writer.rich(entry), REF, key=f"ref{index:02d}", gap=3.0)
    last = writer.page
    writer.finish_page(last)
    if writer.notes[last + 1]:
        raise RuntimeError("a footnote is still waiting for a page that does not exist")
    _furniture(writer, last)
    doc.pdf.delete_pages(from_page=last + 1, to_page=MAX_PAGES - 1)
    doc.page_labels = {page: printed_label(page) for page in range(last + 1)}
    return doc


def _front_matter(writer: EssayWriter) -> None:
    doc = writer.doc
    region = Region(0, 90.0, PAGE_W - 180.0, 64.0, BOTTOM)
    doc.text(region, "doc_title", text.TITLE, TextStyle("bf", 19.0, 24.0, align="center"), key="title", gap=10.0)
    top = Region(0, MARGIN_X, TEXT_W, region.y, BOTTOM)
    doc.text(top, "author", text.AUTHOR, TextStyle("rm", 12.2, 15.0, align="center"), key="author", gap=2.0)
    doc.text(top, "affiliation", text.AFFILIATION, TextStyle("it", 9.6, 12.0, align="center"), key="affil", gap=4.0)
    doc.text(top, "publication_info", text.PUBLICATION, TextStyle("rm", 8.4, 10.6, align="center"), key="pubinfo", gap=12.0)
    writer.region.y = top.y
    narrow = dict(x=MARGIN_X + 30.0, width=TEXT_W - 60.0)
    writer.flow("abstract", writer.rich(text.ABSTRACT), TextStyle("rm", 9.4, 12.6), key="abstract", gap=4.0, **narrow)
    writer.flow("keywords", text.KEYWORDS, TextStyle("rm", 9.0, 12.0), key="keywords", gap=9.0, **narrow)
    doc.rule(0, MARGIN_X, PAGE_W - MARGIN_X, writer.region.y - 2.0, 0.5)
    writer.region.y += 12.0
    epigraph = dict(x=MARGIN_X + 140.0, width=TEXT_W - 140.0)
    writer.flow("paragraph", text.EPIGRAPH, TextStyle("it", 10.0, 13.6), key="epigraph", gap=2.0, attributes={"role": "epigraph"}, **epigraph)
    writer.flow(
        "paragraph",
        text.EPIGRAPH_SOURCE,
        TextStyle("rm", 8.8, 11.6, align="right"),
        key="epigraph-source",
        gap=10.0,
        attributes={"role": "epigraph_source"},
        **epigraph,
    )


def _furniture(writer: EssayWriter, last: int) -> None:
    """页眉、页脚、页码：最后才画。第一页没有页眉（文章开头）；偶数页页眉是作者、奇数页是短题。"""
    doc = writer.doc
    for page in range(last + 1):
        label = printed_label(page)
        if page > 0:
            band = Region(page, MARGIN_X, TEXT_W, 34.0, BOTTOM)
            if int(label) % 2 == 0:
                doc.text(band, "running_header", text.RUNNING_AUTHOR, TextStyle("it", 8.6, 11.0), key=f"header-{page}", gap=0)
            else:
                doc.text(band, "running_header", text.RUNNING_TITLE, TextStyle("it", 8.6, 11.0, align="right"), key=f"header-{page}", gap=0)
            doc.rule(page, MARGIN_X, PAGE_W - MARGIN_X, 49.0, 0.4)
        doc.text(Region(page, MARGIN_X, 300.0, 752.0, 780.0), "running_footer", text.RUNNING_FOOTER, TextStyle("it", 8.0, 10.0), key=f"footer-{page}", gap=0)
        doc.text(Region(page, PAGE_W - MARGIN_X - 40, 40.0, 752.0, 780.0), "page_number", label, TextStyle("rm", 9.0, 11.0, align="right"), key=f"folio-{page}", gap=0)


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

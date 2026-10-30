"""把 `long_book.py` 的正文排成一本 A5 的小书 PDF，并按块分类记下标准答案（和 3 页样例同一种 `truth.json`）。

书名页（页码 i）、目录页（ii），正文从第 1 页起；每章另起一页，偶数页页眉是书名、奇数页页眉是章名，页码在页脚居中。
正文一栏排，段落写不下就接到下一页（接续组）。

    python -m devtools.agent_lab.long_sample --out /tmp/long_book   # 在 backend/pipeline 下跑
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from devtools.agent_lab import long_book
from devtools.ocr_viewer.complex_sample import Region
from devtools.ocr_viewer.complex_sample import SampleDocument
from devtools.ocr_viewer.sample_layout import SUB
from devtools.ocr_viewer.sample_layout import TextStyle
from devtools.ocr_viewer.sample_layout import block_height

PAGE_W, PAGE_H = 420.0, 595.0  # A5
MARGIN_X, TOP, BOTTOM = 50.0, 58.0, 548.0
TEXT_W = PAGE_W - 2 * MARGIN_X
MAX_PAGES = 80
FRONT = 2  # 书名页、目录页

BODY = TextStyle("rm", 10.6, 15.2, indent=14.0)
BODY_FIRST = TextStyle("rm", 10.6, 15.2)
H1 = TextStyle("bf", 17.0, 21.0)
H2 = TextStyle("bf", 11.4, 15.0)
CAPTION = TextStyle("rm", 9.0, 12.0)
REF = TextStyle("rm", 8.6, 11.4)
NOTE = TextStyle("rm", 8.2, 10.6)
HEADER = TextStyle("it", 8.2, 10.0)
HEADER_RIGHT = TextStyle("it", 8.2, 10.0, align="right")
FOLIO = TextStyle("rm", 8.6, 10.0, align="center")

INLINE_RE = re.compile(r"(\[\d+(?:,\s*\d+)*\]|\{fn:[\w-]+\}|\$[^$]+\$)")


def printed_label(page: int) -> str:
    return ["i", "ii"][page] if page < FRONT else str(page - FRONT + 1)


class BookWriter:
    def __init__(self) -> None:
        self.doc = SampleDocument(pages=MAX_PAGES, size=(PAGE_W, PAGE_H), document_id="long_book", title=long_book.BOOK_TITLE)
        self.doc.flow = [Region(p, MARGIN_X, TEXT_W, TOP, BOTTOM) for p in range(MAX_PAGES)]
        self.page = FRONT
        self.chapter_pages: dict[int, str] = {}  # 页 → 章名（页眉用）
        self.openers: set[int] = set()
        self.footnotes: dict[str, str] = {}  # 脚注 key → 编号

    @property
    def region(self) -> Region:
        return self.doc.flow[self.page]

    def next_page(self) -> None:
        self.page += 1

    def ensure(self, height: float) -> None:
        if self.region.bottom - self.region.y < height:
            self.next_page()

    def text(self, cls: str, content, ts: TextStyle, *, key: str | None = None, gap: float = 6.0, **kwargs):
        made = self.doc.text(self.region, cls, content, ts, key=key, gap=gap, split=True, **kwargs)
        self.page = made[-1].page
        return made

    def rich(self, text: str) -> list:
        """正文里的记号换成排版用的行内对象：引用、脚注标记、行内公式。"""
        content: list = []
        for part in INLINE_RE.split(text):
            if not part:
                continue
            if part.startswith("[") and part.endswith("]"):
                content.append({"cite": part})
            elif part.startswith("{fn:"):
                key = part[4:-1]
                content.append({"fn": self.footnotes[key], "target": key})
            elif part.startswith("$"):
                latex = part[1:-1]
                pieces = [(t, style, SUB if script == "sub" else None) for t, style, script in long_book.FORMULAS[latex]]
                content.append({"math": pieces, "latex": latex})
            else:
                content.append(part)
        return content

    # ---- 各种块 ----
    def chapter(self, number: int, chapter: dict) -> None:
        if self.page > FRONT or self.region.y > TOP:
            self.next_page()
        self.openers.add(self.page)
        self.region.y = 110.0
        title = f"{chapter['number']}   {chapter['title']}" if chapter["number"] else chapter["title"]
        self.text("section_heading", title, H1, key=f"h-{chapter['key']}", attributes={"level": 1}, gap=26)
        start = self.page
        first_paragraph = True
        footnote_count = 0
        items = chapter["items"]
        for index, item in enumerate(items):
            kind = item[0]
            key = f"{chapter['key']}-{index + 1:02d}"
            if kind == "h2":
                self.ensure(block_height(1, H2) + block_height(3, BODY) + 14)
                self.text("section_heading", item[1], H2, key=key, attributes={"level": 2}, gap=6)
                first_paragraph = True
            elif kind == "p":
                # 段落里有脚注标记：脚注先排到这一页底部
                for fn_key in re.findall(r"\{fn:([\w-]+)\}", item[1]):
                    footnote_count += 1
                    self.footnotes[fn_key] = str(footnote_count)
                    note = next(i for i in items if i[0] == "fn" and i[1] == fn_key)
                    self.doc.footnote_bottom(self.region, [{"sup": self.footnotes[fn_key]}, " " + note[2]], key=fn_key, relations={"note_of": key})
                self.ensure(block_height(2, BODY) + 4)
                self.text("paragraph", self.rich(item[1]), BODY_FIRST if first_paragraph else BODY, key=key, gap=4)
                first_paragraph = False
            elif kind == "fig":
                height = 120.0
                self.ensure(height + 40)
                self.doc.figure(self.region, height, key=item[1], seed=number * 7 + index)
                self.text("figure_caption", item[2], CAPTION, key=f"{item[1]}-cap", relations={"caption_of": [item[1]]}, gap=12)
                first_paragraph = True
            elif kind == "table":
                rows = item[3]
                self.ensure(len(rows) * 11.0 + 50)
                self.text("table_caption", item[2], CAPTION, key=f"{item[1]}-cap", relations={"caption_of": [item[1]]}, gap=4)
                self.doc.table(self.region, rows, key=item[1], gap=12)
                first_paragraph = True
            elif kind == "refs":
                self.ensure(block_height(1, H2) + block_height(2, REF) + 16)
                self.text("section_heading", "References", H2, key=f"{chapter['key']}-refs", attributes={"level": 2}, gap=5)
                for r_index, entry in enumerate(item[1], start=1):
                    self.text("reference_entry", entry, REF, key=f"{chapter['key']}-ref{r_index}", gap=3)
        for page in range(start, self.page + 1):
            self.chapter_pages[page] = title

    def title_page(self) -> None:
        doc = self.doc
        doc.text(Region(0, MARGIN_X, TEXT_W, 170.0, BOTTOM), "doc_title", long_book.BOOK_TITLE, TextStyle("bf", 26.0, 32.0, align="center"), key="title", gap=0)
        doc.text(
            Region(0, MARGIN_X, TEXT_W, 214.0, BOTTOM),
            "doc_title",
            "A Practical Guide to Document Understanding",
            TextStyle("it", 13.0, 17.0, align="center"),
            key="subtitle",
            gap=0,
        )
        doc.text(Region(0, MARGIN_X, TEXT_W, 300.0, BOTTOM), "author", long_book.AUTHOR, TextStyle("rm", 12.0, 15.0, align="center"), key="author", gap=0)

    def contents(self) -> None:
        toc = Region(1, MARGIN_X + 20, TEXT_W - 40, 110.0, BOTTOM)
        self.doc.text(toc, "section_heading", "Contents", H1, key="h-contents", attributes={"level": 1}, gap=20)
        by_key = {e.id: e for e in self.doc.elements}
        for chapter in long_book.CHAPTERS:
            heading = by_key[f"h-{chapter['key']}"]
            self.doc.toc_entry(toc, 1, heading.text, printed_label(heading.page), key=f"toc-{chapter['key']}", target=heading.id)

    def furniture(self, last_page: int) -> None:
        """页眉、页码：最后才画，要等知道每页属于哪一章。"""
        for page in range(1, last_page + 1):
            label = printed_label(page)
            folio = Region(page, PAGE_W / 2 - 20, 40, 562.0, 580.0)
            self.doc.text(folio, "page_number", label, FOLIO, key=f"folio-{page}", gap=0)
            if page < FRONT or page in self.openers:
                continue
            band = Region(page, MARGIN_X, TEXT_W, 30.0, BOTTOM)
            if (page - FRONT + 1) % 2 == 0:
                self.doc.text(band, "running_header", long_book.BOOK_TITLE, HEADER, key=f"header-{page}", gap=0)
            else:
                self.doc.text(band, "running_header", self.chapter_pages.get(page, ""), HEADER_RIGHT, key=f"header-{page}", gap=0)
            self.doc.rule(page, MARGIN_X, PAGE_W - MARGIN_X, 44.0, 0.4)


def build() -> SampleDocument:
    writer = BookWriter()
    writer.title_page()
    for number, chapter in enumerate(long_book.CHAPTERS):
        writer.chapter(number, chapter)
    last = max(e.page for e in writer.doc.elements)
    writer.contents()
    writer.furniture(last)
    writer.doc.pdf.delete_pages(from_page=last + 1, to_page=MAX_PAGES - 1)
    writer.doc.page_labels = {page: printed_label(page) for page in range(last + 1)}
    writer.doc.chapters = {e.id: chapter["key"] for chapter in long_book.CHAPTERS for e in writer.doc.elements if e.id == f"h-{chapter['key']}"}
    return writer.doc


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    doc = build()
    pdf_path, truth_path = doc.save(args.out)
    print(pdf_path, f"{len(doc.page_labels)} pages")
    print(truth_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""按坐标排版的小排版器：一边往 PDF 上画字，一边把每个块、每一行、每个行内片段的框记下来当标准答案。

只用 PyMuPDF 自带的字体（Times、Courier、Droid Sans Fallback），换台机器生成的 PDF 和答案都一样。
坐标是 PDF 点，原点在左上角，和 document.v1 归一化之后的坐标一致。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import fitz

FONTS = {
    "rm": "tiro",
    "bf": "tibo",
    "it": "tiit",
    "tt": "cour",
    "zh": "china-s",
    "sf": "helv",
    "sfb": "hebo",
}
_FONT_CACHE: dict[str, fitz.Font] = {}

SUP = "sup"
SUB = "sub"
_SCRIPT = {SUP: (0.68, -0.38), SUB: (0.68, 0.22)}  # 字号比例、基线偏移（占字号的比例，向下为正）

NO_LINE_START = set("。，、；：！？）》」』")  # 中文避头：这些标点不放在行首
CJK_RE = re.compile(r"[　-〿一-鿿＀-￯]")
TOKEN_RE = re.compile(r"[　-〿一-鿿＀-￯]|[^\s　-〿一-鿿＀-￯]+|\s+")


def font(style: str) -> fitz.Font:
    name = FONTS[style]
    if name not in _FONT_CACHE:
        _FONT_CACHE[name] = fitz.Font(name)
    return _FONT_CACHE[name]


def r2(values) -> list[float]:
    return [round(float(v), 2) for v in values]


def union(boxes: list[list[float]]) -> list[float]:
    return [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]


@dataclass
class Piece:
    text: str
    style: str
    script: str = ""  # "", SUP, SUB


@dataclass
class Atom:
    """排版时不拆开的一小段：一个英文词、一个汉字、一个行内公式、一个脚注标记。"""

    pieces: list[Piece]
    space_before: bool
    inline: str = ""  # 行内类别：inline_formula / footnote_mark / citation
    latex: str = ""
    target: str = ""  # 脚注标记指向的脚注 key

    def text(self) -> str:
        return "".join(p.text for p in self.pieces)


@dataclass
class Element:
    id: str
    cls: str
    zone: str
    page: int
    bbox: list[float]
    text: str
    lines: list[dict] = field(default_factory=list)
    inlines: list[dict] = field(default_factory=list)
    relations: dict = field(default_factory=dict)
    attributes: dict = field(default_factory=dict)
    lang: str = "en"

    def payload(self) -> dict:
        data = {
            "id": self.id,
            "class": self.cls,
            "zone": self.zone,
            "page": self.page,
            "bbox": r2(self.bbox),
            "text": self.text,
            "lang": self.lang,
            "lines": self.lines,
        }
        if self.inlines:
            data["inlines"] = self.inlines
        if self.relations:
            data["relations"] = self.relations
        if self.attributes:
            data["attributes"] = self.attributes
        return data


def tokenize(content, base_style: str) -> list[Atom]:
    """content：字符串和行内对象混排的列表。

    行内对象：{"math": [(文字, 字体, 上下标), ...], "latex": ...}、{"fn": "1", "target": key}、{"cite": "[3]"}。
    """
    atoms: list[Atom] = []
    pending_space = False
    for item in content if isinstance(content, list) else [content]:
        if isinstance(item, str):
            for token in TOKEN_RE.findall(item):
                if token.isspace():
                    pending_space = True
                    continue
                cjk = bool(CJK_RE.match(token))
                # 中文段落里的英文、数字用 Times 排：内置中文字体量不准西文字宽。
                style = "zh" if cjk else ("rm" if base_style == "zh" else base_style)
                atoms.append(Atom([Piece(token, style)], space_before=pending_space))
                pending_space = False
            continue
        if "math" in item:
            pieces = [Piece(text, style, script) for text, style, script in item["math"]]
            atoms.append(Atom(pieces, pending_space, inline="inline_formula", latex=item.get("latex", "")))
        elif "fn" in item:
            atoms.append(Atom([Piece(item["fn"], "rm", SUP)], False, inline="footnote_mark", target=item.get("target", "")))
        elif "sup" in item:
            atoms.append(Atom([Piece(item["sup"], "rm", SUP)], False))
        elif "cite" in item:
            atoms.append(Atom([Piece(item["cite"], base_style if base_style != "zh" else "rm")], pending_space, inline="citation"))
        pending_space = False
    return atoms


def _piece_size(piece: Piece, size: float) -> tuple[float, float]:
    scale, shift = _SCRIPT.get(piece.script, (1.0, 0.0))
    return size * scale, size * shift


def atom_width(atom: Atom, size: float) -> float:
    return sum(font(p.style).text_length(p.text, _piece_size(p, size)[0]) for p in atom.pieces)


def space_width(style: str, size: float) -> float:
    return font("rm" if style == "zh" else style).text_length(" ", size)


@dataclass
class TextStyle:
    style: str = "rm"
    size: float = 9.0
    leading: float = 12.4
    align: str = "left"  # left / center / right
    indent: float = 0.0  # 首行缩进


def wrap(atoms: list[Atom], width: float, ts: TextStyle) -> list[list[Atom]]:
    lines: list[list[Atom]] = []
    current: list[Atom] = []
    used = ts.indent
    for atom in atoms:
        w = atom_width(atom, ts.size)
        gap = space_width(ts.style, ts.size) if (current and atom.space_before) else 0.0
        if current and used + gap + w > width + 0.01 and atom.text() not in NO_LINE_START:
            lines.append(current)
            current, used = [atom], w
            continue
        current.append(atom)
        used += gap + w
    if current:
        lines.append(current)
    return lines


def line_width(line: list[Atom], ts: TextStyle, first: bool) -> float:
    total = ts.indent if first else 0.0
    for index, atom in enumerate(line):
        if index and atom.space_before:
            total += space_width(ts.style, ts.size)
        total += atom_width(atom, ts.size)
    return total


def line_height_box(baseline: float, ts: TextStyle) -> tuple[float, float]:
    f = font(ts.style)
    return baseline - f.ascender * ts.size, baseline - f.descender * ts.size


def draw_lines(page: fitz.Page, lines: list[list[Atom]], x: float, top: float, width: float, ts: TextStyle, *, first_index: int = 0):
    """画若干行，返回（行记录、行内片段记录、下一行的顶）。"""
    f = font(ts.style)
    line_records: list[dict] = []
    inline_records: list[dict] = []
    baseline = top + f.ascender * ts.size
    for index, line in enumerate(lines):
        first = first_index == 0 and index == 0
        lw = line_width(line, ts, first)
        if ts.align == "center":
            cx = x + (width - lw) / 2
        elif ts.align == "right":
            cx = x + width - lw
        else:
            cx = x + (ts.indent if first else 0.0)
        start = cx
        parts: list[str] = []
        for atom_index, atom in enumerate(line):
            if atom_index and atom.space_before:
                cx += space_width(ts.style, ts.size)
                parts.append(" ")
            atom_boxes = []
            for piece in atom.pieces:
                psize, shift = _piece_size(piece, ts.size)
                pf = font(piece.style)
                page.insert_text((cx, baseline + shift), piece.text, fontname=FONTS[piece.style], fontsize=psize)
                pw = pf.text_length(piece.text, psize)
                atom_boxes.append([cx, baseline + shift - pf.ascender * psize, cx + pw, baseline + shift - pf.descender * psize])
                cx += pw
            parts.append(atom.text())
            if atom.inline:
                record = {"class": atom.inline, "bbox": r2(union(atom_boxes)), "text": atom.text()}
                if atom.latex:
                    record["latex"] = atom.latex
                if atom.target:
                    record["target"] = atom.target
                inline_records.append(record)
        y0, y1 = line_height_box(baseline, ts)
        line_records.append({"bbox": r2([start, y0, cx, y1]), "text": "".join(parts)})
        baseline += ts.leading
    next_top = top + ts.leading * len(lines)
    return line_records, inline_records, next_top


def block_height(n_lines: int, ts: TextStyle) -> float:
    f = font(ts.style)
    return (n_lines - 1) * ts.leading + (f.ascender - f.descender) * ts.size

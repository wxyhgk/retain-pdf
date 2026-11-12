"""表格框里的文字层：逐字取位置和字号，拼成词，标上下标，再按行排好。

格子原文从这里取，不用 OCR 的（评测集量过：OCR 的格子文字约四成和原文对不上）。
"""
from __future__ import annotations

from dataclasses import dataclass, field

import fitz

from .symbol_fonts import fix_symbol_char

# 比本行主字号小这么多就算上下标
_SCRIPT_SIZE_RATIO = 0.85
# 同一行里两段字之间的空隙小于主字号的这个比例，算同一个词
_WORD_GAP_RATIO = 0.18


@dataclass
class Word:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    size: float

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass
class TextLine:
    words: list[Word] = field(default_factory=list)

    @property
    def y0(self) -> float:
        return min(word.y0 for word in self.words)

    @property
    def y1(self) -> float:
        return max(word.y1 for word in self.words)

    @property
    def text(self) -> str:
        return " ".join(word.text for word in self.words)


@dataclass
class _Piece:
    x0: float
    y0: float
    x1: float
    y1: float
    text: str
    size: float
    script: str  # "" / "sup" / "sub"
    line_key: int
    baseline: float


def _line_main_size(spans: list[dict]) -> float:
    weights: dict[float, int] = {}
    for span in spans:
        count = sum(1 for char in span.get("chars") or [] if not char["c"].isspace())
        weights[round(span["size"], 1)] = weights.get(round(span["size"], 1), 0) + count
    return max(weights, key=weights.get) if weights else 0.0


def _span_script(span: dict, main_size: float, line_mid: float) -> str:
    if main_size <= 0 or span["size"] >= main_size * _SCRIPT_SIZE_RATIO:
        return ""
    x0, y0, x1, y1 = span["bbox"]
    return "sup" if (y0 + y1) / 2 < line_mid else "sub"


def _pieces(page: fitz.Page, rect: fitz.Rect) -> list[_Piece]:
    raw = page.get_text("rawdict", clip=rect)
    pieces: list[_Piece] = []
    line_key = 0
    for block in raw.get("blocks") or []:
        if block.get("type") != 0:
            continue
        for line in block.get("lines") or []:
            line_key += 1
            # 只要横排的字：斜着的水印、竖排的字会把好几行撑成一行（2026-11-12 评测集里一张表因此整张对不上）
            direction = line.get("dir") or (1.0, 0.0)
            if abs(direction[1]) > 0.1 or direction[0] < 0:
                continue
            spans = line.get("spans") or []
            main_size = _line_main_size(spans)
            normal = [span for span in spans if span["size"] >= main_size * _SCRIPT_SIZE_RATIO] or spans
            line_mid = sum((span["bbox"][1] + span["bbox"][3]) / 2 for span in normal) / len(normal)
            for span in spans:
                script = _span_script(span, main_size, line_mid)
                current: list[dict] = []
                for char in (span.get("chars") or []) + [None]:
                    if char is None or (char["c"].isspace() and fix_symbol_char(span.get("font", ""), char["c"]) == char["c"]):
                        if current:
                            pieces.append(
                                _Piece(
                                    x0=min(c["bbox"][0] for c in current),
                                    y0=min(c["bbox"][1] for c in current),
                                    x1=max(c["bbox"][2] for c in current),
                                    y1=max(c["bbox"][3] for c in current),
                                    text="".join(fix_symbol_char(span.get("font", ""), c["c"]) for c in current),
                                    size=span["size"] if not script else main_size,
                                    script=script,
                                    line_key=line_key,
                                    baseline=sum(c["origin"][1] for c in current) / len(current),
                                )
                            )
                            current = []
                        continue
                    cx = (char["bbox"][0] + char["bbox"][2]) / 2
                    cy = (char["bbox"][1] + char["bbox"][3]) / 2
                    if rect.contains(fitz.Point(cx, cy)):
                        current.append(char)
    return pieces


def _markup(piece: _Piece) -> str:
    return f"<{piece.script}>{piece.text}</{piece.script}>" if piece.script else piece.text


def _join_words(pieces: list[_Piece]) -> list[Word]:
    """同一行里挨得很近的片段（含上下标）拼成一个词。"""
    pieces = sorted(pieces, key=lambda piece: piece.x0)
    words: list[Word] = []
    for piece in pieces:
        if words:
            last = words[-1]
            gap = piece.x0 - last.x1
            if gap < max(piece.size, last.size) * _WORD_GAP_RATIO:
                last.text += _markup(piece)
                last.x1 = max(last.x1, piece.x1)
                last.y0 = min(last.y0, piece.y0)
                last.y1 = max(last.y1, piece.y1)
                continue
        words.append(Word(piece.x0, piece.y0, piece.x1, piece.y1, _markup(piece), piece.size))
    return words


def table_text_lines(page: fitz.Page, bbox: list[float] | tuple[float, ...]) -> list[TextLine]:
    """表格框里的文字，按视觉上的行从上到下排好；每行里的词从左到右。"""
    rect = fitz.Rect(*bbox)
    pieces = _pieces(page, rect)
    heights = sorted(piece.y1 - piece.y0 for piece in pieces if not piece.script)
    typical = heights[len(heights) // 2] if heights else 0.0
    if typical > 0:  # 异常高的片段（大号装饰字、竖排）不参与分行
        pieces = [piece for piece in pieces if piece.y1 - piece.y0 <= typical * 3]
    # 按基线分行：基线差超过字号的 0.35 倍就是另一行。不用"竖直方向有重叠"——行距很紧的表会一行连一行串成一行。
    normal = sorted((piece for piece in pieces if not piece.script), key=lambda piece: piece.baseline)
    rows: list[list[_Piece]] = []
    for piece in normal:
        if rows:
            current = rows[-1]
            baselines = sorted(p.baseline for p in current)
            if abs(piece.baseline - baselines[len(baselines) // 2]) <= max(piece.size, 1.0) * 0.35:
                current.append(piece)
                continue
        rows.append([piece])
    # 字号没变小、只是抬高或压低的上下标（例如表头的 `CIE(x,y)<sup>f</sup>`）会自己成一行：只有零星几个片段、
    # 紧贴在另一行上方或下方（基线差不到 0.7 个字号）的行，并进那一行当上下标。
    rows.sort(key=lambda row: sorted(p.baseline for p in row)[len(row) // 2])
    merged = True
    while merged and len(rows) > 1:
        merged = False
        for index, row in enumerate(rows):
            baseline = sorted(p.baseline for p in row)[len(row) // 2]
            size = max(p.size for p in row)
            for neighbour_index in (index + 1, index - 1):
                if not 0 <= neighbour_index < len(rows):
                    continue
                neighbour = rows[neighbour_index]
                if len(row) * 3 > len(neighbour):
                    continue
                other = sorted(p.baseline for p in neighbour)[len(neighbour) // 2]
                if 0 < abs(other - baseline) <= size * 0.7:
                    script = "sup" if baseline < other else "sub"
                    for piece in row:
                        piece.script = script
                    neighbour.extend(row)
                    rows.pop(index)
                    merged = True
                    break
            if merged:
                break

    # 上下标挂到它所属的那一行：上标挂到基线在它下面、最近的那一行；下标挂到基线在它上面、最近的那一行
    # （挂到"中心最近"的行会把表头里的上标挂到上一行去）。
    def _row_baseline(row: list[_Piece]) -> float:
        values = sorted(p.baseline for p in row if not p.script) or sorted(p.baseline for p in row)
        return values[len(values) // 2]

    for piece in pieces:
        if not piece.script or not rows:
            continue
        if piece.script == "sup":
            below = [row for row in rows if _row_baseline(row) >= piece.baseline - 0.5]
            target = min(below, key=_row_baseline) if below else max(rows, key=_row_baseline)
        else:
            above = [row for row in rows if _row_baseline(row) <= piece.baseline + 0.5]
            target = max(above, key=_row_baseline) if above else min(rows, key=_row_baseline)
        target.append(piece)
    lines = [TextLine(words=_join_words(row)) for row in rows]
    lines = [line for line in lines if line.words]
    lines.sort(key=lambda line: line.y0)
    return lines

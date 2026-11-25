"""表格模型（table.v1）的格子 → 交给模型的文字、分段。

只读 table.v1 的字段，不依赖流水线的表格代码（表格模型由流水线建，翻译包只拿到字典）。
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from dataclasses import field

# 一段最多交给模型几个要翻的格子。长表按行分段，每段都带上表头（第一段翻表头，后面的段只看表头的译文）。
MAX_CANDIDATES_PER_CHUNK = 80

ROLE_LETTER = {"header": "H", "stub": "S", "data": "D", "empty": "-"}
_TAG = re.compile(r"<[^>]+>")


def plain(text: str) -> str:
    return " ".join(_TAG.sub("", text or "").split())


@dataclass(frozen=True)
class Cell:
    cell_id: str
    row: int
    col: int
    rowspan: int
    colspan: int
    text: str
    role: str
    kind: str
    candidate: bool  # 规则建议翻（content_kind=text）；数字、化学式、编号、空格子规则先定不翻

    @property
    def flag(self) -> str:
        return "?" if self.candidate else "="


def table_cells(model: dict) -> list[Cell]:
    cells: list[Cell] = []
    for raw in model.get("cells") or []:
        text = str(raw.get("text") or "").strip()
        cells.append(
            Cell(
                cell_id=str(raw.get("id") or f"r{raw.get('row')}c{raw.get('col')}"),
                row=int(raw.get("row") or 0),
                col=int(raw.get("col") or 0),
                rowspan=int(raw.get("rowspan") or 1),
                colspan=int(raw.get("colspan") or 1),
                text=text,
                role=str(raw.get("role") or ("empty" if not text else "data")),
                kind=str(raw.get("content_kind") or ("empty" if not text else "text")),
                candidate=bool(text) and str(raw.get("suggested_action") or "") == "translate",
            )
        )
    cells.sort(key=lambda cell: (cell.row, cell.col))
    return cells


@dataclass
class Chunk:
    """交给模型的一段：要翻的格子（candidates）+ 只给模型看的格子（context，可能带已定的译文）。"""

    rows: tuple[int, int]
    candidates: list[Cell] = field(default_factory=list)
    context: list[Cell] = field(default_factory=list)


def plan_chunks(cells: list[Cell], *, max_candidates: int = MAX_CANDIDATES_PER_CHUNK) -> list[Chunk]:
    header_rows = sorted({cell.row for cell in cells if cell.role == "header"})
    header = [cell for cell in cells if cell.row in header_rows]
    body_rows = sorted({cell.row for cell in cells} - set(header_rows))
    total = sum(cell.candidate for cell in cells)
    if total <= max_candidates or not body_rows:
        return [Chunk(rows=(min((c.row for c in cells), default=0), max((c.row for c in cells), default=0)),
                      candidates=[c for c in cells if c.candidate], context=[c for c in cells if not c.candidate])]
    by_row: dict[int, list[Cell]] = {}
    for cell in cells:
        by_row.setdefault(cell.row, []).append(cell)
    chunks: list[Chunk] = []
    current: list[int] = []
    budget = max_candidates - sum(cell.candidate for cell in header)
    count = 0
    for row in body_rows:
        row_candidates = sum(cell.candidate for cell in by_row[row])
        if current and count + row_candidates > budget:
            chunks.append(_chunk(current, by_row, header, first=not chunks))
            current, count, budget = [], 0, max_candidates
        current.append(row)
        count += row_candidates
    if current:
        chunks.append(_chunk(current, by_row, header, first=not chunks))
    return chunks


def _chunk(rows: list[int], by_row: dict[int, list[Cell]], header: list[Cell], *, first: bool) -> Chunk:
    body = [cell for row in rows for cell in by_row[row]]
    chunk = Chunk(rows=(rows[0], rows[-1]))
    for cell in (header if first else []) + body:
        (chunk.candidates if cell.candidate else chunk.context).append(cell)
    if not first:
        chunk.context = header + chunk.context  # 后面的段：表头只当上下文（带第一段定下的译文）
    return chunk


def render_chunk(chunk: Chunk, *, n_rows: int, n_cols: int, decided: dict[str, str]) -> str:
    """一行一个格子：`r2c0 S ? toluene`。`?` 要你定（翻或 keep），`=` 规则定了不翻（要翻得说明理由）；
    带 `→` 的是前面已经定下的译文，只作参考。"""
    lines = [f"表格 {n_rows} 行 × {n_cols} 列；这一段是第 {chunk.rows[0]}–{chunk.rows[1]} 行。"]
    for cell in sorted(chunk.candidates + chunk.context, key=lambda cell: (cell.row, cell.col)):
        if not cell.text:
            continue
        span = ""
        if cell.rowspan > 1 or cell.colspan > 1:
            span = f" (跨{cell.rowspan}行{cell.colspan}列)"
        line = f"{cell.cell_id} {ROLE_LETTER.get(cell.role, 'D')} {cell.flag}{span} {cell.text}"
        if cell.cell_id in decided:
            line += f"  → {decided[cell.cell_id]}"
        lines.append(line)
    return "\n".join(lines)


__all__ = ["Cell", "Chunk", "MAX_CANDIDATES_PER_CHUNK", "plain", "plan_chunks", "render_chunk", "table_cells"]

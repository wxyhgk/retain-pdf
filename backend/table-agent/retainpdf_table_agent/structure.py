"""定结构（表格 agent G4 的前半）：表格模型标了结构不可信的表，把原表截图和当前结构给模型，它只能用结构工具改。

一张表一个有上限的循环（``STRUCTURE_MAX_ROUNDS`` 轮，一轮一次请求）。每轮模型回一个 JSON 动作：

- ``edit``：一组结构改动（工具见 ``TOOLS``），代码一条条做；每条做完让调用方按新结构重建表格（格子原文照旧按位置
  从 PDF 文字层取），再用文字层核对——文字层的字一个都不能丢（每个字要落进某个格子，或者是移出去的表题表注）。
  不成立、丢了字的改动撤回，连原因退给模型；全部做完再看规则检查（表格模型的 issues）过没过。
- ``give_up``：修不了，保留原表。

规则检查过了、字一个没丢，才算修好（``fixed``），修好的结构交给翻格子的循环；到了上限还不行，整张保留原表，
不留半修的结构。模型只能动结构（行、格子的跨度、哪几行文字是表题表注、表头几行），写不了格子里的字。

核心不碰文件、不认识哪家模型：截图、重建由调用方给（``contract.StructureSource``），模型调用是同一个 ``chat_fn``，
``purpose="table_structure"``。这一版只修有文字层、OCR 给了网格的表（``FIXABLE_ISSUES``）；没有文字层（要看图认字）、
OCR 没给网格的表照旧跳过。
"""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

from retainpdf_table_agent.contract import ChatResult
from retainpdf_table_agent.contract import StructureSource
from retainpdf_table_agent.json_text import extract_json_text
from retainpdf_table_agent.prompts import load_prompt

STRUCTURE_PROMPT = "table_structure_system.txt"
STRUCTURE_PROMPT_VERSION = "table_structure.v1"
STRUCTURE_PURPOSE = "table_structure"
STRUCTURE_MAX_ROUNDS = 3
RESPONSE_FORMAT = {"type": "json_object"}

# 这一版修得了的：有文字层、OCR 给了网格，只是行、列、跨度不对。
FIXABLE_ISSUES = frozenset({"row_swallows_rows", "columns_not_found"})
# 修完还要没有的（和 agent.BLOCKING_ISSUES 一样，抄在这里免得互相 import）
_BLOCKING = frozenset({"ocr_html_missing", "no_text_layer", "columns_not_found", "row_swallows_rows"})

STRUCTURE_FIXED = "fixed"
STRUCTURE_KEPT = "kept"

REASON_NOT_FIXABLE = "not_fixable"
REASON_GAVE_UP = "model_gave_up"
REASON_ROUNDS = "rounds_exhausted"
REASON_NO_SCREENSHOT = "no_screenshot"

TOOLS = (
    "move_to_caption",
    "split_row",
    "confirm_rows",
    "set_span",
    "delete_cell",
    "delete_column",
    "merge_cells",
    "set_header_rows",
)
MAX_EDITS_PER_ROUND = 60
CELL_PREVIEW_CHARS = 60


# ---- 结构初稿（调用方给的字典 ↔ 按行排的格子） ----


@dataclass
class _Cell:
    rowspan: int
    colspan: int
    ocr_text: str = ""


@dataclass
class _Row:
    cells: list[_Cell]
    lines: list[int]
    wrapped: bool = False


@dataclass
class _Draft:
    """和 HTML 一样按行排格子，列号由占位算出来（改了跨度，同一行后面的格子跟着挪）。"""

    rows: list[_Row]
    caption_lines: list[int]
    skipped_lines: list[int]
    header_rows: int | None

    @classmethod
    def load(cls, raw: dict[str, Any]) -> "_Draft":
        n_rows = int(raw.get("n_rows") or 0)
        by_row: dict[int, list[dict]] = {}
        for cell in raw.get("cells") or []:
            by_row.setdefault(int(cell["row"]), []).append(cell)
        row_lines = list(raw.get("row_lines") or [])
        wrapped = {int(row) for row in raw.get("wrapped_rows") or []}
        rows = []
        for index in range(n_rows):
            cells = sorted(by_row.get(index, []), key=lambda cell: int(cell["col"]))
            rows.append(
                _Row(
                    cells=[_Cell(int(c.get("rowspan") or 1), int(c.get("colspan") or 1), str(c.get("ocr_text") or "")) for c in cells],
                    lines=[int(line) for line in (row_lines[index] if index < len(row_lines) else [])],
                    wrapped=index in wrapped,
                )
            )
        header = raw.get("header_rows")
        return cls(
            rows=rows,
            caption_lines=sorted(int(line) for line in raw.get("caption_lines") or []),
            skipped_lines=sorted(int(line) for line in raw.get("skipped_lines") or []),
            header_rows=None if header is None else int(header),
        )

    def layout(self) -> tuple[list[tuple[int, int, _Cell]], int, int]:
        """每格的（起始行, 起始列, 格子）、行数、列数：照 HTML 表格的占位规则。"""
        occupied: set[tuple[int, int]] = set()
        placed: list[tuple[int, int, _Cell]] = []
        n_rows = len(self.rows)
        for row_index, row in enumerate(self.rows):
            column = 0
            for cell in row.cells:
                while (row_index, column) in occupied:
                    column += 1
                placed.append((row_index, column, cell))
                for dr in range(min(cell.rowspan, n_rows - row_index)):
                    for dc in range(cell.colspan):
                        occupied.add((row_index + dr, column + dc))
                column += cell.colspan
        n_cols = max((column for _, column in occupied), default=-1) + 1
        return placed, n_rows, n_cols

    def snapshot(self) -> tuple:
        """撤回一条改动用：记下每行、每格现在的样子（对象不换，按编号找到的格子撤回后照样能用）。"""
        rows = [(row, list(row.cells), list(row.lines), row.wrapped) for row in self.rows]
        cells = [(cell, cell.rowspan, cell.colspan) for row in self.rows for cell in row.cells]
        return list(self.rows), rows, cells, list(self.caption_lines), self.header_rows

    def restore(self, snapshot: tuple) -> None:
        rows_list, rows, cells, caption_lines, header_rows = snapshot
        self.rows = list(rows_list)
        for row, row_cells, lines, wrapped in rows:
            row.cells, row.lines, row.wrapped = list(row_cells), list(lines), wrapped
        for cell, rowspan, colspan in cells:
            cell.rowspan, cell.colspan = rowspan, colspan
        self.caption_lines, self.header_rows = list(caption_lines), header_rows

    def export(self) -> dict[str, Any]:
        placed, n_rows, n_cols = self.layout()
        return {
            "n_rows": n_rows,
            "n_cols": n_cols,
            "cells": [
                {"row": row, "col": col, "rowspan": min(cell.rowspan, n_rows - row), "colspan": cell.colspan,
                 "ocr_text": cell.ocr_text}
                for row, col, cell in placed
            ],
            "row_lines": [list(row.lines) for row in self.rows],
            "caption_lines": list(self.caption_lines),
            "skipped_lines": list(self.skipped_lines),
            "header_rows": self.header_rows,
            "wrapped_rows": [index for index, row in enumerate(self.rows) if row.wrapped],
        }


# ---- 结果 ----


@dataclass
class StructureResult:
    status: str
    reason: str = ""
    issues_before: list[str] = field(default_factory=list)
    issues_after: list[str] = field(default_factory=list)
    rounds: int = 0
    edits: list[dict[str, Any]] = field(default_factory=list)  # 收下的改动（照模型交的写法）
    rejected: int = 0
    shape_before: tuple[int, int] = (0, 0)
    shape_after: tuple[int, int] = (0, 0)
    model: dict[str, Any] | None = None  # 修好的 table.v1（调用方存，不进 as_dict）

    def as_dict(self) -> dict[str, Any]:
        return {
            "prompt_version": STRUCTURE_PROMPT_VERSION,
            "status": self.status,
            "reason": self.reason,
            "issues_before": list(self.issues_before),
            "issues_after": list(self.issues_after),
            "rounds": self.rounds,
            "edits": list(self.edits),
            "rejected": self.rejected,
            "shape_before": list(self.shape_before),
            "shape_after": list(self.shape_after),
        }


def needs_structure_fix(model: dict) -> bool:
    """表格模型标了结构不可信，而且是这一版修得了的（有文字层、OCR 给了网格）。"""
    blocking = _BLOCKING.intersection(model.get("issues") or [])
    return bool(blocking) and blocking <= FIXABLE_ISSUES


def structure_fingerprint(source: StructureSource) -> str:
    """缓存键里用：同一份初稿、同一层文字、同一个提示词版本，修出来的结果可以复用。"""
    payload = [STRUCTURE_PROMPT_VERSION, source.lines, source.draft]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


# ---- 循环 ----

ChatFn = Callable[..., Any]


def fix_structure(
    model: dict,
    *,
    source: StructureSource,
    chat_fn: ChatFn,
    caption: str = "",
    footnotes: str = "",
    max_rounds: int = STRUCTURE_MAX_ROUNDS,
) -> StructureResult:
    """修一张表的结构。修好了 ``result.model`` 是新的 table.v1；修不好原表不动（``status == "kept"``）。

    模型请求失败（网络、Key 失效）的异常照样抛出去，由调用方决定。
    """
    issues_before = sorted(_BLOCKING.intersection(model.get("issues") or []))
    result = StructureResult(
        status=STRUCTURE_KEPT,
        issues_before=issues_before,
        shape_before=(int(model.get("n_rows") or 0), int(model.get("n_cols") or 0)),
    )
    if not needs_structure_fix(model):
        result.reason = f"{REASON_NOT_FIXABLE}:{','.join(issues_before)}"
        return result
    image = source.screenshot()
    if image is None:
        result.reason = REASON_NO_SCREENSHOT
        return result
    session = _Session(source)
    first = session.view()
    intro = []
    if caption:
        intro.append(f"表题：{caption}")
    if footnotes:
        intro.append(f"表注：{footnotes}")
    intro.append(first)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": load_prompt(STRUCTURE_PROMPT)},
        {"role": "user", "content": [image, {"type": "text", "text": "\n\n".join(intro)}]},
    ]
    for _ in range(max_rounds):
        result.rounds += 1
        reply = _coerce(chat_fn(messages, purpose=STRUCTURE_PURPOSE, response_format=RESPONSE_FORMAT))
        messages.append({"role": "assistant", "content": reply})
        action = _parse(reply)
        kind = str(action.get("action") or "") if action else ""
        if kind == "give_up":
            result.reason = REASON_GAVE_UP
            break
        if kind != "edit" or not isinstance(action.get("edits"), list):
            messages.append({"role": "user", "content": "只回一个 JSON 对象：action 是 edit（带 edits 列表）或 give_up。"})
            continue
        feedback = session.apply_round(action["edits"][:MAX_EDITS_PER_ROUND])
        result.edits.extend(feedback.accepted)
        result.rejected += len(feedback.rejected)
        passed = session.passes()
        # 说了 done、可这一轮有改动被退回：不算完，把原因给它看（它想改的没改成，规则过了也不一定对）
        finished = action.get("done") is True and not feedback.rejected
        if passed and (finished or result.rounds >= max_rounds):
            break
        messages.append({"role": "user", "content": feedback.render(passed=passed, view=session.view())})
    if session.passes() and result.reason != REASON_GAVE_UP:
        result.status = STRUCTURE_FIXED
        result.model = session.model
    elif not result.reason:
        result.reason = REASON_ROUNDS
    result.issues_after = sorted(_BLOCKING.intersection(session.model.get("issues") or []))
    result.shape_after = (int(session.model.get("n_rows") or 0), int(session.model.get("n_cols") or 0))
    return result


@dataclass
class _RoundFeedback:
    accepted: list[dict[str, Any]] = field(default_factory=list)
    rejected: list[tuple[dict[str, Any], str]] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)

    def render(self, *, passed: bool, view: str) -> str:
        lines = [f"收下 {len(self.accepted)} 条改动。"]
        if self.rejected:
            lines.append("退回的改动（已撤回，结构照没做它算）：")
            lines += [f"- {json.dumps(edit, ensure_ascii=False)}：{reason}" for edit, reason in self.rejected]
        if passed:
            lines.append("规则检查都过了、字一个没丢。结构对了就回 {\"action\": \"edit\", \"edits\": [], \"done\": true}；还有要改的接着改。")
        else:
            lines.append("还没过的检查：")
            lines += [f"- {problem}" for problem in self.problems]
        lines.append("")
        lines.append(view)
        return "\n".join(lines)


class _Session:
    """一张表的结构、当前重建出来的 table.v1，和一条条改动。"""

    def __init__(self, source: StructureSource) -> None:
        self.source = source
        self.lines = list(source.lines)
        self.draft = _Draft.load(source.draft)
        self.model = source.rebuild(self.draft.export())
        self.lost = self._lost_tokens(self.draft, self.model)

    # 核对

    def _lost_tokens(self, draft: _Draft, model: dict) -> Counter | None:
        """文字层里算在表格行里的字，有哪些没落进任何格子（列都找不到时没法核对，返回 None）。"""
        if "columns_not_found" in (model.get("issues") or []) or not model.get("cells"):
            return None
        expected: Counter = Counter()
        for row in draft.rows:
            for index in row.lines:
                expected.update(self.lines[index].split())
        placed: Counter = Counter()
        for cell in model.get("cells") or []:
            placed.update(str(cell.get("text") or "").split())
        return (expected - placed) + (placed - expected)

    def problems(self) -> list[str]:
        problems = []
        issues = set(self.model.get("issues") or [])
        if "columns_not_found" in issues:
            problems.append(
                f"columns_not_found：按 {int(self.model.get('n_cols') or 0)} 列切不开文字层（多半是 OCR 多认了列、"
                "或者跨度错了让某一行的格子比别的行多）"
            )
        if "row_swallows_rows" in issues:
            rows = "、".join(str(row) for row in self.model.get("suspect_rows") or []) or "?"
            problems.append(f"row_swallows_rows：第 {rows} 行一行里有好几行每列都有字（几行被并成了一行，或者是格子里折行）")
        if self.lost:
            sample = " ".join(sorted(self.lost.elements())[:12])
            problems.append(f"有 {sum(self.lost.values())} 个字没落进任何格子：{sample}")
        return problems

    def passes(self) -> bool:
        return (
            bool(self.model.get("cells"))
            and not _BLOCKING.intersection(self.model.get("issues") or [])
            and self.lost is not None
            and not self.lost
        )

    # 改动

    def apply_round(self, edits: list[Any]) -> _RoundFeedback:
        feedback = _RoundFeedback()
        placed, n_rows, n_cols = self.draft.layout()
        refs = _Refs(
            rows=list(self.draft.rows),
            cells={f"r{row}c{col}": cell for row, col, cell in placed},
            columns={column: [cell for row, col, cell in placed if col <= column < col + cell.colspan] for column in range(n_cols)},
            suspect_rows=[self.draft.rows[row] for row in self.model.get("suspect_rows") or [] if 0 <= row < n_rows],
        )
        for edit in edits:
            if not isinstance(edit, dict):
                feedback.rejected.append(({"edit": edit}, "每条改动是一个对象：{\"tool\": …}"))
                continue
            snapshot = self.draft.snapshot()
            columns_before = self.draft.layout()[2]
            error = self._apply(edit, refs)
            if error is None and self.draft.layout()[2] > columns_before:
                # 没有加列的工具：OCR 少认列的表这一版修不了；跨度给大了把列撑多的改动退回
                error = f"改完列数从 {columns_before} 变成 {self.draft.layout()[2]}；列只能删（多认的列），不能加"
            if error is None:
                try:
                    model = self.source.rebuild(self.draft.export())
                except Exception as exc:  # noqa: BLE001 - 调用方重建不成立，当改动不成立
                    error = f"改完结构不成立（{type(exc).__name__}）"
                else:
                    lost = self._lost_tokens(self.draft, model)
                    if lost is not None and sum(lost.values()) > sum((self.lost or Counter()).values()):
                        missing = " ".join(sorted((lost - (self.lost or Counter())).elements())[:12])
                        error = f"改完有字没落进任何格子（{missing}），多半是删错了格子、跨度不对"
                    else:
                        self.model, self.lost = model, lost
            if error is not None:
                self.draft.restore(snapshot)
                feedback.rejected.append((edit, error))
            else:
                feedback.accepted.append(edit)
        feedback.problems = self.problems()
        return feedback

    def _apply(self, edit: dict[str, Any], refs: "_Refs") -> str | None:
        tool = str(edit.get("tool") or "")
        handler = {
            "move_to_caption": self._move_to_caption,
            "split_row": self._split_row,
            "confirm_rows": self._confirm_rows,
            "set_span": self._set_span,
            "delete_cell": self._delete_cell,
            "delete_column": self._delete_column,
            "merge_cells": self._merge_cells,
            "set_header_rows": self._set_header_rows,
        }.get(tool)
        if handler is None:
            return f"没有这个工具；只有 {', '.join(TOOLS)}"
        try:
            return handler(edit, refs)
        except (TypeError, ValueError, KeyError) as exc:
            return f"参数不对（{exc}）"

    def _row_index(self, row: _Row) -> int:
        for index, candidate in enumerate(self.draft.rows):
            if candidate is row:
                return index
        raise ValueError("这一行已经不在了")

    def _move_to_caption(self, edit: dict, refs: "_Refs") -> str | None:
        lines = sorted({int(line) for line in edit.get("lines") or []})
        if not lines:
            return "lines 不能空"
        owner: dict[int, _Row] = {index: row for row in self.draft.rows for index in row.lines}
        for line in lines:
            if line not in owner:
                return f"L{line} 不在表格的行里"
        remaining = sorted(index for index in owner if index not in lines)
        if not remaining:
            return "不能把表格的字全移出去"
        for line in lines:
            if remaining[0] < line < remaining[-1]:
                return f"L{line} 在表格中间；只能移最上面或最下面连着的几行"
        for line in lines:
            owner[line].lines.remove(line)
        self.draft.caption_lines = sorted(set(self.draft.caption_lines) | set(lines))
        # 移空了的行：只有一格一格、没有跨行格子压着的才删掉，删不掉的留着（重建时标 row_without_text，不挡）
        placed, n_rows, _ = self.draft.layout()
        for row in [row for row in self.draft.rows if not row.lines]:
            index = self._row_index(row)
            covered = any(r < index < r + c.rowspan for r, _, c in placed)
            if not covered and all(cell.rowspan == 1 for cell in row.cells):
                self.draft.rows.remove(row)
        return None

    def _split_row(self, edit: dict, refs: "_Refs") -> str | None:
        row = refs.row(edit.get("row"))
        at = sorted({int(line) for line in edit.get("at_lines") or []})
        current = sorted(row.lines)
        if not at:
            return "at_lines 不能空"
        # 同一轮前面的改动可能已经把这一行开头几行文字移走了（编号按这一轮开头的结构写的）：从第一行文字切，当没写
        at = [line for line in at if line != current[0]]
        for line in at:
            if line not in current:
                return f"L{line} 不在这一行里（这一行现在是 {_line_span(current)}）"
        if not at:
            return f"从这一行的第一行文字 L{current[0]} 切不出新行"
        segments: list[list[int]] = []
        for line in current:
            if line in at or not segments:
                segments.append([])
            segments[-1].append(line)
        extra = len(segments) - 1
        index = self._row_index(row)
        placed, _, n_cols = self.draft.layout()
        spanning = [cell for r, _, cell in placed if r < index < r + cell.rowspan or (r == index and cell.rowspan > 1)]
        for cell in spanning:
            cell.rowspan += extra  # 跨过这一行的格子跟着多跨几行
        # 切出来的新行：没被跨行格子占着的每一列一个格子（不照抄这一行的跨列，要合并让模型另外 merge_cells）
        free = max(0, n_cols - sum(cell.colspan for cell in spanning))
        new_rows = [_Row(cells=[_Cell(1, 1) for _ in range(free)], lines=segment) for segment in segments[1:]]
        row.lines = segments[0]
        row.wrapped = False
        self.draft.rows[index + 1:index + 1] = new_rows
        return None

    def _confirm_rows(self, edit: dict, refs: "_Refs") -> str | None:
        rows = [refs.row(value) for value in edit.get("rows") or []]
        if not rows:
            return "rows 不能空"
        for value, row in zip(edit.get("rows") or [], rows):
            if row not in refs.suspect_rows:
                return f"第 {value} 行规则没标吞行，不用确认"
        for row in rows:
            row.wrapped = True
        return None

    def _set_span(self, edit: dict, refs: "_Refs") -> str | None:
        cell = refs.cell(edit.get("cell"))
        rowspan = int(cell.rowspan if edit.get("rowspan") is None else edit["rowspan"])
        colspan = int(cell.colspan if edit.get("colspan") is None else edit["colspan"])
        if rowspan < 1 or colspan < 1:
            return "rowspan、colspan 至少是 1"
        _, n_rows, n_cols = self.draft.layout()
        if rowspan > n_rows or colspan > max(n_cols, 1) + 1:
            return "跨度比整张表还大"
        cell.rowspan, cell.colspan = rowspan, colspan
        return None

    def _delete_cell(self, edit: dict, refs: "_Refs") -> str | None:
        cell = refs.cell(edit.get("cell"))
        for row in self.draft.rows:
            if any(candidate is cell for candidate in row.cells):
                row.cells = [candidate for candidate in row.cells if candidate is not cell]
                return None
        return "这个格子已经不在了"

    def _delete_column(self, edit: dict, refs: "_Refs") -> str | None:
        column = int(edit.get("col"))
        if column not in refs.columns:
            return f"没有第 {column} 列"
        if len(refs.columns) <= 1:
            return "只剩一列了"
        for cell in refs.columns[column]:
            if cell.colspan > 1:
                cell.colspan -= 1
                continue
            for row in self.draft.rows:
                row.cells = [candidate for candidate in row.cells if candidate is not cell]
        return None

    def _merge_cells(self, edit: dict, refs: "_Refs") -> str | None:
        cells = [refs.cell(value) for value in edit.get("cells") or []]
        if len({id(cell) for cell in cells}) < 2:
            return "至少给两个不同的格子"
        placed, n_rows, _ = self.draft.layout()
        where = {id(cell): (row, col) for row, col, cell in placed}
        boxes = []
        for cell in cells:
            if id(cell) not in where:
                return "有格子已经不在了"
            row, col = where[id(cell)]
            boxes.append((row, col, row + min(cell.rowspan, n_rows - row), col + cell.colspan))
        top, left = min(b[0] for b in boxes), min(b[1] for b in boxes)
        bottom, right = max(b[2] for b in boxes), max(b[3] for b in boxes)
        area = sum((b[2] - b[0]) * (b[3] - b[1]) for b in boxes)
        if area != (bottom - top) * (right - left):
            return "这几个格子拼不成一个长方形（中间缺格子或者有别的格子）"
        keep = cells[boxes.index(min(boxes))]
        for cell in cells:
            if cell is keep:
                continue
            for row in self.draft.rows:
                row.cells = [candidate for candidate in row.cells if candidate is not cell]
        keep.rowspan, keep.colspan = bottom - top, right - left
        return None

    def _set_header_rows(self, edit: dict, refs: "_Refs") -> str | None:
        rows = int(edit.get("rows"))
        if not 0 <= rows < len(self.draft.rows):
            return f"表头行数要在 0 到 {len(self.draft.rows) - 1} 之间"
        self.draft.header_rows = rows
        return None

    # 给模型看的结构

    def view(self) -> str:
        placed, n_rows, n_cols = self.draft.layout()
        texts = {(cell["row"], cell["col"]): str(cell.get("text") or "") for cell in self.model.get("cells") or []}
        has_text = bool(self.model.get("cells"))
        header = self.draft.header_rows
        header_note = f"表头 {header} 行（你定的）" if header is not None else f"表头 {_header_count(self.model)} 行（规则猜的）"
        out = [f"现在的结构：{n_rows} 行 × {n_cols} 列；{header_note}。"]
        problems = self.problems()
        if problems:
            out.append("规则检查没过：")
            out += [f"- {problem}" for problem in problems]
        caption = set(self.draft.caption_lines)
        skipped = set(self.draft.skipped_lines)
        out.append("")
        out.append("文字层（表格框里从上到下的每一行文字）：")
        for index, text in enumerate(self.lines):
            mark = " [表外：表题表注]" if index in caption else " [表外：没对上任何一行]" if index in skipped else ""
            out.append(f"L{index}{mark} {text}")
        out.append("")
        out.append("表格的行和格子（r 行号 c 列号，从 0 数；[2行]、[3列] 是跨度）：")
        suspect = set(self.model.get("suspect_rows") or [])
        by_row: dict[int, list[tuple[int, _Cell]]] = {}
        for row, col, cell in placed:
            by_row.setdefault(row, []).append((col, cell))
        for row_index, row in enumerate(self.draft.rows):
            notes = []
            if row_index in suspect:
                notes.append("规则：可能吞了好几行")
            if row.wrapped:
                notes.append("已确认是格子里折行")
            note = f"  （{'；'.join(notes)}）" if notes else ""
            out.append(f"第 {row_index} 行 ← {_line_span(row.lines)}{note}")
            parts = []
            for col, cell in by_row.get(row_index, []):
                span = ""
                if cell.rowspan > 1:
                    span += f"[{min(cell.rowspan, n_rows - row_index)}行]"
                if cell.colspan > 1:
                    span += f"[{cell.colspan}列]"
                text = texts.get((row_index, col), "") if has_text else f"OCR: {cell.ocr_text}"
                parts.append(f"r{row_index}c{col}{span} {_preview(text) or '（空）'}")
            out.append("  " + " | ".join(parts) if parts else "  （这一行没有自己的格子）")
        return "\n".join(out)


@dataclass
class _Refs:
    """一轮里模型说的编号（行号、格子编号、列号）都按这一轮开头给它看的结构找，做了前面的改动也不变。"""

    rows: list[_Row]
    cells: dict[str, _Cell]
    columns: dict[int, list[_Cell]]
    suspect_rows: list[_Row]

    def row(self, value: Any) -> _Row:
        index = int(value)
        if not 0 <= index < len(self.rows):
            raise ValueError(f"没有第 {value} 行")
        return self.rows[index]

    def cell(self, value: Any) -> _Cell:
        key = str(value or "")
        if key not in self.cells:
            raise ValueError(f"没有格子 {key}")
        return self.cells[key]


def _header_count(model: dict) -> int:
    return len({cell["row"] for cell in model.get("cells") or [] if cell.get("role") == "header"})


def _line_span(lines: list[int]) -> str:
    if not lines:
        return "（没有文字）"
    lines = sorted(lines)
    if lines == list(range(lines[0], lines[-1] + 1)):
        return f"L{lines[0]}" if len(lines) == 1 else f"L{lines[0]}–L{lines[-1]}"
    return "、".join(f"L{line}" for line in lines)


def _preview(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= CELL_PREVIEW_CHARS else text[: CELL_PREVIEW_CHARS - 1] + "…"


def _coerce(value: Any) -> str:
    if isinstance(value, ChatResult):
        return value.content
    if isinstance(value, tuple) and value:
        return str(value[0] or "")
    return str(value or "")


def _parse(reply: str) -> dict[str, Any] | None:
    try:
        value = json.loads(extract_json_text(reply))
    except (ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None


__all__ = [
    "FIXABLE_ISSUES",
    "STRUCTURE_FIXED",
    "STRUCTURE_KEPT",
    "STRUCTURE_MAX_ROUNDS",
    "STRUCTURE_PROMPT_VERSION",
    "StructureResult",
    "fix_structure",
    "needs_structure_fix",
    "structure_fingerprint",
]

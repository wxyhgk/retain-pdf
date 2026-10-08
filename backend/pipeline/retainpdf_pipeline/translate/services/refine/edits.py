"""定点修改的编辑操作：模型只给 replace / insert_after，执行由程序完成。

硬规则：
- ``replace.find`` / ``insert_after.anchor`` 必须在当前译文里**恰好出现一次**；
- 命中的范围不能碰占位符或公式 token（``<f1-abc/>``、``[[FORMULA_1]]``、``@@P1@@``、
  行内 ``$…$``）——既不能跨过，也不能把它整个包进去；插入点不能落在 token 内部；
- 新写进去的文字不能带占位符（占位符只能原样留在没被碰过的地方）。
任何一条不满足，整块放弃（由调用方保留原译、记原因）。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from retainpdf_pipeline.translate.core.placeholder_tokens import PLACEHOLDER_RE
from retainpdf_pipeline.translate.services.quality.qa.text import MATH_SPAN_RE


EDIT_OP_REPLACE = "replace"
EDIT_OP_INSERT_AFTER = "insert_after"
EDIT_OPS = (EDIT_OP_REPLACE, EDIT_OP_INSERT_AFTER)
MAX_EDITS_PER_ITEM = 6
MAX_EDIT_TEXT_CHARS = 2000

REJECT_INVALID_EDIT = "invalid_edit"
REJECT_FIND_NOT_FOUND = "find_not_found"
REJECT_FIND_NOT_UNIQUE = "find_not_unique"
REJECT_CROSSES_PROTECTED = "crosses_protected_token"
REJECT_INTRODUCES_PLACEHOLDER = "introduces_placeholder"
REJECT_TOO_MANY_EDITS = "too_many_edits"


class EditRejected(Exception):
    def __init__(self, reason: str, detail: str) -> None:
        super().__init__(detail)
        self.reason = reason
        self.detail = detail


@dataclass(frozen=True)
class EditOp:
    op: str
    find: str = ""
    replace: str = ""
    anchor: str = ""
    text: str = ""

    def as_dict(self) -> dict[str, str]:
        if self.op == EDIT_OP_REPLACE:
            return {"op": self.op, "find": self.find, "replace": self.replace}
        return {"op": self.op, "anchor": self.anchor, "text": self.text}


def protected_spans(text: str) -> list[tuple[int, int]]:
    spans = [(match.start(), match.end()) for match in PLACEHOLDER_RE.finditer(text)]
    spans.extend((match.start(), match.end()) for match in MATH_SPAN_RE.finditer(text))
    return sorted(spans)


def _touches_protected(text: str, start: int, end: int) -> bool:
    for span_start, span_end in protected_spans(text):
        if start < span_end and span_start < end:
            return True
    return False


def _inside_protected(text: str, position: int) -> bool:
    return any(span_start < position < span_end for span_start, span_end in protected_spans(text))


def parse_edit(raw: Any) -> EditOp:
    if not isinstance(raw, dict):
        raise EditRejected(REJECT_INVALID_EDIT, "edit is not an object")
    op = str(raw.get("op", "") or "").strip()
    if op == EDIT_OP_REPLACE:
        find = str(raw.get("find", "") or "")
        replace = str(raw.get("replace", "") if raw.get("replace") is not None else "")
        if not find:
            raise EditRejected(REJECT_INVALID_EDIT, "replace.find is empty")
        if len(find) > MAX_EDIT_TEXT_CHARS or len(replace) > MAX_EDIT_TEXT_CHARS:
            raise EditRejected(REJECT_INVALID_EDIT, "edit text too long")
        return EditOp(op=op, find=find, replace=replace)
    if op == EDIT_OP_INSERT_AFTER:
        anchor = str(raw.get("anchor", "") or "")
        text = str(raw.get("text", "") or "")
        if not anchor or not text:
            raise EditRejected(REJECT_INVALID_EDIT, "insert_after needs anchor and text")
        if len(anchor) > MAX_EDIT_TEXT_CHARS or len(text) > MAX_EDIT_TEXT_CHARS:
            raise EditRejected(REJECT_INVALID_EDIT, "edit text too long")
        return EditOp(op=op, anchor=anchor, text=text)
    raise EditRejected(REJECT_INVALID_EDIT, f"unknown op: {op or '<empty>'}")


def _unique_position(text: str, needle: str, label: str) -> int:
    count = text.count(needle)
    if count == 0:
        raise EditRejected(REJECT_FIND_NOT_FOUND, f"{label} not found in current translation")
    if count > 1:
        raise EditRejected(REJECT_FIND_NOT_UNIQUE, f"{label} occurs {count} times in current translation")
    return text.index(needle)


def apply_edit(text: str, edit: EditOp) -> str:
    inserted = edit.replace if edit.op == EDIT_OP_REPLACE else edit.text
    if PLACEHOLDER_RE.search(inserted):
        raise EditRejected(REJECT_INTRODUCES_PLACEHOLDER, "edit text contains a placeholder token")
    if edit.op == EDIT_OP_REPLACE:
        start = _unique_position(text, edit.find, "find")
        end = start + len(edit.find)
        if _touches_protected(text, start, end):
            raise EditRejected(REJECT_CROSSES_PROTECTED, "find overlaps a placeholder or formula token")
        return text[:start] + edit.replace + text[end:]
    start = _unique_position(text, edit.anchor, "anchor")
    end = start + len(edit.anchor)
    if _touches_protected(text, start, end) or _inside_protected(text, end):
        raise EditRejected(REJECT_CROSSES_PROTECTED, "anchor overlaps a placeholder or formula token")
    return text[:end] + edit.text + text[end:]


def apply_edits(text: str, raw_edits: list[Any]) -> tuple[str, list[EditOp]]:
    if len(raw_edits) > MAX_EDITS_PER_ITEM:
        raise EditRejected(REJECT_TOO_MANY_EDITS, f"{len(raw_edits)} edits > {MAX_EDITS_PER_ITEM}")
    edits = [parse_edit(raw) for raw in raw_edits]
    current = text
    for edit in edits:
        current = apply_edit(current, edit)
    return current, edits


__all__ = [
    "EDIT_OPS",
    "EDIT_OP_INSERT_AFTER",
    "EDIT_OP_REPLACE",
    "EditOp",
    "EditRejected",
    "MAX_EDITS_PER_ITEM",
    "REJECT_CROSSES_PROTECTED",
    "REJECT_FIND_NOT_FOUND",
    "REJECT_FIND_NOT_UNIQUE",
    "REJECT_INTRODUCES_PLACEHOLDER",
    "REJECT_INVALID_EDIT",
    "REJECT_TOO_MANY_EDITS",
    "apply_edit",
    "apply_edits",
    "parse_edit",
    "protected_spans",
]

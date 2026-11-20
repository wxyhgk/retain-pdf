"""表格 agent（表格翻译 T3，先只看文字）：一张表一个有上限的循环，每轮模型回一个 JSON 动作，代码执行。

不依赖哪家的原生工具调用，所以 openai、openai_responses、anthropic 都能用；请求走翻译共用的
``request_chat_content``（由调用方给的 ``chat_fn`` 决定，测试里注入假的）。

动作：
- ``lookup_terms``：查这本书里已有的译法（术语表、正文、前面的表）；
- ``submit``：交格子译文。代码逐格校验（数字、上下标、真翻了、同表同译），过了的收下，不过的连原因退回。

一张表最多 ``MAX_ROUNDS`` 轮；到了上限还有格子没定，整表保留原文（原因写进结果），不半翻。
长表按行分段（每段带表头），一段一个循环；术语记忆在段与段、表与表之间共用。
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

from retainpdf_translation.llm.shared.response_parsing import extract_json_text
from retainpdf_translation.prompt_loader import load_prompt
from retainpdf_translation_classic.services.refine.llm import ChatResult

from retainpdf_translation_classic.services.tables.cells import Cell
from retainpdf_translation_classic.services.tables.cells import Chunk
from retainpdf_translation_classic.services.tables.cells import plain
from retainpdf_translation_classic.services.tables.cells import plan_chunks
from retainpdf_translation_classic.services.tables.cells import render_chunk
from retainpdf_translation_classic.services.tables.cells import table_cells
from retainpdf_translation_classic.services.tables.memory import TableTermMemory
from retainpdf_translation_classic.services.tables.validate import check_cell
from retainpdf_translation_classic.services.tables.validate import check_consistency
from retainpdf_translation_classic.services.tables.validate import normalize_source

SYSTEM_PROMPT = "table_translate_system.txt"
PROMPT_VERSION = "table_translate.v1"
MAX_ROUNDS = 6
MAX_LOOKUP_TERMS = 20
RESPONSE_FORMAT = {"type": "json_object"}

STATUS_TRANSLATED = "translated"
STATUS_KEPT = "kept"
STATUS_SKIPPED = "skipped"

REASON_NO_CANDIDATES = "no_cells_to_translate"
REASON_NO_TEXT_LAYER = "no_text_layer"
REASON_MODEL_ISSUES = "structure_unreliable"
REASON_ROUNDS = "rounds_exhausted"
REASON_REQUEST_FAILED = "request_failed"
REASON_MODEL_KEPT_ALL = "model_kept_all"

# 表格模型标出这些问题时结构不可信（多半是 OCR 并行、漏行、并列），先不翻，等看图（T2）以后裁决。
BLOCKING_ISSUES = frozenset({"ocr_html_missing", "no_text_layer", "columns_not_found", "row_swallows_rows"})

ChatFn = Callable[..., Any]


@dataclass
class TableContext:
    caption: str = ""
    footnotes: str = ""
    mentions: list[str] = field(default_factory=list)  # 正文里提到这张表的句子

    def render(self) -> str:
        parts = []
        if self.caption:
            parts.append(f"表题：{self.caption}")
        if self.footnotes:
            parts.append(f"表注：{self.footnotes}")
        for mention in self.mentions[:3]:
            parts.append(f"正文提到：{mention}")
        return "\n".join(parts)


@dataclass
class TableResult:
    block_id: str
    status: str
    reason: str = ""
    cells: dict[str, dict[str, Any]] = field(default_factory=dict)
    rounds: int = 0
    chunks: int = 0
    feedback_rounds: int = 0
    cache_key: str = ""

    def translations(self) -> dict[str, str]:
        return {cell_id: entry["translation"] for cell_id, entry in self.cells.items() if entry.get("translation")}

    def as_dict(self) -> dict[str, Any]:
        return {
            "block_id": self.block_id,
            "status": self.status,
            "reason": self.reason,
            "rounds": self.rounds,
            "chunks": self.chunks,
            "feedback_rounds": self.feedback_rounds,
            "cache_key": self.cache_key,
            "cells": self.cells,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "TableResult":
        return cls(
            block_id=str(value.get("block_id") or ""),
            status=str(value.get("status") or STATUS_KEPT),
            reason=str(value.get("reason") or ""),
            cells=dict(value.get("cells") or {}),
            rounds=int(value.get("rounds") or 0),
            chunks=int(value.get("chunks") or 0),
            feedback_rounds=int(value.get("feedback_rounds") or 0),
            cache_key=str(value.get("cache_key") or ""),
        )


def _coerce(value: Any) -> str:
    if isinstance(value, ChatResult):
        return value.content
    if isinstance(value, tuple) and value:
        return str(value[0] or "")
    return str(value or "")


def cache_key(model: dict, context: TableContext, *, engine: str) -> str:
    cells = [(cell.cell_id, cell.text, cell.role, cell.flag) for cell in table_cells(model)]
    payload = [PROMPT_VERSION, engine, cells, context.caption, context.footnotes, context.mentions[:3]]
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False).encode("utf-8")).hexdigest()


def translate_table(
    model: dict,
    *,
    chat_fn: ChatFn,
    memory: TableTermMemory,
    context: TableContext | None = None,
    max_rounds: int = MAX_ROUNDS,
) -> TableResult:
    """翻一张表。``chat_fn(messages, *, purpose, response_format)`` 返回模型回复（``ChatResult`` / 字符串）。

    模型请求失败（网络、Key 失效）的异常照样抛出去，由调用方决定停不停整个任务。
    """
    context = context or TableContext()
    block_id = str(model.get("block_id") or "")
    result = TableResult(block_id=block_id, status=STATUS_SKIPPED)
    blocking = sorted(BLOCKING_ISSUES.intersection(model.get("issues") or []))
    if blocking:
        result.reason = REASON_NO_TEXT_LAYER if "no_text_layer" in blocking else f"{REASON_MODEL_ISSUES}:{','.join(blocking)}"
        return result
    cells = table_cells(model)
    by_id = {cell.cell_id: cell for cell in cells}
    for cell in cells:
        if cell.text:
            result.cells[cell.cell_id] = {"source": cell.text, "translation": None, "decided_by": "rule"}
    if not any(cell.candidate for cell in cells):
        result.reason = REASON_NO_CANDIDATES
        return result
    decided: dict[str, str | None] = {}
    chunks = plan_chunks(cells)
    result.chunks = len(chunks)
    for chunk in chunks:
        outcome = _run_chunk(
            chunk,
            by_id=by_id,
            model=model,
            context=context,
            memory=memory,
            chat_fn=chat_fn,
            decided=decided,
            max_rounds=max_rounds,
            result=result,
        )
        if outcome is not None:
            result.status = STATUS_KEPT
            result.reason = outcome
            for entry in result.cells.values():
                entry["translation"] = None
            return result
    for cell_id, translation in decided.items():
        result.cells[cell_id]["translation"] = translation
        result.cells[cell_id]["decided_by"] = "model"
    if not any(decided.values()):
        result.status = STATUS_KEPT
        result.reason = REASON_MODEL_KEPT_ALL
        return result
    result.status = STATUS_TRANSLATED
    for cell_id, translation in decided.items():
        if translation:
            memory.add(by_id[cell_id].text, translation)
    return result


def _run_chunk(
    chunk: Chunk,
    *,
    by_id: dict[str, Cell],
    model: dict,
    context: TableContext,
    memory: TableTermMemory,
    chat_fn: ChatFn,
    decided: dict[str, str | None],
    max_rounds: int,
    result: TableResult,
) -> str | None:
    """跑一段；成功返回 None（译文写进 ``decided``），失败返回原因。"""
    pending = {cell.cell_id for cell in chunk.candidates if cell.cell_id not in decided}
    # 前面分段已经定过同一原文的，直接沿用（同表同译）
    by_source = {normalize_source(by_id[cell_id].text): value for cell_id, value in decided.items()}
    for cell_id in list(pending):
        source = normalize_source(by_id[cell_id].text)
        if source in by_source:
            decided[cell_id] = by_source[source]
            pending.discard(cell_id)
    if not pending:
        return None
    known_text = " ".join(cell.text for cell in chunk.candidates)
    known = memory.matching(plain(known_text))
    user = [render_chunk(chunk, n_rows=int(model.get("n_rows") or 0), n_cols=int(model.get("n_cols") or 0),
                         decided={k: v for k, v in decided.items() if v})]
    rendered_context = context.render()
    if rendered_context:
        user.insert(0, rendered_context)
    if known:
        user.append("已知译法：\n" + "\n".join(f"{term.source} → {term.target}" for term in known))
    messages: list[dict[str, str]] = [
        {"role": "system", "content": load_prompt(SYSTEM_PROMPT)},
        {"role": "user", "content": "\n\n".join(user)},
    ]
    accepted: dict[str, str | None] = {}
    for _ in range(max_rounds):
        result.rounds += 1
        reply = _coerce(chat_fn(messages, purpose="table_translate", response_format=RESPONSE_FORMAT))
        messages.append({"role": "assistant", "content": reply})
        action = _parse(reply)
        kind = str(action.get("action") or "") if action else ""
        if kind == "lookup_terms":
            terms = [str(term) for term in (action.get("terms") or []) if str(term).strip()][:MAX_LOOKUP_TERMS]
            found = memory.lookup(terms)
            lines = [f"{term} → {target}" if target else f"{term} → （这本书里还没有）" for term, target in found.items()]
            messages.append({"role": "user", "content": "查到的译法：\n" + ("\n".join(lines) or "（没有）")})
            continue
        if kind != "submit":
            messages.append({"role": "user", "content": "只回一个 JSON 对象，action 是 lookup_terms 或 submit。"})
            continue
        submitted = action.get("cells") if isinstance(action.get("cells"), dict) else {}
        errors: dict[str, str] = {}
        for cell_id, value in submitted.items():
            cell = by_id.get(str(cell_id))
            if cell is None:
                errors[str(cell_id)] = "没有这个格子"
                continue
            if cell.cell_id not in pending and cell.candidate:
                continue  # 已经收下的，忽略重复交
            if not cell.candidate and (value is None or str(value).strip().casefold() in ("", "keep")):
                continue
            translation, error = check_cell(cell, value)
            if error:
                errors[cell.cell_id] = error
            else:
                accepted[cell.cell_id] = translation
                pending.discard(cell.cell_id)
        merged = {**{k: v for k, v in decided.items()}, **accepted}
        for cell_id, error in check_consistency(by_id, merged).items():
            if cell_id in accepted:
                accepted.pop(cell_id)
                pending.add(cell_id)
                errors[cell_id] = error
        for source, target in (action.get("terms") or {}).items() if isinstance(action.get("terms"), dict) else []:
            memory.add(str(source), str(target))
        if not pending:
            decided.update(accepted)
            return None
        result.feedback_rounds += 1
        lines = [f"{cell_id}：{error}" for cell_id, error in sorted(errors.items())]
        missing = sorted(pending - set(errors))
        if missing:
            lines.append("还没给的格子：" + "、".join(missing))
        messages.append({"role": "user", "content": "这些格子要重交（其余已收下）：\n" + "\n".join(lines)})
    return REASON_ROUNDS


def _parse(reply: str) -> dict[str, Any] | None:
    try:
        value = json.loads(extract_json_text(reply))
    except (ValueError, TypeError):
        return None
    return value if isinstance(value, dict) else None


__all__ = [
    "BLOCKING_ISSUES",
    "MAX_ROUNDS",
    "PROMPT_VERSION",
    "STATUS_KEPT",
    "STATUS_SKIPPED",
    "STATUS_TRANSLATED",
    "TableContext",
    "TableResult",
    "cache_key",
    "translate_table",
]

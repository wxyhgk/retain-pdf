"""这一问的结构化出处（只用标准库，2026-11-26）：`session/prompt` 的 `_meta.retainpdf.selection`。

写法和后端 `POST /ai/ask-conversations/{id}/messages` 的 `selection` 一样（docs/api/16-AI/02-主对话和记忆.md）：
`{document_id, job_id, translation_version, pane, page, item_ids, selected_text, section, source_text, translated_text, prefix, suffix}`，
只有 `page` 必填。

- 读书的工具认的是旧写法 `_meta.retainpdf.anchor`（`page`、`item_id`、`selection`、`source_text`、`translated_text`）：
  有 `selection` 没有 `anchor` 时换一份 `anchor` 放进去（`with_anchor`），读书那边不用改。
- 前端知道自带 agent 认 `selection` 以后可以不在问题前面写那段可读的出处；这时代码把出处写成一段字放在问题前面（`selection_text`），
  模型照样看得到选中的字。问题里已经有前端那段（`TEXT_MARKERS`、`（RetainPDF 任务 …）`）就不再写。
"""
from __future__ import annotations

from typing import Any

# 前端那段可读出处里的字（frontend/packages/reader/src/ask/ask-context.ts 的 anchorPreamble）
PREAMBLE_MARKERS = ("我选中的这段：", "这一块的原文：", "这一块的译文：", "（RetainPDF 任务 ")
MAX_QUOTE_CHARS = 4_000


def selection_from_meta(meta: Any) -> dict[str, Any] | None:
    """`_meta.retainpdf.selection`；页码不对（没有、不是正整数）当没有。"""
    retainpdf = meta.get("retainpdf") if isinstance(meta, dict) else None
    selection = retainpdf.get("selection") if isinstance(retainpdf, dict) else None
    if not isinstance(selection, dict):
        return None
    page = selection.get("page")
    if not isinstance(page, int) or isinstance(page, bool) or page < 1:
        return None
    return selection


def _text(selection: dict[str, Any], key: str) -> str:
    value = selection.get(key)
    return value.strip() if isinstance(value, str) else ""


def _item_ids(selection: dict[str, Any]) -> list[str]:
    items = selection.get("item_ids")
    return [item for item in items if isinstance(item, str) and item.strip()] if isinstance(items, list) else []


def with_anchor(meta: Any) -> Any:
    """有 `selection` 没有 `anchor` 时补一份 `anchor`（读书的工具认它）；别的原样。"""
    selection = selection_from_meta(meta)
    if selection is None or isinstance(meta["retainpdf"].get("anchor"), dict):
        return meta
    items = _item_ids(selection)
    anchor = {
        "page": selection["page"],
        "item_id": items[0] if items else None,
        "selection": _text(selection, "selected_text"),
        "source_text": _text(selection, "source_text"),
        "translated_text": _text(selection, "translated_text"),
    }
    return {**meta, "retainpdf": {**meta["retainpdf"], "anchor": anchor}}


def has_preamble(texts: list[str]) -> bool:
    return any(marker in (text or "") for text in texts for marker in PREAMBLE_MARKERS)


def _clip(text: str) -> str:
    return text if len(text) <= MAX_QUOTE_CHARS else text[:MAX_QUOTE_CHARS] + "…"


def selection_text(selection: dict[str, Any]) -> str:
    """出处写成一段字（前端没写那段可读出处时放在问题前面）。"""
    pane = {"source": "原文", "translated": "译文"}.get(_text(selection, "pane"), "")
    section = _text(selection, "section")
    where = f"第 {selection['page']} 页" + (f"「{section}」" if section else "") + (f"（{pane}栏）" if pane else "")
    lines = [f"【这一问的出处（RetainPDF）】{where}"]
    for key, label in (("selected_text", "选中的字"), ("source_text", "这一块的原文"), ("translated_text", "这一块的译文")):
        value = _text(selection, key)
        if value:
            lines += ["", f"{label}：", _clip(value)]
    items = _item_ids(selection)
    if items:
        lines += ["", f"（块 {'、'.join(items[:10])}）"]
    return "\n".join(lines)


__all__ = ["has_preamble", "selection_from_meta", "selection_text", "with_anchor"]

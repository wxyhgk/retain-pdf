"""认上下文：规则拿不准的目录页，给模型看截图和规则草稿，模型用工具改角色和归属，改完就检查，最多 3 轮。

一页的结果（``PageOutcome.status``）：

| 状态 | 什么时候 | 对文档（``effect``） |
|---|---|---|
| ``rules`` | 没有信号，不问模型 | 不动 |
| ``not_asked`` | 有信号，但模型这一步没开（R3 实测前默认关） | 不动 |
| ``model`` | 模型改完过了检查 | 改了就按它重建这一页的条目（``rebuild``）；规则不认的块按它拆开；扫描件的页也重建（记下文字层看不见） |
| ``not_toc`` | 模型说这一页不是目录 | 规则认过的页整页保留原文（``keep_page``），规则不认的不动 |
| ``rules_fallback`` | 3 轮没过或模型放弃，规则草稿过得了检查 | 不动（就是规则草稿） |
| ``keep_original`` | 同上，规则草稿也不过 | 整页保留原文（``keep_page``） |
| ``unchanged`` | 同上，规则本来就不认这一块 | 不动（照旧整块交普通翻译） |
| ``request_failed`` | 请求失败（网络、Key……） | 不动；不缓存，下次再试 |
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

from retainpdf_toc_agent.context.checks import check_draft
from retainpdf_toc_agent.context.draft import TEXT_LAYER_INVISIBLE
from retainpdf_toc_agent.context.draft import PageDraft
from retainpdf_toc_agent.context.tools import apply_actions
from retainpdf_toc_agent.contract import ChatResult
from retainpdf_toc_agent.prompts import load_prompt

CONTEXT_PROMPT = "toc_context_system.txt"
CONTEXT_PROMPT_VERSION = "toc_context.v1"
CONTEXT_PURPOSE = "toc_context"
CONTEXT_RESPONSE_FORMAT = {"type": "json_object"}
MAX_CONTEXT_ROUNDS = 3

STATUS_RULES = "rules"
STATUS_NOT_ASKED = "not_asked"
STATUS_MODEL = "model"
STATUS_NOT_TOC = "not_toc"
STATUS_RULES_FALLBACK = "rules_fallback"
STATUS_KEEP_ORIGINAL = "keep_original"
STATUS_UNCHANGED = "unchanged"
STATUS_REQUEST_FAILED = "request_failed"

EFFECT_NONE = "none"
EFFECT_REBUILD = "rebuild"
EFFECT_KEEP_PAGE = "keep_page"

ChatFn = Callable[..., Any]


@dataclass
class PageOutcome:
    page_index: int
    status: str
    signals: list[str]
    draft: PageDraft  # 最后用的草稿（模型改过的，或者规则草稿）
    effect: str = EFFECT_NONE
    rounds: int = 0
    requests: int = 0
    usage: dict[str, int] = field(default_factory=dict)
    problems: list[dict] = field(default_factory=list)  # 最后一轮没过的检查
    action_errors: list[str] = field(default_factory=list)
    give_up: str = ""
    error: str = ""

    def to_record(self) -> dict:
        return {
            "page_index": self.page_index,
            "status": self.status,
            "effect": self.effect,
            "signals": list(self.signals),
            "rounds": self.rounds,
            "requests": self.requests,
            "usage": dict(self.usage),
            **({"problems": self.problems} if self.problems else {}),
            **({"action_errors": self.action_errors[:20]} if self.action_errors else {}),
            **({"give_up": self.give_up} if self.give_up else {}),
            **({"error": self.error} if self.error else {}),
            "draft": self.draft.to_dict(),
        }

    @classmethod
    def from_record(cls, record: dict) -> "PageOutcome":
        return cls(page_index=int(record.get("page_index") or 0), status=str(record.get("status") or ""),
                   signals=list(record.get("signals") or []), draft=PageDraft.from_dict(record.get("draft") or {}),
                   effect=str(record.get("effect") or EFFECT_NONE), rounds=int(record.get("rounds") or 0),
                   requests=int(record.get("requests") or 0), usage=dict(record.get("usage") or {}),
                   problems=list(record.get("problems") or []), action_errors=list(record.get("action_errors") or []),
                   give_up=str(record.get("give_up") or ""), error=str(record.get("error") or ""))


def page_view(draft: PageDraft, signals: list[str]) -> dict:
    """给模型看的草稿：每个视觉行的片段（字、x、字号、粗斜体、角色、归哪条）和条目。"""
    entry_of = draft.entry_of()
    lines: dict[int, list[dict]] = {}
    for fragment in draft.fragments:
        row = {"id": fragment.id, "t": fragment.text, "x": round(fragment.bbox[0], 1), "s": round(fragment.size, 1),
               "role": fragment.role}
        if fragment.bold:
            row["b"] = 1
        if fragment.italic:
            row["i"] = 1
        if fragment.id in entry_of:
            row["e"] = entry_of[fragment.id]
        lines.setdefault(fragment.line, []).append(row)
    entries = []
    for entry in draft.entries:
        row = {"id": entry.id, "level": entry.level, "title": draft.role_text(entry, "title")}
        page = draft.role_text(entry, "page")
        if page:
            row["page"] = page
        if entry.keep:
            row["keep"] = entry.keep
        if entry.continues_prev_page:
            row["continues_prev_page"] = True
        entries.append(row)
    return {
        "page": draft.page_index + 1,
        "rules": "accepted" if draft.accepted else f"rejected: {draft.reason or 'unknown'}",
        "text_layer": draft.text_layer,
        "signals": list(signals),
        "lines": [{"line": line, "frags": rows} for line, rows in sorted(lines.items())],
        "entries": entries,
    }


def _parse_actions(content: str) -> list | None:
    text = str(content or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        payload = json.loads(text[start : end + 1])
    except ValueError:
        return None
    actions = payload.get("actions") if isinstance(payload, dict) else None
    return actions if isinstance(actions, list) else None


def _add_usage(total: dict[str, int], usage: dict[str, Any] | None) -> None:
    for key, value in (usage or {}).items():
        if isinstance(value, int) and not isinstance(value, bool):
            total[key] = total.get(key, 0) + value


def _same_structure(a: PageDraft, b: PageDraft) -> bool:
    def shape(draft: PageDraft):
        return ([(f.id, f.role) for f in draft.fragments],
                [(tuple(e.fragments), e.level, e.keep, e.continues_prev_page) for e in draft.entries])

    return shape(a) == shape(b)


def _fallback(base: PageDraft, outcome: PageOutcome) -> PageOutcome:
    """模型没改成：规则认过且过得了检查就照规则草稿；规则草稿也不过就整页保留原文；规则本来不认的照旧不动。"""
    outcome.draft = base.copy()
    if not base.accepted:
        outcome.status, outcome.effect = STATUS_UNCHANGED, EFFECT_NONE
    elif not check_draft(base, base):
        outcome.status, outcome.effect = STATUS_RULES_FALLBACK, EFFECT_NONE
    else:
        outcome.status, outcome.effect = STATUS_KEEP_ORIGINAL, EFFECT_KEEP_PAGE
    return outcome


def resolve_page(
    draft: PageDraft,
    *,
    signals: list[str],
    chat_fn: ChatFn | None,
    image: dict | None = None,
    ask_model: bool = True,
) -> PageOutcome:
    """认一页。没有信号、或者模型这一步没开（``ask_model=False``、没有 ``chat_fn``）就照规则草稿，不发请求。

    ``image`` 是截图的消息片段（OpenAI Chat 写法 ``{"type": "image_url", …}``，接线包截的）；没有就只发文字。
    请求失败不抛：结果是 ``request_failed``，这一页照规则草稿。"""
    base = draft.copy()
    outcome = PageOutcome(page_index=draft.page_index, status=STATUS_RULES, signals=list(signals), draft=base.copy())
    if not signals:
        return outcome
    if not ask_model or chat_fn is None:
        outcome.status = STATUS_NOT_ASKED
        return outcome
    working = base.copy()
    view = json.dumps(page_view(working, signals), ensure_ascii=False)
    user: Any = [image, {"type": "text", "text": view}] if image else view
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": load_prompt(CONTEXT_PROMPT)},
        {"role": "user", "content": user},
    ]
    try:
        for round_index in range(1, MAX_CONTEXT_ROUNDS + 1):
            outcome.rounds += 1
            outcome.requests += 1
            reply = chat_fn(messages, purpose=CONTEXT_PURPOSE, response_format=CONTEXT_RESPONSE_FORMAT)
            content = reply.content if isinstance(reply, ChatResult) else str(reply or "")
            _add_usage(outcome.usage, reply.usage if isinstance(reply, ChatResult) else None)
            actions = _parse_actions(content)
            if actions is None:
                applied_errors = ["回的不是 {\"actions\": [...]} 这样的 JSON"]
                problems: list[dict] = []
                applied = None
            else:
                applied = apply_actions(working, actions)
                applied_errors = applied.errors
                if applied.not_toc:
                    outcome.status = STATUS_NOT_TOC
                    outcome.effect = EFFECT_KEEP_PAGE if base.accepted else EFFECT_NONE
                    outcome.draft = base.copy()
                    outcome.draft.not_toc = True
                    return outcome
                if applied.give_up:
                    outcome.give_up = applied.give_up
                    return _fallback(base, outcome)
                problems = check_draft(working, base)
            outcome.problems, outcome.action_errors = problems, list(applied_errors)
            last_round = round_index == MAX_CONTEXT_ROUNDS
            if applied is not None and not problems and (not applied_errors or last_round):
                outcome.status = STATUS_MODEL
                outcome.draft = working
                changed = not _same_structure(working, base)
                # 规则不认的块按模型的拆开；扫描件的页照样重建一遍，条目上记下文字层看不见（原位替换要在图上盖底色）
                rebuild = changed or not base.accepted or base.text_layer == TEXT_LAYER_INVISIBLE
                outcome.effect = EFFECT_REBUILD if rebuild else EFFECT_NONE
                return outcome
            if last_round:
                break
            retry = {
                "problems": [{"code": p["code"], "hint": p["hint"], "where": p["where"]} for p in problems],
                "action_errors": applied_errors,
                "now": page_view(working, signals),
            }
            messages = [
                *messages,
                {"role": "assistant", "content": content},
                {"role": "user", "content": "没过检查，接着改（在现在的草稿上改，只回 actions）：\n" + json.dumps(retry, ensure_ascii=False)},
            ]
    except Exception as error:  # noqa: BLE001 - 认上下文失败只是照规则走，不挡翻译
        outcome.status = STATUS_REQUEST_FAILED
        outcome.effect = EFFECT_NONE
        outcome.draft = base.copy()
        outcome.error = f"{type(error).__name__}: {error}"[:500]
        return outcome
    return _fallback(base, outcome)


__all__ = [
    "CONTEXT_PROMPT_VERSION",
    "CONTEXT_PURPOSE",
    "EFFECT_KEEP_PAGE",
    "EFFECT_NONE",
    "EFFECT_REBUILD",
    "MAX_CONTEXT_ROUNDS",
    "PageOutcome",
    "page_view",
    "resolve_page",
]

"""模型的工具：只改片段的角色和条目的归属，不能改字、不能改位置。

模型一轮回 ``{"actions": [{"tool": …, …}, …]}``，按顺序改草稿；认不出的、参数不对的那一步不做，原因记下来退回给模型。

| 工具 | 参数 | 做什么 |
|---|---|---|
| ``set_role`` | ``fragments``（或 ``fragment``）、``role`` | 改片段的角色；改成 header / other 的同时移出条目 |
| ``merge`` | ``entries``（两条以上） | 后面几条并进第一条 |
| ``split`` | ``entry``，``at``（片段）或 ``line``（行号） | 从这个片段 / 这一行起拆成新的一条 |
| ``attach`` | ``fragments`` 或 ``line``，``entry``（``"new"`` 新起一条） | 把这些字挂到某条上（从原来的条目里移走） |
| ``keep`` | ``entry``、``reason`` | 这条不翻（代码名、人名、作者……），原字不动 |
| ``set_level`` | ``entry``、``level``（1–6） | 改级别 |
| ``continue_from_prev_page`` | ``entry`` | 这条接上一页最后那条没完的标题 |
| ``not_toc`` | — | 这一页不是目录 |
| ``done`` / ``give_up`` | ``reason``（give_up） | 结束 |
"""
from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from typing import Any

from retainpdf_toc_agent.context.draft import FREE_ROLES
from retainpdf_toc_agent.context.draft import ROLES
from retainpdf_toc_agent.context.draft import DraftEntry
from retainpdf_toc_agent.context.draft import PageDraft

TOOLS = ("set_role", "merge", "split", "attach", "keep", "set_level", "continue_from_prev_page", "not_toc", "done", "give_up")
MAX_LEVEL = 6
MAX_ACTIONS_PER_ROUND = 200


@dataclass
class Applied:
    errors: list[str] = field(default_factory=list)  # 没做的那几步：「第 n 步 tool：原因」
    applied: int = 0
    done: bool = False
    give_up: str = ""
    not_toc: bool = False


def _ids(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item) for item in value if isinstance(item, (str, int))]
    return []


def _fragments_of(draft: PageDraft, action: dict) -> list[str]:
    ids = _ids(action.get("fragments")) + _ids(action.get("fragment"))
    if "line" in action:
        try:
            line = int(action["line"])
        except (TypeError, ValueError):
            line = -1
        ids += [fragment.id for fragment in draft.fragments if fragment.line == line]
    return list(dict.fromkeys(ids))


def _detach(draft: PageDraft, fragment_ids: set[str]) -> None:
    for entry in draft.entries:
        entry.fragments = [f for f in entry.fragments if f not in fragment_ids]


def _apply_one(draft: PageDraft, action: dict, result: Applied) -> str:
    """做一步；做不了返回原因。"""
    tool = str(action.get("tool") or "")
    by_id = draft.by_id()
    if tool == "set_role":
        role = str(action.get("role") or "")
        ids = _fragments_of(draft, action)
        if role not in ROLES:
            return f"没有 {role!r} 这个角色（只有 {', '.join(ROLES)}）"
        missing = [f for f in ids if f not in by_id]
        if not ids or missing:
            return f"片段不存在：{', '.join(missing) or '（没给）'}"
        for fragment_id in ids:
            by_id[fragment_id].role = role
        if role in FREE_ROLES:
            _detach(draft, set(ids))
        return ""
    if tool == "merge":
        ids = list(dict.fromkeys(_ids(action.get("entries"))))
        entries = [draft.entry(entry_id) for entry_id in ids]
        if len(ids) < 2 or any(entry is None for entry in entries):
            return f"要两条以上存在的条目：{ids}"
        first = entries[0]
        for other in entries[1:]:
            first.fragments += other.fragments
            other.fragments = []
        draft.tidy()
        return ""
    if tool == "split":
        entry = draft.entry(str(action.get("entry") or ""))
        if entry is None:
            return "条目不存在"
        at = str(action.get("at") or "")
        if at:
            if at not in entry.fragments:
                return f"{at} 不在 {entry.id} 里"
            cut = entry.fragments.index(at)
        else:
            try:
                line = int(action.get("line"))
            except (TypeError, ValueError):
                return "要给 at（片段）或 line（行号）"
            cut = next((index for index, f in enumerate(entry.fragments) if by_id[f].line >= line), len(entry.fragments))
        if cut <= 0 or cut >= len(entry.fragments):
            return "拆开的地方要在这条中间"
        new = DraftEntry(id=draft.next_entry_id(), fragments=entry.fragments[cut:], level=entry.level)
        entry.fragments = entry.fragments[:cut]
        draft.entries.append(new)
        draft.tidy()
        return ""
    if tool == "attach":
        ids = _fragments_of(draft, action)
        missing = [f for f in ids if f not in by_id]
        if not ids or missing:
            return f"片段不存在：{', '.join(missing) or '（没给）'}"
        target_id = str(action.get("entry") or "")
        _detach(draft, set(ids))
        if target_id == "new":
            draft.entries.append(DraftEntry(id=draft.next_entry_id(), fragments=list(ids), level=int(action.get("level") or 1)))
        else:
            target = draft.entry(target_id)
            if target is None:
                return f"条目不存在：{target_id!r}"
            target.fragments += ids
        for fragment_id in ids:
            if by_id[fragment_id].role in FREE_ROLES:
                by_id[fragment_id].role = "title"  # 挂进条目的落单字默认当标题；不对再 set_role
        draft.tidy()
        return ""
    if tool == "keep":
        entry = draft.entry(str(action.get("entry") or ""))
        if entry is None:
            return "条目不存在"
        entry.keep = str(action.get("reason") or "keep")[:40]
        return ""
    if tool == "set_level":
        entry = draft.entry(str(action.get("entry") or ""))
        try:
            level = int(action.get("level"))
        except (TypeError, ValueError):
            level = 0
        if entry is None or not 1 <= level <= MAX_LEVEL:
            return f"要存在的条目和 1–{MAX_LEVEL} 的级别"
        entry.level = level
        return ""
    if tool == "continue_from_prev_page":
        entry = draft.entry(str(action.get("entry") or ""))
        if entry is None:
            return "条目不存在"
        entry.continues_prev_page = True
        return ""
    if tool == "not_toc":
        result.not_toc = True
        return ""
    if tool == "done":
        result.done = True
        return ""
    if tool == "give_up":
        result.give_up = str(action.get("reason") or "give_up")[:200]
        return ""
    return f"没有这个工具（只有 {', '.join(TOOLS)}）"


def apply_actions(draft: PageDraft, actions: Any) -> Applied:
    """按顺序改 ``draft``（原地改），返回做了几步、哪几步没做。"""
    result = Applied()
    if not isinstance(actions, list):
        result.errors.append("actions 要是列表")
        return result
    for index, action in enumerate(actions[:MAX_ACTIONS_PER_ROUND], start=1):
        if not isinstance(action, dict):
            result.errors.append(f"第 {index} 步：要是对象")
            continue
        error = _apply_one(draft, action, result)
        if error:
            result.errors.append(f"第 {index} 步 {action.get('tool')}：{error}")
        else:
            result.applied += 1
        if result.not_toc or result.give_up:
            break
    draft.tidy()
    return result


__all__ = ["MAX_LEVEL", "TOOLS", "Applied", "apply_actions"]

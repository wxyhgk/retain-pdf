"""把 transcript 收成喂给 agent 的 history messages。"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .compress import is_summary_message, split_transcript


def estimate_tokens(text: str) -> int:
    """中英混合廉价估算：约 chars/2.5。"""
    n = len(text or "")
    return max(1, int(n / 2.5)) if n else 0


def _clip_content(role: str, content: str, *, user_max: int = 2000, assistant_max: int = 3000) -> str:
    text = str(content or "")
    limit = user_max if role == "user" else assistant_max
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}…"


@dataclass
class AssembleResult:
    history: list[dict[str, str]]
    debug: dict[str, Any] = field(default_factory=dict)


def assemble_history(
    messages: list[dict[str, Any]],
    *,
    window_turns: int = 6,
    max_chars: int = 24000,
) -> AssembleResult:
    """
    输入完整/已压缩 transcript，输出 agent.ask(history=...) 用的 user/assistant 列表。

    - 若有 summary：注入「摘要背景」伪轮次
    - 窗口：summary 之后最近 window_turns 轮
    - 单条过长 clip；整体超 max_chars 时从窗口头部继续丢
    """
    window_turns = max(1, int(window_turns))
    last_summary, turns = split_transcript(messages)

    keep_n = window_turns * 2
    window = turns[-keep_n:] if len(turns) > keep_n else list(turns)

    history: list[dict[str, str]] = []
    if last_summary and str(last_summary.get("content") or "").strip():
        summary_body = str(last_summary.get("content") or "").strip()
        history.append(
            {
                "role": "user",
                "content": f"以下是更早对话的摘要，请当作已知背景：\n{summary_body}",
            }
        )
        history.append(
            {
                "role": "assistant",
                "content": "好的，我将基于摘要与新问题继续。",
            }
        )

    for message in window:
        role = str(message.get("role") or "")
        if role not in {"user", "assistant"}:
            continue
        if is_summary_message(message):
            continue
        content = _clip_content(role, str(message.get("content") or ""))
        if not content.strip():
            continue
        history.append({"role": role, "content": content})

    # 总长护栏：从窗口头（摘要伪轮之后）开始丢
    def total_chars(items: list[dict[str, str]]) -> int:
        return sum(len(m.get("content") or "") for m in items)

    prefix_len = 2 if last_summary else 0
    while len(history) > prefix_len + 2 and total_chars(history) > max_chars:
        # 丢掉最早的一对 turn（尽量成对）
        del history[prefix_len]
        if len(history) > prefix_len and history[prefix_len]["role"] == "assistant":
            del history[prefix_len]

    prompt_est = estimate_tokens("\n".join(m["content"] for m in history))
    return AssembleResult(
        history=history,
        debug={
            "window_turns": window_turns,
            "had_summary": bool(last_summary),
            "history_messages": len(history),
            "prompt_tokens_est": prompt_est,
            "total_chars": total_chars(history),
        },
    )

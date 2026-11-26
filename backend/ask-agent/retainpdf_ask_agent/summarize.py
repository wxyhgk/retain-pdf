"""`python -m retainpdf_ask_agent summarize`：一次性把一段对话压成摘要（2026-11-26 第二期）。

两种用途（`kind`）：
- `compaction`：主对话太长，把「上一份摘要 + 之后的这些消息」压成一份新摘要，替代 `seq <= covers_to_seq` 的消息；
- `side`：副对话结束，把副对话的来回压成一张回到主对话的结论卡片。

后端（书库包 `ask_compactions.rs`）起这个子命令，模型配置和密钥和问答一样经环境变量给（`RETAIN_ASK_MODEL` 等），
stdin 一个 JSON：`{"kind", "previous_summary", "messages": [{"seq", "role", "text", "document_title", "page"}], "max_chars"}`，
stdout 一行 JSON：`{"summary", "usage"}`；出错 stdout 写 `{"error": 原因}`、退出码 1。

只用标准库（核心包的规矩）；模型调用由调用方给（`stream_fn`，和 `server.py` 同一个接口）。
"""
from __future__ import annotations

import threading
from importlib import resources
from typing import Any, Callable, Iterable

KINDS = ("compaction", "side")
DEFAULT_MAX_CHARS = 2000
MAX_MAX_CHARS = 8000
# 交给模型的对话最多多少字：超了从前面截掉（后端本来就按阈值触发，正常不会超）
MAX_INPUT_CHARS = 120_000

StreamFn = Callable[..., Iterable[tuple[str, Any]]]


class SummarizeError(ValueError):
    """输入不对、模型什么都没回。"""


def _prompt(name: str) -> str:
    return resources.files("retainpdf_ask_agent.prompts").joinpath(name).read_text(encoding="utf-8").strip()


def _where(message: dict[str, Any]) -> str:
    title = str(message.get("document_title") or "").strip()
    page = message.get("page")
    if title and page:
        return f"（《{title}》第 {page} 页）"
    if title:
        return f"（《{title}》）"
    if page:
        return f"（第 {page} 页）"
    return ""


def transcript(previous_summary: str | None, messages: list[dict[str, Any]]) -> str:
    """交给模型的那段文字：上一份摘要（有的话）+ 逐条消息，每条标出处。超了 `MAX_INPUT_CHARS` 从最早的消息截。"""
    speaker = {"user": "用户", "assistant": "AI", "side_summary": "（副对话的结论）"}
    lines = [f"{speaker.get(str(m.get('role')), str(m.get('role')))}{_where(m)}：{str(m.get('text') or '').strip()}" for m in messages]
    head = f"【之前的摘要】\n{previous_summary.strip()}\n\n【之后的对话】" if previous_summary and previous_summary.strip() else "【对话】"
    body = "\n\n".join(line for line in lines if line.strip())
    if len(body) > MAX_INPUT_CHARS:
        body = "……（更早的部分略）\n\n" + body[-MAX_INPUT_CHARS:]
    return f"{head}\n{body}"


def summarize(request: dict[str, Any], stream_fn: StreamFn) -> dict[str, Any]:
    """按请求压一段对话，返回 `{"summary", "usage"}`。"""
    kind = str(request.get("kind") or "")
    if kind not in KINDS:
        raise SummarizeError(f"kind must be one of {', '.join(KINDS)}")
    messages = request.get("messages")
    if not isinstance(messages, list) or not messages:
        raise SummarizeError("messages must be a non-empty list")
    max_chars = request.get("max_chars") or DEFAULT_MAX_CHARS
    if not isinstance(max_chars, int) or not (100 <= max_chars <= MAX_MAX_CHARS):
        raise SummarizeError(f"max_chars must be between 100 and {MAX_MAX_CHARS}")
    previous = request.get("previous_summary")
    system = _prompt("summarize_compaction.txt" if kind == "compaction" else "summarize_side.txt").replace("{max_chars}", str(max_chars))
    chat = [
        {"role": "system", "content": system},
        {"role": "user", "content": [{"type": "text", "text": transcript(previous if isinstance(previous, str) else None, messages)}]},
    ]
    text: list[str] = []
    usage: dict[str, Any] = {}
    for kind_, value in stream_fn(chat, threading.Event()):
        if kind_ == "text":
            text.append(str(value))
        elif kind_ == "usage" and isinstance(value, dict):
            usage.update(value)
    summary = "".join(text).strip()
    if not summary:
        raise SummarizeError("the model returned an empty summary")
    # 模型偶尔超长：按字数截，不让一份摘要无限长
    if len(summary) > max_chars * 2:
        summary = summary[: max_chars * 2].rstrip() + "……"
    return {"summary": summary, "usage": usage}


__all__ = ["KINDS", "SummarizeError", "summarize", "transcript"]

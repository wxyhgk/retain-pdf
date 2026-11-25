"""表格 agent 和调用方之间的交接格式（只加不改）。

``chat_fn(messages, *, purpose, response_format)`` 由调用方给：真实调用在接线包
``retainpdf_table_agent_engine.llm.table_chat_fn``，测试里注入假的。它返回 ``ChatResult``（或直接返回字符串）。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ChatResult:
    """一次模型回复：正文和这一次的用量（拿不到就是 None）。"""

    content: str
    usage: dict[str, Any] | None = None


__all__ = ["ChatResult"]

"""目录 agent 和调用方之间的交接格式（只加不改）。

``chat_fn(messages, *, purpose, response_format)`` 由调用方给：真实调用在接线包
``retainpdf_toc_agent_engine.llm.toc_chat_fn``，测试里注入假的。它返回 ``ChatResult``（或直接返回字符串）。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ChatResult:
    """一次模型回复：正文和这一次的用量（拿不到就是 None）。"""

    content: str
    usage: dict[str, Any] | None = None


@dataclass(frozen=True)
class TocEntry:
    """目录页上的一条（归一化时按文字层拆出来的条目块，见流水线 ``ocr/document_schema/toc_pages.py``）。"""

    id: str
    title: str
    number: str = ""  # 章号「1」「2.3」，没有就是空
    level: int = 1


@dataclass(frozen=True)
class Heading:
    """正文里的一个标题块。"""

    id: str
    text: str


@dataclass(frozen=True)
class GlossaryTerm:
    source: str
    target: str


__all__ = ["ChatResult", "GlossaryTerm", "Heading", "TocEntry"]

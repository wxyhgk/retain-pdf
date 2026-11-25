"""表格 agent 和调用方之间的交接格式（只加不改）。

``chat_fn(messages, *, purpose, response_format)`` 由调用方给：真实调用在接线包
``retainpdf_table_agent_engine.llm.table_chat_fn``，测试里注入假的。它返回 ``ChatResult``（或直接返回字符串）。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class ChatResult:
    """一次模型回复：正文和这一次的用量（拿不到就是 None）。"""

    content: str
    usage: dict[str, Any] | None = None


@dataclass(frozen=True)
class StructureSource:
    """定结构（G4）要调用方给的：表格框里的文字层、结构初稿、按结构重建表格、原表截图。

    - ``lines``：文字层从上到下的每一行文字（下标就是 L 编号）；
    - ``draft``：结构初稿（格式见流水线 ``ocr/tables/structure.py``：每格的起始行列和跨度、每行表格占哪几行文字……）；
    - ``rebuild(draft) -> table.v1``：按改过的结构重新从文字层取格子原文、重算 issues（多带 ``suspect_rows``）；
    - ``screenshot() -> 消息片段``：原表截图，核心不看内容，原样放进发给模型的 user 消息（调用方定写法，
      例如 OpenAI Chat 的 ``image_url`` 片段）；拿不到返回 None。只在真要修的时候才调。
    """

    lines: list[str]
    draft: dict[str, Any]
    rebuild: Callable[[dict[str, Any]], dict[str, Any]]
    screenshot: Callable[[], Any]


__all__ = ["ChatResult", "StructureSource"]

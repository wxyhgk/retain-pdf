"""Conservative host-owned routing for ``assistant_mode=auto``."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

ResolvedAssistantMode = Literal["reading", "operations"]
ContentSource = Literal["structured", "markdown", "none", "unscoped", "unknown"]

_OPERATION_ID_RE = re.compile(r"\bop-[a-z0-9-]{8,}\b", re.IGNORECASE)
_OPERATION_ACTION_RE = re.compile(
    r"(?:"
    r"(?:旋转|删除|重排|重新排序|裁剪|提取).{0,20}"
    r"(?:第?\s*[一二三四五六七八九十百\d]+\s*页|最后一页|首页|封面页|页面|PDF|文档)|"
    r"(?:第?\s*[一二三四五六七八九十百\d]+\s*页|最后一页|首页|封面页|页面|PDF|文档).{0,20}"
    r"(?:旋转|删除|重排|重新排序|裁剪|提取)|"
    r"(?:拆分|合并|加密|解密|加水印|移除水印).{0,20}(?:PDF|文档|页面)|"
    r"(?:PDF|文档|页面).{0,20}(?:拆分|合并|加密|解密|加水印|移除水印)|"
    r"(?:rotate|delete|reorder|crop|extract).{0,30}(?:page|pages|pdf|document)|"
    r"(?:page|pages|pdf|document).{0,30}(?:rotate|delete|reorder|crop|extract)|"
    r"(?:split|merge|encrypt|decrypt|watermark).{0,30}(?:pdf|document|pages)"
    r")",
    re.IGNORECASE,
)
_EXISTING_OPERATION_ACTION_RE = re.compile(
    r"(?:确认)?(?:运行|执行|提交|取消|重试).{0,24}(?:操作|候选|op-)|"
    r"(?:run|commit|cancel|retry).{0,24}(?:operation|candidate|op-)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class RouteDecision:
    requested_mode: str
    resolved_mode: ResolvedAssistantMode
    reason: str


def resolve_assistant_mode(requested_mode: str, question: str) -> RouteDecision:
    """Honor explicit modes and let ambiguous auto requests fail safe to reading."""
    requested = requested_mode.strip().lower() or "auto"
    if requested in {"reading", "operations"}:
        return RouteDecision(requested, requested, "explicit")  # type: ignore[arg-type]
    normalized = " ".join(question.strip().split())
    if _OPERATION_ACTION_RE.search(normalized):
        return RouteDecision("auto", "operations", "document_mutation_intent")
    if _OPERATION_ID_RE.search(normalized) and _EXISTING_OPERATION_ACTION_RE.search(
        normalized
    ):
        return RouteDecision("auto", "operations", "operation_control_intent")
    return RouteDecision("auto", "reading", "safe_reading_default")

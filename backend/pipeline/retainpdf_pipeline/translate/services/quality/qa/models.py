"""确定性 QA 的公共数据结构：严重度、违规记录、证据片段。

QA 只出报告、不改译文，所以这里的结构全是「读出来的事实 + 判定」，不带任何回写入口。
"""
from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from typing import Any


TRANSLATION_QA_FILE_NAME = "translation_qa.v1.json"
TRANSLATION_QA_SCHEMA = "translation_qa.v1"
TRANSLATION_QA_SCHEMA_VERSION = 1

SEVERITY_CRITICAL = "critical"
SEVERITY_MAJOR = "major"
SEVERITY_MINOR = "minor"
SEVERITY_ORDER: tuple[str, ...] = (SEVERITY_CRITICAL, SEVERITY_MAJOR, SEVERITY_MINOR)

# 严重度定义照抄任务书附录（依据 CY/T 123—2015 等），写进报告元数据，
# 前端和审校的人看报告就知道每一档的口径。
SEVERITY_DEFINITIONS: dict[str, str] = {
    SEVERITY_CRITICAL: "改变数值、结论或逻辑方向；漏了整句或整段；公式或数值被改",
    SEVERITY_MAJOR: "违反锁定术语；意思偏差；指代错误；引用编号错误",
    SEVERITY_MINOR: "欧化句式、冗余、标点、空格、体例问题",
}

EXCERPT_WIDTH = 48


@dataclass
class QaViolation:
    check: str
    type: str
    severity: str
    message: str
    item_ids: list[str]
    page_number: int
    block_idx: int
    unit_id: str = ""
    scope: str = "unit"
    evidence: dict[str, Any] = field(default_factory=dict)

    def sort_key(self) -> tuple:
        return (
            self.page_number if self.page_number > 0 else 1 << 30,
            self.block_idx,
            SEVERITY_ORDER.index(self.severity) if self.severity in SEVERITY_ORDER else 9,
            self.check,
            self.type,
        )

    def as_dict(self, violation_id: str, review_kinds: list[str]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": violation_id,
            "check": self.check,
            "type": self.type,
            "severity": self.severity,
            "scope": self.scope,
            "message": self.message,
            "location": {
                "item_id": self.item_ids[0] if self.item_ids else "",
                "item_ids": list(self.item_ids),
                "unit_id": self.unit_id,
                "page_number": self.page_number,
                "block_idx": self.block_idx,
            },
            "evidence": self.evidence,
        }
        if review_kinds:
            payload["translation_review_kinds"] = review_kinds
        return payload


def excerpt(text: str, needle: str | None = None, *, start: int | None = None, width: int = EXCERPT_WIDTH) -> str:
    """取 needle（或 start 位置）附近的一段原文/译文作为证据，避免把整段塞进报告。"""
    value = " ".join(str(text or "").split())
    if not value:
        return ""
    position = -1
    if start is not None:
        position = max(0, min(len(value), start))
    elif needle:
        position = value.find(" ".join(str(needle).split()))
        if position < 0:
            position = value.casefold().find(" ".join(str(needle).split()).casefold())
    if position < 0:
        return value if len(value) <= width * 2 else value[: width * 2].rstrip() + "…"
    left = max(0, position - width)
    right = min(len(value), position + len(needle or "") + width)
    snippet = value[left:right]
    if left > 0:
        snippet = "…" + snippet
    if right < len(value):
        snippet = snippet + "…"
    return snippet


__all__ = [
    "EXCERPT_WIDTH",
    "QaViolation",
    "SEVERITY_CRITICAL",
    "SEVERITY_DEFINITIONS",
    "SEVERITY_MAJOR",
    "SEVERITY_MINOR",
    "SEVERITY_ORDER",
    "TRANSLATION_QA_FILE_NAME",
    "TRANSLATION_QA_SCHEMA",
    "TRANSLATION_QA_SCHEMA_VERSION",
    "excerpt",
]

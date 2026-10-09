"""主编：看问题清单、不看全文，逐块决定交给修订怎么处理。

模型只能在规则框里选：``allowed_actions`` 由问题类型和之前的尝试算出来，模型选了框外的动作、
没回某块、或整批请求失败，一律用 ``default_action``，并在台账里记下来源（model / rule）。

规则框：
- patch（局部改）最多 ``MAX_PATCH_ATTEMPTS`` 次；上一次局部改因为碰到公式 / 片段找不到或不唯一
  / 写回校验失败而被拒，就不再给局部改——同样的路还会撞同样的墙。
- rewrite（整块重写）最多 ``MAX_REWRITE_ATTEMPTS`` 次。
- 严重的漏译和数字问题（critical 的 omission / number_unit）不许 keep：要么修，要么交给人。
- 只有一个动作可选时不问模型。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from dataclasses import field
from typing import Any

from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem
from retainpdf_pipeline.translate.services.refine import edits as edit_ops
from retainpdf_pipeline.translate.services.refine import fix as fix_rules
from retainpdf_pipeline.translate.services.refine.review import Finding
from retainpdf_pipeline.translate.services.refine.review import parse_json_object

CHIEF_SYSTEM_PROMPT = "editorial_chief_system.txt"
CHIEF_PROMPT_VERSION = "editorial_chief.v1"
CHIEF_BATCH_SIZE = 25
CHIEF_RESPONSE_FORMAT = {"type": "json_object"}

ACTION_PATCH = "patch"
ACTION_REWRITE = "rewrite"
ACTION_KEEP = "keep"
ACTION_ESCALATE = "escalate"
ACTIONS = (ACTION_PATCH, ACTION_REWRITE, ACTION_KEEP, ACTION_ESCALATE)

MAX_PATCH_ATTEMPTS = 2
MAX_REWRITE_ATTEMPTS = 1
MAX_ROUNDS = 2

SOURCE_MODEL = "model"
SOURCE_RULE = "rule"

# 局部改撞上这些墙，再局部改也没用。
PATCH_DEAD_ENDS = frozenset(
    {
        edit_ops.REJECT_CROSSES_PROTECTED,
        edit_ops.REJECT_FIND_NOT_FOUND,
        edit_ops.REJECT_FIND_NOT_UNIQUE,
        edit_ops.REJECT_INTRODUCES_PLACEHOLDER,
        fix_rules.REJECT_VALIDATION,
    }
)
SEVERE_CATEGORIES = ("omission", "number_unit")
NOTE_MAX_CHARS = 120
REASON_MAX_CHARS = 300


@dataclass
class Attempts:
    """一块在本次运行里被修过几次、结果如何。"""

    patch: int = 0
    rewrite: int = 0
    patch_dead_end: bool = False
    history: list[str] = field(default_factory=list)

    def record(self, action: str, status: str, reason: str = "") -> None:
        if action == ACTION_PATCH:
            self.patch += 1
            if status == fix_rules.FIX_REJECTED and reason in PATCH_DEAD_ENDS:
                self.patch_dead_end = True
        elif action == ACTION_REWRITE:
            self.rewrite += 1
        self.history.append(f"{action}:{status}" + (f"/{reason}" if reason else ""))


def is_severe(findings: list[Finding]) -> bool:
    return any(finding.severity == "critical" and finding.category in SEVERE_CATEGORIES for finding in findings)


def allowed_actions(findings: list[Finding], attempts: Attempts) -> tuple[list[str], str]:
    """（允许的动作, 默认动作）。"""
    severe = is_severe(findings)
    allowed: list[str] = []
    can_patch = attempts.patch < MAX_PATCH_ATTEMPTS and not attempts.patch_dead_end
    can_rewrite = attempts.rewrite < MAX_REWRITE_ATTEMPTS
    if can_patch:
        allowed.append(ACTION_PATCH)
    if can_rewrite:
        allowed.append(ACTION_REWRITE)
    if not severe:
        allowed.append(ACTION_KEEP)
    allowed.append(ACTION_ESCALATE)
    if severe and can_rewrite:
        default = ACTION_REWRITE
    elif can_patch:
        default = ACTION_PATCH
    elif can_rewrite:
        default = ACTION_REWRITE
    else:
        default = ACTION_ESCALATE
    return allowed, default


def _has_formula(item: QaItem) -> bool:
    text = item.protected_source
    return "$" in text or "<f" in text or "[[FORMULA" in text or "@@P" in text


def chief_item_payload(
    item: QaItem,
    findings: list[Finding],
    attempts: Attempts,
    *,
    allowed: list[str],
    default: str,
) -> dict[str, Any]:
    return {
        "item_id": item.item_id,
        "page": item.page_number,
        "issues": [
            {
                key: value
                for key, value in (
                    ("issue_id", finding.finding_id),
                    ("category", finding.category),
                    ("severity", finding.severity),
                    ("origin", finding.origin),
                    ("explanation", finding.explanation),
                    ("target_span", finding.target_span),
                    ("source_span", finding.source_span),
                )
                if value
            }
            for finding in findings
        ],
        "source_chars": len(item.protected_source),
        "translation_chars": len(item.protected_translated),
        "has_formula": _has_formula(item),
        "attempts": list(attempts.history),
        "allowed_actions": allowed,
        "default_action": default,
    }


def build_chief_messages(batch: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": load_prompt(CHIEF_SYSTEM_PROMPT)},
        {"role": "user", "content": json.dumps({"items": batch}, ensure_ascii=False)},
    ]


def parse_chief_response(content: str) -> dict[str, dict[str, str]]:
    payload = parse_json_object(content)
    rows = payload.get("decisions") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("chief response has no decisions list")
    decisions: dict[str, dict[str, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        item_id = str(row.get("item_id", "") or "").strip()
        if not item_id or item_id in decisions:
            continue
        decisions[item_id] = {
            "action": str(row.get("action", "") or "").strip().lower(),
            "reason": str(row.get("reason", "") or "").strip()[:REASON_MAX_CHARS],
            "note": str(row.get("note", "") or "").strip()[:NOTE_MAX_CHARS],
        }
    return decisions


@dataclass(frozen=True)
class Decision:
    item_id: str
    action: str
    source: str
    reason: str
    note: str
    overridden: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "action": self.action,
            "source": self.source,
            "reason": self.reason,
            "note": self.note,
            "overridden": self.overridden,
        }


def settle_decision(
    item_id: str,
    proposed: dict[str, str] | None,
    *,
    allowed: list[str],
    default: str,
    fallback_reason: str,
) -> Decision:
    """把模型的提议落在规则框里。"""
    if proposed is None:
        return Decision(item_id, default, SOURCE_RULE, fallback_reason, "")
    action = proposed.get("action", "")
    if action not in allowed:
        return Decision(
            item_id,
            default,
            SOURCE_RULE,
            f"主编选了不允许的动作「{action or '空'}」，按规则默认处理",
            proposed.get("note", ""),
            overridden=True,
        )
    return Decision(item_id, action, SOURCE_MODEL, proposed.get("reason", ""), proposed.get("note", ""))


__all__ = [
    "ACTIONS",
    "ACTION_ESCALATE",
    "ACTION_KEEP",
    "ACTION_PATCH",
    "ACTION_REWRITE",
    "Attempts",
    "CHIEF_BATCH_SIZE",
    "CHIEF_PROMPT_VERSION",
    "CHIEF_RESPONSE_FORMAT",
    "Decision",
    "MAX_PATCH_ATTEMPTS",
    "MAX_REWRITE_ATTEMPTS",
    "MAX_ROUNDS",
    "SOURCE_MODEL",
    "SOURCE_RULE",
    "allowed_actions",
    "build_chief_messages",
    "chief_item_payload",
    "is_severe",
    "parse_chief_response",
    "settle_decision",
]

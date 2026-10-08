"""定点修改（fix）：只修 critical / major；模型给编辑操作，接不接受由确定性检查决定。

这里只放纯函数：请求组装、响应解析、长度预算、QA 违规比对。写回与 QA 重算由
workflow/refine.py 编排（它能用 revision 的预演 / 写回入口）。
"""
from __future__ import annotations

import json
import math
from collections import Counter
from typing import Any

from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.refine.review import Finding
from retainpdf_pipeline.translate.services.refine.review import parse_json_object
from retainpdf_pipeline.translate.services.quality.qa.fit import CHECK_LAYOUT_FIT
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem


FIX_SYSTEM_PROMPT = "refine_fix_system.txt"
FIX_PROMPT_VERSION = "refine_fix.v1"
FIX_BATCH_SIZE = 8
FIX_RESPONSE_FORMAT = {"type": "json_object"}
LENGTH_BUDGET_RATIO = 1.10
MAX_FIX_ROUNDS = 1
# 补漏译 / 补译残留英文时允许在 110% 之外再长出来的量：按挑错给出的原文片段字符数
# （没有片段时按整块原文）封顶。英译中的译文字符数一般只有原文的一半左右，
# 所以这是宽松但有界的上限。
GROWTH_CATEGORIES = ("omission", "untranslated")

FIX_APPLIED = "applied"
FIX_REJECTED = "rejected"
FIX_SKIPPED = "skipped"

REJECT_UNCHANGED = "unchanged"
REJECT_LENGTH_BUDGET = "length_budget_exceeded"
REJECT_FIT_NO_GROWTH = "fit_no_growth"
REJECT_VALIDATION = "validation_failed"
REJECT_QA_REGRESSION = "qa_new_violation"
REJECT_REVISION_CONFLICT = "revision_conflict"
REJECT_SAME_AS_SOURCE = "same_as_source"
SKIP_NO_EDIT = "model_returned_no_edit"
SKIP_NOT_TRANSLATABLE = "item_not_translatable"
SKIP_BUDGET = "budget_exhausted"
SKIP_LLM_ERROR = "llm_error"
SKIP_LLM_UNAVAILABLE = "llm_unavailable"
SKIP_REVISION_UNCHANGED = "revision_unchanged"

# 布局 fit 的违规由渲染结果决定，修改前后用的是同一份旧 fit 报告，不参与比对。
QA_COMPARE_IGNORED_CHECKS = frozenset({CHECK_LAYOUT_FIT})


def length_budget(
    item: QaItem,
    findings: list[Finding],
    *,
    no_growth: bool,
) -> int:
    base = len(item.protected_translated)
    if no_growth:
        return base
    growth = [finding for finding in findings if finding.category in GROWTH_CATEGORIES]
    allowance = 0
    if growth:
        # 挑错给了原文片段就按片段长度放宽；只有 QA 的漏译疑点（没有片段）时按整块原文。
        # 无论如何不超过整块原文的长度。
        spans = [len(finding.source_span) for finding in growth if finding.source_span]
        source_len = len(item.protected_source)
        allowance = min(sum(spans), source_len) if spans else source_len
    return int(math.floor(base * LENGTH_BUDGET_RATIO)) + allowance


def fix_item_payload(
    item: QaItem,
    findings: list[Finding],
    *,
    terms: list[dict[str, str]],
    max_chars: int,
    may_grow: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "item_id": item.item_id,
        "source": item.protected_source,
        "translation": item.protected_translated,
        "issues": [
            {
                key: value
                for key, value in (
                    ("category", finding.category),
                    ("severity", finding.severity),
                    ("target_span", finding.target_span),
                    ("source_span", finding.source_span),
                    ("explanation", finding.explanation),
                    ("suggestion", finding.suggestion),
                )
                if value
            }
            for finding in findings
        ],
        "max_chars": max_chars,
        "may_grow": may_grow,
    }
    if terms:
        payload["locked_terms"] = terms
    return payload


def build_fix_messages(batch: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": load_prompt(FIX_SYSTEM_PROMPT)},
        {"role": "user", "content": json.dumps({"items": batch}, ensure_ascii=False)},
    ]


def parse_fix_response(content: str) -> dict[str, dict[str, Any]]:
    payload = parse_json_object(content)
    fixes = payload.get("fixes") if isinstance(payload, dict) else payload
    if not isinstance(fixes, list):
        raise ValueError("fix response has no fixes list")
    parsed: dict[str, dict[str, Any]] = {}
    for entry in fixes:
        if not isinstance(entry, dict):
            continue
        item_id = str(entry.get("item_id", "") or "").strip()
        if not item_id or item_id in parsed:
            continue
        edits = entry.get("edits")
        parsed[item_id] = {
            "edits": edits if isinstance(edits, list) else [],
            "note": " ".join(str(entry.get("note", "") or "").split())[:300],
        }
    return parsed


def violation_keys(qa_payload: dict[str, Any], item_ids: set[str]) -> Counter:
    keys: Counter = Counter()
    for violation in qa_payload.get("violations") or []:
        if violation.get("check") in QA_COMPARE_IGNORED_CHECKS:
            continue
        location = violation.get("location") or {}
        touched = set(location.get("item_ids") or [location.get("item_id")]) & item_ids
        for item_id in sorted(touched):
            keys[(item_id, violation.get("check", ""), violation.get("type", ""), violation.get("severity", ""))] += 1
    return keys


def new_violations(before: Counter, after: Counter) -> list[dict[str, Any]]:
    introduced = []
    for key, count in sorted(after.items()):
        extra = count - before.get(key, 0)
        if extra > 0:
            item_id, check, violation_type, severity = key
            introduced.append(
                {"item_id": item_id, "check": check, "type": violation_type, "severity": severity, "count": extra}
            )
    return introduced


def revision_reason(findings: list[Finding], note: str) -> str:
    categories = sorted({finding.category for finding in findings})
    explanations = "；".join(finding.explanation for finding in findings if finding.explanation)
    reason = f"refine[{','.join(categories)}] {explanations}".strip()
    if note:
        reason = f"{reason}（{note}）"
    return reason[:1900]


__all__ = [
    "FIX_APPLIED",
    "FIX_BATCH_SIZE",
    "FIX_PROMPT_VERSION",
    "FIX_REJECTED",
    "FIX_RESPONSE_FORMAT",
    "FIX_SKIPPED",
    "LENGTH_BUDGET_RATIO",
    "MAX_FIX_ROUNDS",
    "REJECT_FIT_NO_GROWTH",
    "REJECT_LENGTH_BUDGET",
    "REJECT_QA_REGRESSION",
    "REJECT_REVISION_CONFLICT",
    "REJECT_SAME_AS_SOURCE",
    "REJECT_UNCHANGED",
    "REJECT_VALIDATION",
    "SKIP_BUDGET",
    "SKIP_LLM_ERROR",
    "SKIP_LLM_UNAVAILABLE",
    "SKIP_NOT_TRANSLATABLE",
    "SKIP_NO_EDIT",
    "SKIP_REVISION_UNCHANGED",
    "build_fix_messages",
    "fix_item_payload",
    "length_budget",
    "new_violations",
    "parse_fix_response",
    "revision_reason",
    "violation_keys",
]

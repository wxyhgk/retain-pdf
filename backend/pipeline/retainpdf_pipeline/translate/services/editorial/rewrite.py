"""修订的整块重写：局部改解决不了时，让模型重写整块，然后走和局部改同一套验收。

验收（写回预演里的占位符 / 公式校验、质检不新增问题、长度预算）在
``workflow/editorial.py`` 里调用精修的同一个入口，这里只放请求组装、解析和长度预算。
"""
from __future__ import annotations

import json
import math
from typing import Any

from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem
from retainpdf_pipeline.translate.services.refine import fix as fix_rules
from retainpdf_pipeline.translate.services.refine.review import Finding
from retainpdf_pipeline.translate.services.refine.review import parse_json_object

REWRITE_SYSTEM_PROMPT = "editorial_rewrite_system.txt"
REWRITE_PROMPT_VERSION = "editorial_rewrite.v1"
REWRITE_BATCH_SIZE = 4
REWRITE_RESPONSE_FORMAT = {"type": "json_object"}
CONTEXT_CHARS = 160
NOTE_MAX_CHARS = 200


def rewrite_length_budget(item: QaItem, findings: list[Finding], *, no_growth: bool) -> int:
    """整块重写的长度上限。

    排版已经放不下的块不许变长。其余：在局部改的预算（现译 110%，补漏译时再加原文片段长度）
    基础上，至少放到「原文字符数」——整句漏译时缺的就是一整句，英译中的译文通常只有原文
    一半长，按原文封顶已经很宽松。
    """
    base = len(item.protected_translated)
    if no_growth:
        return base
    source_len = len(item.protected_source)
    budget = int(math.floor(base * fix_rules.LENGTH_BUDGET_RATIO)) + source_len // 4
    if any(finding.category in fix_rules.GROWTH_CATEGORIES for finding in findings):
        budget = max(budget, source_len)
    return max(budget, fix_rules.length_budget(item, findings, no_growth=False))


def rewrite_item_payload(
    item: QaItem,
    findings: list[Finding],
    *,
    note: str,
    terms: list[dict[str, str]],
    max_chars: int,
    context_before: str,
    context_after: str,
) -> dict[str, Any]:
    return {
        "item_id": item.item_id,
        "source": item.protected_source,
        "translation": item.protected_translated,
        "issues": [
            {
                key: value
                for key, value in (
                    ("category", finding.category),
                    ("severity", finding.severity),
                    ("explanation", finding.explanation),
                    ("target_span", finding.target_span),
                    ("source_span", finding.source_span),
                    ("suggestion", finding.suggestion),
                )
                if value
            }
            for finding in findings
        ],
        "note": note,
        "locked_terms": terms,
        "context_before": context_before[-CONTEXT_CHARS:],
        "context_after": context_after[:CONTEXT_CHARS],
        "max_chars": max_chars,
    }


def build_rewrite_messages(batch: list[dict[str, Any]], *, style_notes: str = "") -> list[dict[str, str]]:
    system = load_prompt(REWRITE_SYSTEM_PROMPT)
    if style_notes:
        system = f"{system}\n\n本书风格要点：\n{style_notes}"
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps({"items": batch}, ensure_ascii=False)},
    ]


def parse_rewrite_response(content: str) -> dict[str, dict[str, str]]:
    payload = parse_json_object(content)
    rows = payload.get("rewrites") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("rewrite response has no rewrites list")
    parsed: dict[str, dict[str, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        item_id = str(row.get("item_id", "") or "").strip()
        translation = str(row.get("translation", "") or "")
        if not item_id or item_id in parsed or not translation.strip():
            continue
        parsed[item_id] = {"translation": translation, "note": str(row.get("note", "") or "").strip()[:NOTE_MAX_CHARS]}
    return parsed


__all__ = [
    "REWRITE_BATCH_SIZE",
    "REWRITE_PROMPT_VERSION",
    "REWRITE_RESPONSE_FORMAT",
    "build_rewrite_messages",
    "parse_rewrite_response",
    "rewrite_item_payload",
    "rewrite_length_budget",
]

"""术语改动申请：审校和术语表冲突时，由术语专员（模型）看证据裁决。

- keep：维持术语表，审校这条意见不改（与第一期的规则裁决相同）；
- change：改术语表；长词条按一致化跟着改（``harmonize_term_base``），全书用旧译法的块按规则统一；
- escalate：交给人。

只有预扫抽出来的术语可以改；用户术语表里的条目是用户定的，一律维持，不发申请。
"""
from __future__ import annotations

import json
from datetime import datetime
from datetime import timezone
from typing import Any

from retainpdf_pipeline.translate.core.terms import matched_glossary_entries
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries
from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.preparation.term_prescan import is_acceptable_term_target
from retainpdf_pipeline.translate.services.preparation.term_review import harmonize_term_base
from retainpdf_pipeline.translate.services.refine.review import Finding
from retainpdf_pipeline.translate.services.refine.review import parse_json_object

TERM_REQUEST_SYSTEM_PROMPT = "editorial_term_request_system.txt"
TERM_REQUEST_PROMPT_VERSION = "editorial_term_request.v1"
TERM_REQUEST_BATCH_SIZE = 10
TERM_REQUEST_RESPONSE_FORMAT = {"type": "json_object"}

RULING_KEEP = "keep_term_base"
RULING_CHANGE = "change_term_base"
RULING_ESCALATE = "escalate"
DECISION_TO_RULING = {"keep": RULING_KEEP, "change": RULING_CHANGE, "escalate": RULING_ESCALATE}

MAX_SUGGESTIONS = 5
MAX_EXAMPLES = 3
EXCERPT_CHARS = 160
REASON_MAX_CHARS = 200


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def term_record(payload: dict[str, Any] | None, source: str) -> dict[str, Any] | None:
    key = str(source).casefold()
    for term in (payload or {}).get("terms", []):
        if isinstance(term, dict) and str(term.get("source", "")).casefold() == key:
            return term
    return None


def changeable(term: dict[str, Any] | None) -> bool:
    return term is not None and term.get("origin") == "extracted"


def _excerpt(text: str, needle: str) -> str:
    position = text.find(needle) if needle else -1
    if position < 0:
        return text[:EXCERPT_CHARS]
    start = max(0, position - EXCERPT_CHARS // 2)
    return text[start : start + EXCERPT_CHARS]


def build_requests(
    disputes: list[dict[str, Any]],
    findings_by_id: dict[str, Finding],
    items_by_id: dict[str, Any],
    term_base: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """把争议按术语分组成申请；不可改的术语（用户术语表、术语表里找不到）不发申请。"""
    grouped: dict[str, dict[str, Any]] = {}
    for dispute in disputes:
        term = term_record(term_base, dispute["term_source"])
        if not changeable(term):
            continue
        request = grouped.setdefault(
            term["source"].casefold(),
            {
                "term_source": term["source"],
                "current_target": term["target"],
                "alternatives": sorted(
                    {
                        str(row.get("target", ""))
                        for row in term.get("conflict_candidates") or []
                        if isinstance(row, dict) and row.get("target") and row.get("target") != term["target"]
                    }
                    | ({str(term["prescan_target"])} if term.get("prescan_target") else set())
                ),
                "suggestions": [],
                "examples": [],
                "finding_ids": [],
                "item_ids": [],
            },
        )
        finding = findings_by_id.get(dispute["finding_id"])
        request["finding_ids"].append(dispute["finding_id"])
        if dispute["item_id"] not in request["item_ids"]:
            request["item_ids"].append(dispute["item_id"])
        if finding is not None and len(request["suggestions"]) < MAX_SUGGESTIONS:
            suggestion = {"suggestion": finding.suggestion, "reason": finding.explanation[:REASON_MAX_CHARS]}
            if suggestion not in request["suggestions"]:
                request["suggestions"].append(suggestion)
        item = items_by_id.get(dispute["item_id"])
        if item is not None and len(request["examples"]) < MAX_EXAMPLES:
            request["examples"].append(
                {
                    "item_id": item.item_id,
                    "source": _excerpt(item.protected_source, term["source"]),
                    "translation": _excerpt(item.protected_translated, term["target"]),
                }
            )
    return list(grouped.values())


def request_payload(request: dict[str, Any]) -> dict[str, Any]:
    return {key: request[key] for key in ("term_source", "current_target", "alternatives", "suggestions", "examples")}


def build_term_request_messages(batch: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": load_prompt(TERM_REQUEST_SYSTEM_PROMPT)},
        {"role": "user", "content": json.dumps({"requests": [request_payload(r) for r in batch]}, ensure_ascii=False)},
    ]


def parse_term_request_response(content: str) -> dict[str, dict[str, str]]:
    payload = parse_json_object(content)
    rows = payload.get("decisions") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("term request response has no decisions list")
    decisions: dict[str, dict[str, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        source = str(row.get("term_source", "") or "").strip()
        if not source:
            continue
        decisions[source.casefold()] = {
            "decision": str(row.get("decision", "") or "").strip().lower(),
            "target": str(row.get("target", "") or "").strip(),
            "reason": str(row.get("reason", "") or "").strip()[:REASON_MAX_CHARS],
        }
    return decisions


def settle(request: dict[str, Any], proposed: dict[str, str] | None, *, target_lang: str) -> tuple[str, str, str]:
    """（裁决, 新译法, 理由）。模型没回、回了不认识的裁决、或改法不合格：交给人。"""
    if proposed is None:
        return RULING_ESCALATE, "", "术语专员没有给出裁决"
    ruling = DECISION_TO_RULING.get(proposed["decision"])
    if ruling is None:
        return RULING_ESCALATE, "", f"术语专员给了不认识的裁决「{proposed['decision']}」"
    if ruling != RULING_CHANGE:
        return ruling, "", proposed["reason"]
    target = proposed["target"]
    if (
        not target
        or target == request["current_target"]
        or not is_acceptable_term_target(request["term_source"], target, target_lang=target_lang)
    ):
        return RULING_ESCALATE, "", f"术语专员要改但给的译法不合格「{target}」"
    return RULING_CHANGE, target, proposed["reason"]


def apply_change(
    term_base: dict[str, Any],
    source: str,
    target: str,
    *,
    reason: str,
    run_id: str,
) -> list[dict[str, str]]:
    """改术语表（原地），返回全部译法变动（这一条 + 一致化带动的长词条）：[{source, from, to}]。"""
    term = term_record(term_base, source)
    if term is None:
        return []
    old = term["target"]
    term.setdefault("revisions", []).append(
        {"from": old, "to": target, "by": "terminologist", "reason": reason, "run_id": run_id, "at": _now()}
    )
    term["target"] = target
    # 旧译法降为落选候选：一致化会把含有它的长词条一起改掉。
    candidates = [row for row in term.get("conflict_candidates") or [] if isinstance(row, dict) and row.get("target") != target]
    if not any(row.get("target") == old for row in candidates):
        candidates.append({"target": old, "votes": 0})
    term["conflict_candidates"] = candidates
    changes = [{"source": term["source"], "from": old, "to": target}]
    for change in harmonize_term_base(term_base):
        changes.append({"source": change["source"], "from": change["from"], "to": change["to"]})
    return changes


def rule_rewrite(protected_source: str, translation: str, change: dict[str, str]) -> str | None:
    """块的原文里有这个术语、译文里用的是旧译法：把旧译法换成新译法。不需要改时返回 None。"""
    old, new = change["from"], change["to"]
    if not old or len(old) < 2 or old not in translation or old == new:
        return None
    entries = normalize_glossary_entries(
        [{"source": change["source"], "target": new, "level": "preferred", "match_mode": "case_insensitive"}]
    )
    if not matched_glossary_entries(entries, protected_source):
        return None
    rewritten = translation.replace(old, new) if old not in new else _replace_outside(translation, old, new)
    return rewritten if rewritten != translation else None


def _replace_outside(text: str, old: str, new: str) -> str:
    """新译法包含旧译法（谐振子 → 简谐振子）时，已经是新译法的地方不能再套一层。"""
    out: list[str] = []
    index = 0
    while index < len(text):
        if text.startswith(new, index):
            out.append(new)
            index += len(new)
        elif text.startswith(old, index):
            out.append(new)
            index += len(old)
        else:
            out.append(text[index])
            index += 1
    return "".join(out)


__all__ = [
    "RULING_CHANGE",
    "RULING_ESCALATE",
    "RULING_KEEP",
    "TERM_REQUEST_BATCH_SIZE",
    "TERM_REQUEST_PROMPT_VERSION",
    "TERM_REQUEST_RESPONSE_FORMAT",
    "apply_change",
    "build_requests",
    "build_term_request_messages",
    "changeable",
    "parse_term_request_response",
    "rule_rewrite",
    "settle",
    "term_record",
]

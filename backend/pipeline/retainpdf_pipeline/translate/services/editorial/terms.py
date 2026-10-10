"""术语改动申请：审校和术语表冲突时，由术语专员（模型）看证据裁决。

- keep：维持术语表，审校这条意见不改（与第一期的规则裁决相同）；
- change：改术语表；长词条按一致化跟着改（``harmonize_term_base``），全书用旧译法的块按规则统一；
- escalate：交给人。

只有预扫抽出来的术语可以改；用户术语表里的条目是用户定的，一律维持，不发申请。
"""
from __future__ import annotations

import json
import re
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


# ---- 术语巡检：同一个英文词有的地方保留、有的地方译掉了 -------------------------

TERM_PATROL_SYSTEM_PROMPT = "editorial_term_patrol_system.txt"
TERM_PATROL_PROMPT_VERSION = "editorial_term_patrol.v1"
TERM_PATROL_BATCH_SIZE = 15
PATROL_TRANSLATE = "translate"
PATROL_KEEP_ORIGINAL = "keep_original"
PATROL_LEAVE = "leave"
PATROL_DECISIONS = (PATROL_TRANSLATE, PATROL_KEEP_ORIGINAL, PATROL_LEAVE)
INCONSISTENT_RENDERING = "term_inconsistent_rendering"


def build_patrol_requests(qa_payload: dict[str, Any] | None, items_by_id: dict[str, Any]) -> list[dict[str, Any]]:
    """质检里「全书处理不一致」的词，按词分组成巡检条目（附两种处理各几处的片段）。"""
    grouped: dict[str, dict[str, Any]] = {}
    for violation in (qa_payload or {}).get("violations") or []:
        if not isinstance(violation, dict) or violation.get("type") != INCONSISTENT_RENDERING:
            continue
        evidence = violation.get("evidence") or {}
        source = str(evidence.get("term_source", "") or "").strip()
        if not source or source.casefold() in grouped:
            continue

        def examples(ids):
            rows = []
            for item_id in list(ids or [])[:MAX_EXAMPLES]:
                item = items_by_id.get(str(item_id))
                if item is not None:
                    rows.append({"source": _excerpt(item.protected_source, source), "translation": _excerpt(item.protected_translated, source)})
            return rows

        grouped[source.casefold()] = {
            "term_source": source,
            "kept_in_english": int(evidence.get("kept_in_english", 0) or 0),
            "translated": int(evidence.get("translated", 0) or 0),
            "kept_examples": examples(evidence.get("kept_item_ids")),
            "translated_examples": examples(evidence.get("translated_item_ids")),
        }
    return list(grouped.values())


def build_term_patrol_messages(batch: list[dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": load_prompt(TERM_PATROL_SYSTEM_PROMPT)},
        {"role": "user", "content": json.dumps({"terms": batch}, ensure_ascii=False)},
    ]


def settle_patrol(request: dict[str, Any], proposed: dict[str, str] | None, *, target_lang: str) -> tuple[str, str, str]:
    """（决定, 中文译名, 理由）。没回、不认识、或译名不合格：不统一（leave）。"""
    if proposed is None:
        return PATROL_LEAVE, "", "术语专员没有给出决定"
    decision = proposed["decision"]
    if decision not in PATROL_DECISIONS:
        return PATROL_LEAVE, "", f"术语专员给了不认识的决定「{decision}」"
    if decision != PATROL_TRANSLATE:
        return decision, "", proposed["reason"]
    target = proposed["target"]
    if not target or not is_acceptable_term_target(request["term_source"], target, target_lang=target_lang):
        return PATROL_LEAVE, "", f"术语专员给的译名不合格「{target}」"
    return PATROL_TRANSLATE, target, proposed["reason"]


def add_term(term_base: dict[str, Any], source: str, target: str, *, treatment: str, reason: str, run_id: str) -> bool:
    """把巡检定下的词加进术语表。已经在表里的不动（以表为准），返回是否加了。"""
    if term_record(term_base, source) is not None:
        return False
    keep = treatment == "keep_original"
    term_base.setdefault("terms", []).append(
        {
            "source": source,
            "target": source if keep else target,
            "frequency": 0,
            "first_occurrence": None,
            "conflict_candidates": [],
            "origin": "extracted",
            "votes": 0,
            "kind": "domain_term",
            "level": "preserve" if keep else "preferred",
            "category": "technical",
            "treatment": treatment,
            "annotate": False,
            "review_status": "patrol",
            "revisions": [{"from": "", "to": source if keep else target, "by": "terminologist", "reason": reason, "run_id": run_id, "at": _now()}],
        }
    )
    return True


def english_rewrite(translation: str, chunk: str, target: str) -> str | None:
    """把译文里保留下来的英文词换成中文译名。括注里的（「位力定理（virial theorem）」）和公式里的不动。"""
    pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(chunk)}(?![A-Za-z0-9])", re.IGNORECASE)
    out: list[str] = []
    last = 0
    for match in pattern.finditer(translation):
        before = translation[: match.start()].rstrip()
        in_math = translation.count("$", 0, match.start()) % 2 == 1
        if in_math or before.endswith(("（", "(")):
            continue
        out.append(translation[last : match.start()])
        out.append(target)
        last = match.end()
    if not out:
        return None
    out.append(translation[last:])
    rewritten = "".join(out)
    # 英文两侧原本的空格在中文里不需要：「用 Hermite 多项式」→「用埃尔米特多项式」。
    rewritten = re.sub(rf"(?<=[\u4e00-\u9fff]) ({re.escape(target)})", r"\1", rewritten)
    rewritten = re.sub(rf"({re.escape(target)}) (?=[\u4e00-\u9fff])", r"\1", rewritten)
    return rewritten if rewritten != translation else None


__all__ = [
    "RULING_CHANGE",
    "RULING_ESCALATE",
    "RULING_KEEP",
    "PATROL_KEEP_ORIGINAL",
    "PATROL_LEAVE",
    "PATROL_TRANSLATE",
    "TERM_PATROL_BATCH_SIZE",
    "TERM_PATROL_PROMPT_VERSION",
    "TERM_REQUEST_BATCH_SIZE",
    "TERM_REQUEST_PROMPT_VERSION",
    "TERM_REQUEST_RESPONSE_FORMAT",
    "add_term",
    "apply_change",
    "build_patrol_requests",
    "build_term_patrol_messages",
    "english_rewrite",
    "build_requests",
    "build_term_request_messages",
    "changeable",
    "parse_term_request_response",
    "rule_rewrite",
    "settle",
    "settle_patrol",
    "term_record",
]

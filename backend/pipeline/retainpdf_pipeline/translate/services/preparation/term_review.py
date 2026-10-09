"""术语专员：预扫之后审定术语表（preparation=editorial）。

预扫抽出的候选不分青红皂白全部锁定、全部要求首现括注，结果把参考文献里的人名音译、把期刊名
译成书名号、对「波函数」这类基础词也要求括注。审定给每条候选定类别，由类别决定怎么用：

==============  ===============  ===============================================
category        treatment        翻译 / 修订 / 质检怎么用
==============  ===============  ===============================================
technical       lock             锁定译法、注入翻译；annotate=true 的才要求首现括注
publication     keep_original    以 preserve 注入（保留原文），不括注
person          free             不注入、不检查，由译者按上下文处理
organization    free             同上
common          drop             不进术语表的任何用途
==============  ===============  ===============================================

用户术语表的条目不审，照旧锁定。模型没回某条、或整批请求失败：该条保持预扫时的行为
（锁定、要括注），在 ``review.unreviewed_count`` 里如实记下。

审定之后再做一次不调模型的一致化（``harmonize_term_base``），记在 ``review.harmonized``：

1. 只差单复数或连字符的同一个词（Cartesian coordinate / Cartesian coordinates）统一成一个译法，
   按全部变体上的票数取多的；
2. 长词条的原文里含有短词条（quantum-mechanical virial theorem ⊃ virial theorem）时，长词条的
   译法里也要用短词条的译法：长词条译法里出现短词条落选的译法（维里定理），换成锁定的那个
   （位力定理）。不然翻译、审校和质检会拿着两套互相打架的锁定译法。
"""
from __future__ import annotations

import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from retainpdf_pipeline.translate.llm.shared.executor_context import unit_scope
from retainpdf_pipeline.translate.llm.shared.provider_runtime import request_chat_content
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_json_text
from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.preparation.segments import PrescanSegment
from retainpdf_pipeline.translate.services.preparation.term_prescan import is_acceptable_term_target
from retainpdf_pipeline.translate.services.preparation.term_prescan import request_sha256

TERM_REVIEW_PROMPT = "term_review_system.txt"
TERM_REVIEW_PROMPT_VERSION = "term-review-v1"
TERM_REVIEW_BATCH_SIZE = 40
TERM_REVIEW_MAX_WORKERS = 8
TERM_REVIEW_TIMEOUT_SECS = 120
CONTEXT_CHARS = 120

CATEGORY_TECHNICAL = "technical"
CATEGORY_PERSON = "person"
CATEGORY_ORGANIZATION = "organization"
CATEGORY_PUBLICATION = "publication"
CATEGORY_COMMON = "common"
CATEGORIES = (CATEGORY_TECHNICAL, CATEGORY_PERSON, CATEGORY_ORGANIZATION, CATEGORY_PUBLICATION, CATEGORY_COMMON)

TREATMENT_LOCK = "lock"
TREATMENT_KEEP_ORIGINAL = "keep_original"
TREATMENT_FREE = "free"
TREATMENT_DROP = "drop"
CATEGORY_TREATMENT = {
    CATEGORY_TECHNICAL: TREATMENT_LOCK,
    CATEGORY_PUBLICATION: TREATMENT_KEEP_ORIGINAL,
    CATEGORY_PERSON: TREATMENT_FREE,
    CATEGORY_ORGANIZATION: TREATMENT_FREE,
    CATEGORY_COMMON: TREATMENT_DROP,
}
# 翻译、修订、质检要用到的处理方式：锁定译法，或锁定为保留原文。
INJECTED_TREATMENTS = frozenset({TREATMENT_LOCK, TREATMENT_KEEP_ORIGINAL})

TERM_REVIEW_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "term_review_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "terms": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "source": {"type": "string"},
                            "category": {"type": "string", "enum": list(CATEGORIES)},
                            "target": {"type": "string"},
                            "annotate": {"type": "boolean"},
                        },
                        "required": ["source", "category", "target", "annotate"],
                    },
                },
            },
            "required": ["terms"],
        },
    },
}

RequestFn = Callable[..., str]


def term_treatment(term: dict[str, Any]) -> str:
    """一条术语的处理方式。没审过（旧术语表、审定失败）的条目按锁定处理，与以前一致。"""
    treatment = str(term.get("treatment", "") or "")
    return treatment if treatment in CATEGORY_TREATMENT.values() else TREATMENT_LOCK


def term_annotate(term: dict[str, Any]) -> bool:
    """首现要不要括注。没审过的条目沿用以前的行为（要）。"""
    value = term.get("annotate")
    return True if value is None else bool(value)


def _context(term: dict[str, Any], segments_by_id: dict[str, PrescanSegment]) -> str:
    first = term.get("first_occurrence") or {}
    segment = segments_by_id.get(str(first.get("item_id", "") or ""))
    if segment is None:
        return ""
    text = segment.text
    position = text.casefold().find(str(term.get("source", "")).casefold())
    if position < 0:
        return text[: CONTEXT_CHARS * 2]
    start = max(0, position - CONTEXT_CHARS)
    end = min(len(text), position + len(str(term.get("source", ""))) + CONTEXT_CHARS)
    return ("…" if start else "") + text[start:end] + ("…" if end < len(text) else "")


def build_term_review_messages(
    candidates: list[dict[str, Any]],
    *,
    segments_by_id: dict[str, PrescanSegment],
    domain: str,
    target_language_name: str,
) -> list[dict[str, str]]:
    payload = {
        "domain": domain,
        "target_language": target_language_name,
        "terms": [
            {
                "source": term["source"],
                "target": term.get("target", ""),
                "kind": term.get("kind", ""),
                "frequency": term.get("frequency", 0),
                "context": _context(term, segments_by_id),
            }
            for term in candidates
        ],
    }
    return [
        {"role": "system", "content": load_prompt(TERM_REVIEW_PROMPT)},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


def parse_term_review_response(content: str) -> dict[str, dict[str, Any]]:
    """{source.casefold(): {category, target, annotate}}；不认识的类别丢弃。"""
    payload = json.loads(extract_json_text(content))
    rows = payload.get("terms") if isinstance(payload, dict) else None
    decisions: dict[str, dict[str, Any]] = {}
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        source = str(row.get("source", "") or "").strip()
        category = str(row.get("category", "") or "").strip().lower()
        if not source or category not in CATEGORIES:
            continue
        decisions[source.casefold()] = {
            "category": category,
            "target": str(row.get("target", "") or "").strip(),
            "annotate": bool(row.get("annotate")) and category == CATEGORY_TECHNICAL,
        }
    return decisions


def _apply_decision(term: dict[str, Any], decision: dict[str, Any], *, target_lang: str) -> None:
    category = decision["category"]
    term["category"] = category
    term["treatment"] = CATEGORY_TREATMENT[category]
    term["annotate"] = decision["annotate"]
    term["review_status"] = "reviewed"
    if category == CATEGORY_PUBLICATION:
        term["prescan_target"] = term.get("target", "")
        term["target"] = term["source"]
        term["level"] = "preserve"
        return
    proposed = decision["target"]
    if (
        category == CATEGORY_TECHNICAL
        and proposed
        and proposed != term.get("target")
        and is_acceptable_term_target(str(term["source"]), proposed, target_lang=target_lang)
    ):
        term["prescan_target"] = term.get("target", "")
        term["target"] = proposed


def _term_words(source: str) -> tuple[str, ...]:
    words = re.sub(r"[-‐–]", " ", str(source).casefold()).split()
    if words and len(words[-1]) > 3 and words[-1].endswith("s") and not words[-1].endswith("ss"):
        words[-1] = words[-1][:-1]
    return tuple(words)


def _contains_words(longer: tuple[str, ...], shorter: tuple[str, ...]) -> bool:
    if len(shorter) >= len(longer):
        return False
    return any(longer[i : i + len(shorter)] == shorter for i in range(len(longer) - len(shorter) + 1))


def _alternatives(term: dict[str, Any]) -> list[str]:
    """一条术语落选的译法：预扫的冲突候选、审定前的预扫译法。"""
    options = [str(row.get("target", "")) for row in term.get("conflict_candidates") or [] if isinstance(row, dict)]
    if term.get("prescan_target"):
        options.append(str(term["prescan_target"]))
    return [option for option in options if option and option != term.get("target")]


def harmonize_term_base(payload: dict[str, Any]) -> list[dict[str, str]]:
    """让锁定的术语之间不互相打架（见模块说明）。返回改动记录，原地改 payload。"""
    locked = [
        term
        for term in payload.get("terms", [])
        if isinstance(term, dict) and term.get("origin") == "extracted" and term_treatment(term) == TREATMENT_LOCK
    ]
    changes: list[dict[str, str]] = []

    def change(term: dict[str, Any], target: str, reason: str) -> None:
        changes.append({"source": term["source"], "from": term["target"], "to": target, "reason": reason})
        term.setdefault("harmonized_from", term["target"])
        term["target"] = target

    # 1. 单复数 / 连字符变体。
    groups: dict[tuple[str, ...], list[dict[str, Any]]] = {}
    for term in locked:
        groups.setdefault(_term_words(term["source"]), []).append(term)
    for variants in groups.values():
        if len(variants) < 2:
            continue
        votes: dict[str, int] = {}
        for term in variants:
            votes[term["target"]] = votes.get(term["target"], 0) + max(1, int(term.get("votes", 0) or 0))
            for row in term.get("conflict_candidates") or []:
                if isinstance(row, dict) and row.get("target"):
                    votes[row["target"]] = votes.get(row["target"], 0) + max(1, int(row.get("votes", 0) or 0))
        winner = sorted(votes.items(), key=lambda pair: (-pair[1], pair[0]))[0][0]
        for term in variants:
            if term["target"] != winner:
                change(term, winner, "variant")

    # 2. 长词条沿用短词条的译法。
    by_length = sorted(locked, key=lambda term: len(_term_words(term["source"])))
    for longer in by_length:
        long_words = _term_words(longer["source"])
        for shorter in by_length:
            short_words = _term_words(shorter["source"])
            if not _contains_words(long_words, short_words) or shorter["target"] in longer["target"]:
                continue
            for alternative in _alternatives(shorter):
                if alternative in longer["target"]:
                    change(longer, longer["target"].replace(alternative, shorter["target"]), f"compound:{shorter['source']}")
                    break
    return changes


def review_term_base(
    payload: dict[str, Any],
    *,
    segments: list[PrescanSegment],
    api_key: str,
    model: str,
    base_url: str,
    workers: int,
    domain: str,
    target_lang: str,
    target_language_name: str,
    request_fn: RequestFn | None = None,
) -> dict[str, Any]:
    """原地审定 ``payload["terms"]`` 里抽取出来的条目，写入 ``payload["review"]``，返回 payload。"""
    request = request_fn or request_chat_content
    segments_by_id = {segment.segment_id: segment for segment in segments}
    candidates = [term for term in payload.get("terms", []) if isinstance(term, dict) and term.get("origin") == "extracted"]
    batches = [
        candidates[start : start + TERM_REVIEW_BATCH_SIZE]
        for start in range(0, len(candidates), TERM_REVIEW_BATCH_SIZE)
    ]
    lock = threading.Lock()
    failed: list[int] = []

    def run_one(indexed: tuple[int, list[dict[str, Any]]]) -> None:
        index, batch = indexed
        messages = build_term_review_messages(
            batch, segments_by_id=segments_by_id, domain=domain, target_language_name=target_language_name
        )
        try:
            with unit_scope("term_review", [request_sha256(messages, model=model)]):
                content = request(
                    messages,
                    api_key=api_key,
                    model=model,
                    base_url=base_url,
                    temperature=0.0,
                    response_format=TERM_REVIEW_RESPONSE_FORMAT,
                    timeout=TERM_REVIEW_TIMEOUT_SECS,
                    request_label=f"term-review batch {index + 1}/{len(batches)}",
                    max_attempts=2,
                )
            decisions = parse_term_review_response(content)
        except Exception as exc:  # noqa: BLE001 - 一批失败只让这一批保持预扫时的行为
            print(f"term-review: batch {index + 1} failed: {type(exc).__name__}: {exc}", flush=True)
            with lock:
                failed.append(index + 1)
            return
        with lock:
            for term in batch:
                decision = decisions.get(str(term["source"]).casefold())
                if decision is not None:
                    _apply_decision(term, decision, target_lang=target_lang)

    if batches:
        max_workers = max(1, min(int(workers or 1), TERM_REVIEW_MAX_WORKERS, len(batches)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            list(executor.map(run_one, enumerate(batches)))

    for term in candidates:
        term.setdefault("review_status", "unreviewed")
    harmonized = harmonize_term_base(payload)
    by_category: dict[str, int] = {}
    by_treatment: dict[str, int] = {}
    for term in payload.get("terms", []):
        if not isinstance(term, dict):
            continue
        if term.get("category"):
            by_category[term["category"]] = by_category.get(term["category"], 0) + 1
        treatment = term_treatment(term)
        by_treatment[treatment] = by_treatment.get(treatment, 0) + 1
    payload["review"] = {
        "status": "failed" if batches and len(failed) == len(batches) else ("partial" if failed else "completed"),
        "model": model,
        "prompt_version": TERM_REVIEW_PROMPT_VERSION,
        "batch_count": len(batches),
        "failed_batches": sorted(failed),
        "candidate_count": len(candidates),
        "unreviewed_count": sum(1 for term in candidates if term.get("review_status") != "reviewed"),
        "by_category": dict(sorted(by_category.items())),
        "by_treatment": dict(sorted(by_treatment.items())),
        "annotate_count": sum(
            1 for term in candidates if term.get("review_status") == "reviewed" and term.get("annotate")
        ),
        "harmonized": harmonized,
    }
    summary = payload.setdefault("summary", {})
    summary["locked_count"] = by_treatment.get(TREATMENT_LOCK, 0) + by_treatment.get(TREATMENT_KEEP_ORIGINAL, 0)
    return payload


__all__ = [
    "CATEGORIES",
    "CATEGORY_TREATMENT",
    "INJECTED_TREATMENTS",
    "TERM_REVIEW_PROMPT_VERSION",
    "TREATMENT_DROP",
    "TREATMENT_FREE",
    "TREATMENT_KEEP_ORIGINAL",
    "TREATMENT_LOCK",
    "build_term_review_messages",
    "harmonize_term_base",
    "parse_term_review_response",
    "review_term_base",
    "term_annotate",
    "term_treatment",
]

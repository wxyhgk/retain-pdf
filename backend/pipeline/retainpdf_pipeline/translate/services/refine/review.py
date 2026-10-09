"""挑错（review）：只定位准确性错误，不打分。

- 每批 ``REVIEW_BATCH_SIZE`` 块（另有字符上限），输入原文、现译、命中的锁定术语、
  风格要点、前后文、这批块已有的 QA 违规；
- 模型只输出有错的条目；``target_span`` 必须在译文里逐字找得到，找不到的丢弃并计数；
- 确定性 QA 里的 major / critical 违规（准确性相关的几类）并入待修清单，origin=qa。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Iterable

from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import matched_glossary_entries
from retainpdf_pipeline.translate.llm.shared.response_parsing import extract_json_text
from retainpdf_pipeline.translate.prompt_loader import load_prompt
from retainpdf_pipeline.translate.services.quality.qa.numerics import CHECK_NUMBERS
from retainpdf_pipeline.translate.services.quality.qa.omission import CHECK_OMISSION
from retainpdf_pipeline.translate.services.quality.qa.references import CHECK_REFERENCES
from retainpdf_pipeline.translate.services.quality.qa.style import CHECK_RESIDUE
from retainpdf_pipeline.translate.services.quality.qa.terms import CHECK_TERMS
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem


REVIEW_SYSTEM_PROMPT = "refine_review_system.txt"
REVIEW_PROMPT_VERSION = "refine_review.v1"
REVIEW_BATCH_SIZE = 30
REVIEW_BATCH_MAX_CHARS = 16000
CONTEXT_CHARS = 160
MAX_TERMS_PER_ITEM = 12
STYLE_NOTES_MAX_CHARS = 800

CATEGORIES = ("mistranslation", "omission", "addition", "untranslated", "number_unit", "terminology")
SEVERITIES = ("critical", "major", "minor")
FIXABLE_SEVERITIES = ("critical", "major")
ORIGIN_REVIEW = "review"
ORIGIN_QA = "qa"
# 确定性规则找出并直接修的（不调模型），比如没译的英文交叉引用标签。
ORIGIN_RULE = "rule"

# 确定性 QA 的检查 -> 精修类别。没列出的（占位符、标点、首现注释、排版 fit）不是
# 「改一个片段就能修」的准确性问题，不进待修清单。
QA_CHECK_CATEGORY = {
    CHECK_NUMBERS: "number_unit",
    CHECK_REFERENCES: "mistranslation",
    CHECK_TERMS: "terminology",
    CHECK_RESIDUE: "untranslated",
    CHECK_OMISSION: "omission",
}

DISCARD_SPAN_NOT_FOUND = "target_span_not_found"
DISCARD_UNKNOWN_ITEM = "unknown_item"
DISCARD_INVALID = "invalid_finding"
DISCARD_DUPLICATE = "duplicate"

REVIEW_RESPONSE_FORMAT = {"type": "json_object"}


@dataclass
class Finding:
    finding_id: str
    item_id: str
    page_number: int
    category: str
    severity: str
    target_span: str
    source_span: str
    explanation: str
    suggestion: str
    origin: str
    qa: dict[str, Any] | None = None

    @property
    def fixable(self) -> bool:
        return self.severity in FIXABLE_SEVERITIES

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "finding_id": self.finding_id,
            "item_id": self.item_id,
            "page_number": self.page_number,
            "category": self.category,
            "severity": self.severity,
            "target_span": self.target_span,
            "source_span": self.source_span,
            "explanation": self.explanation,
            "suggestion": self.suggestion,
            "origin": self.origin,
        }
        if self.qa:
            payload["qa"] = dict(self.qa)
        return payload


@dataclass
class ReviewStats:
    candidate_item_count: int = 0
    reviewed_item_count: int = 0
    batch_count: int = 0
    failed_batch_count: int = 0
    raw_finding_count: int = 0
    discarded: dict[str, int] = field(default_factory=dict)

    def discard(self, reason: str) -> None:
        self.discarded[reason] = self.discarded.get(reason, 0) + 1


def _clip(text: str, limit: int) -> str:
    value = " ".join(str(text or "").split())
    return value if len(value) <= limit else value[:limit].rstrip() + "…"


def locked_terms_for(entries: list[GlossaryEntry], source: str) -> list[dict[str, str]]:
    terms = []
    for entry in matched_glossary_entries(entries, source)[:MAX_TERMS_PER_ITEM]:
        terms.append({"source": entry.source, "target": entry.target})
    return terms


def review_item_payload(
    item: QaItem,
    *,
    before: QaItem | None,
    after: QaItem | None,
    terms: list[dict[str, str]],
    qa_flags: list[dict[str, Any]],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "item_id": item.item_id,
        "page": item.page_number,
        "source": item.protected_source,
        "translation": item.protected_translated,
        "context_before": _clip(before.protected_translated, CONTEXT_CHARS) if before else "",
        "context_after": _clip(after.protected_translated, CONTEXT_CHARS) if after else "",
    }
    if terms:
        payload["locked_terms"] = terms
    if qa_flags:
        payload["qa_flags"] = qa_flags
    return payload


def batch_payloads(payloads: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    batches: list[list[dict[str, Any]]] = []
    current: list[dict[str, Any]] = []
    current_chars = 0
    for payload in payloads:
        size = len(json.dumps(payload, ensure_ascii=False))
        if current and (len(current) >= REVIEW_BATCH_SIZE or current_chars + size > REVIEW_BATCH_MAX_CHARS):
            batches.append(current)
            current, current_chars = [], 0
        current.append(payload)
        current_chars += size
    if current:
        batches.append(current)
    return batches


def build_review_messages(batch: list[dict[str, Any]], *, style_notes: str) -> list[dict[str, str]]:
    user = {"style_notes": _clip(style_notes, STYLE_NOTES_MAX_CHARS), "items": batch}
    return [
        {"role": "system", "content": load_prompt(REVIEW_SYSTEM_PROMPT)},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
    ]


def _strip_code_fence(text: str) -> str:
    if not text.startswith("```"):
        return text
    lines = text.splitlines()[1:]
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def parse_json_object(content: str) -> Any:
    """先按严格 JSON 解析，失败才退回翻译用的宽松解析。

    宽松解析（``extract_json_text``）会把中文弯引号 “” 一律换成 ASCII 双引号，
    而挑错 / 修改的 explanation、target_span、edits 里本来就常有中文引号——
    直接走宽松解析会把合法 JSON 弄坏，整批结果作废。
    """
    text = _strip_code_fence(str(content or "").strip())
    candidates = [text]
    start, end = text.find("{"), text.rfind("}")
    if 0 < start < end:
        candidates.append(text[start : end + 1])
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except ValueError:
            continue
    return json.loads(extract_json_text(text))


def parse_review_findings(content: str) -> list[Any]:
    payload = parse_json_object(content)
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        findings = payload.get("findings")
        if isinstance(findings, list):
            return findings
        if findings is None and not payload:
            return []
    raise ValueError("review response has no findings list")


def accept_review_findings(
    raw_findings: Iterable[Any],
    *,
    items_by_id: dict[str, QaItem],
    stats: ReviewStats,
    next_id,
    seen: set[tuple[str, str, str]],
) -> list[Finding]:
    accepted: list[Finding] = []
    for raw in raw_findings:
        stats.raw_finding_count += 1
        if not isinstance(raw, dict):
            stats.discard(DISCARD_INVALID)
            continue
        item_id = str(raw.get("item_id", "") or "").strip()
        item = items_by_id.get(item_id)
        if item is None:
            stats.discard(DISCARD_UNKNOWN_ITEM)
            continue
        category = str(raw.get("category", "") or "").strip().lower()
        severity = str(raw.get("severity", "") or "").strip().lower()
        target_span = str(raw.get("target_span", "") or "")
        if category not in CATEGORIES or severity not in SEVERITIES:
            stats.discard(DISCARD_INVALID)
            continue
        if not target_span or target_span not in item.protected_translated:
            stats.discard(DISCARD_SPAN_NOT_FOUND)
            continue
        key = (item_id, category, target_span)
        if key in seen:
            stats.discard(DISCARD_DUPLICATE)
            continue
        seen.add(key)
        accepted.append(
            Finding(
                finding_id=next_id(),
                item_id=item_id,
                page_number=item.page_number,
                category=category,
                severity=severity,
                target_span=target_span,
                source_span=str(raw.get("source_span", "") or ""),
                explanation=_clip(str(raw.get("explanation", "") or ""), 400),
                suggestion=_clip(str(raw.get("suggestion", "") or ""), 400),
                origin=ORIGIN_REVIEW,
            )
        )
    return accepted


def qa_flags_by_item(qa_payload: dict[str, Any] | None) -> dict[str, list[dict[str, Any]]]:
    flags: dict[str, list[dict[str, Any]]] = {}
    for violation in (qa_payload or {}).get("violations") or []:
        if not isinstance(violation, dict):
            continue
        location = violation.get("location") or {}
        for item_id in location.get("item_ids") or [location.get("item_id")]:
            if not item_id:
                continue
            flags.setdefault(str(item_id), []).append(
                {
                    "check": violation.get("check", ""),
                    "type": violation.get("type", ""),
                    "severity": violation.get("severity", ""),
                    "message": violation.get("message", ""),
                }
            )
    return flags


def qa_findings(
    qa_payload: dict[str, Any] | None,
    *,
    items_by_id: dict[str, QaItem],
    next_id,
) -> list[Finding]:
    """QA 里 major / critical 的准确性违规并入待修清单。"""
    findings: list[Finding] = []
    for violation in (qa_payload or {}).get("violations") or []:
        if not isinstance(violation, dict):
            continue
        severity = str(violation.get("severity", "") or "")
        category = QA_CHECK_CATEGORY.get(str(violation.get("check", "") or ""))
        if severity not in FIXABLE_SEVERITIES or category is None:
            continue
        location = violation.get("location") or {}
        item_id = str(location.get("item_id", "") or "")
        item = items_by_id.get(item_id)
        if item is None:
            continue
        evidence = violation.get("evidence") or {}
        findings.append(
            Finding(
                finding_id=next_id(),
                item_id=item_id,
                page_number=item.page_number,
                category=category,
                severity=severity,
                target_span="",
                source_span="",
                explanation=_clip(str(violation.get("message", "") or ""), 400),
                suggestion="",
                origin=ORIGIN_QA,
                qa={
                    "violation_id": violation.get("id", ""),
                    "check": violation.get("check", ""),
                    "type": violation.get("type", ""),
                    "item_ids": list(location.get("item_ids") or [item_id]),
                    "evidence": {
                        key: evidence[key]
                        for key in ("length_ratio", "expected", "found", "source_excerpt", "translation_excerpt")
                        if key in evidence
                    },
                },
            )
        )
    return findings


__all__ = [
    "CATEGORIES",
    "FIXABLE_SEVERITIES",
    "Finding",
    "ORIGIN_QA",
    "ORIGIN_RULE",
    "ORIGIN_REVIEW",
    "QA_CHECK_CATEGORY",
    "REVIEW_BATCH_SIZE",
    "REVIEW_PROMPT_VERSION",
    "REVIEW_RESPONSE_FORMAT",
    "ReviewStats",
    "SEVERITIES",
    "accept_review_findings",
    "batch_payloads",
    "build_review_messages",
    "locked_terms_for",
    "parse_json_object",
    "parse_review_findings",
    "qa_findings",
    "qa_flags_by_item",
    "review_item_payload",
]

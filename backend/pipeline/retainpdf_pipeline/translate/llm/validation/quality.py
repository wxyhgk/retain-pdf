from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import re
from typing import Any

from retainpdf_pipeline.translate.core.item_reader import item_content_kind
from retainpdf_pipeline.translate.artifacts.status import is_allowed_untranslated
from retainpdf_pipeline.translate.llm.result_payload import KEEP_ORIGIN_LABEL
from retainpdf_pipeline.translate.llm.result_payload import is_internal_placeholder_degraded
from retainpdf_pipeline.translate.llm.result_payload import normalize_decision
from retainpdf_pipeline.translate.llm.validation.english_residue import is_direct_math_mode
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_mixed_english_residue_output
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_predominantly_english_output
from retainpdf_pipeline.translate.llm.validation.english_residue import looks_like_untranslated_english_output
from retainpdf_pipeline.translate.llm.validation.english_residue import should_force_translate_body_text
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.math_safety import has_balanced_inline_math_delimiters
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholders
from retainpdf_pipeline.translate.llm.validation.protocol_shell import looks_like_protocol_shell_output
from retainpdf_pipeline.translate.core.terms import GlossaryEntry
from retainpdf_pipeline.translate.core.terms import matched_glossary_entries
from retainpdf_pipeline.translate.core.terms import normalize_glossary_entries


INLINE_MATH_SPAN_RE = re.compile(r"(?<!\\)\$(?:\\.|[^$\\\n])+(?<!\\)\$")
SOURCE_TERMINAL_RE = re.compile(r"[.!?。！？；;:：)\]）】”’\"']\s*$")
# 上下文借词(“借词幻觉”):当前块没写完时模型从续接上下文借实词补全,
# 如半句 + 图注上下文编出原文没有的 “Scheme 18 所示类型”。
# 只抓高精度信号——编号标签(Scheme/Figure/Table/Equation + 数字,中英皆可)
# 与上下文独有的长专有名词;命中只记 warning + retryable,标记复修而不丢弃。
_CONTEXT_EN_LABEL_RE = re.compile(
    r"\b(scheme|figures?|fig\.?|tables?|equations?|eq\.?|sections?|chapters?)\s*\.?\s*(\d{1,3}[a-z]?)",
    re.IGNORECASE,
)
_CONTEXT_ZH_LABEL_RE = re.compile(r"(图|表|方案|公式|方程|章节)\s*(\d{1,3}[a-z]?)")
_CONTEXT_PROPER_NOUN_RE = re.compile(r"\b[A-Z][A-Za-z\-]{4,}\b")
_CONTEXT_BORROW_STOPWORDS = frozenset(
    {
        "about", "after", "before", "between", "during", "these", "those", "this", "that",
        "with", "from", "into", "such", "when", "where", "which", "while", "their",
        "there", "here", "have", "been", "would", "could", "should", "first", "second",
        "other", "more", "most", "some", "many", "each", "both", "through", "under",
        "over", "because", "scheme", "schemes", "figure", "figures", "table", "tables",
        "equation", "equations", "section", "sections", "chapter", "chapters",
    }
)
_CONTEXT_LABEL_ZH_HINTS: dict[str, tuple[str, ...]] = {
    "scheme": ("scheme", "方案"),
    "figure": ("figure", "fig", "图"),
    "table": ("table", "表"),
    "equation": ("equation", "eq", "公式", "方程"),
    "section": ("section", "chapter", "节", "章"),
}
# EN→ZH technical prose is typically ~0.3–0.5 of source char length. Flag only
# extreme tail-only / partial outputs so normal dense translations stay clean.
TRUNCATION_MIN_SOURCE_CHARS = 200
TRUNCATION_MAX_RATIO = 0.15


@dataclass(frozen=True)
class TranslationQualityIssue:
    item_id: str
    kind: str
    severity: str
    message: str
    retryable: bool = True
    details: dict[str, Any] | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "item_id": self.item_id,
            "kind": self.kind,
            "severity": self.severity,
            "message": self.message,
            "retryable": self.retryable,
        }
        if self.details:
            payload["details"] = self.details
        return payload


@dataclass(frozen=True)
class TranslationQualityReport:
    issues: list[TranslationQualityIssue]
    reviewed_item_count: int

    @property
    def has_errors(self) -> bool:
        return any(issue.severity == "error" for issue in self.issues)

    def as_dict(self) -> dict[str, Any]:
        return {
            "reviewed_item_count": self.reviewed_item_count,
            "issue_count": len(self.issues),
            "has_errors": self.has_errors,
            "issues": [issue.as_dict() for issue in self.issues],
        }


def should_reject_keep_origin(item: dict, decision: str, payload: dict[str, str] | None = None) -> bool:
    if decision != KEEP_ORIGIN_LABEL:
        return False
    if payload and is_internal_placeholder_degraded(payload):
        return False
    if item_content_kind(item) != "text":
        return False
    return should_force_translate_body_text(item)


def review_translation_batch(
    batch: list[dict],
    result: dict[str, dict[str, str]],
    *,
    glossary_entries: list[GlossaryEntry | dict] | None = None,
) -> TranslationQualityReport:
    normalized_glossary = normalize_glossary_entries(glossary_entries)
    issues: list[TranslationQualityIssue] = []
    expected_ids = {str(item.get("item_id", "") or "") for item in batch}
    actual_ids = {str(item_id) for item_id in result}
    for missing in sorted(expected_ids - actual_ids):
        if missing:
            issues.append(
                TranslationQualityIssue(
                    item_id=missing,
                    kind="missing_result",
                    severity="error",
                    message="Translation result is missing this item_id",
                )
            )
    for extra in sorted(actual_ids - expected_ids):
        if extra:
            issues.append(
                TranslationQualityIssue(
                    item_id=extra,
                    kind="unexpected_result",
                    severity="error",
                    message="Translation result contains an unexpected item_id",
                )
            )
    for item in batch:
        item_id = str(item.get("item_id", "") or "")
        if not item_id or item_id not in result:
            continue
        issues.extend(
            review_translation_item(
                item,
                result.get(item_id, {}),
                glossary_entries=normalized_glossary,
            ).issues
        )
    return TranslationQualityReport(issues=issues, reviewed_item_count=len(batch))


def review_translation_item(
    item: dict,
    translated_result: dict[str, str],
    *,
    glossary_entries: list[GlossaryEntry | dict] | None = None,
) -> TranslationQualityReport:
    normalized_glossary = normalize_glossary_entries(glossary_entries)
    item_id = str(item.get("item_id", "") or "")
    source_text = unit_source_text(item)
    translated_text = str(translated_result.get("translated_text", "") or "")
    decision = normalize_decision(translated_result.get("decision", "translate"))
    issues: list[TranslationQualityIssue] = []
    diagnostics = dict(translated_result.get("translation_diagnostics") or {})

    if should_reject_keep_origin(item, decision, translated_result):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="keep_origin_degraded",
                severity="warning",
                message="Long body text was kept as origin and should be reviewed",
            )
        )
        return TranslationQualityReport(issues=issues, reviewed_item_count=1)
    if is_allowed_untranslated(item, diagnostics):
        return TranslationQualityReport(issues=issues, reviewed_item_count=1)
    if decision == KEEP_ORIGIN_LABEL:
        return TranslationQualityReport(issues=issues, reviewed_item_count=1)

    issues.extend(_review_translated_text(item, item_id, source_text, translated_text))
    issues.extend(
        _review_context_borrow(item, item_id, source_text, translated_text, normalized_glossary)
    )
    if not is_direct_math_mode(item):
        issues.extend(review_placeholders(item_id, source_text, translated_text))
    issues.extend(_review_glossary_terms(item_id, source_text, translated_text, normalized_glossary))
    return TranslationQualityReport(issues=issues, reviewed_item_count=1)


def _review_translated_text(
    item: dict,
    item_id: str,
    source_text: str,
    translated_text: str,
) -> list[TranslationQualityIssue]:
    issues: list[TranslationQualityIssue] = []
    if not translated_text.strip():
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="empty_translation",
                severity="error",
                message="Translation output is empty",
            )
        )
        return issues
    if is_direct_math_mode(item) and not has_balanced_inline_math_delimiters(translated_text):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="math_delimiter_unbalanced",
                severity="error",
                message="Translated output has unbalanced inline math delimiters",
            )
        )
    if looks_like_protocol_shell_output(translated_text):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="protocol_shell_output",
                severity="error",
                message="Translated output still contains JSON/protocol shell",
            )
        )
    truncation = _truncated_translation_issue(item_id, source_text, translated_text)
    if truncation is not None:
        issues.append(truncation)
    context_bleed = _context_bleed_leaked_math(item, source_text, translated_text)
    if context_bleed:
        # 连续段片段按设计就是"无终止标点的不完整句",此检查对它们必然
        # 高频触发;而 apply 层的 _sanitize_neighbor_continuation_leak 已经
        # 能确定性修剪泄漏的后文公式。对连续段降级为警告,避免为机械层
        # 可修复的问题反复重试;独立条目仍保持硬错误。
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="context_bleed",
                severity="warning" if _is_continuation_item(item) else "error",
                message="Translated output appears to include following context not present in current source",
                details={"leaked_math": context_bleed[:5]},
            )
        )
    if looks_like_untranslated_english_output(item, translated_text):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="english_residue",
                severity="error",
                message="Translated output still looks predominantly English",
            )
        )
    elif looks_like_mixed_english_residue_output(item, translated_text):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="mixed_english_residue",
                severity="error",
                message="Translated output still contains long copied English residue spans",
            )
        )
    elif looks_like_predominantly_english_output(item, translated_text):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="english_residue_warning",
                severity="warning",
                message="Translated output still contains substantial English residue",
                retryable=False,
            )
        )
    return issues


def _math_spans(text: str) -> list[str]:
    return [match.group(0).strip() for match in INLINE_MATH_SPAN_RE.finditer(str(text or "")) if match.group(0).strip()]


def _truncated_translation_issue(
    item_id: str,
    source_text: str,
    translated_text: str,
) -> TranslationQualityIssue | None:
    source = str(source_text or "").strip()
    translated = str(translated_text or "").strip()
    if len(source) < TRUNCATION_MIN_SOURCE_CHARS or not translated:
        return None
    ratio = len(translated) / len(source)
    if ratio >= TRUNCATION_MAX_RATIO:
        return None
    return TranslationQualityIssue(
        item_id=item_id,
        kind="truncated_translation",
        severity="error",
        message=(
            f"Translated output is abnormally short vs source "
            f"(ratio={ratio:.3f}, source_chars={len(source)}, translated_chars={len(translated)})"
        ),
        details={
            "ratio": round(ratio, 4),
            "source_chars": len(source),
            "translated_chars": len(translated),
            "min_source_chars": TRUNCATION_MIN_SOURCE_CHARS,
            "max_ratio": TRUNCATION_MAX_RATIO,
        },
    )


def _source_looks_incomplete(text: str) -> bool:
    source = str(text or "").strip()
    if not source:
        return False
    return SOURCE_TERMINAL_RE.search(source) is None


def _is_continuation_item(item: dict) -> bool:
    return bool(str(item.get("continuation_group", "") or "").strip()) or str(
        item.get("translation_unit_id", "") or ""
    ).startswith("__cg__:")


def _context_bleed_leaked_math(item: dict, source_text: str, translated_text: str) -> list[str]:
    if not is_direct_math_mode(item) or not _source_looks_incomplete(source_text):
        return []
    context_after = str(item.get("translation_context_after") or item.get("continuation_next_text") or "")
    if not context_after:
        return []
    source_math = set(_math_spans(source_text))
    return [
        expr
        for expr in _math_spans(context_after)
        if expr not in source_math and expr in translated_text
    ]


def _normalize_label_kind(raw_kind: str) -> str:
    kind = str(raw_kind or "").strip().lower().rstrip(".")
    if kind in {"fig", "figure", "figures", "图"}:
        return "figure"
    if kind in {"table", "tables", "表"}:
        return "table"
    if kind in {"equation", "equations", "eq", "公式", "方程"}:
        return "equation"
    if kind in {"section", "sections", "chapter", "chapters", "章节"}:
        return "section"
    return "scheme"


def _number_present(text: str, number: str) -> bool:
    return re.search(rf"(?<!\d){re.escape(number)}(?!\d)", str(text or "")) is not None


def _label_hint_present(translated_text: str, kind: str, number: str) -> bool:
    if not _number_present(translated_text, number):
        return False
    folded = str(translated_text or "").casefold()
    return any(hint.casefold() in folded for hint in _CONTEXT_LABEL_ZH_HINTS[kind])


def _context_borrowed_terms(
    item: dict,
    source_text: str,
    translated_text: str,
    glossary_entries: list[GlossaryEntry],
) -> list[str]:
    source = str(source_text or "")
    translated = str(translated_text or "")
    if not translated.strip():
        return []
    context = " ".join(
        str(item.get(key) or "")
        for key in (
            "translation_context_before",
            "translation_context_after",
            "continuation_prev_text",
            "continuation_next_text",
        )
    )
    if not context.strip():
        return []
    borrowed: list[str] = []
    seen: set[str] = set()

    def _record(term: str) -> None:
        key = term.casefold()
        if key not in seen:
            seen.add(key)
            borrowed.append(term)

    for match in _CONTEXT_EN_LABEL_RE.finditer(context):
        kind = _normalize_label_kind(match.group(1))
        number = str(match.group(2) or "").strip()
        if not number or _number_present(source, number):
            continue
        label = f"{kind} {number}"
        if _label_hint_present(translated, kind, number):
            _record(label)
    for match in _CONTEXT_ZH_LABEL_RE.finditer(context):
        kind = _normalize_label_kind(match.group(1))
        number = str(match.group(2) or "").strip()
        if not number or _number_present(source, number):
            continue
        label = f"{kind} {number}"
        if label.casefold() in seen:
            continue
        if _label_hint_present(translated, kind, number):
            _record(label)
    glossary_surfaces = set()
    for entry in glossary_entries or []:
        for surface in (getattr(entry, "source", ""), getattr(entry, "target", "")):
            surface = str(surface or "").strip().casefold()
            if surface:
                glossary_surfaces.add(surface)
    source_folded = source.casefold()
    translated_folded = translated.casefold()
    for match in _CONTEXT_PROPER_NOUN_RE.finditer(context):
        token = str(match.group(0) or "").strip()
        if len(token) < 5 or token.casefold() in _CONTEXT_BORROW_STOPWORDS:
            continue
        if token.casefold() in source_folded or token.casefold() in glossary_surfaces:
            continue
        if token.casefold() in translated_folded:
            _record(token)
    return borrowed[:5]


def _review_context_borrow(
    item: dict,
    item_id: str,
    source_text: str,
    translated_text: str,
    glossary_entries: list[GlossaryEntry],
) -> list[TranslationQualityIssue]:
    borrowed = _context_borrowed_terms(item, source_text, translated_text, glossary_entries or [])
    if not borrowed:
        return []
    return [
        TranslationQualityIssue(
            item_id=item_id,
            kind="context_borrow",
            severity="warning",
            message="Translated output contains terms borrowed from neighboring context not present in current source",
            retryable=True,
            details={"borrowed_terms": borrowed},
        )
    ]


def review_placeholders(item_id: str, source_text: str, translated_text: str) -> list[TranslationQualityIssue]:
    issues: list[TranslationQualityIssue] = []
    source_placeholders = placeholders(source_text)
    translated_placeholders = placeholders(translated_text)
    unexpected = sorted(translated_placeholders - source_placeholders)
    if unexpected:
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="unexpected_placeholder",
                severity="error",
                message="Translated output contains placeholders not present in source",
                details={"unexpected": unexpected},
            )
        )
    source_sequence = placeholder_sequence(source_text)
    translated_sequence = placeholder_sequence(translated_text)
    if Counter(translated_sequence) != Counter(source_sequence):
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="placeholder_inventory_mismatch",
                severity="error",
                message="Placeholder inventory mismatch",
                details={
                    "source_sequence": source_sequence,
                    "translated_sequence": translated_sequence,
                },
            )
        )
    elif translated_sequence != source_sequence:
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="placeholder_order_changed",
                severity="warning",
                message="Protected token order changed but inventory is preserved",
                retryable=False,
                details={
                    "source_sequence": source_sequence,
                    "translated_sequence": translated_sequence,
                },
            )
        )
    return issues


def _review_glossary_terms(
    item_id: str,
    source_text: str,
    translated_text: str,
    glossary_entries: list[GlossaryEntry],
) -> list[TranslationQualityIssue]:
    issues: list[TranslationQualityIssue] = []
    if not glossary_entries or not source_text:
        return issues
    matched = matched_glossary_entries(glossary_entries, source_text)
    translated_folded = translated_text.casefold()
    for entry in matched:
        expected = entry.source if entry.level == "preserve" else entry.target
        if expected and expected.casefold() in translated_folded:
            continue
        issues.append(
            TranslationQualityIssue(
                item_id=item_id,
                kind="glossary_term_missing",
                severity="warning",
                message="Matched glossary term was not reflected in translated output",
                retryable=False,
                details={
                    "source": entry.source,
                    "target": entry.target,
                    "level": entry.level,
                    "expected": expected,
                },
            )
        )
    return issues


__all__ = [
    "TranslationQualityIssue",
    "TranslationQualityReport",
    "review_placeholders",
    "review_translation_batch",
    "review_translation_item",
    "should_reject_keep_origin",
]

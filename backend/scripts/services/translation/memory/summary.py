from __future__ import annotations

from typing import Any

from services.translation.memory.constants import MAX_RETRIEVED_PRESERVE_HINTS
from services.translation.memory.constants import MAX_RETRIEVED_SUMMARY_TERMS
from services.translation.memory.constants import MAX_SUMMARY_PRESERVE_HINTS
from services.translation.memory.constants import MAX_SUMMARY_TERMS
from services.translation.memory.constants import MIN_TERM_HITS_FOR_PROMPT
from services.translation.memory.filters import preserve_hint_matches_source
from services.translation.memory.filters import term_key_matches_source
from services.translation.memory.filters import term_record_allowed_in_prompt
from services.translation.memory.text import clean_term_key
from services.translation.memory.text import clean_term_value
from services.translation.memory.text import normalize_space


def build_prompt_summary(
    terms: dict[str, dict[str, Any]],
    preserve_hints: dict[str, dict[str, Any]],
) -> str:
    lines: list[str] = []
    term_records = [
        record
        for record in terms.values()
        if int(record.get("hits") or 0) >= MIN_TERM_HITS_FOR_PROMPT
        and term_record_allowed_in_prompt(record)
    ]
    term_records = sorted(term_records, key=lambda record: (-int(record.get("hits") or 0), str(record.get("key") or "")))
    if term_records:
        lines.append("当前文档记忆：术语保持一致。")
        for record in term_records[:MAX_SUMMARY_TERMS]:
            key = clean_term_key(str(record.get("key") or ""))
            value = clean_term_value(str(record.get("value") or ""))
            if key and value:
                lines.append(f"- {key} => {value}")

    preserve_records = sorted(
        preserve_hints.values(),
        key=lambda record: (-int(record.get("hits") or 0), str(record.get("key") or "")),
    )
    if preserve_records:
        lines.append("当前文档记忆：以下类型更可能是技术原文/代码/参数块，应优先保留排版和符号。")
        for record in preserve_records[:MAX_SUMMARY_PRESERVE_HINTS]:
            lines.append(f"- {str(record.get('key') or '')}")
    return "\n".join(lines).strip()


def build_prompt_summary_for_source(
    terms: dict[str, dict[str, Any]],
    preserve_hints: dict[str, dict[str, Any]],
    source_text: str,
    *,
    max_terms: int = MAX_RETRIEVED_SUMMARY_TERMS,
    max_preserve_hints: int = MAX_RETRIEVED_PRESERVE_HINTS,
) -> str:
    source = normalize_space(source_text)
    if not source:
        return ""

    matched_terms = [
        record
        for record in terms.values()
        if int(record.get("hits") or 0) >= MIN_TERM_HITS_FOR_PROMPT
        and term_record_allowed_in_prompt(record)
        and term_key_matches_source(str(record.get("key") or ""), source)
    ]
    matched_terms = sorted(
        matched_terms,
        key=lambda record: (
            -int(record.get("hits") or 0),
            -len(clean_term_key(str(record.get("key") or ""))),
            str(record.get("key") or ""),
        ),
    )

    lines: list[str] = []
    if matched_terms:
        lines.append("当前块相关文档记忆：术语保持一致。")
        for record in matched_terms[:max_terms]:
            key = clean_term_key(str(record.get("key") or ""))
            value = clean_term_value(str(record.get("value") or ""))
            if key and value:
                lines.append(f"- {key} => {value}")

    matched_preserve_hints = [
        record
        for record in preserve_hints.values()
        if preserve_hint_matches_source(str(record.get("key") or ""), source)
    ]
    matched_preserve_hints = sorted(
        matched_preserve_hints,
        key=lambda record: (-int(record.get("hits") or 0), str(record.get("key") or "")),
    )
    if matched_preserve_hints:
        lines.append("当前块相关文档记忆：以下内容此前更适合保留技术排版。")
        for record in matched_preserve_hints[:max_preserve_hints]:
            lines.append(f"- {str(record.get('key') or '')}")
    return "\n".join(lines).strip()

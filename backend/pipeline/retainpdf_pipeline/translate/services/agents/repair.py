from __future__ import annotations
from retainpdf_pipeline.translate.llm.shared.executor_context import scoped_request

import json
from dataclasses import dataclass
from typing import Callable

from retainpdf_pipeline.translate.services.agents.contracts import LLMTask
from retainpdf_pipeline.translate.llm.validation.english_residue import unit_source_text
from retainpdf_pipeline.translate.llm.validation.placeholder_tokens import placeholder_sequence
from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue
from retainpdf_pipeline.translate.services.terms import GlossaryEntry
from retainpdf_pipeline.translate.services.terms import build_terms_guidance
from retainpdf_pipeline.translate.services.terms import matched_glossary_entries
from retainpdf_pipeline.translate.services.terms import normalize_glossary_entries


REPAIR_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "translation_repair",
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "repaired_text": {"type": "string"},
                "applied_issue_kinds": {"type": "array", "items": {"type": "string"}},
                "confidence": {"type": "number"},
                "needs_manual_review": {"type": "boolean"},
                "notes": {"type": "string"},
            },
            "required": ["repaired_text", "applied_issue_kinds", "confidence", "needs_manual_review", "notes"],
        },
    },
}

DEFAULT_REPAIRABLE_ISSUE_KINDS = {
    "empty_translation",
    "english_residue",
    "english_residue_warning",
    "glossary_term_missing",
    "mixed_english_residue",
    "protocol_shell_output",
}


@dataclass(frozen=True)
class TranslationRepairRequest:
    item: dict
    translated_result: dict[str, str]
    issues: list[TranslationQualityIssue]
    glossary_entries: list[GlossaryEntry] | None = None
    target_language_name: str = "简体中文"


@dataclass(frozen=True)
class TranslationRepairResult:
    item_id: str
    repaired_text: str
    applied_issue_kinds: list[str]
    confidence: float
    needs_manual_review: bool
    notes: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "item_id": self.item_id,
            "repaired_text": self.repaired_text,
            "applied_issue_kinds": self.applied_issue_kinds,
            "confidence": self.confidence,
            "needs_manual_review": self.needs_manual_review,
            "notes": self.notes,
        }


RepairRequestFn = Callable[..., str]


class RepairAgent:
    name = "repair"

    def __init__(
        self,
        *,
        glossary_entries: list[GlossaryEntry | dict] | None = None,
        repairable_issue_kinds: set[str] | None = None,
    ):
        self._glossary_entries = normalize_glossary_entries(glossary_entries)
        self._repairable_issue_kinds = set(repairable_issue_kinds or DEFAULT_REPAIRABLE_ISSUE_KINDS)

    def repairable_issues(self, issues: list[TranslationQualityIssue]) -> list[TranslationQualityIssue]:
        return [issue for issue in issues if issue.kind in self._repairable_issue_kinds]

    def build_task(
        self,
        request: TranslationRepairRequest,
        *,
        model: str = "",
        base_url: str = "",
        timeout_s: int = 70,
    ) -> LLMTask:
        item_id = str(request.item.get("item_id", "") or "")
        source_text = unit_source_text(request.item)
        current_translation = str(request.translated_result.get("translated_text", "") or "")
        repairable = self.repairable_issues(request.issues)
        if not repairable:
            raise ValueError("No repairable translation issues were provided.")
        matched_glossary = matched_glossary_entries(
            normalize_glossary_entries(request.glossary_entries or self._glossary_entries),
            source_text,
        )
        messages = [
            {
                "role": "system",
                "content": _repair_system_prompt(target_language_name=request.target_language_name),
            },
            {
                "role": "user",
                "content": _repair_user_prompt(
                    item_id=item_id,
                    source_text=source_text,
                    current_translation=current_translation,
                    issues=repairable,
                    glossary_entries=matched_glossary,
                    target_language_name=request.target_language_name,
                ),
            },
        ]
        return LLMTask(
            task_id=f"repair:{item_id}",
            agent=self.name,
            messages=messages,
            model=model,
            base_url=base_url,
            response_format=REPAIR_RESPONSE_SCHEMA,
            timeout_s=timeout_s,
            metadata={
                "item_id": item_id,
                "issue_kinds": [issue.kind for issue in repairable],
                "source_placeholders": placeholder_sequence(source_text),
            },
        )

    def parse_result(self, *, item_id: str, content: str) -> TranslationRepairResult:
        payload = parse_repair_response(content)
        return TranslationRepairResult(
            item_id=item_id,
            repaired_text=payload["repaired_text"],
            applied_issue_kinds=list(payload["applied_issue_kinds"]),
            confidence=float(payload["confidence"]),
            needs_manual_review=bool(payload["needs_manual_review"]),
            notes=str(payload.get("notes", "") or ""),
        )

    def repair_with_llm(
        self,
        request: TranslationRepairRequest,
        *,
        request_chat_content_fn: RepairRequestFn,
        api_key: str = "",
        model: str = "",
        base_url: str = "",
    ) -> TranslationRepairResult:
        task = self.build_task(request, model=model, base_url=base_url)
        content = scoped_request("agent", [task.agent,task.task_id], request_chat_content_fn,
            task.messages,
            api_key=api_key,
            model=model,
            base_url=base_url,
            response_format=task.response_format,
            timeout=task.timeout_s,
            request_label=f"repair {task.metadata.get('item_id', '')}",
        )
        return self.parse_result(item_id=str(task.metadata.get("item_id", "") or ""), content=content)


def parse_repair_response(content: str) -> dict[str, object]:
    from retainpdf_pipeline.translate.llm.shared.structured_output import parse_structured_json

    payload = parse_structured_json(content)
    if isinstance(payload.get("result"), dict):
        payload = {**payload, **payload["result"]}
    if isinstance(payload.get("repair"), dict):
        payload = {**payload, **payload["repair"]}
    repaired_text = str(
        payload.get("repaired_text")
        or payload.get("translated_text")
        or payload.get("translation")
        or payload.get("text")
        or payload.get("output")
        or ""
    ).strip()
    if not repaired_text:
        raise ValueError("Repair response is missing repaired_text.")
    applied = payload.get("applied_issue_kinds", payload.get("applied_issues", []))
    if not isinstance(applied, list):
        applied = [str(applied)]
    confidence = _bounded_confidence(payload.get("confidence", 0.0))
    return {
        "repaired_text": repaired_text,
        "applied_issue_kinds": [str(item).strip() for item in applied if str(item).strip()],
        "confidence": confidence,
        "needs_manual_review": bool(payload.get("needs_manual_review", confidence < 0.75)),
        "notes": str(payload.get("notes", "") or "").strip(),
    }


def _bounded_confidence(value: object) -> float:
    try:
        numeric = float(value)
    except Exception:
        numeric = 0.0
    return max(0.0, min(1.0, numeric))


def _repair_system_prompt(*, target_language_name: str) -> str:
    return (
        "You are a translation repair agent for a scientific PDF translation pipeline.\n"
        f"Repair only the current translation into {target_language_name}.\n"
        "Do not add explanations, do not translate surrounding context, and do not invent content.\n"
        "Preserve all source placeholders exactly when they appear in the source.\n"
        "Return only JSON matching the requested schema."
    )


def _repair_user_prompt(
    *,
    item_id: str,
    source_text: str,
    current_translation: str,
    issues: list[TranslationQualityIssue],
    glossary_entries: list[GlossaryEntry],
    target_language_name: str,
) -> str:
    payload = {
        "item_id": item_id,
        "target_language": target_language_name,
        "source_text": source_text,
        "current_translation": current_translation,
        "source_placeholders": placeholder_sequence(source_text),
        "issues": [issue.as_dict() for issue in issues],
    }
    glossary_guidance = build_terms_guidance(glossary_entries=glossary_entries)
    if glossary_guidance:
        payload["matched_glossary_guidance"] = glossary_guidance
    return json.dumps(payload, ensure_ascii=False, indent=2)


__all__ = [
    "DEFAULT_REPAIRABLE_ISSUE_KINDS",
    "REPAIR_RESPONSE_SCHEMA",
    "RepairAgent",
    "TranslationRepairRequest",
    "TranslationRepairResult",
    "parse_repair_response",
]

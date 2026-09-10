from __future__ import annotations

from retainpdf_pipeline.translate.artifacts.review import TRANSLATION_REVIEW_SCHEMA
from retainpdf_pipeline.translate.artifacts.review import TRANSLATION_REVIEW_SCHEMA_VERSION
from retainpdf_pipeline.translate.llm.shared.control_context import TranslationControlContext
from retainpdf_pipeline.translate.services.agents.coordinator import TranslationAgentCoordinator


def build_translation_review(
    *,
    translated_pages_map: dict[int, list[dict]],
    translation_context: TranslationControlContext | None = None,
) -> dict[str, object]:
    coordinator = (
        TranslationAgentCoordinator.from_control_context(translation_context)
        if translation_context is not None
        else TranslationAgentCoordinator()
    )
    issues: list[dict] = []
    reviewed_item_count = 0
    for page_idx, items in sorted(translated_pages_map.items()):
        for item in items:
            item_id = str(item.get("item_id", "") or "")
            if not item_id:
                continue
            result = {
                item_id: {
                    "decision": str(item.get("decision", "") or "translate"),
                    "translated_text": str(
                        item.get("translated_text")
                        or item.get("protected_translated_text")
                        or item.get("translation_unit_translated_text")
                        or item.get("translation_unit_protected_translated_text")
                        or ""
                    ),
                    "final_status": str(item.get("final_status", "") or ""),
                    "translation_diagnostics": item.get("translation_diagnostics") or {},
                }
            }
            review = coordinator.review_batch([item], result)
            reviewed_item_count += review.reviewed_item_count
            for issue in review.issues:
                payload = issue.as_dict()
                payload.setdefault("page_idx", int(item.get("page_idx", page_idx) or page_idx))
                payload.setdefault("page_number", int(item.get("page_idx", page_idx) or page_idx) + 1)
                payload.setdefault("block_idx", int(item.get("block_idx", -1) or -1))
                payload.setdefault("policy_state", _review_policy_state(item))
                issues.append(payload)

    issue_summary: dict[str, int] = {}
    severity_summary: dict[str, int] = {}
    for issue in issues:
        kind = str(issue.get("kind", "") or "")
        severity = str(issue.get("severity", "") or "")
        if kind:
            issue_summary[kind] = issue_summary.get(kind, 0) + 1
        if severity:
            severity_summary[severity] = severity_summary.get(severity, 0) + 1
    return {
        "schema": TRANSLATION_REVIEW_SCHEMA,
        "schema_version": TRANSLATION_REVIEW_SCHEMA_VERSION,
        "reviewed_item_count": reviewed_item_count,
        "issue_count": len(issues),
        "has_errors": severity_summary.get("error", 0) > 0,
        "issue_summary": issue_summary,
        "severity_summary": severity_summary,
        "issues": issues,
    }

def _review_policy_state(item: dict) -> dict[str, object]:
    diagnostics = item.get("translation_diagnostics") or {}
    return {
        "item_id": str(item.get("item_id", "") or ""),
        "block_type": str(item.get("block_type", "") or ""),
        "block_kind": str(item.get("block_kind", "") or ""),
        "raw_block_type": str(item.get("raw_block_type", "") or ""),
        "source_text": str(item.get("source_text", "") or ""),
        "protected_source_text": str(item.get("protected_source_text", "") or ""),
        "translation_unit_protected_source_text": str(
            item.get("translation_unit_protected_source_text", "") or ""
        ),
        "classification_label": str(item.get("classification_label", "") or ""),
        "should_translate": item.get("should_translate", True),
        "policy_translate": item.get("policy_translate"),
        "skip_reason": str(item.get("skip_reason", "") or ""),
        "final_status": str(item.get("final_status", "") or ""),
        "translation_diagnostics": diagnostics if isinstance(diagnostics, dict) else {},
    }


__all__ = ["build_translation_review"]

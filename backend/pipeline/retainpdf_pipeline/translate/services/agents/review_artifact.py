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
    unit_translations = _multi_member_unit_translations(translated_pages_map)
    reviewed_units: set[str] = set()
    for page_idx, items in sorted(translated_pages_map.items()):
        for item in items:
            item_id = str(item.get("item_id", "") or "")
            if not item_id:
                continue
            unit_id = _multi_member_unit_id(item)
            if unit_id:
                # 续接组的原文按整组取（unit_source_text），译文也必须按整组比；
                # 拿成员自己那一截去比会报 truncated_translation / formula_commands_dropped 误报。
                # 整组只审一次，问题挂在组里最先出现的成员上。
                if unit_id in reviewed_units:
                    reviewed_item_count += 1
                    continue
                reviewed_units.add(unit_id)
                translated_text = unit_translations.get(unit_id, "")
            else:
                translated_text = str(
                    item.get("translated_text")
                    or item.get("protected_translated_text")
                    or item.get("translation_unit_translated_text")
                    or item.get("translation_unit_protected_translated_text")
                    or ""
                )
            result = {
                item_id: {
                    "decision": str(item.get("decision", "") or "translate"),
                    "translated_text": translated_text,
                    "final_status": str(item.get("final_status", "") or ""),
                    "translation_diagnostics": item.get("translation_diagnostics") or {},
                }
            }
            review = coordinator.review_batch([item], result)
            reviewed_item_count += review.reviewed_item_count
            for issue in review.issues:
                payload = issue.as_dict()
                if unit_id:
                    payload.setdefault("translation_unit_id", unit_id)
                    payload.setdefault("translation_unit_member_ids", list(item.get("translation_unit_member_ids") or []))
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

def _multi_member_unit_id(item: dict) -> str:
    members = item.get("translation_unit_member_ids") or []
    if not isinstance(members, list) or len(members) < 2:
        return ""
    return str(item.get("translation_unit_id", "") or "")


def _multi_member_unit_translations(translated_pages_map: dict[int, list[dict]]) -> dict[str, str]:
    """续接组整组的译文：优先用组上记录的整组译文，没有就按成员顺序拼接各成员的那一截。"""
    unit_text: dict[str, str] = {}
    member_parts: dict[str, dict[str, str]] = {}
    member_order: dict[str, list[str]] = {}
    for _page_idx, items in sorted(translated_pages_map.items()):
        for item in items:
            unit_id = _multi_member_unit_id(item)
            if not unit_id:
                continue
            whole = str(
                item.get("translation_unit_protected_translated_text")
                or item.get("translation_unit_translated_text")
                or ""
            )
            if whole and unit_id not in unit_text:
                unit_text[unit_id] = whole
            member_order.setdefault(unit_id, [str(m) for m in item.get("translation_unit_member_ids") or []])
            member_parts.setdefault(unit_id, {})[str(item.get("item_id", "") or "")] = str(
                item.get("protected_translated_text") or item.get("translated_text") or ""
            )
    for unit_id, parts in member_parts.items():
        if unit_id not in unit_text:
            unit_text[unit_id] = " ".join(
                parts[member] for member in member_order.get(unit_id, []) if parts.get(member)
            )
    return unit_text


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

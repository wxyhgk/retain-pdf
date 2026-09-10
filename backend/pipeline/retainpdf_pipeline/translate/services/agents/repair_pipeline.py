from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from dataclasses import dataclass

from retainpdf_pipeline.translate.core.payload import apply_translated_text_map
from retainpdf_pipeline.translate.core.payload.parts.diagnostics import record_translation_diagnostics
from retainpdf_pipeline.translate.services.agents.coordinator import TranslationAgentCoordinator
from retainpdf_pipeline.translate.services.agents.repair import TranslationRepairRequest
from retainpdf_pipeline.translate.services.agents.repair import RepairAgent
from retainpdf_pipeline.translate.services.agents.runtime import TranslationAgentRuntime
from retainpdf_pipeline.translate.services.policy import should_skip_model_by_policy
from retainpdf_pipeline.translate.services.quality import TranslationQualityIssue
from retainpdf_pipeline.translate.services.quality import TranslationQualityReport
from retainpdf_pipeline.translate.services.quality import review_translation_item


BLOCKING_REPAIR_ISSUE_KINDS = {
    "placeholder_inventory_mismatch",
    "placeholder_order_changed",
    "unexpected_placeholder",
    "math_delimiter_unbalanced",
    "context_bleed",
}
RESIDUE_ISSUE_KINDS = {
    "english_residue",
    "mixed_english_residue",
    "english_residue_warning",
}
# 重试链已对同类残留反复重试并放弃接受的标记:agent 修复重复同样的
# 要求只会得到同样被重验拒绝的结果(实测 8 个候选 6 个失败的主因)。
RESIDUE_EXHAUSTED_DEGRADATION_REASONS = {
    "english_residue_repeated",
    "english_residue_partial_accept",
}
DEFAULT_AGENT_REPAIR_WORKERS = 8
MAX_AGENT_REPAIR_WORKERS = 16


@dataclass(frozen=True)
class AgentRepairPipelineResult:
    reviewed_items: int = 0
    candidate_items: int = 0
    repaired_items: int = 0
    skipped_items: int = 0
    failed_items: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "reviewed_items": self.reviewed_items,
            "candidate_items": self.candidate_items,
            "repaired_items": self.repaired_items,
            "skipped_items": self.skipped_items,
            "failed_items": self.failed_items,
        }


def run_agent_repair_pipeline(
    *,
    payload: list[dict],
    translated_results: dict[str, dict[str, str]],
    coordinator: TranslationAgentCoordinator,
    runtime: TranslationAgentRuntime,
    glossary_entries: list | None = None,
    max_items: int | None = None,
    model: str = "",
    base_url: str = "",
) -> AgentRepairPipelineResult:
    candidates: list[tuple[dict, dict[str, str], list[TranslationQualityIssue]]] = []
    reviewed = 0
    skipped = 0
    for item in payload:
        item_id = str(item.get("item_id", "") or "")
        if not item_id or item_id not in translated_results:
            continue
        if _should_skip_policy_keep_origin_item(item):
            skipped += 1
            _record_agent_repair_skip(item, "policy_keep_origin_item", [])
            continue
        if _is_group_member_item(item):
            skipped += 1
            _record_agent_repair_skip(item, "continuation_group_member", [])
            continue
        if _already_repaired_in_flight(item):
            # 重试链的定界符修复/乱码重建已经成功处理过,不再追打
            # 一次 70s 档的 agent 修复调用。
            skipped += 1
            _record_agent_repair_skip(item, "already_repaired_in_flight", [])
            continue
        translated_result = translated_results.get(item_id, {}) or {}
        review = coordinator.review_batch([item], {item_id: translated_result})
        reviewed += review.reviewed_item_count
        if _has_blocking_issue(review.issues):
            skipped += 1
            _record_agent_repair_skip(item, "blocking_quality_issue", review.issues)
            continue
        issues = _repairable_review_issues(review)
        if not issues:
            continue
        if _is_exhausted_residue_candidate(item, issues):
            # 候选问题全是英文残留,而重试链已对同一残留反复重试并放弃:
            # 修复输出仍是同样的英文,重验必拒,纯浪费调用。
            skipped += 1
            _record_agent_repair_skip(item, "residue_retries_exhausted", issues)
            continue
        candidates.append((item, translated_result, issues))

    if max_items is not None:
        skipped += max(0, len(candidates) - max(0, max_items))
        candidates = candidates[: max(0, max_items)]

    repaired = 0
    failed = 0
    repaired_results: dict[str, dict[str, object]] = {}
    repair_workers = _agent_repair_worker_count(len(candidates))
    if repair_workers <= 1:
        repair_outputs = [
            _run_single_agent_repair(
                item=item,
                translated_result=translated_result,
                issues=issues,
                coordinator=coordinator,
                runtime=runtime,
                glossary_entries=glossary_entries,
                model=model,
                base_url=base_url,
            )
            for item, translated_result, issues in candidates
        ]
    else:
        repair_outputs = []
        with ThreadPoolExecutor(max_workers=repair_workers) as executor:
            futures = [
                executor.submit(
                    _run_single_agent_repair,
                    item=item,
                    translated_result=translated_result,
                    issues=issues,
                    coordinator=coordinator,
                    runtime=runtime,
                    glossary_entries=glossary_entries,
                    model=model,
                    base_url=base_url,
                )
                for item, translated_result, issues in candidates
            ]
            for future in as_completed(futures):
                repair_outputs.append(future.result())

    for item, repair_result, exc in repair_outputs:
        item_id = str(item.get("item_id", "") or "")
        if exc is not None or repair_result is None:
            failed += 1
            _record_agent_repair_failure(item, exc or RuntimeError("empty repair result"))
            continue
        validation_issues = _validate_repair_result(item, repair_result.repaired_text)
        if validation_issues:
            failed += 1
            _record_agent_repair_rejected(item, validation_issues)
            continue
        repaired_results[item_id] = {
            "decision": "translate",
            "translated_text": repair_result.repaired_text,
            "final_status": "translated",
            "translation_diagnostics": {
                "agent_repaired": True,
                "agent": "repair",
                "applied_issue_kinds": repair_result.applied_issue_kinds,
                "confidence": repair_result.confidence,
                "needs_manual_review": repair_result.needs_manual_review,
                "notes": repair_result.notes,
            },
        }
        repaired += 1

    if repaired_results:
        apply_translated_text_map(payload, repaired_results)
    return AgentRepairPipelineResult(
        reviewed_items=reviewed,
        candidate_items=len(candidates),
        repaired_items=repaired,
        skipped_items=skipped,
        failed_items=failed,
    )


def _agent_repair_worker_count(candidate_count: int) -> int:
    if candidate_count <= 1:
        return 1
    return max(1, min(MAX_AGENT_REPAIR_WORKERS, DEFAULT_AGENT_REPAIR_WORKERS, candidate_count))


def _run_single_agent_repair(
    *,
    item: dict,
    translated_result: dict[str, str],
    issues: list[TranslationQualityIssue],
    coordinator: TranslationAgentCoordinator,
    runtime: TranslationAgentRuntime,
    glossary_entries: list | None,
    model: str,
    base_url: str,
):
    try:
        return (
            item,
            coordinator.run_repair(
                TranslationRepairRequest(
                    item=item,
                    translated_result=translated_result,
                    issues=issues,
                    glossary_entries=glossary_entries,
                ),
                runtime=runtime,
                model=model,
                base_url=base_url,
            ),
            None,
        )
    except Exception as exc:
        return item, None, exc


def _repairable_review_issues(report: TranslationQualityReport) -> list[TranslationQualityIssue]:
    return RepairAgent().repairable_issues(report.issues)


def _has_blocking_issue(issues: list[TranslationQualityIssue]) -> bool:
    return any(issue.kind in BLOCKING_REPAIR_ISSUE_KINDS for issue in issues)


def _already_repaired_in_flight(item: dict) -> bool:
    from retainpdf_pipeline.translate.artifacts.status import has_repaired_translation_artifact

    diagnostics = dict(item.get("translation_diagnostics") or {})
    if has_repaired_translation_artifact(item, diagnostics):
        return True
    return str(diagnostics.get("degradation_reason", "") or "") == "typst_math_repaired"


def _is_exhausted_residue_candidate(item: dict, issues: list[TranslationQualityIssue]) -> bool:
    if not issues or not all(issue.kind in RESIDUE_ISSUE_KINDS for issue in issues):
        return False
    diagnostics = dict(item.get("translation_diagnostics") or {})
    return str(diagnostics.get("degradation_reason", "") or "") in RESIDUE_EXHAUSTED_DEGRADATION_REASONS


def _is_group_member_item(item: dict) -> bool:
    if str(item.get("continuation_group", "") or "").strip():
        return True
    unit_id = str(item.get("translation_unit_id", "") or "")
    return unit_id.startswith("group:")


def _should_skip_policy_keep_origin_item(item: dict) -> bool:
    return should_skip_model_by_policy(item)


def _record_agent_repair_skip(item: dict, reason: str, issues: list[TranslationQualityIssue]) -> None:
    record_translation_diagnostics(
        item,
        "agent_repair",
        {
            "agent_repair_skipped": True,
            "agent_repair_skip_reason": reason,
            "agent_repair_issue_kinds": [issue.kind for issue in issues],
        },
    )


def _record_agent_repair_failure(item: dict, exc: Exception) -> None:
    record_translation_diagnostics(
        item,
        "agent_repair",
        {
            "agent_repair_failed": True,
            "agent_repair_error_type": type(exc).__name__,
            "agent_repair_error": str(exc),
        },
    )


def _validate_repair_result(item: dict, repaired_text: str) -> list[TranslationQualityIssue]:
    item_id = str(item.get("item_id", "") or "")
    review = review_translation_item(
        item,
        {
            "decision": "translate",
            "translated_text": repaired_text,
        },
    )
    return [
        issue
        for issue in review.issues
        if issue.item_id == item_id and issue.severity == "error"
    ]


def _record_agent_repair_rejected(item: dict, issues: list[TranslationQualityIssue]) -> None:
    record_translation_diagnostics(
        item,
        "agent_repair",
        {
            "agent_repair_failed": True,
            "agent_repair_error_type": "RepairValidationError",
            "agent_repair_error": "Repair output failed translation quality validation.",
            "agent_repair_issue_kinds": [issue.kind for issue in issues],
            "agent_repair_issues": [issue.as_dict() for issue in issues],
        },
    )


__all__ = [
    "AgentRepairPipelineResult",
    "BLOCKING_REPAIR_ISSUE_KINDS",
    "run_agent_repair_pipeline",
]

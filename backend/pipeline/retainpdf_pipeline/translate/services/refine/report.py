"""精修报告 artifacts/refine_report.v1.json（schema refine_report_v1）。

契约：contracts/refine-report.v1.schema.json（backend/contracts/ 下有字节一致的镜像）。
Rust 原样转发（GET /api/v1/jobs/:job_id/translation/refine-report），终端 agent 读它向用户呈现。
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime
from datetime import timezone
from pathlib import Path
from typing import Any

from retainpdf_pipeline.foundation.config.output_layout import ARTIFACTS_DIR_NAME
from retainpdf_pipeline.services.pipeline_shared.io import save_json_atomic
from retainpdf_pipeline.translate.services.refine.review import CATEGORIES
from retainpdf_pipeline.translate.services.refine.review import SEVERITIES


REFINE_REPORT_FILE_NAME = "refine_report.v1.json"
REFINE_REPORT_SCHEMA = "refine_report_v1"
REFINE_REPORT_SCHEMA_VERSION = 1

STATUS_COMPLETED = "completed"
STATUS_STOPPED = "stopped"
STATUS_FAILED = "failed"

STOP_MAX_ITEMS = "max_items"
STOP_MAX_TOKENS = "max_tokens"
STOP_LLM_UNAVAILABLE = "llm_unavailable"
STOP_LLM_ERROR = "llm_error"
STOP_ERROR = "error"


def refine_report_path(job_root: Path) -> Path:
    return Path(job_root) / ARTIFACTS_DIR_NAME / REFINE_REPORT_FILE_NAME


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def findings_summary(findings: list[dict[str, Any]]) -> dict[str, Any]:
    by_category = Counter(finding["category"] for finding in findings)
    by_severity = Counter(finding["severity"] for finding in findings)
    by_origin = Counter(finding["origin"] for finding in findings)
    matrix: dict[str, dict[str, int]] = {}
    for finding in findings:
        matrix.setdefault(finding["category"], {severity: 0 for severity in SEVERITIES})
        matrix[finding["category"]][finding["severity"]] += 1
    return {
        "finding_count": len(findings),
        "item_count": len({finding["item_id"] for finding in findings}),
        "by_category": {category: by_category.get(category, 0) for category in CATEGORIES},
        "by_severity": {severity: by_severity.get(severity, 0) for severity in SEVERITIES},
        "by_origin": {origin: by_origin.get(origin, 0) for origin in ("review", "qa")},
        "by_category_and_severity": matrix,
    }


def fixes_summary(fixes: list[dict[str, Any]]) -> dict[str, Any]:
    by_status = Counter(fix["status"] for fix in fixes)
    reject_reasons = Counter(fix["reject_reason"] for fix in fixes if fix["status"] == "rejected")
    skip_reasons = Counter(fix["reject_reason"] for fix in fixes if fix["status"] == "skipped")
    attempted = by_status.get("applied", 0) + by_status.get("rejected", 0)
    return {
        "item_count": len(fixes),
        "applied": by_status.get("applied", 0),
        "rejected": by_status.get("rejected", 0),
        "skipped": by_status.get("skipped", 0),
        # 拒绝率 = 被确定性检查否决的 / 模型真的给了编辑的。高说明挑错或修改在瞎报。
        "rejection_rate": round(by_status.get("rejected", 0) / attempted, 4) if attempted else None,
        "reject_reasons": dict(sorted(reject_reasons.items())),
        "skip_reasons": dict(sorted(skip_reasons.items())),
    }


def qa_summary(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None
    summary = payload.get("summary") or {}
    return {
        "violation_count": int(summary.get("violation_count", 0) or 0),
        "by_severity": dict(summary.get("by_severity") or {}),
        "by_check": dict(summary.get("by_check") or {}),
        "items_with_violations": int(summary.get("items_with_violations", 0) or 0),
        "clean_unit_rate": summary.get("clean_unit_rate"),
    }


def _violation_identity(violation: dict[str, Any]) -> tuple[str, str, str, str]:
    location = violation.get("location") or {}
    return (
        str(location.get("item_id", "") or ""),
        str(violation.get("check", "") or ""),
        str(violation.get("type", "") or ""),
        str(violation.get("severity", "") or ""),
    )


def qa_delta(before: dict[str, Any] | None, after: dict[str, Any] | None, *, item_ids: set[str]) -> dict[str, Any]:
    """只比被精修改过的块：哪些违规消失了、哪些是新出现的。"""
    if not isinstance(before, dict) or not isinstance(after, dict):
        return {"resolved": [], "introduced": []}

    def _keys(payload: dict[str, Any]) -> Counter:
        counter: Counter = Counter()
        for violation in payload.get("violations") or []:
            identity = _violation_identity(violation)
            if identity[0] in item_ids:
                counter[identity] += 1
        return counter

    before_keys, after_keys = _keys(before), _keys(after)

    def _rows(left: Counter, right: Counter) -> list[dict[str, Any]]:
        rows = []
        for key, count in sorted(left.items()):
            missing = count - right.get(key, 0)
            if missing > 0:
                rows.append({"item_id": key[0], "check": key[1], "type": key[2], "severity": key[3], "count": missing})
        return rows

    return {"resolved": _rows(before_keys, after_keys), "introduced": _rows(after_keys, before_keys)}


def write_refine_report(job_root: Path, payload: dict[str, Any]) -> Path:
    path = refine_report_path(job_root)
    save_json_atomic(path, payload)
    return path


__all__ = [
    "REFINE_REPORT_FILE_NAME",
    "REFINE_REPORT_SCHEMA",
    "REFINE_REPORT_SCHEMA_VERSION",
    "STATUS_COMPLETED",
    "STATUS_FAILED",
    "STATUS_STOPPED",
    "STOP_ERROR",
    "STOP_LLM_ERROR",
    "STOP_LLM_UNAVAILABLE",
    "STOP_MAX_ITEMS",
    "STOP_MAX_TOKENS",
    "findings_summary",
    "fixes_summary",
    "now_iso",
    "qa_delta",
    "qa_summary",
    "refine_report_path",
    "write_refine_report",
]

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


REFINE_HISTORY_DIR_NAME = "refine_history"

STOP_LABELS = {
    STOP_MAX_ITEMS: "达到块数上限",
    STOP_MAX_TOKENS: "达到用量上限",
    STOP_LLM_UNAVAILABLE: "没有可用的模型",
    STOP_LLM_ERROR: "模型调用都失败了",
    STOP_ERROR: "出错",
}


def coverage(scoped: list[Any], reviewed_ids: set[str]) -> dict[str, Any]:
    """挑错覆盖了多少：没审到的块数，以及没审到的第一页（1-based；全审到为 None）。

    没审到的包括：超出上限没轮到的、所在的批调用失败的。从 ``next_page`` 接着精修
    （retry-stage refine 的 start_page）就能补上。
    """
    unreviewed = [item for item in scoped if item.item_id not in reviewed_ids]
    return {
        "unreviewed_item_count": len(unreviewed),
        "next_page": unreviewed[0].page_number if unreviewed else None,
    }


def done_message(report: dict[str, Any]) -> str:
    """进度里给人看的一句结果；没审完时说清楚停在哪、为什么。"""
    review = report["review"]
    found = review["summary"]["finding_count"]
    fixes = report["fix_summary"]
    tail = f"发现 {found} 处，采纳 {fixes['applied']}，拒绝 {fixes['rejected']}，跳过 {fixes['skipped']}"
    next_page = review.get("next_page")
    if report.get("status") == STATUS_FAILED:
        return f"精修出错，没有做完：{tail}"
    if next_page:
        reason = STOP_LABELS.get(report.get("stopped_reason"), "没有审完")
        total = review.get("candidate_item_count", 0)
        done = total - review.get("unreviewed_item_count", 0)
        return f"精修只审到第 {next_page} 页之前（{reason}，审了 {done}/{total} 块），可以从第 {next_page} 页接着精修：{tail}"
    return f"精修完成：{tail}"


def write_refine_report(job_root: Path, payload: dict[str, Any]) -> Path:
    """写这次的报告；上一次的挪进 refine_history/（接着精修、重复精修时不丢前面的结果）。"""
    path = refine_report_path(job_root)
    if path.is_file():
        history = path.parent / REFINE_HISTORY_DIR_NAME
        history.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        path.replace(history / f"refine_report-{stamp}.v1.json")
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

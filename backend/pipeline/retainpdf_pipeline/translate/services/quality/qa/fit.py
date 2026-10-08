"""排版 fit 报告里的溢出块、应急档块。

fit_report.v1.json 由渲染侧生成（另一个模块），字段先按约定假定为每块：
item_id、page、final_font_size、base_font_size、scale、emergency_tier、overflow、
overflow_chars_estimate。文件不存在就整项 skipped，并在报告里注明原因。

翻译阶段内联生成 QA 时渲染还没跑，这一项必然是 skipped；渲染之后用离线子命令重算即可带上。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from retainpdf_pipeline.translate.services.quality.qa.models import QaViolation
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MAJOR
from retainpdf_pipeline.translate.services.quality.qa.models import SEVERITY_MINOR
from retainpdf_pipeline.translate.services.quality.qa.models import excerpt
from retainpdf_pipeline.translate.services.quality.qa.units import QaItem


CHECK_LAYOUT_FIT = "layout_fit"
FIT_REPORT_FILE_NAME = "fit_report.v1.json"
_FIT_REPORT_RELATIVE_CANDIDATES = (
    Path("artifacts") / FIT_REPORT_FILE_NAME,
    Path("rendered") / FIT_REPORT_FILE_NAME,
    Path("artifacts") / "render" / FIT_REPORT_FILE_NAME,
)


def locate_fit_report(job_root: Path | None) -> Path | None:
    if job_root is None:
        return None
    for relative in _FIT_REPORT_RELATIVE_CANDIDATES:
        candidate = job_root / relative
        if candidate.is_file():
            return candidate
    for candidate in sorted(job_root.glob(f"*/{FIT_REPORT_FILE_NAME}")) + sorted(
        job_root.glob(f"*/*/{FIT_REPORT_FILE_NAME}")
    ):
        if candidate.is_file():
            return candidate
    return None


def _entries(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [entry for entry in payload if isinstance(entry, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("items", "blocks", "entries"):
        value = payload.get(key)
        if isinstance(value, list):
            return [entry for entry in value if isinstance(entry, dict)]
    pages = payload.get("pages")
    if isinstance(pages, list):
        collected: list[dict] = []
        for page in pages:
            if isinstance(page, dict):
                collected.extend(_entries(page))
        return collected
    return []


def _truthy_tier(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    text = str(value or "").strip().lower()
    return bool(text) and text not in {"0", "false", "none", "no", "off", "normal"}


def _as_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def check_fit_report(
    fit_report_path: Path | None,
    items_by_id: dict[str, QaItem],
) -> tuple[dict[str, Any], list[QaViolation]]:
    if fit_report_path is None or not fit_report_path.is_file():
        return {
            "status": "skipped",
            "reason": f"{FIT_REPORT_FILE_NAME} 不存在（渲染尚未生成 fit 报告）",
            "path": str(fit_report_path) if fit_report_path else "",
        }, []
    try:
        payload = json.loads(fit_report_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return {
            "status": "skipped",
            "reason": f"{FIT_REPORT_FILE_NAME} 无法解析：{type(exc).__name__}",
            "path": str(fit_report_path),
        }, []
    report_status = str(payload.get("status", "ok") or "ok") if isinstance(payload, dict) else "ok"
    if report_status != "ok":
        # failed / unavailable：渲染侧没量出来，不能拿它判溢出。
        return {
            "status": "skipped",
            "reason": f"{FIT_REPORT_FILE_NAME} 状态为 {report_status}",
            "path": str(fit_report_path),
        }, []
    entries = _entries(payload)
    violations: list[QaViolation] = []
    overflow_count = 0
    emergency_count = 0
    scales: list[float] = []
    for entry in entries:
        item_id = str(entry.get("item_id", "") or "")
        item = items_by_id.get(item_id)
        scale = _as_float(entry.get("scale"))
        if scale is not None:
            scales.append(scale)
        # measured=false 的块没有真正量过，不判溢出。
        overflow = bool(entry.get("overflow")) and entry.get("measured", True) is not False
        emergency = _truthy_tier(entry.get("emergency_tier")) or str(entry.get("tier", "") or "") == "emergency"
        if emergency:
            emergency_count += 1
        if not overflow and not emergency:
            continue
        page_number = int(_as_float(entry.get("page")) or (item.page_number if item else 0))
        fit_evidence = {
            key: entry.get(key)
            for key in (
                "final_font_size",
                "base_font_size",
                "scale",
                "emergency_tier",
                "overflow",
                "overflow_chars_estimate",
                "overflow_pt",
                "tier",
                "measured",
            )
            if key in entry
        }
        fit_evidence["translation_excerpt"] = excerpt(item.translated) if item else ""
        if overflow:
            overflow_count += 1
            violations.append(
                QaViolation(
                    check=CHECK_LAYOUT_FIT,
                    type="layout_overflow",
                    severity=SEVERITY_MAJOR,
                    message="译文在版面中放不下，文字溢出文本框",
                    item_ids=[item_id],
                    page_number=page_number,
                    block_idx=item.block_idx if item else -1,
                    unit_id=item.unit_id if item else "",
                    scope="item",
                    evidence=fit_evidence,
                )
            )
        else:
            violations.append(
                QaViolation(
                    check=CHECK_LAYOUT_FIT,
                    type="layout_emergency_tier",
                    severity=SEVERITY_MINOR,
                    message="译文进入应急缩字档，字号明显小于基准",
                    item_ids=[item_id],
                    page_number=page_number,
                    block_idx=item.block_idx if item else -1,
                    unit_id=item.unit_id if item else "",
                    scope="item",
                    evidence=fit_evidence,
                )
            )
    scales.sort()
    summary: dict[str, Any] = {
        "status": "ok",
        "path": str(fit_report_path),
        "entry_count": len(entries),
        "overflow_count": overflow_count,
        "emergency_tier_count": emergency_count,
    }
    if scales:
        summary["scale_min"] = round(scales[0], 4)
        summary["scale_median"] = round(scales[len(scales) // 2], 4)
    return summary, violations


__all__ = [
    "CHECK_LAYOUT_FIT",
    "FIT_REPORT_FILE_NAME",
    "check_fit_report",
    "locate_fit_report",
]

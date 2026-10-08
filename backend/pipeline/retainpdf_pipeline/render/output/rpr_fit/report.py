"""rpr_fit 引擎报告（rpr_fit_report_v1）→ fit_report_v1。

- base = 引擎的种子字号（retain-pdf 的几何估算），final = 引擎测量后定下的字号；
- tier：final 明显小于种子（scale < 0.995）记 shrink，否则 base；这条路线没有应急档；
- overflow：文字超出自己框底的部分（引擎允许在不碰任何东西时伸进下方空白，照实报）；
- source.measurement = "rpr_fit_engine"；碰撞（文字互叠、压住保留元素 / 矢量图形）与公式
  统计放进新增的 collisions / math / invariants，summary 也带上这几项。
"""

from __future__ import annotations

from retainpdf_pipeline.render.output.typst.fit_report import OVERFLOW_TOLERANCE_PT
from retainpdf_pipeline.render.output.typst.fit_report import SHRUNK_SCALE_THRESHOLD
from retainpdf_pipeline.render.output.typst.fit_report import build_fit_report_payload

FIT_REPORT_MEASUREMENT_RPR_FIT = "rpr_fit_engine"
RPR_FIT_REPORT_SCHEMA = "rpr_fit_report_v1"


def _float(value, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number == number else default


def build_fit_entries(report: dict) -> list[dict]:
    entries: list[dict] = []
    for block in report.get("blocks") or []:
        final = _float(block.get("final_font_size"))
        base = _float(block.get("seed_font_size"), final) or final
        scale = round(final / base, 4) if base > 0 else 1.0
        overflow_pt = _float(block.get("overflow_pt"))
        entries.append(
            {
                "item_id": str(block.get("item_id") or block.get("id") or ""),
                "page": int(_float(block.get("page"))) + 1,
                "block_id": str(block.get("id") or ""),
                "kind": str(block.get("kind") or ""),
                "measured": True,
                "base_font_size": round(base, 2),
                "final_font_size": round(final, 2),
                "min_font_size": None,
                "scale": scale,
                "tier": "shrink" if scale < SHRUNK_SCALE_THRESHOLD else "base",
                "emergency_tier": False,
                "fit_mode": "measured",
                "overflow": overflow_pt > OVERFLOW_TOLERANCE_PT,
                "overflow_pt": round(overflow_pt, 3),
                "overflow_right_pt": round(_float(block.get("overflow_right_pt")), 3),
                "overflow_chars_estimate": 0,
                "needed_height_pt": None,
                "available_height_pt": None,
                "final_leading_em": None,
                "text_chars": 0,
                "lines": int(_float(block.get("lines"))),
                "stop_reason": block.get("stop_reason"),
            }
        )
    return entries


def build_rpr_fit_fit_report_payload(report: dict, *, render_path: str, engine_elapsed_seconds: float) -> dict:
    payload = build_fit_report_payload(
        build_fit_entries(report),
        render_path=render_path,
        probe_elapsed_seconds=engine_elapsed_seconds,
    )
    invariants = dict(report.get("invariants") or {})
    math_report = report.get("math") or {}
    failed = list(math_report.get("failed") or [])
    payload["source"] = {
        **payload.get("source", {}),
        "measurement": FIT_REPORT_MEASUREMENT_RPR_FIT,
        "engine": dict(report.get("engine") or {}),
        "engine_report_schema": str(report.get("schema") or ""),
        "timings": dict(report.get("timings") or {}),
    }
    payload["collisions"] = list(report.get("collisions") or [])
    payload["math"] = {"formulas": int(_float(math_report.get("formulas"))), "failed": failed}
    payload["invariants"] = invariants
    payload["body_font"] = dict(report.get("body_font") or {})
    payload["summary"].update(
        {
            "text_collisions": int(_float(invariants.get("line_overlaps"))),
            "obstacle_collisions": int(_float(invariants.get("obstacle_hits"))) + int(_float(invariants.get("vector_hits"))),
            "math_formulas": int(_float(math_report.get("formulas"))),
            "math_failed": len(failed),
        }
    )
    return payload


__all__ = [
    "FIT_REPORT_MEASUREMENT_RPR_FIT",
    "RPR_FIT_REPORT_SCHEMA",
    "build_fit_entries",
    "build_rpr_fit_fit_report_payload",
]

"""rpr 引擎报告 ``rpr_retain_report_v1`` → 排版 fit 报告 ``fit_report_v1``。

同一 schema、同一字段，渲染后的翻译 QA 不用改：

- 每个译文块一条（目录、保留行盒拆出的多个引擎块按译文块聚合：base 取最大、final 取最小、
  溢出任一即溢出）；引擎报告里没有的块 ``measured=false``；
- ``tier`` 保持 v1 的 base / shrink / emergency 语义，取引擎的 ``shrink_tier``（引擎复刻了
  single_line 的应急档）；引擎的缩字方式 fixed / fit / single_line 放进新增字段 ``fit_mode``；
  ``emergency_tier = shrink_tier == "emergency"``；``scale = final / base``；
- 溢出：引擎判溢出且超出量大于 0.5pt（与 Typst 探针同一容差），或出了页面；缺字估计优先用
  引擎给的 ``overflow_chars_estimate``；
- ``source.measurement = "rpr_engine"``；引擎版本、耗时、公式失败放进 ``source.engine``；
- 额外的 ``collisions``（文字互压、压住保留元素）是新增可选字段，v1 读方按宽松读取忽略它。
"""

from __future__ import annotations

import math

from retainpdf_pipeline.render.output.rpr.input_builder import BRANCH_LINE_BOXES
from retainpdf_pipeline.render.output.rpr.input_builder import BRANCH_TOC
from retainpdf_pipeline.render.output.rpr.input_builder import RprBuiltInput
from retainpdf_pipeline.render.output.rpr.input_builder import item_id_for_block_id
from retainpdf_pipeline.render.output.typst.fit_report import OVERFLOW_TOLERANCE_PT
from retainpdf_pipeline.render.output.typst.fit_report import SHRUNK_SCALE_THRESHOLD
from retainpdf_pipeline.render.output.typst.fit_report import _visible_chars
from retainpdf_pipeline.render.output.typst.fit_report import build_fit_report_payload

RPR_REPORT_SCHEMA = "rpr_retain_report_v1"
FIT_REPORT_MEASUREMENT_RPR = "rpr_engine"


def _float(value, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) else default


def _round(value: float | None, digits: int = 3) -> float | None:
    if value is None or not math.isfinite(float(value)):
        return None
    return round(float(value), digits)


def _optional_round(value, digits: int) -> float | None:
    if value is None:
        return None
    return _round(_float(value), digits)


def _overflow_chars(text_chars: int, overflow_pt: float, needed_pt: float) -> int:
    if text_chars <= 0:
        return 0
    if needed_pt > 0 and overflow_pt > 0:
        return max(1, min(text_chars, math.ceil(text_chars * overflow_pt / needed_pt)))
    return 1


def _shrink_tier(record: dict, *, base: float, final: float) -> str:
    tier = str(record.get("shrink_tier") or "").strip().lower()
    if tier in {"base", "shrink", "emergency"}:
        return tier
    return "shrink" if base > 0 and final / base < SHRUNK_SCALE_THRESHOLD else "base"


def _engine_block_overflow(record: dict) -> tuple[bool, float]:
    overflow_pt = max(0.0, _float(record.get("overflow_pt")))
    overflow_right = max(0.0, _float(record.get("overflow_right_pt")))
    outside = bool(record.get("outside_page"))
    flagged = bool(record.get("overflow")) or outside
    over = flagged and (outside or overflow_pt > OVERFLOW_TOLERANCE_PT or overflow_right > OVERFLOW_TOLERANCE_PT)
    return over, overflow_pt


def _input_blocks_by_id(built: RprBuiltInput) -> dict[str, dict]:
    return {
        block["id"]: block
        for page in built.payload.get("pages", [])
        for block in page.get("blocks", [])
    }


def build_fit_entries(built: RprBuiltInput, report: dict, *, page_specs) -> list[dict]:
    records_by_id: dict[str, dict] = {}
    for record in report.get("blocks") or []:
        if isinstance(record, dict) and record.get("id") is not None:
            records_by_id[str(record["id"])] = record
    input_blocks = _input_blocks_by_id(built)
    engine_ids_by_owner: dict[tuple[int, str], list[str]] = {}
    for engine_id, owner in built.engine_block_owner.items():
        engine_ids_by_owner.setdefault(owner, []).append(engine_id)

    entries: list[dict] = []
    for page_offset, spec in enumerate(page_specs):
        for layout_block in spec.blocks:
            key = (page_offset, layout_block.block_id)
            block = built.layout_blocks.get(key)
            branch = built.block_branches.get(key, "")
            engine_ids = engine_ids_by_owner.get(key, [])
            text_source = block.plain_text if block is not None and block.render_kind in {"plain", "plain_line"} else (
                (block.markdown_text or block.plain_text) if block is not None else ""
            )
            entry: dict = {
                "item_id": item_id_for_block_id(layout_block.block_id),
                "page": spec.page_index + 1,
                "block_id": layout_block.block_id,
                "kind": "toc" if branch == BRANCH_TOC else ("lines" if branch == BRANCH_LINE_BOXES else branch),
                "measured": False,
                "base_font_size": _round(layout_block.font_size_pt, 2),
                "final_font_size": _round(layout_block.font_size_pt, 2),
                "min_font_size": None,
                "scale": 1.0,
                "tier": "base",
                "emergency_tier": False,
                "fit_mode": "",
                "overflow": False,
                "overflow_pt": 0.0,
                "overflow_chars_estimate": 0,
                "needed_height_pt": None,
                "available_height_pt": None,
                "final_leading_em": None,
                "text_chars": _visible_chars(text_source),
            }
            records = [records_by_id[engine_id] for engine_id in engine_ids if engine_id in records_by_id]
            if not records:
                entries.append(entry)
                continue
            bases: list[float] = []
            finals: list[float] = []
            mins: list[float] = []
            fit_modes: list[str] = []
            shrink_tiers: list[str] = []
            at_min = False
            overflow_any = False
            worst_overflow = -math.inf
            worst: dict = records[0]
            missing = 0
            for record in records:
                engine_id = str(record.get("id"))
                input_block = input_blocks.get(engine_id, {})
                base = _float(record.get("base_font_size"), _float(input_block.get("font_size_pt")))
                final = _float(record.get("final_font_size"), base)
                bases.append(base)
                finals.append(final)
                fit = input_block.get("fit") or {}
                fallback_min = _float(fit.get("min_font_size_pt"), base) if fit.get("mode") != "fixed" else base
                mins.append(_float(record.get("min_font_size"), fallback_min))
                fit_modes.append(str(record.get("tier") or ""))
                shrink_tiers.append(_shrink_tier(record, base=base, final=final))
                at_min = at_min or bool(record.get("at_min"))
                over, overflow_pt = _engine_block_overflow(record)
                if over:
                    overflow_any = True
                    if record.get("overflow_chars_estimate") is not None:
                        missing += max(1, int(_float(record.get("overflow_chars_estimate"))))
                    else:
                        record_chars = int(_float(record.get("text_chars"))) or _visible_chars(
                            str(input_block.get("text") or "")
                        )
                        missing += _overflow_chars(record_chars, overflow_pt, _float(record.get("needed_height_pt")))
                if overflow_pt > worst_overflow:
                    worst_overflow = overflow_pt
                    worst = record
            base = max(bases) if bases else 0.0
            final = min(finals) if finals else base
            scale = min((f / b for f, b in zip(finals, bases) if b > 0), default=1.0)
            unique_modes = sorted({mode for mode in fit_modes if mode})
            emergency = "emergency" in shrink_tiers
            entry.update(
                {
                    "measured": True,
                    "base_font_size": _round(base, 2),
                    "final_font_size": _round(final, 2),
                    "min_font_size": _round(min(mins), 2) if mins else None,
                    "scale": _round(scale, 4),
                    "tier": "emergency" if emergency else ("shrink" if "shrink" in shrink_tiers else "base"),
                    "emergency_tier": emergency,
                    "fit_mode": unique_modes[0] if len(unique_modes) == 1 else ("mixed" if unique_modes else ""),
                    "at_min": at_min,
                    "overflow": overflow_any,
                    "overflow_pt": _round(max(0.0, worst_overflow), 2),
                    "overflow_chars_estimate": int(missing),
                    "needed_height_pt": _optional_round(worst.get("needed_height_pt"), 2),
                    "available_height_pt": _optional_round(worst.get("available_height_pt"), 2),
                    "final_leading_em": (
                        _round(_float(worst.get("final_leading_em")), 3)
                        if len(records) == 1 and worst.get("final_leading_em") is not None
                        else None
                    ),
                    "lines": sum(int(_float(record.get("lines"))) for record in records),
                    "engine_blocks": len(engine_ids),
                }
            )
            entries.append(entry)
    return entries


def _collisions(built: RprBuiltInput, report: dict, *, page_specs) -> list[dict]:
    out: list[dict] = []
    for collision in report.get("collisions") or []:
        if not isinstance(collision, dict):
            continue
        item = dict(collision)
        page = collision.get("page")
        try:
            page_offset = int(page)
        except (TypeError, ValueError):
            page_offset = -1
        if 0 <= page_offset < len(page_specs):
            item["source_page"] = page_specs[page_offset].page_index + 1
        for side in ("a", "b"):
            owner = built.engine_block_owner.get(str(collision.get(side)))
            if owner is not None:
                item[f"{side}_item_id"] = item_id_for_block_id(owner[1])
        out.append(item)
    return out


def build_rpr_fit_report_payload(
    built: RprBuiltInput,
    report: dict,
    *,
    page_specs,
    render_path: str,
    engine_elapsed_seconds: float,
    engine_version: str = "",
) -> dict:
    entries = build_fit_entries(built, report, page_specs=page_specs)
    payload = build_fit_report_payload(
        entries,
        render_path=render_path,
        probe_elapsed_seconds=engine_elapsed_seconds,
    )
    engine_info = dict(report.get("engine") or {})
    if engine_version and not engine_info.get("version"):
        engine_info["version"] = engine_version
    payload["source"] = {
        **payload.get("source", {}),
        "measurement": FIT_REPORT_MEASUREMENT_RPR,
        "engine": engine_info,
        "engine_report_schema": str(report.get("schema") or ""),
        "timings": dict(report.get("timings") or {}),
    }
    collisions = _collisions(built, report, page_specs=page_specs)
    math_report = report.get("math") or {}
    failed_math = list(math_report.get("failed") or [])
    payload["collisions"] = collisions
    payload["math"] = {"formulas": int(_float(math_report.get("formulas"))), "failed": failed_math}
    payload["summary"].update(
        {
            "text_collisions": sum(1 for item in collisions if item.get("kind") == "text"),
            "obstacle_collisions": sum(
                1 for item in collisions if item.get("kind") == "obstacle" and not item.get("insideOwnBox")
            ),
            "math_formulas": int(_float(math_report.get("formulas"))),
            "math_failed": len(failed_math),
        }
    )
    return payload


__all__ = [
    "FIT_REPORT_MEASUREMENT_RPR",
    "RPR_REPORT_SCHEMA",
    "build_fit_entries",
    "build_rpr_fit_report_payload",
]

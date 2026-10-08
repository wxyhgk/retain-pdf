"""排版 fit 报告：每个译文块最终用了多大字号、有没有进应急档、有没有溢出。

只出报告，不改排版。数据来自 fit_probe（Typst 探针），和正式渲染用的是同一套缩字算法、
同一套字体，所以字号是 Typst 实际选定的值，不是 Python 端的估算。

开关是一个上下文作用域：渲染阶段入口用 ``fit_report_scope(path)`` 指定报告写到哪里，
output 层在整本编译成功后调用 ``record_*_fit_report``。没有作用域时 record 直接返回，
不跑探针——单页预览、编译失败后的定位探测、测试等调用路径都不受影响。

任何异常都只记日志、写一份 status=failed 的报告，不向上抛：报告失败不能让渲染失败。
"""

from __future__ import annotations

import contextlib
import contextvars
import json
import math
import re
import time
from dataclasses import dataclass
from dataclasses import field
from datetime import datetime
from datetime import timezone
from pathlib import Path
from typing import Iterator

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import paths
from retainpdf_pipeline.render.layout.model.block_view import layout_block_to_render_block
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.payload.blocks import build_render_blocks
from retainpdf_pipeline.render.output.typst.fit_probe import FIT_PROBE_HELPERS_PAGE_SPEC
from retainpdf_pipeline.render.output.typst.fit_probe import FIT_PROBE_HELPERS_RENDER_BLOCK
from retainpdf_pipeline.render.output.typst.fit_probe import FitProbeBlock
from retainpdf_pipeline.render.output.typst.fit_probe import FitProbePage
from retainpdf_pipeline.render.output.typst.fit_probe import run_fit_probe
from retainpdf_pipeline.services.pipeline_shared.io import save_json_atomic

FIT_REPORT_FILE_NAME = "fit_report.v1.json"
FIT_REPORT_SCHEMA = "fit_report_v1"
FIT_REPORT_SCHEMA_VERSION = 1
FIT_REPORT_ARTIFACT_KEY = "fit_report_json"
FIT_REPORT_STATUS_OK = "ok"
FIT_REPORT_STATUS_FAILED = "failed"
FIT_REPORT_STATUS_UNAVAILABLE = "unavailable"
# 文字高度超出可用框不到半个点的，视觉上看不出来，不算溢出。
OVERFLOW_TOLERANCE_PT = 0.5
# 缩小比例低于这个值才算「缩过字」，避开浮点误差。
SHRUNK_SCALE_THRESHOLD = 0.995


@dataclass
class FitReportTarget:
    path: Path
    recorded: bool = False
    status: str = ""
    summary: dict = field(default_factory=dict)
    elapsed_seconds: float = 0.0
    # 渲染路线附加说明（例如 rpr 引擎回退到 Typst 的原因），写进报告的 reason
    reason_note: str = ""


_FIT_REPORT_TARGET: contextvars.ContextVar[FitReportTarget | None] = contextvars.ContextVar(
    "retainpdf_fit_report_target",
    default=None,
)


@contextlib.contextmanager
def fit_report_scope(path: Path | None) -> Iterator[FitReportTarget | None]:
    if path is None:
        yield None
        return
    target = FitReportTarget(path=Path(path))
    token = _FIT_REPORT_TARGET.set(target)
    try:
        yield target
    finally:
        _FIT_REPORT_TARGET.reset(token)


def active_fit_report_target() -> FitReportTarget | None:
    return _FIT_REPORT_TARGET.get()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _round(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    if not math.isfinite(value):
        return None
    return round(float(value), digits)


_LATEX_COMMAND_RE = re.compile(r"\\[A-Za-z]+|\\.")
_MARKUP_CHARS = set("${}^_*`")


def _visible_chars(text: str) -> int:
    """粗略的「可见字符数」：去掉 LaTeX 命令名和 Markdown / 公式标记符，避免把源码长度
    当成字数（`\\tilde{\\omega}_e` 显示出来只有两个字符）。"""
    stripped = _LATEX_COMMAND_RE.sub("", str(text or ""))
    return sum(1 for char in stripped if not char.isspace() and char not in _MARKUP_CHARS)


def _block_text(block: RenderBlock) -> str:
    if block.render_kind in {"plain", "plain_line"}:
        return block.plain_text
    return block.markdown_text or block.plain_text


def _record_text(block: RenderBlock, fit_id: str) -> str:
    _, _, suffix = fit_id.partition("/l")
    if suffix.isdigit():
        line_boxes = block.preserved_line_boxes or []
        index = int(suffix)
        if 0 <= index < len(line_boxes):
            return line_boxes[index].text
    return _block_text(block)


def _float(record: dict, key: str) -> float:
    try:
        value = float(record.get(key) or 0.0)
    except (TypeError, ValueError):
        return 0.0
    return value if math.isfinite(value) else 0.0


def estimate_overflow_chars(record: dict, *, text_chars: int) -> int:
    """估算还要删掉多少字符才能放下（最终字号下）。

    natural_w 是整段排成一行的总长，line_h 是单行高；框里放得下 fit_lines 行，就能容纳
    fit_lines × region_w 的行长，超出的行长按平均字宽折算成字符数。换行时行尾总有空白，
    所以这是下界；按高度判定溢出、按行长又算不出缺口时，至少记 1。
    """
    if text_chars <= 0:
        return 0
    natural_w = _float(record, "natural_w")
    line_h = _float(record, "line_h")
    region_w = _float(record, "region_w")
    region_h = _float(record, "region_h")
    needed_h = _float(record, "needed_h")
    if natural_w > 0 and line_h > 0 and region_w > 0:
        gap = max(0.0, _float(record, "leading") * _float(record, "final"))
        fit_lines = max(0, math.floor((region_h + gap + OVERFLOW_TOLERANCE_PT) / (line_h + gap)))
        overflow_w = natural_w - fit_lines * region_w
        if overflow_w > 0:
            return max(1, min(text_chars, math.ceil(text_chars * overflow_w / natural_w)))
        return 1
    if needed_h > 0:
        # 缺自然行长时退回按高度比例估算
        return max(1, math.ceil(text_chars * (needed_h - region_h) / needed_h))
    return 1


def _record_overflow(record: dict, *, text_chars: int) -> tuple[float, int]:
    overflow_pt = _float(record, "needed_h") - _float(record, "region_h")
    if overflow_pt <= OVERFLOW_TOLERANCE_PT:
        return max(0.0, overflow_pt), 0
    return overflow_pt, estimate_overflow_chars(record, text_chars=text_chars)


def build_block_fit_entry(probe_block: FitProbeBlock, records: list[dict], *, source_block_id: str = "") -> dict:
    block = probe_block.block
    text_chars = _visible_chars(_block_text(block))
    entry: dict = {
        "item_id": probe_block.item_id,
        "page": probe_block.page_index + 1,
        "block_id": source_block_id,
        "kind": "toc" if block.toc_entries else "",
        "measured": False,
        "base_font_size": _round(block.font_size_pt, 2),
        "final_font_size": _round(block.font_size_pt, 2),
        "min_font_size": None,
        "scale": 1.0,
        "tier": "base",
        "emergency_tier": False,
        "overflow": False,
        "overflow_pt": 0.0,
        "overflow_chars_estimate": 0,
        "needed_height_pt": None,
        "available_height_pt": None,
        "final_leading_em": None,
        "text_chars": text_chars,
    }
    if not records:
        return entry
    worst_overflow_pt = -math.inf
    worst_record: dict = records[0]
    min_scale = math.inf
    finals: list[float] = []
    bases: list[float] = []
    mins: list[float] = []
    missing_total = 0
    overflow_any = False
    emergency_any = False
    shrink_any = False
    for record in records:
        base = float(record.get("base") or 0.0)
        final = float(record.get("final") or 0.0)
        bases.append(base)
        finals.append(final)
        mins.append(float(record.get("min") or 0.0))
        if base > 0:
            min_scale = min(min_scale, final / base)
        tier = str(record.get("tier") or "base")
        emergency_any = emergency_any or tier == "emergency"
        shrink_any = shrink_any or tier == "shrink"
        record_chars = _visible_chars(_record_text(block, str(record.get("id") or "")))
        overflow_pt, missing = _record_overflow(record, text_chars=record_chars)
        if overflow_pt > OVERFLOW_TOLERANCE_PT:
            overflow_any = True
        missing_total += missing
        if overflow_pt > worst_overflow_pt:
            worst_overflow_pt = overflow_pt
            worst_record = record
    kinds = {str(record.get("kind") or "") for record in records}
    entry["kind"] = "lines" if len(records) > 1 else (kinds.pop() if kinds else "")
    entry["measured"] = True
    entry["base_font_size"] = _round(max(bases), 2)
    entry["final_font_size"] = _round(min(finals), 2)
    entry["min_font_size"] = _round(min(mins), 2)
    entry["scale"] = _round(min_scale if math.isfinite(min_scale) else 1.0, 4)
    entry["tier"] = "emergency" if emergency_any else ("shrink" if shrink_any else "base")
    entry["emergency_tier"] = emergency_any
    entry["overflow"] = overflow_any
    entry["overflow_pt"] = _round(max(0.0, worst_overflow_pt), 2)
    entry["overflow_chars_estimate"] = int(missing_total)
    entry["needed_height_pt"] = _round(worst_record.get("needed_h"), 2)
    entry["available_height_pt"] = _round(worst_record.get("region_h"), 2)
    entry["final_leading_em"] = _round(worst_record.get("leading"), 3) if len(records) == 1 else None
    return entry


def _summarize(entries: list[dict]) -> dict:
    measured = [entry for entry in entries if entry.get("measured")]
    scales = [float(entry["scale"]) for entry in measured if entry.get("scale") is not None]
    overflow_entries = [entry for entry in entries if entry.get("overflow")]
    emergency_entries = [entry for entry in entries if entry.get("emergency_tier")]
    return {
        "blocks": len(entries),
        "measured_blocks": len(measured),
        "shrunk_blocks": sum(1 for scale in scales if scale < SHRUNK_SCALE_THRESHOLD),
        "emergency_blocks": len(emergency_entries),
        "overflow_blocks": len(overflow_entries),
        "overflow_chars_estimate": sum(int(entry.get("overflow_chars_estimate") or 0) for entry in entries),
        "mean_scale": _round(sum(scales) / len(scales), 4) if scales else None,
        "min_scale": _round(min(scales), 4) if scales else None,
        "min_final_font_size": _round(
            min((float(entry["final_font_size"]) for entry in measured), default=math.nan),
            2,
        ),
    }


def build_fit_report_payload(
    entries: list[dict],
    *,
    render_path: str,
    probe_elapsed_seconds: float = 0.0,
    status: str = FIT_REPORT_STATUS_OK,
    reason: str = "",
) -> dict:
    pages: dict[int, list[dict]] = {}
    for entry in entries:
        pages.setdefault(int(entry["page"]), []).append(entry)
    page_summaries = [{"page": page, **_summarize(page_entries)} for page, page_entries in sorted(pages.items())]
    summary = _summarize(entries)
    summary["pages"] = len(page_summaries)
    summary["pages_with_overflow"] = sum(1 for page in page_summaries if page["overflow_blocks"] > 0)
    summary["overflow_item_ids"] = [entry["item_id"] for entry in entries if entry.get("overflow")]
    summary["emergency_item_ids"] = [entry["item_id"] for entry in entries if entry.get("emergency_tier")]
    return {
        "schema": FIT_REPORT_SCHEMA,
        "schema_version": FIT_REPORT_SCHEMA_VERSION,
        "status": status,
        "reason": reason,
        "generated_at": _now_iso(),
        "source": {
            "render_path": render_path,
            "measurement": "typst_probe",
            "probe_elapsed_seconds": _round(probe_elapsed_seconds, 3),
        },
        "params": {
            "overflow_tolerance_pt": OVERFLOW_TOLERANCE_PT,
            "shrunk_scale_threshold": SHRUNK_SCALE_THRESHOLD,
        },
        "summary": summary,
        "pages": page_summaries,
        "blocks": entries,
    }


def empty_fit_report_payload(*, status: str, reason: str, render_path: str = "") -> dict:
    return build_fit_report_payload([], render_path=render_path, status=status, reason=reason)


def _write_report(target: FitReportTarget, payload: dict, *, elapsed: float) -> dict:
    if target.reason_note:
        payload = {**payload, "reason": _join_reason(payload.get("reason", ""), target.reason_note)}
    save_json_atomic(target.path, payload)
    target.recorded = True
    target.status = str(payload.get("status") or "")
    target.summary = {key: value for key, value in payload.get("summary", {}).items() if not key.endswith("_item_ids")}
    target.elapsed_seconds = elapsed
    return {
        "fit_report_path": str(target.path),
        "fit_report_status": target.status,
        "fit_report_elapsed_seconds": round(elapsed, 3),
        "fit_report_summary": dict(target.summary),
    }


def _record_probe_pages(
    pages: list[FitProbePage],
    *,
    render_path: str,
    work_dir: Path,
    font_family: str,
    font_paths: list[Path] | None,
    helpers: str,
) -> dict:
    target = active_fit_report_target()
    if target is None:
        return {}
    started = time.perf_counter()
    try:
        result = run_fit_probe(
            pages,
            work_dir=work_dir,
            font_family=font_family,
            font_paths=font_paths,
            helpers=helpers,
        )
        source_ids = [source_id for page in pages for source_id, _ in page.blocks]
        entries = [
            build_block_fit_entry(probe_block, result.records.get(probe_block.key, []), source_block_id=source_id)
            for probe_block, source_id in zip(result.blocks, source_ids)
        ]
        payload = build_fit_report_payload(
            entries,
            render_path=render_path,
            probe_elapsed_seconds=result.elapsed_seconds,
        )
    except Exception as exc:  # noqa: BLE001 - 报告失败不能让渲染失败
        print(f"fit report: failed {type(exc).__name__}: {exc}", flush=True)
        payload = empty_fit_report_payload(
            status=FIT_REPORT_STATUS_FAILED,
            reason=f"{type(exc).__name__}: {str(exc)[:500]}",
            render_path=render_path,
        )
    elapsed = time.perf_counter() - started
    try:
        diagnostics = _write_report(target, payload, elapsed=elapsed)
    except Exception as exc:  # noqa: BLE001
        print(f"fit report: write failed {type(exc).__name__}: {exc}", flush=True)
        return {"fit_report_status": FIT_REPORT_STATUS_FAILED, "fit_report_error": f"{type(exc).__name__}: {exc}"}
    summary = payload.get("summary", {})
    print(
        "fit report: "
        f"status={payload.get('status')} blocks={summary.get('blocks', 0)} "
        f"shrunk={summary.get('shrunk_blocks', 0)} emergency={summary.get('emergency_blocks', 0)} "
        f"overflow={summary.get('overflow_blocks', 0)} elapsed={elapsed:.2f}s",
        flush=True,
    )
    return diagnostics


def record_render_pages_fit_report(
    page_specs: list[RenderPageSpec],
    *,
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> dict:
    """typst_visual 整本渲染（emitter.build_typst_source_from_page_specs）对应的报告。"""
    if active_fit_report_target() is None:
        return {}
    try:
        pages = [
            FitProbePage(
                page_index=spec.page_index,
                page_width_pt=spec.page_width_pt,
                page_height_pt=spec.page_height_pt,
                blocks=[
                    (f"rp{page_offset}_{block.block_id}_{block_index}", layout_block_to_render_block(block))
                    for block_index, block in enumerate(spec.blocks)
                ],
            )
            for page_offset, spec in enumerate(page_specs)
        ]
    except Exception as exc:  # noqa: BLE001
        return _record_failure(f"{type(exc).__name__}: {exc}", render_path="typst_visual")
    return _record_probe_pages(
        pages,
        render_path="typst_visual",
        work_dir=work_dir,
        font_family=font_family,
        font_paths=font_paths,
        helpers=FIT_PROBE_HELPERS_PAGE_SPEC,
    )


def overlay_fit_probe_work_dir(temp_root: Path | None) -> Path:
    return (temp_root or paths.OUTPUT_DIR) / "fit-probe"


def record_overlay_pages_fit_report(
    page_specs: list[tuple],
    *,
    work_dir: Path,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
) -> dict:
    """整本 overlay 渲染（source_pages.build_book_overlay_source_lines）对应的报告。

    page_specs 是 overlay_book.build_overlay_page_specs 的产物：
    (page_idx, page_width, page_height, translated_items, stem)。
    """
    if active_fit_report_target() is None:
        return {}
    try:
        pages: list[FitProbePage] = []
        for page_offset, spec in enumerate(page_specs):
            page_idx, page_width, page_height, items = spec[0], spec[1], spec[2], spec[3]
            # build_render_blocks 会给没 seed 过的 item 写字段；拷一份，别动渲染用的数据。
            blocks = build_render_blocks(
                [dict(item) for item in items],
                page_width=page_width,
                page_height=page_height,
            )
            pages.append(
                FitProbePage(
                    page_index=int(page_idx),
                    page_width_pt=float(page_width),
                    page_height_pt=float(page_height),
                    blocks=[
                        (f"p{page_offset}_{block.block_id}_{block_index}", block)
                        for block_index, block in enumerate(blocks)
                    ],
                )
            )
    except Exception as exc:  # noqa: BLE001
        return _record_failure(f"{type(exc).__name__}: {exc}", render_path="book_overlay")
    return _record_probe_pages(
        pages,
        render_path="book_overlay",
        work_dir=work_dir,
        font_family=font_family,
        font_paths=font_paths,
        helpers=FIT_PROBE_HELPERS_RENDER_BLOCK,
    )


def _record_failure(reason: str, *, render_path: str) -> dict:
    target = active_fit_report_target()
    if target is None:
        return {}
    print(f"fit report: failed {reason}", flush=True)
    try:
        return _write_report(
            target,
            empty_fit_report_payload(status=FIT_REPORT_STATUS_FAILED, reason=reason[:500], render_path=render_path),
            elapsed=0.0,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"fit report: write failed {type(exc).__name__}: {exc}", flush=True)
        return {}


def _join_reason(reason: str, note: str) -> str:
    parts = [part for part in (str(reason or "").strip(), str(note or "").strip()) if part]
    return "; ".join(parts)


def record_fit_report_payload(payload: dict, *, elapsed: float = 0.0) -> dict:
    """外部量好的报告（rpr 引擎）直接写进当前作用域。没有作用域时什么都不做。"""
    target = active_fit_report_target()
    if target is None:
        return {}
    try:
        return _write_report(target, payload, elapsed=elapsed)
    except Exception as exc:  # noqa: BLE001
        print(f"fit report: write failed {type(exc).__name__}: {exc}", flush=True)
        return {"fit_report_status": FIT_REPORT_STATUS_FAILED, "fit_report_error": f"{type(exc).__name__}: {exc}"}


def note_fit_report_reason(note: str) -> None:
    """给本次渲染的报告 reason 附一句说明。已写出的报告就地改；还没写的，之后写出时带上。"""
    target = active_fit_report_target()
    if target is None or not str(note or "").strip():
        return
    target.reason_note = _join_reason(target.reason_note, note)
    if not target.recorded:
        return
    try:
        payload = json.loads(target.path.read_text(encoding="utf-8"))
        payload["reason"] = _join_reason(payload.get("reason", ""), note)
        save_json_atomic(target.path, payload)
    except Exception as exc:  # noqa: BLE001
        print(f"fit report: annotate failed {type(exc).__name__}: {exc}", flush=True)


def finalize_fit_report_target(target: FitReportTarget | None, *, reason: str) -> None:
    """作用域结束时还没写过报告（逐页降级、Word 等不走整本 Typst 的路径），写一份
    status=unavailable 的报告盖掉上一次渲染留下的旧报告，免得下游读到过期数据。"""
    if target is None or target.recorded:
        return
    try:
        _write_report(
            target,
            empty_fit_report_payload(status=FIT_REPORT_STATUS_UNAVAILABLE, reason=reason),
            elapsed=0.0,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"fit report: write failed {type(exc).__name__}: {exc}", flush=True)


__all__ = [
    "FIT_REPORT_ARTIFACT_KEY",
    "FIT_REPORT_FILE_NAME",
    "FIT_REPORT_SCHEMA",
    "FIT_REPORT_SCHEMA_VERSION",
    "FIT_REPORT_STATUS_FAILED",
    "FIT_REPORT_STATUS_OK",
    "FIT_REPORT_STATUS_UNAVAILABLE",
    "OVERFLOW_TOLERANCE_PT",
    "FitReportTarget",
    "active_fit_report_target",
    "build_block_fit_entry",
    "build_fit_report_payload",
    "empty_fit_report_payload",
    "finalize_fit_report_target",
    "fit_report_scope",
    "note_fit_report_reason",
    "record_fit_report_payload",
    "overlay_fit_probe_work_dir",
    "record_overlay_pages_fit_report",
    "record_render_pages_fit_report",
]

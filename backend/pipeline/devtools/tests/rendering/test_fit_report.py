"""排版 fit 报告（fit_report.v1.json）。

纯逻辑部分用手写的探针记录断言字段；needs_typst 的用例真跑一遍 Typst 探针，覆盖
放得下 / 需要缩字 / 进入应急档 / 溢出四种情况。另外守住一条底线：正式渲染的 Typst 源码
不能因为 fit 报告多出任何东西。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from devtools.tests.rendering.mitex_probe import TYPST_BIN
from retainpdf_pipeline.render.layout.model.models import RenderBlock
from retainpdf_pipeline.render.output.typst import fit_report as fit_report_module
from retainpdf_pipeline.render.output.typst.block_renderer import build_typst_block
from retainpdf_pipeline.render.output.typst.fit_helpers import page_spec_fit_helpers
from retainpdf_pipeline.render.output.typst.fit_helpers import render_block_fit_helpers
from retainpdf_pipeline.render.output.typst.fit_probe import FIT_PROBE_HELPERS_PAGE_SPEC
from retainpdf_pipeline.render.output.typst.fit_probe import FIT_PROBE_HELPERS_RENDER_BLOCK
from retainpdf_pipeline.render.output.typst.fit_probe import FitProbeBlock
from retainpdf_pipeline.render.output.typst.fit_probe import FitProbePage
from retainpdf_pipeline.render.output.typst.fit_probe import run_fit_probe
from retainpdf_pipeline.render.output.typst.fit_report import FIT_REPORT_FILE_NAME
from retainpdf_pipeline.render.output.typst.fit_report import build_block_fit_entry
from retainpdf_pipeline.render.output.typst.fit_report import build_fit_report_payload
from retainpdf_pipeline.render.output.typst.fit_report import fit_report_scope
from retainpdf_pipeline.render.output.typst.fit_report import record_render_pages_fit_report
from retainpdf_pipeline.render.workflow.fit_report import render_fit_report_scope

LONG_TEXT = "这是一个需要缩小字号才能放进框里的中文段落，用来测试排版拟合。" * 3


def _block(
    item_id: str,
    *,
    text: str,
    width: float,
    height: float,
    font_size: float = 10.0,
    fit_to_box: bool = False,
    fit_single_line: bool = False,
    fit_min_font_size: float = 0.0,
) -> RenderBlock:
    rect = [20.0, 20.0, 20.0 + width, 20.0 + height]
    return RenderBlock(
        block_id=f"item-{item_id}",
        bbox=list(rect),
        cover_bbox=list(rect),
        inner_bbox=list(rect),
        markdown_text=text,
        plain_text=text,
        render_kind="markdown",
        font_size_pt=font_size,
        leading_em=0.5,
        fit_to_box=fit_to_box,
        fit_single_line=fit_single_line,
        fit_min_font_size_pt=fit_min_font_size,
        fit_min_leading_em=0.5,
        source_item_id=item_id,
    )


def _probe_block(block: RenderBlock, page_index: int = 0) -> FitProbeBlock:
    return FitProbeBlock(key="k0", page_index=page_index, item_id=block.source_item_id, block=block)


def _record(**overrides) -> dict:
    record = {
        "id": "k0",
        "kind": "markdown",
        "base": 10.0,
        "min": 8.0,
        "final": 10.0,
        "leading": 0.5,
        "tier": "base",
        "natural_w": 120.0,
        "line_h": 8.0,
        "needed_h": 20.0,
        "allowed_h": 40.0,
        "region_w": 200.0,
        "region_h": 40.0,
    }
    record.update(overrides)
    return record


# ---------------------------------------------------------------- 正式渲染不变


def test_production_typst_source_has_no_probe_markup() -> None:
    helpers = "\n".join(page_spec_fit_helpers() + render_block_fit_helpers())
    assert "fit_id" not in helpers
    assert "metadata" not in helpers
    for block in (
        _block("p001-b001", text="短句。", width=200, height=40, fit_to_box=True, fit_min_font_size=8),
        _block("p001-b002", text=LONG_TEXT, width=200, height=12, fit_to_box=True, fit_single_line=True),
        _block("p001-b003", text=LONG_TEXT, width=100, height=12),
    ):
        source = build_typst_block("b0", block, include_fill=True)
        assert "fit_id" not in source
        assert "pdftr_fit_emit" not in source


def test_probe_typst_source_tags_every_kind_of_block() -> None:
    fit = build_typst_block(
        "b0",
        _block("p001-b001", text="短句。", width=200, height=40, fit_to_box=True, fit_min_font_size=8),
        fit_probe_id="k0",
    )
    assert 'fit_id: "k0"' in fit
    fixed = build_typst_block("b1", _block("p001-b002", text=LONG_TEXT, width=100, height=12), fit_probe_id="k1")
    assert 'pdftr_fit_emit("k1", "fixed"' in fixed


# ---------------------------------------------------------------- 字段（不跑 Typst）


def test_entry_fits_at_base_size() -> None:
    block = _block("p003-b004", text="短句。", width=200, height=40, fit_to_box=True)
    entry = build_block_fit_entry(_probe_block(block, page_index=2), [_record()], source_block_id="rp0_x_0")
    assert entry["item_id"] == "p003-b004"
    assert entry["page"] == 3
    assert entry["final_font_size"] == 10.0
    assert entry["base_font_size"] == 10.0
    assert entry["scale"] == 1.0
    assert entry["emergency_tier"] is False
    assert entry["overflow"] is False
    assert entry["overflow_chars_estimate"] == 0
    assert entry["measured"] is True


def test_entry_shrunk_within_box() -> None:
    block = _block("p001-b001", text=LONG_TEXT, width=200, height=40, fit_to_box=True)
    entry = build_block_fit_entry(_probe_block(block), [_record(final=8.5, tier="shrink", needed_h=39.0)])
    assert entry["final_font_size"] == 8.5
    assert entry["scale"] == 0.85
    assert entry["tier"] == "shrink"
    assert entry["emergency_tier"] is False
    assert entry["overflow"] is False


def test_entry_emergency_tier() -> None:
    block = _block("p001-b001", text=LONG_TEXT, width=200, height=12, fit_to_box=True)
    entry = build_block_fit_entry(_probe_block(block), [_record(final=5.2, tier="emergency", needed_h=11.0, region_h=12.0)])
    assert entry["emergency_tier"] is True
    assert entry["tier"] == "emergency"
    assert entry["final_font_size"] == 5.2
    assert entry["scale"] == 0.52
    assert entry["overflow"] is False


def test_entry_overflow_estimates_missing_chars() -> None:
    # 10 个字排成一行 100pt 宽，框宽 60pt、只放得下一行 → 后 40pt（约 4 个字）放不下
    block = _block("p001-b001", text="或者用矢量记号表示出来", width=60, height=11)
    record = _record(kind="fixed", min=10.0, natural_w=100.0, line_h=10.0, needed_h=25.0, region_w=60.0, region_h=11.0)
    entry = build_block_fit_entry(_probe_block(block), [record])
    assert entry["overflow"] is True
    assert entry["overflow_pt"] == 14.0
    assert entry["overflow_chars_estimate"] == 5  # ceil(11 * 40 / 100)
    assert entry["emergency_tier"] is False
    assert entry["scale"] == 1.0


def test_overflow_within_tolerance_is_not_reported() -> None:
    block = _block("p001-b001", text="短句。", width=60, height=11)
    entry = build_block_fit_entry(_probe_block(block), [_record(needed_h=11.3, region_h=11.0)])
    assert entry["overflow"] is False
    assert entry["overflow_chars_estimate"] == 0


def test_visible_chars_ignore_latex_source() -> None:
    block = _block("p001-b001", text=r"计算 $\tilde{x}_e$ 和 $\tilde{\omega}_e$。", width=60, height=11)
    entry = build_block_fit_entry(_probe_block(block), [])
    # 计 算 x e 和 ω e 。 → 去掉 \tilde、\omega 等命令名，只剩可见字符
    assert entry["text_chars"] == 7
    assert entry["measured"] is False


def test_line_records_aggregate_into_one_block() -> None:
    block = _block("p001-b001", text="图 5.8", width=60, height=11)
    records = [
        _record(id="k0/l0", kind="single_line", base=40.0, min=20.0, final=12.0, tier="emergency"),
        _record(id="k0/l1", kind="single_line", base=10.0, min=8.0, final=10.0, tier="base"),
    ]
    entry = build_block_fit_entry(_probe_block(block), records)
    assert entry["kind"] == "lines"
    assert entry["base_font_size"] == 40.0
    assert entry["final_font_size"] == 10.0
    assert entry["scale"] == 0.3
    assert entry["emergency_tier"] is True


def test_page_and_book_summary() -> None:
    entries = [
        {"item_id": "a", "page": 1, "measured": True, "scale": 1.0, "final_font_size": 10.0, "overflow": False, "emergency_tier": False, "overflow_chars_estimate": 0},
        {"item_id": "b", "page": 1, "measured": True, "scale": 0.5, "final_font_size": 5.0, "overflow": True, "emergency_tier": True, "overflow_chars_estimate": 7},
        {"item_id": "c", "page": 2, "measured": True, "scale": 0.9, "final_font_size": 9.0, "overflow": False, "emergency_tier": False, "overflow_chars_estimate": 0},
    ]
    payload = build_fit_report_payload(entries, render_path="typst_visual")
    assert payload["schema"] == "fit_report_v1"
    assert payload["status"] == "ok"
    summary = payload["summary"]
    assert summary["blocks"] == 3
    assert summary["shrunk_blocks"] == 2
    assert summary["emergency_blocks"] == 1
    assert summary["overflow_blocks"] == 1
    assert summary["overflow_chars_estimate"] == 7
    assert summary["mean_scale"] == 0.8
    assert summary["min_scale"] == 0.5
    assert summary["pages"] == 2
    assert summary["pages_with_overflow"] == 1
    assert summary["overflow_item_ids"] == ["b"]
    assert summary["emergency_item_ids"] == ["b"]
    assert [page["page"] for page in payload["pages"]] == [1, 2]
    assert payload["pages"][0]["overflow_blocks"] == 1
    assert payload["pages"][1]["mean_scale"] == 0.9


# ---------------------------------------------------------------- 作用域与失败隔离


def test_record_is_noop_without_scope(monkeypatch, tmp_path: Path) -> None:
    def explode(*_args, **_kwargs):
        raise AssertionError("没有作用域时不该跑探针")

    monkeypatch.setattr(fit_report_module, "run_fit_probe", explode)
    assert record_render_pages_fit_report([], work_dir=tmp_path) == {}


def test_probe_failure_writes_failed_report_instead_of_raising(monkeypatch, tmp_path: Path) -> None:
    def explode(*_args, **_kwargs):
        raise RuntimeError("typst exploded")

    monkeypatch.setattr(fit_report_module, "run_fit_probe", explode)
    report_path = tmp_path / FIT_REPORT_FILE_NAME
    with fit_report_scope(report_path):
        diagnostics = record_render_pages_fit_report([], work_dir=tmp_path)
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    assert payload["status"] == "failed"
    assert "typst exploded" in payload["reason"]
    assert payload["blocks"] == []
    assert diagnostics["fit_report_status"] == "failed"


def test_stage_scope_marks_render_without_report_unavailable(tmp_path: Path) -> None:
    report_path = tmp_path / FIT_REPORT_FILE_NAME
    report_path.write_text('{"status": "ok", "blocks": [{"stale": true}]}', encoding="utf-8")
    with render_fit_report_scope(tmp_path) as target:
        assert target is not None
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    assert payload["status"] == "unavailable"
    assert payload["blocks"] == []


def test_stage_scope_keeps_render_exception(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        with render_fit_report_scope(tmp_path):
            raise ValueError("render failed")
    payload = json.loads((tmp_path / FIT_REPORT_FILE_NAME).read_text(encoding="utf-8"))
    assert payload["status"] == "unavailable"
    assert payload["reason"] == "render_failed"


def test_stage_scope_without_artifacts_dir_is_disabled() -> None:
    with render_fit_report_scope(None) as target:
        assert target is None


# ---------------------------------------------------------------- 真跑 Typst


_skip_without_typst = pytest.mark.skipif(not TYPST_BIN, reason="没有可用的 typst 二进制")


def needs_typst(test):
    return pytest.mark.needs_typst(_skip_without_typst(test))


def _run_probe(tmp_path: Path, blocks: list[RenderBlock], helpers: str) -> dict[str, dict]:
    page = FitProbePage(
        page_index=0,
        page_width_pt=400.0,
        page_height_pt=400.0,
        blocks=[(f"rp0_{block.block_id}_{index}", block) for index, block in enumerate(blocks)],
    )
    result = run_fit_probe([page], work_dir=tmp_path, helpers=helpers)
    entries = [
        build_block_fit_entry(probe_block, result.records.get(probe_block.key, []))
        for probe_block in result.blocks
    ]
    return {entry["item_id"]: entry for entry in entries}


@needs_typst
@pytest.mark.parametrize("helpers", [FIT_PROBE_HELPERS_PAGE_SPEC, FIT_PROBE_HELPERS_RENDER_BLOCK])
def test_typst_probe_reports_four_fit_outcomes(tmp_path: Path, helpers: str) -> None:
    entries = _run_probe(
        tmp_path,
        [
            _block("p001-fits", text="短句。", width=200, height=40, fit_to_box=True, fit_min_font_size=8),
            _block("p001-shrink", text=LONG_TEXT, width=200, height=40, fit_to_box=True, fit_min_font_size=5),
            _block(
                "p001-emergency",
                text=LONG_TEXT,
                width=200,
                height=12,
                fit_to_box=True,
                fit_single_line=True,
                fit_min_font_size=8,
            ),
            _block("p001-overflow", text=LONG_TEXT, width=100, height=12),
        ],
        helpers,
    )
    fits = entries["p001-fits"]
    assert fits["measured"] is True
    assert fits["tier"] == "base"
    assert fits["final_font_size"] == fits["base_font_size"] == 10.0
    assert fits["overflow"] is False

    shrink = entries["p001-shrink"]
    assert shrink["tier"] == "shrink"
    assert 5.0 <= shrink["final_font_size"] < 10.0
    assert shrink["scale"] < 1.0
    assert shrink["emergency_tier"] is False
    assert shrink["overflow"] is False

    emergency = entries["p001-emergency"]
    assert emergency["kind"] == "single_line"
    assert emergency["emergency_tier"] is True
    assert emergency["final_font_size"] < 8.0

    overflow = entries["p001-overflow"]
    assert overflow["kind"] == "fixed"
    assert overflow["final_font_size"] == 10.0
    assert overflow["overflow"] is True
    assert overflow["overflow_pt"] > 0
    assert 0 < overflow["overflow_chars_estimate"] <= overflow["text_chars"]


@needs_typst
def test_typst_probe_render_block_markdown_emergency(tmp_path: Path) -> None:
    # 只有整本 overlay 那套 helper 的多行拟合有应急档
    entries = _run_probe(
        tmp_path,
        [_block("p001-tiny", text=LONG_TEXT, width=200, height=12, fit_to_box=True, fit_min_font_size=8)],
        FIT_PROBE_HELPERS_RENDER_BLOCK,
    )
    entry = entries["p001-tiny"]
    assert entry["kind"] == "markdown"
    assert entry["emergency_tier"] is True
    assert entry["final_font_size"] < 8.0

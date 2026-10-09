"""render.engine = "rpr"：输入组装、子进程调用、报告转换、合并、回退。

真引擎（backend/rendering-engine）就绪之前，这里一律用 rendering_support/fake_rpr_engine.py
的假引擎跑，CLI 契约与真引擎相同；不需要 node，也不需要 typst。
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from unittest import mock

import fitz
import pytest

from devtools.tests.pdf_fixtures import write_pdf
from devtools.tests.rendering_support.fake_rpr_engine import FAKE_ENGINE_VERSION
from devtools.tests.rendering_support.fake_rpr_engine import install_fake_rpr_engine
from retainpdf_pipeline.foundation.shared.stage_specs import normalize_render_engine
from retainpdf_pipeline.render.layout.model.models import RenderLayoutBlock
from retainpdf_pipeline.render.layout.model.models import RenderLineBox
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.layout.model.models import RenderTocEntry
from retainpdf_pipeline.render.layout.model.block_view import layout_block_to_render_block
from retainpdf_pipeline.render.output.rpr import engine_cli
from retainpdf_pipeline.render.output.rpr.input_builder import build_rpr_input
from retainpdf_pipeline.render.output.rpr.input_builder import engine_blocks_for_layout_block
from retainpdf_pipeline.render.output.rpr.obstacles import build_obstacles
from retainpdf_pipeline.render.output.rpr.obstacles import obstacles_from_document
from retainpdf_pipeline.render.output.rpr.report import build_rpr_fit_report_payload
from retainpdf_pipeline.render.output.rpr.text import markdown_to_engine_text
from retainpdf_pipeline.render.output.rpr.text import plain_to_engine_text
from retainpdf_pipeline.render.output.typst.fit_report import fit_report_scope
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.engine_dispatch import dispatch_with_render_engine
from retainpdf_pipeline.render.workflow.engine_dispatch import render_engine_summary
from retainpdf_pipeline.translate.services.quality.qa.fit import check_fit_report


def _block(**overrides) -> RenderLayoutBlock:
    values = dict(
        block_id="item-p001-b002",
        page_index=0,
        background_rect=[10.0, 20.0, 190.0, 80.0],
        content_rect=[12.0, 22.0, 200.0, 78.0],
        content_kind="markdown",
        content_text="译文",
        plain_text="译文",
        math_map=[],
        font_size_pt=10.0,
        leading_em=0.56,
        text_color=(0.1, 0.1, 0.1),
        cover_fill=(1.0, 1.0, 0.9),
    )
    values.update(overrides)
    return RenderLayoutBlock(**values)


def _engine_blocks(layout_block: RenderLayoutBlock, *, include_fill: bool = True, box_mode: str = "box"):
    return engine_blocks_for_layout_block(
        layout_block_to_render_block(layout_block),
        engine_prefix="rp0_x_0",
        include_fill=include_fill,
        box_mode=box_mode,
    )


def test_fit_to_box_block_uses_the_routes_box_mode() -> None:
    # typst / typst_visual 用 page-spec 的缩字规则（box），overlay 用 overlay 路线的（box_overlay）；
    # 其余参数完全相同。
    block = _block(fit_to_box=True, fit_min_font_size_pt=8.0, fit_min_leading_em=0.4)
    branch_box, (page_spec,) = _engine_blocks(block)
    branch_overlay, (overlay,) = _engine_blocks(block, box_mode="box_overlay")
    assert branch_box == branch_overlay == "fit_box"
    assert page_spec["fit"]["mode"] == "box"
    assert overlay["fit"]["mode"] == "box_overlay"
    assert {**overlay["fit"], "mode": "box"} == page_spec["fit"]


# ---------------------------------------------------------------- 文本


def test_markdown_to_engine_text_unescapes_and_strips_emphasis() -> None:
    assert markdown_to_engine_text(r"a \* b **粗体** *斜* \_x\_") == "a * b 粗体 斜 _x_"


def test_markdown_to_engine_text_keeps_math_and_literal_dollar() -> None:
    text = markdown_to_engine_text(r"价格 \$5，公式 $a*b \_ c$ 和 $$x^2$$")
    assert text == r"价格 \$5，公式 $a*b \_ c$ 和 $x^2$"


def test_markdown_to_engine_text_soft_and_paragraph_breaks() -> None:
    assert markdown_to_engine_text("第一行\n第二行") == "第一行第二行"
    assert markdown_to_engine_text("first line\nsecond") == "first line second"
    assert markdown_to_engine_text("段一\n\n段二") == "段一\n\n段二"
    assert markdown_to_engine_text("行一\n行二", preserve_line_breaks=True) == "行一\n行二"


def test_markdown_to_engine_text_joins_math_broken_across_lines() -> None:
    assert markdown_to_engine_text("见 $a +\n b$ 式") == "见 $a + b$ 式"


def test_plain_to_engine_text_escapes_dollar_and_keeps_newlines() -> None:
    assert plain_to_engine_text("cost $5\nnext") == "cost \\$5\nnext"


# ---------------------------------------------------------------- 块映射


def test_fixed_block_maps_box_cover_colors_and_justify() -> None:
    branch, blocks = _engine_blocks(
        _block(justify_text=True, first_line_indent_pt=20.0, font_weight="bold", content_text=r"带 $x$ 的 \*正文\*")
    )
    assert branch == "fixed"
    (block,) = blocks
    assert block["id"] == "rp0_x_0"
    assert block["item_id"] == "p001-b002"
    assert block["content_box"] == [12.0, 22.0, 200.0, 78.0]
    # 底色裁到 OCR 擦除框（background_rect）里
    assert block["cover_box"] == [12.0, 22.0, 190.0, 78.0]
    assert block["cover_fill"] == [1.0, 1.0, 0.9]
    assert block["text_color"] == [0.1, 0.1, 0.1]
    assert block["text"] == "带 $x$ 的 *正文*"
    assert block["align"] == "justify"
    assert block["font_weight"] == "bold"
    assert block["first_line_indent_pt"] == 20.0
    assert block["font_size_pt"] == 10.0
    assert block["leading_em"] == 0.56
    assert block["fit"]["mode"] == "fixed"
    # 有公式 → 与 Typst 同一套公式安全 inset
    assert block["inset_top_pt"] > 0 and block["inset_bottom_pt"] > 0


def test_no_cover_when_fill_not_requested() -> None:
    _, (block,) = _engine_blocks(_block(), include_fill=False)
    assert block["cover_box"] is None and block["cover_fill"] is None
    _, (block,) = _engine_blocks(_block(use_cover_fill=True), include_fill=False)
    assert block["cover_box"] is not None


def test_long_inline_math_turns_justify_off() -> None:
    formula = "\\alpha_{1}+" * 20
    _, (block,) = _engine_blocks(
        _block(justify_text=True, content_text=f"说明 ${formula}x$ 结束", content_rect=[12.0, 22.0, 120.0, 78.0])
    )
    assert block["align"] == "left"


def test_fit_box_block_carries_fit_limits() -> None:
    branch, (block,) = _engine_blocks(
        _block(fit_to_box=True, fit_min_font_size_pt=7.5, fit_min_leading_em=0.4, fit_max_height_pt=40.0)
    )
    assert branch == "fit_box"
    assert block["fit"] == {
        "mode": "box",
        "min_font_size_pt": 7.5,
        "max_font_size_pt": 10.0,
        "min_leading_em": 0.4,
        "max_height_pt": 40.0,
        "target_width_pt": None,
        "target_height_pt": None,
    }


def test_single_line_fit_block_uses_target_width_and_shift() -> None:
    branch, (block,) = _engine_blocks(
        _block(
            fit_to_box=True,
            fit_single_line=True,
            fit_min_font_size_pt=8.0,
            fit_max_font_size_pt=14.0,
            fit_target_width_pt=230.0,
            fit_shift_up_pt=3.0,
            content_text="标题",
        )
    )
    assert branch == "fit_single_line"
    assert block["fit"]["mode"] == "single_line"
    assert block["fit"]["max_font_size_pt"] == 14.0
    assert block["font_size_pt"] == 14.0
    assert block["fit"]["min_font_size_pt"] == 8.0
    assert block["content_box"][2] == pytest.approx(12.0 + 230.0)
    assert block["shift_up_pt"] == 3.0
    assert block["align"] == "left"


def test_plain_line_short_is_scaled_to_one_line_and_long_is_fixed() -> None:
    branch, (block,) = _engine_blocks(_block(content_kind="plain_line", plain_text="Fig. 1 $5", content_text="Fig. 1 $5"))
    assert branch == "plain_line_scaled"
    assert block["text"] == "Fig. 1 \\$5"
    assert block["fit"]["mode"] == "single_line" and block["fit"]["min_font_size_pt"] == 1.0
    long_text = "x" * 60
    branch, (block,) = _engine_blocks(_block(content_kind="plain", plain_text=long_text, content_text=long_text))
    assert branch == "plain_fixed" and block["fit"]["mode"] == "fixed"


def test_toc_block_splits_title_and_page_label() -> None:
    entries = [
        RenderTocEntry(title="引言", page_label="1", bbox=[20.0, 100.0, 300.0, 112.0], number="1"),
        RenderTocEntry(title="方法", page_label="", bbox=[20.0, 114.0, 300.0, 126.0], level=2),
    ]
    branch, blocks = _engine_blocks(_block(toc_entries=entries))
    assert branch == "toc_entries"
    assert [block["id"] for block in blocks] == ["rp0_x_0/toc0", "rp0_x_0/toc0p", "rp0_x_0/toc1"]
    assert blocks[0]["text"] == "1 引言"
    assert blocks[1]["text"] == "1"
    assert blocks[1]["content_box"][2] == 300.0
    assert all(block["fit"]["mode"] == "single_line" and block["cover_box"] is None for block in blocks)
    # 二级条目有缩进
    assert blocks[2]["content_box"][0] > 20.0


def test_preserved_line_boxes_become_one_block_per_line() -> None:
    lines = [
        RenderLineBox(text="第一行", bbox=[10.0, 20.0, 150.0, 32.0]),
        RenderLineBox(text="", bbox=[10.0, 33.0, 150.0, 45.0]),
        RenderLineBox(text="第三行", bbox=[10.0, 46.0, 150.0, 58.0]),
    ]
    branch, blocks = _engine_blocks(_block(preserve_line_breaks=True, preserved_line_boxes=lines))
    assert branch == "preserved_line_boxes"
    assert [block["id"] for block in blocks] == ["rp0_x_0/l0", "rp0_x_0/l2"]
    assert [block["text"] for block in blocks] == ["第一行", "第三行"]
    assert all(block["fit"]["mode"] == "single_line" for block in blocks)
    assert blocks[0]["font_size_pt"] == pytest.approx(min(10.0, 12.0 * 0.86), abs=0.01)


def test_preserve_line_breaks_without_boxes_keeps_hard_breaks() -> None:
    branch, (block,) = _engine_blocks(
        _block(preserve_line_breaks=True, content_text="甲\n乙", justify_text=True)
    )
    assert branch == "preserved_line_breaks"
    assert block["text"] == "甲\n乙"
    assert block["align"] == "left"


# ---------------------------------------------------------------- obstacles


def _spec(blocks, *, page_index: int = 0) -> RenderPageSpec:
    return RenderPageSpec(page_index=page_index, page_width_pt=200.0, page_height_pt=300.0, background_pdf_path=None, blocks=blocks)


def test_obstacles_from_document_skip_rendered_blocks_and_classify() -> None:
    document = {
        "schema": "normalized_document_v1",
        "pages": [
            {
                "page_index": 0,
                "blocks": [
                    {"block_id": "p001-b0002", "content": {"kind": "text"}, "bbox": [10, 20, 190, 80]},
                    {"block_id": "p001-b0003", "content": {"kind": "formula"}, "bbox": [30, 90, 150, 110]},
                    {"block_id": "p001-b0004", "content": {"kind": "image"}, "bbox": [10, 120, 190, 200]},
                    {"block_id": "p001-b0005", "content": {"kind": "table"}, "bbox": [10, 210, 190, 250]},
                    {"block_id": "p001-b0006", "content": {"kind": "text"}, "bbox": [10, 5, 190, 15]},
                    {"block_id": "p001-b0007", "content": {"kind": "text"}, "bbox": [0, 0, 0, 0]},
                ],
            },
            {"page_index": 1, "blocks": [{"block_id": "p002-b0001", "content": {"kind": "image"}, "bbox": [1, 1, 5, 5]}]},
        ]
    }
    result = obstacles_from_document(document, [_spec([_block()])])
    assert list(result) == [0]
    assert [(item["id"], item["kind"]) for item in result[0]] == [
        ("p001-b0003", "formula"),
        ("p001-b0004", "figure"),
        ("p001-b0005", "table"),
        ("p001-b0006", "text"),
    ]


def test_obstacles_fall_back_to_translated_items(tmp_path: Path) -> None:
    translated = {
        0: [
            {"item_id": "p001-b002", "block_type": "text", "bbox": [10, 20, 190, 80]},
            {"item_id": "p001-b003", "block_type": "formula", "bbox": [30, 90, 150, 110]},
        ]
    }
    result, source = build_obstacles(
        document_path=tmp_path / "missing.json", translated_pages=translated, page_specs=[_spec([_block()])]
    )
    assert source == "translated_items"
    assert result == {0: [{"id": "p001-b003", "box": [30.0, 90.0, 150.0, 110.0], "kind": "formula"}]}


def test_build_rpr_input_counts_branches_and_obstacles() -> None:
    specs = [
        _spec(
            [
                _block(),
                _block(block_id="item-p001-b005", skip_reason="adjacent_collision_risk", fit_to_box=True),
                _block(block_id="item-p001-b006", content_text=""),
            ]
        )
    ]
    built = build_rpr_input(
        specs,
        font_family="Source Han Serif SC",
        include_fill=True,
        obstacles_by_page={0: [{"id": "p001-b0009", "box": [1, 2, 3, 4], "kind": "formula"}]},
    )
    assert built.payload["schema"] == "rpr_retain_input_v1"
    assert built.payload["font"] == {"family": "Source Han Serif SC"}
    page = built.payload["pages"][0]
    assert page["index"] == 0 and page["width"] == 200.0 and page["height"] == 300.0
    assert len(page["blocks"]) == 3 and len(page["obstacles"]) == 1
    stats = built.stats.as_dict()
    assert stats["layout_blocks"] == 3
    assert stats["branches"] == {"empty_text": 1, "fit_box": 1, "fixed": 1}
    assert stats["skip_reason_blocks"] == {"adjacent_collision_risk": 1}
    assert stats["obstacle_kinds"] == {"formula": 1}


# ---------------------------------------------------------------- 报告


def _report_for(built, *, overflow_ids=(), shrink: dict | None = None, missing=()) -> dict:
    blocks = []
    for page_number, page in enumerate(built.payload["pages"]):
        for block in page["blocks"]:
            if block["id"] in missing:
                continue
            base = block["font_size_pt"]
            final = (shrink or {}).get(block["id"], base)
            over = block["id"] in overflow_ids
            blocks.append(
                {
                    "id": block["id"],
                    "item_id": block["item_id"],
                    "page": page_number,
                    "base_font_size": base,
                    "final_font_size": final,
                    "final_leading_em": 0.5,
                    "lines": 3,
                    "scale": final / base,
                    "tier": "fit" if block["fit"]["mode"] == "box" else block["fit"]["mode"],
                    "at_min": False,
                    "overflow": over,
                    "overflow_pt": 6.0 if over else 0.2,
                    "overflow_right_pt": 0.0,
                    "outside_page": False,
                    "needed_height_pt": 60.0,
                    "available_height_pt": 54.0,
                    "text_chars": 30,
                }
            )
    ids = [block["id"] for block in blocks]
    return {
        "schema": "rpr_retain_report_v1",
        "engine": {"name": "retain-pdf-rendering", "version": "0.2.0", "commit": "abc"},
        "blocks": blocks,
        "collisions": [{"page": 0, "a": ids[0], "b": ids[-1], "kind": "text", "overlap": 1.0, "insideOwnBox": False}],
        "math": {"formulas": 2, "failed": [{"tex": "\\bad", "error": "x"}]},
        "timings": {"totalMs": 5},
    }


def test_report_converts_to_fit_report_v1_and_qa_reads_it(tmp_path: Path) -> None:
    lines = [
        RenderLineBox(text="甲", bbox=[10.0, 20.0, 150.0, 32.0]),
        RenderLineBox(text="乙", bbox=[10.0, 33.0, 150.0, 45.0]),
    ]
    specs = [
        _spec(
            [
                _block(),
                _block(block_id="item-p001-b005", fit_to_box=True, fit_min_font_size_pt=7.0),
                _block(block_id="item-p001-b006", preserve_line_breaks=True, preserved_line_boxes=lines),
                _block(block_id="item-p001-b007"),
            ],
            page_index=3,
        )
    ]
    built = build_rpr_input(specs, font_family="Source Han Serif SC", include_fill=True)
    report = _report_for(
        built,
        overflow_ids={"rp0_item-p001-b002_0"},
        shrink={"rp0_item-p001-b005_1": 8.0, "rp0_item-p001-b006_2/l1": 4.0},
        missing={"rp0_item-p001-b007_3"},
    )
    payload = build_rpr_fit_report_payload(
        built, report, page_specs=specs, render_path="rpr_typst", engine_elapsed_seconds=0.25
    )
    assert payload["schema"] == "fit_report_v1" and payload["status"] == "ok"
    assert payload["source"]["measurement"] == "rpr_engine"
    assert payload["source"]["render_path"] == "rpr_typst"
    assert payload["source"]["engine"]["version"] == "0.2.0"
    entries = {entry["item_id"]: entry for entry in payload["blocks"]}
    assert entries["p001-b002"]["overflow"] is True and entries["p001-b002"]["page"] == 4
    assert entries["p001-b002"]["overflow_chars_estimate"] >= 1
    assert entries["p001-b005"]["tier"] == "shrink"
    assert entries["p001-b005"]["fit_mode"] == "fit"
    assert entries["p001-b002"]["tier"] == "base" and entries["p001-b002"]["fit_mode"] == "fixed"
    assert entries["p001-b005"]["scale"] == pytest.approx(0.8)
    assert entries["p001-b005"]["min_font_size"] == 7.0
    assert entries["p001-b005"]["overflow"] is False  # 0.2pt 在容差内
    assert entries["p001-b006"]["kind"] == "lines" and entries["p001-b006"]["engine_blocks"] == 2
    assert entries["p001-b006"]["final_font_size"] == 4.0
    assert entries["p001-b007"]["measured"] is False
    assert all(entry["emergency_tier"] is False for entry in payload["blocks"])
    assert payload["summary"]["overflow_blocks"] == 1
    assert payload["summary"]["text_collisions"] == 1
    assert payload["summary"]["math_failed"] == 1
    assert payload["collisions"][0]["a_item_id"] == "p001-b002"
    assert payload["collisions"][0]["source_page"] == 4

    path = tmp_path / "fit_report.v1.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    summary, violations = check_fit_report(path, {})
    assert summary["status"] == "ok" and summary["overflow_count"] == 1
    assert [violation.type for violation in violations] == ["layout_overflow"]


def test_report_uses_engine_shrink_tier_and_overflow_estimate(tmp_path: Path) -> None:
    specs = [_spec([_block(fit_to_box=True, fit_single_line=True, fit_min_font_size_pt=8.0)])]
    built = build_rpr_input(specs, font_family="Source Han Serif SC", include_fill=True)
    report = _report_for(built, overflow_ids={"rp0_item-p001-b002_0"}, shrink={"rp0_item-p001-b002_0": 4.4})
    report["blocks"][0].update({"shrink_tier": "emergency", "overflow_chars_estimate": 7, "min_font_size": 4.4})
    payload = build_rpr_fit_report_payload(
        built, report, page_specs=specs, render_path="rpr_overlay", engine_elapsed_seconds=0.1
    )
    (entry,) = payload["blocks"]
    assert entry["tier"] == "emergency" and entry["emergency_tier"] is True
    assert entry["fit_mode"] == "single_line"
    assert entry["overflow_chars_estimate"] == 7
    assert entry["min_font_size"] == 4.4
    assert payload["summary"]["emergency_blocks"] == 1
    path = tmp_path / "fit.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    _, violations = check_fit_report(path, {})
    assert [violation.type for violation in violations] == ["layout_overflow"]


# ---------------------------------------------------------------- 引擎定位与调用


def test_resolve_runtime_with_fake_engine(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    runtime = engine_cli.resolve_engine_runtime()
    assert runtime.node_version == "22.11.0"
    assert runtime.electron_as_node is True
    assert runtime.engine_version == f"{FAKE_ENGINE_VERSION}+0123456789ab"


@pytest.mark.parametrize(
    ("setup", "code"),
    [
        ("node_old", "node_too_old"),
        ("node_missing", "node_not_found"),
        ("no_entry", "engine_not_installed"),
        ("no_mathjax", "engine_dependencies_missing"),
    ],
)
def test_resolve_runtime_reports_why_engine_is_unavailable(tmp_path: Path, monkeypatch, setup: str, code: str) -> None:
    root = install_fake_rpr_engine(tmp_path / "engine", monkeypatch, with_mathjax=setup != "no_mathjax")
    if setup == "node_old":
        monkeypatch.setenv("FAKE_NODE_VERSION", "22.7.9")
    elif setup == "node_missing":
        monkeypatch.setenv("RETAINPDF_NODE_BIN", str(tmp_path / "nope" / "node"))
    elif setup == "no_entry":
        (root / "engine" / "bin" / "rpr-retain.js").unlink()
    with pytest.raises(engine_cli.RprEngineUnavailable) as caught:
        engine_cli.resolve_engine_runtime()
    assert caught.value.code == code


def test_node_on_path_is_used_without_electron_flag(tmp_path: Path, monkeypatch) -> None:
    root = install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.delenv("RETAINPDF_NODE_BIN")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    (bin_dir / "node").symlink_to(root / "fake-node")
    monkeypatch.setenv("PATH", str(bin_dir))
    runtime = engine_cli.resolve_engine_runtime()
    assert runtime.electron_as_node is False
    assert runtime.node == str(bin_dir / "node")


def test_engine_without_fontkit_is_unavailable(tmp_path: Path, monkeypatch) -> None:
    # An older node_modules (mathjax-full only) cannot write the PDF.
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    shutil.rmtree(tmp_path / "engine" / "node_modules" / "fontkit")
    with pytest.raises(engine_cli.RprEngineUnavailable) as excinfo:
        engine_cli.resolve_engine_runtime()
    assert excinfo.value.code == "engine_dependencies_missing"
    assert "fontkit" in str(excinfo.value)


def test_run_engine_writes_the_pdf_itself_with_fonts_and_electron_flag(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    runtime = engine_cli.resolve_engine_runtime()
    built = build_rpr_input([_spec([_block()])], font_family="Source Han Serif SC", include_fill=True)
    input_path = tmp_path / "in.json"
    input_path.write_text(json.dumps(built.payload), encoding="utf-8")
    run = engine_cli.run_engine(runtime, input_path=input_path, out_dir=tmp_path / "out")
    assert run.overlay_pdf.is_file()
    assert run.report["schema"] == "rpr_retain_report_v1"
    argv = json.loads((tmp_path / "out" / "argv.json").read_text(encoding="utf-8"))
    # The engine writes the PDF itself: no Typst involved.
    assert argv["argv"][argv["argv"].index("--output") + 1] == "pdf"
    assert "--typst" not in argv["argv"]
    assert "--font-path" in argv["argv"]
    assert argv["electron_run_as_node"] == "1"


def test_run_engine_typst_output_for_comparison(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv(engine_cli.ENGINE_OUTPUT_ENV_VAR, "typst")
    runtime = engine_cli.resolve_engine_runtime()
    built = build_rpr_input([_spec([_block()])], font_family="Source Han Serif SC", include_fill=True)
    input_path = tmp_path / "in.json"
    input_path.write_text(json.dumps(built.payload), encoding="utf-8")
    engine_cli.run_engine(runtime, input_path=input_path, out_dir=tmp_path / "out")
    argv = json.loads((tmp_path / "out" / "argv.json").read_text(encoding="utf-8"))
    assert argv["argv"][argv["argv"].index("--output") + 1] == "typst"
    assert argv["argv"][argv["argv"].index("--typst") + 1] == "/usr/bin/true"


def test_run_engine_failure_carries_stderr_error(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_EXIT", "3")
    runtime = engine_cli.resolve_engine_runtime()
    input_path = tmp_path / "in.json"
    input_path.write_text(json.dumps({"schema": "rpr_retain_input_v1", "pages": []}), encoding="utf-8")
    with pytest.raises(engine_cli.RprEngineFailed) as caught:
        engine_cli.run_engine(runtime, input_path=input_path, out_dir=tmp_path / "out")
    assert caught.value.code == "engine_error"
    assert "fake engine failure" in str(caught.value)


# ---------------------------------------------------------------- 分流与回退


def _context(tmp_path: Path, **overrides) -> RenderExecutionContext:
    values = dict(output_pdf_path=tmp_path / "out.pdf", start_page=0, end_page=0, render_engine="rpr")
    values.update(overrides)
    return RenderExecutionContext(**values)


def _dispatch(context, *, mode: str = "typst", extract_selected_pages: bool = False, source_pdf_path=Path("/tmp/s.pdf"), translated_pages=None):
    typst_calls: list[str] = []

    def typst_dispatch():
        typst_calls.append(mode)
        return 1, {"mode": mode}

    pages, diagnostics = dispatch_with_render_engine(
        mode=mode,
        source_pdf_path=source_pdf_path,
        translated_pages=translated_pages or {0: []},
        context=context,
        extract_selected_pages=extract_selected_pages,
        typst_dispatch=typst_dispatch,
        compress_final=lambda ctx, label: False,
        fast_save=True,
    )
    return pages, diagnostics, typst_calls


def test_typst_engine_goes_straight_to_typst(tmp_path: Path) -> None:
    with mock.patch("retainpdf_pipeline.render.workflow.engine_dispatch.resolve_engine_runtime") as resolve:
        pages, diagnostics, calls = _dispatch(_context(tmp_path, render_engine="typst"))
    resolve.assert_not_called()
    assert calls == ["typst"] and diagnostics == {"mode": "typst"}
    assert render_engine_summary(requested="typst", diagnostics=diagnostics) == {"requested": "typst", "effective": "typst"}


@pytest.mark.parametrize(
    ("kwargs", "context_overrides", "code"),
    [
        ({"mode": "dual"}, {}, "dual_unsupported"),
        ({"mode": "overlay", "extract_selected_pages": True}, {}, "selected_pages_unsupported"),
        ({"mode": "typst"}, {"typst_font_family": "Noto Sans CJK SC"}, "font_unsupported"),
    ],
)
def test_unsupported_requests_fall_back_to_typst(tmp_path: Path, kwargs, context_overrides, code) -> None:
    with mock.patch("retainpdf_pipeline.render.workflow.engine_dispatch.resolve_engine_runtime") as resolve:
        pages, diagnostics, calls = _dispatch(_context(tmp_path, **context_overrides), **kwargs)
    resolve.assert_not_called()
    assert calls == [kwargs["mode"]]
    assert diagnostics["render_engine"] == "typst"
    assert diagnostics["render_engine_requested"] == "rpr"
    assert diagnostics["render_engine_fallback_reason"] == code
    summary = render_engine_summary(requested="rpr", diagnostics=diagnostics)
    assert summary["effective"] == "typst" and summary["fallback_reason"] == code and summary["warnings"]


def test_unavailable_engine_falls_back_and_notes_fit_report(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_RPR_ENGINE_DIR", str(tmp_path / "missing-engine"))
    report_path = tmp_path / "fit_report.v1.json"
    with fit_report_scope(report_path) as target:
        target.recorded = True
        report_path.write_text(json.dumps({"schema": "fit_report_v1", "status": "ok", "reason": ""}), encoding="utf-8")
        _, diagnostics, calls = _dispatch(_context(tmp_path))
    assert calls == ["typst"]
    assert diagnostics["render_engine_fallback_reason"] == "engine_not_installed"
    assert json.loads(report_path.read_text(encoding="utf-8"))["reason"] == "rpr_fallback:engine_not_installed"


def test_engine_failure_falls_back_before_typst_writes_its_report(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_EXIT", "1")
    source_pdf, translated = _tiny_job(tmp_path)
    with fit_report_scope(tmp_path / "fit.json") as target:
        _, diagnostics, calls = _dispatch(
            _context(tmp_path), mode="overlay", source_pdf_path=source_pdf, translated_pages=translated
        )
        assert target.reason_note == "rpr_fallback:engine_error"
    assert calls == ["overlay"]
    assert diagnostics["render_engine_fallback_reason"] == "engine_error"
    assert "fake engine failure" in diagnostics["render_engine_fallback_message"]


def _tiny_job(tmp_path: Path) -> tuple[Path, dict[int, list[dict]]]:
    source_pdf = tmp_path / "source.pdf"
    doc = fitz.open()
    for index in range(2):
        page = doc.new_page(width=300, height=400)
        page.insert_text((20, 50), f"source text {index}", fontsize=12)
    doc.save(source_pdf)
    doc.close()
    translated = {
        index: [
            {
                "item_id": f"p{index + 1:03d}-b001",
                "page_idx": index,
                "block_type": "text",
                "bbox": [10.0, 30.0, 280.0, 80.0],
                "source_text": f"source text {index}",
                "protected_source_text": f"source text {index}",
                "translated_text": "译文 $x^2$ 正文",
                "protected_translated_text": "译文 $x^2$ 正文",
                "should_translate": True,
            }
        ]
        for index in range(2)
    }
    return source_pdf, translated


@pytest.mark.parametrize("mode", ["overlay", "typst", "typst_visual"])
def test_rpr_route_end_to_end_with_fake_engine(tmp_path: Path, monkeypatch, mode: str) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    source_pdf, translated = _tiny_job(tmp_path)
    document_path = tmp_path / "document.v1.json"
    document_path.write_text(
        json.dumps(
            {
                "schema": "normalized_document_v1",
                "pages": [
                    {
                        "page_index": 0,
                        "blocks": [
                            {"block_id": "p001-b0001", "content": {"kind": "text"}, "bbox": [10, 30, 280, 80]},
                            {"block_id": "p001-b0002", "content": {"kind": "formula"}, "bbox": [50, 100, 200, 130]},
                        ],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    context = _context(tmp_path, end_page=1, document_path=document_path)
    report_path = tmp_path / "artifacts" / "fit_report.v1.json"
    with fit_report_scope(report_path):
        pages, diagnostics, calls = _dispatch(
            context, mode=mode, source_pdf_path=source_pdf, translated_pages=translated
        )
    assert calls == [], diagnostics.get("render_engine_fallback_message")
    assert pages == 2
    assert diagnostics["render_engine"] == "rpr"
    assert diagnostics["rpr_engine_version"] == FAKE_ENGINE_VERSION
    assert diagnostics["rpr_obstacles_source"] == "document_v1"
    assert diagnostics["rpr_input_stats"]["obstacles"] == 1
    output = fitz.open(context.output_pdf_path)
    try:
        assert len(output) == 2
        # 假引擎在每块左上角写了 RPR；叠加层确实合并进了输出
        assert "RPR" in output[0].get_text()
    finally:
        output.close()
    fit_report = json.loads(report_path.read_text(encoding="utf-8"))
    assert fit_report["status"] == "ok"
    assert fit_report["source"]["measurement"] == "rpr_engine"
    assert fit_report["summary"]["blocks"] == 2
    input_payload = json.loads(Path(diagnostics["rpr_work_dir"], "rpr-input.json").read_text(encoding="utf-8"))
    texts = [block["text"] for page in input_payload["pages"] for block in page["blocks"]]
    assert texts and all("$x^2$" in text for text in texts)
    # overlay 用 overlay 路线自己的缩字规则（可进应急档），typst 系用 page-spec 的；
    # 块都按译文条目命名（overlay 原本是 item-<序号>）。
    engine_blocks = [block for page in input_payload["pages"] for block in page["blocks"]]
    fit_modes = {block["fit"]["mode"] for block in engine_blocks}
    assert ("box" if mode == "overlay" else "box_overlay") not in fit_modes, fit_modes
    assert sorted(block["item_id"] for block in engine_blocks) == ["p001-b001", "p002-b001"]
    summary = render_engine_summary(requested="rpr", diagnostics=diagnostics)
    assert summary["effective"] == "rpr" and summary["version"] == FAKE_ENGINE_VERSION


def test_overlay_page_count_mismatch_falls_back(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_PAGES_DELTA", "1")
    source_pdf, translated = _tiny_job(tmp_path)
    _, diagnostics, calls = _dispatch(
        _context(tmp_path, end_page=1), mode="overlay", source_pdf_path=source_pdf, translated_pages=translated
    )
    assert calls == ["overlay"]
    assert diagnostics["render_engine_fallback_reason"] == "engine_output_invalid"


def test_normalize_render_engine() -> None:
    assert normalize_render_engine(None) == "rpr_fit"
    assert normalize_render_engine(" RPR ") == "rpr"
    assert normalize_render_engine(" typst ") == "typst"
    assert normalize_render_engine("bogus") == "rpr_fit"


def test_markdown_to_engine_text_turns_html_scripts_into_inline_math() -> None:
    # cmarker（Typst 路线）认 <sup>/<sub>；引擎只认 $...$，不转会把标签原样印出来。
    assert markdown_to_engine_text("先验<sup>37</sup>相比") == "先验$^{\\text{37}}$相比"
    assert markdown_to_engine_text("速率 3 s<sup>−1</sup>") == "速率 3 s$^{\\text{−1}}$"
    assert markdown_to_engine_text("H<sub>2</sub>O") == "H$_{\\text{2}}$O"
    assert markdown_to_engine_text("x<SUP>a_b</SUP>") == "x$^{\\text{a\\_b}}$"
    assert markdown_to_engine_text("<sup> </sup>空") == "空"
    # 公式里的内容不动
    assert markdown_to_engine_text("$a<sup>b$") == "$a<sup>b$"

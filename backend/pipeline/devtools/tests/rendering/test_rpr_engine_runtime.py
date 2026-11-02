"""rpr 排版引擎的公用部分：找到并调用引擎 CLI（engine_cli）、排版 markdown 转引擎文本（text）、
按 render.engine 分流与回退 Typst。

以前这里是 render.engine = "rpr" 整条路线的测试（输入组装、障碍物、报告转换……），那条路线 2026-11-02 删了，
旧取值按 rpr_fit 处理；rpr_fit 自己的端到端在 test_rpr_fit_route.py。一律用假引擎
（rendering_support/fake_rpr_engine.py），不需要 node，也不需要 typst。
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from unittest import mock

import pytest

from devtools.tests.rendering_support.fake_rpr_engine import FAKE_ENGINE_VERSION
from devtools.tests.rendering_support.fake_rpr_engine import install_fake_rpr_engine
from retainpdf_pipeline.foundation.shared.stage_specs import normalize_render_engine
from retainpdf_pipeline.render.output.rpr import engine_cli
from retainpdf_pipeline.render.output.rpr.text import markdown_to_engine_text
from retainpdf_pipeline.render.output.rpr.text import plain_to_engine_text
from retainpdf_pipeline.render.output.typst.fit_report import fit_report_scope
from retainpdf_pipeline.render.workflow.context import RenderExecutionContext
from retainpdf_pipeline.render.workflow.engine_dispatch import dispatch_with_render_engine
from retainpdf_pipeline.render.workflow.engine_dispatch import render_engine_summary


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


def test_markdown_to_engine_text_turns_html_scripts_into_inline_math() -> None:
    # cmarker（Typst 路线）认 <sup>/<sub>；引擎只认 $...$，不转会把标签原样印出来。
    assert markdown_to_engine_text("先验<sup>37</sup>相比") == "先验$^{\\text{37}}$相比"
    assert markdown_to_engine_text("速率 3 s<sup>−1</sup>") == "速率 3 s$^{\\text{−1}}$"
    assert markdown_to_engine_text("H<sub>2</sub>O") == "H$_{\\text{2}}$O"
    assert markdown_to_engine_text("x<SUP>a_b</SUP>") == "x$^{\\text{a\\_b}}$"
    assert markdown_to_engine_text("<sup> </sup>空") == "空"
    # 公式里的内容不动
    assert markdown_to_engine_text("$a<sup>b$") == "$a<sup>b$"


# ---------------------------------------------------------------- 引擎定位与调用


def _minimal_input(tmp_path: Path) -> Path:
    """rpr_fit 引擎最小的输入：一页、没有块。"""
    input_path = tmp_path / "in.json"
    payload = {
        "schema": "rpr_fit_input_v1",
        "document": {"pages": [{"page_index": 0, "width": 200, "height": 100, "blocks": []}]},
        "translations": [],
        "drawings": {"0": {}},
        "pages": [0],
    }
    input_path.write_text(json.dumps(payload), encoding="utf-8")
    return input_path


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
        (root / "engine" / "bin" / "rpr-fit.js").unlink()
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
    input_path = _minimal_input(tmp_path)
    run = engine_cli.run_engine(runtime, input_path=input_path, out_dir=tmp_path / "out")
    assert run.overlay_pdf.is_file()
    assert run.report["schema"] == "rpr_fit_report_v1"
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
    input_path = _minimal_input(tmp_path)
    engine_cli.run_engine(runtime, input_path=input_path, out_dir=tmp_path / "out")
    argv = json.loads((tmp_path / "out" / "argv.json").read_text(encoding="utf-8"))
    assert argv["argv"][argv["argv"].index("--output") + 1] == "typst"
    assert argv["argv"][argv["argv"].index("--typst") + 1] == "/usr/bin/true"


def test_run_engine_failure_carries_stderr_error(tmp_path: Path, monkeypatch) -> None:
    install_fake_rpr_engine(tmp_path / "engine", monkeypatch)
    monkeypatch.setenv("FAKE_RPR_EXIT", "3")
    runtime = engine_cli.resolve_engine_runtime()
    input_path = tmp_path / "in.json"
    input_path.write_text(json.dumps({"schema": "rpr_fit_input_v1", "pages": []}), encoding="utf-8")
    with pytest.raises(engine_cli.RprEngineFailed) as caught:
        engine_cli.run_engine(runtime, input_path=input_path, out_dir=tmp_path / "out")
    assert caught.value.code == "engine_error"
    assert "fake engine failure" in str(caught.value)


# ---------------------------------------------------------------- 分流与回退


def _context(tmp_path: Path, **overrides) -> RenderExecutionContext:
    values = dict(output_pdf_path=tmp_path / "out.pdf", start_page=0, end_page=0, render_engine="rpr_fit")
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
    assert diagnostics["render_engine_requested"] == "rpr_fit"
    assert diagnostics["render_engine_fallback_reason"] == code
    summary = render_engine_summary(requested="rpr_fit", diagnostics=diagnostics)
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


def test_normalize_render_engine() -> None:
    assert normalize_render_engine(None) == "rpr_fit"
    # 旧取值 rpr（路线 2026-11-02 删了）：接口照旧收，按 rpr_fit 处理
    assert normalize_render_engine(" RPR ") == "rpr_fit"
    assert normalize_render_engine(" typst ") == "typst"
    assert normalize_render_engine("bogus") == "rpr_fit"


def test_the_old_rpr_value_renders_with_rpr_fit(tmp_path: Path) -> None:
    with mock.patch("retainpdf_pipeline.render.workflow.engine_dispatch.resolve_engine_runtime") as resolve:
        resolve.side_effect = engine_cli.RprEngineUnavailable("engine_not_installed", "stop here")
        _, diagnostics, calls = _dispatch(_context(tmp_path, render_engine="rpr"), mode="overlay")
    resolve.assert_called_once_with("rpr-fit.js")
    assert calls == ["overlay"] and diagnostics["render_engine_requested"] == "rpr_fit"

from __future__ import annotations

from concurrent.futures import Future
from pathlib import Path
import subprocess
import sys
from unittest import mock

import fitz
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from retainpdf_pipeline.foundation.config.external_tools import ExternalToolNotFound
from retainpdf_pipeline.render.output.typst import book_renderer
from retainpdf_pipeline.render.output.typst import book_support
from retainpdf_pipeline.render.output.typst import compiler
from retainpdf_pipeline.render.output.typst import overlay_chunk_compile
from retainpdf_pipeline.render.output.typst import overlay_ops
from retainpdf_pipeline.render.output.typst import page_compile
from retainpdf_pipeline.render.output.typst import sanitize
from retainpdf_pipeline.render.output.typst import sanitize_steps


def _compile_error(root: Path, runtime_error_type: str = "", return_code: int = 1):
    return compiler.TypstCompileError(
        phase="overlay_page",
        stem="page-000",
        typ_path=root / "page.typ",
        pdf_path=root / "page.pdf",
        command=["typst", "compile"],
        return_code=return_code,
        stdout="",
        stderr="compiler unavailable" if runtime_error_type else "unknown variable",
        extra={"runtime_error_type": runtime_error_type} if runtime_error_type else {},
    )


@pytest.fixture(params=["FileNotFoundError", "TimeoutExpired"])
def runtime_error(request, tmp_path):
    return _compile_error(tmp_path, request.param, -1)


def _items(count: int = 1, *, math: bool = False) -> list[dict]:
    text = "$x^2$" if math else "ordinary text"
    return [
        {
            "item_id": f"b{index}",
            "bbox": [10, 20, 180, 60],
            "translated_text": text,
            "protected_translated_text": text,
        }
        for index in range(count)
    ]


@pytest.mark.parametrize(
    ("runtime_error_type", "return_code", "expected"),
    [("FileNotFoundError", -1, True), ("TimeoutExpired", -1, True),
     ("PermissionError", -1, True), ("", -9, True), ("", 1, False)],
)
def test_runtime_failure_policy(tmp_path, runtime_error_type, return_code, expected):
    assert compiler.is_typst_runtime_failure(
        _compile_error(tmp_path, runtime_error_type, return_code)
    ) is expected
    assert compiler.is_typst_runtime_failure(RuntimeError("bad formula")) is False


@pytest.mark.parametrize("failure", [FileNotFoundError("typst"), PermissionError("typst"),
                                    subprocess.TimeoutExpired(["typst"], 600)])
def test_compiler_preserves_runtime_failure_cause(tmp_path, failure, monkeypatch):
    monkeypatch.setattr(compiler, "resolve_typst_bin", lambda: "/fake/typst")
    with mock.patch.object(compiler.subprocess, "run", side_effect=failure) as run:
        with pytest.raises(compiler.TypstCompileError) as raised:
            compiler._run_typst_compile(
                command=["compile"], typ_path=tmp_path / "page.typ",
                pdf_path=tmp_path / "page.pdf", phase="overlay_page", stem="page",
                extra={"page_count": 8},
            )
    run.assert_called_once()
    assert run.call_args.args[0][0] == "/fake/typst"
    assert compiler.is_typst_runtime_failure(raised.value)
    assert raised.value.__cause__ is failure
    assert raised.value.to_dict()["extra"]["runtime_error_type"] == type(failure).__name__
    assert raised.value.to_dict()["extra"]["page_count"] == 8


def test_missing_typst_binary_is_wrapped_like_a_launch_failure(tmp_path, monkeypatch):
    """typst 不存在必须被 is_typst_runtime_failure() 认出来。

    否则 sanitize / book_renderer 等十几处会把它当成内容问题，对着一个必然失败的
    编译反复做「删元素再试」的修复，最后报出的还是个误导性的排版错误。
    """
    def _missing():
        raise ExternalToolNotFound("未找到 typst 可执行文件")

    monkeypatch.setattr(compiler, "resolve_typst_bin", _missing)
    with mock.patch.object(compiler.subprocess, "run") as run:
        with pytest.raises(compiler.TypstCompileError) as raised:
            compiler._run_typst_compile(
                command=["compile"], typ_path=tmp_path / "page.typ",
                pdf_path=tmp_path / "page.pdf", phase="overlay_page", stem="page",
            )
    run.assert_not_called()
    assert compiler.is_typst_runtime_failure(raised.value)
    assert isinstance(raised.value.__cause__, ExternalToolNotFound)
    payload = raised.value.to_dict()
    assert payload["extra"]["runtime_error_type"] == "ExternalToolNotFound"
    # 解析都没成功，就不该谎报一个用过的二进制路径。
    assert payload["extra"]["typst_bin"] == ""
    assert "未找到 typst" in payload["stderr"]


def test_sanitize_runtime_failure_does_not_probe_or_repair(tmp_path, runtime_error):
    diagnostics = {}
    items = _items(8)
    with (
        mock.patch.object(sanitize, "compile_typst_overlay_pdf", side_effect=runtime_error) as compile_pdf,
        mock.patch.object(sanitize, "find_bad_item_indices") as probe,
        mock.patch.object(sanitize, "try_selective_llm_repair") as repair,
    ):
        with pytest.raises(compiler.TypstCompileError) as raised:
            sanitize.sanitize_items_for_typst_compile(
                200, 300, items, stem="page", work_dir=tmp_path, diagnostics=diagnostics,
            )
    assert raised.value is runtime_error
    compile_pdf.assert_called_once()
    probe.assert_not_called()
    repair.assert_not_called()
    assert diagnostics["initial_compile_error"] == runtime_error.to_dict()
    assert "final_mode" not in diagnostics
    assert all("_force_plain_line" not in item for item in items)


def test_probe_stops_on_runtime_failure(tmp_path, runtime_error):
    failures = []
    with mock.patch.object(sanitize_steps, "compile_typst_overlay_pdf", side_effect=runtime_error) as compile_pdf:
        with pytest.raises(compiler.TypstCompileError) as raised:
            sanitize_steps.find_bad_item_indices(
                200, 300, _items(8), stem="page", work_dir=tmp_path, failure_details=failures,
            )
    assert raised.value is runtime_error
    compile_pdf.assert_called_once()
    assert failures == []


@pytest.mark.parametrize("step", ["try_selective_formula_strip", "try_selective_llm_repair",
                                 "try_selective_math_token_plain_text", "try_selective_plain_text"])
def test_selective_repair_propagates_runtime_failure(tmp_path, runtime_error, step):
    items = _items(math=step == "try_selective_math_token_plain_text")
    with (
        mock.patch.object(sanitize_steps, "compile_typst_overlay_pdf", side_effect=runtime_error) as compile_pdf,
        mock.patch.object(sanitize_steps, "repair_items_with_llm_for_typst", return_value=_items(2)),
    ):
        with pytest.raises(compiler.TypstCompileError) as raised:
            getattr(sanitize_steps, step)(200, 300, items, [0], stem="page", work_dir=tmp_path)
    assert raised.value is runtime_error
    compile_pdf.assert_called_once()


def test_content_error_still_uses_selective_plain_text(tmp_path, monkeypatch):
    monkeypatch.setenv("RETAIN_RENDER_TYPST_LLM_REPAIR", "0")
    content_error = _compile_error(tmp_path)

    def compile_pdf(*args, **kwargs):
        if kwargs["stem"].endswith("-selective-plain"):
            return tmp_path / "plain.pdf"
        raise content_error

    diagnostics = {}
    with (
        mock.patch.object(sanitize, "compile_typst_overlay_pdf", side_effect=compile_pdf),
        mock.patch.object(sanitize_steps, "compile_typst_overlay_pdf", side_effect=compile_pdf),
    ):
        result = sanitize.sanitize_items_for_typst_compile(
            200, 300, _items(), stem="page", work_dir=tmp_path, diagnostics=diagnostics,
        )
    assert result[0]["_force_plain_line"] is True
    assert diagnostics["final_mode"] == "selective_plain_text"
    assert diagnostics["bad_item_indices"] == [0]


@pytest.mark.parametrize("page_count", [1, 8])
def test_background_probe_does_not_bisect_runtime_failure(tmp_path, runtime_error, page_count):
    with mock.patch.object(book_renderer, "compile_typst_render_pages_pdf", side_effect=runtime_error) as compile_pdf:
        with pytest.raises(compiler.TypstCompileError) as raised:
            book_renderer._locate_bad_render_page_indices(
                background_pdf_path=tmp_path / "source.pdf", page_specs=[object()] * page_count,
                font_family="test", font_paths=None, work_dir=tmp_path, compile_workers=1,
            )
    assert raised.value is runtime_error
    assert compile_pdf.call_count <= (1 if page_count == 1 else 2)


@pytest.mark.parametrize("after_content_error", [False, True])
def test_background_render_does_not_fallback_on_runtime_failure(tmp_path, runtime_error, after_content_error):
    errors = [_compile_error(tmp_path), runtime_error] if after_content_error else [runtime_error]
    specs = [(0, 200, 300, _items())]
    with (
        mock.patch.object(book_renderer, "compile_typst_render_pages_pdf", side_effect=errors) as compile_pdf,
        mock.patch.object(book_renderer, "_locate_bad_render_page_indices", return_value=[0]) as locate,
        mock.patch.object(book_renderer, "collect_background_page_specs", return_value=specs),
        mock.patch.object(book_renderer, "sanitize_page_specs_for_typst_book_background", return_value=specs) as repair,
        mock.patch.object(book_renderer, "_apply_background_page_color_adapt", return_value={0: _items()}),
        mock.patch.object(book_renderer, "build_render_page_specs", return_value=[object()]),
        mock.patch.object(book_renderer, "_build_overlay_base_doc") as fallback,
    ):
        with pytest.raises(compiler.TypstCompileError) as raised:
            book_renderer._compile_render_pages_pdf_resilient(
                source_pdf_path=tmp_path / "source.pdf", color_sample_pdf_path=tmp_path / "source.pdf",
                background_pdf_path=tmp_path / "background.pdf", translated_pages={0: _items()},
                page_specs=[object()], work_dir=tmp_path,
            )
    assert raised.value is runtime_error
    assert compile_pdf.call_count == 1 + int(after_content_error)
    assert locate.call_count == int(after_content_error)
    assert repair.call_count == int(after_content_error)
    fallback.assert_not_called()


def test_legacy_background_does_not_sanitize_runtime_failure(tmp_path, runtime_error):
    with (
        mock.patch.object(book_support, "compile_typst_book_background_pdf", side_effect=runtime_error) as compile_pdf,
        mock.patch.object(book_support, "sanitize_page_specs_for_typst_book_background") as repair,
    ):
        with pytest.raises(compiler.TypstCompileError) as raised:
            book_support.compile_background_pdf_resilient(
                tmp_path / "source.pdf", [(0, 200, 300, _items())], work_dir=tmp_path,
            )
    assert raised.value is runtime_error
    compile_pdf.assert_called_once()
    repair.assert_not_called()


@pytest.mark.parametrize("after_content_error", [False, True])
def test_overlay_does_not_fallback_on_runtime_failure(tmp_path, runtime_error, after_content_error):
    errors = [_compile_error(tmp_path), runtime_error] if after_content_error else [runtime_error]
    items = _items()
    sanitized_specs = ([(200, 300, items)], {0: items}, [(0, 200, 300, items, "page")])
    with (
        fitz.open() as doc,
        mock.patch.object(overlay_ops, "compile_book_overlay_pdf", side_effect=errors) as compile_pdf,
        mock.patch.object(overlay_ops, "sanitize_overlay_page_specs", return_value=sanitized_specs) as repair,
        mock.patch.object(overlay_ops, "overlay_pages_via_page_fallback") as fallback,
    ):
        doc.new_page(width=200, height=300)
        with pytest.raises(compiler.TypstCompileError) as raised:
            overlay_ops.overlay_translated_pages_on_doc(
                doc, {0: items}, stem="page", temp_root=tmp_path,
                prepared_overlay_pages={0: items}, no_cache=True,
            )
    assert raised.value is runtime_error
    assert compile_pdf.call_count == 1 + int(after_content_error)
    assert repair.call_count == int(after_content_error)
    fallback.assert_not_called()


@pytest.mark.parametrize("route", ["page", "chunk"])
def test_parallel_compile_preserves_runtime_error(tmp_path, runtime_error, route):
    module = page_compile if route == "page" else overlay_chunk_compile
    compile_name = "compile_page_overlay_pdf" if route == "page" else "compile_typst_book_overlay_pdf"
    with mock.patch.object(module, compile_name, side_effect=runtime_error) as compile_pdf:
        with pytest.raises(compiler.TypstCompileError) as raised:
            if route == "page":
                page_compile.compile_overlay_page_specs(
                    [(0, 200, 300, _items(), "page")], compile_workers=1, temp_root=tmp_path,
                )
            else:
                overlay_chunk_compile.compile_book_overlay_pdf_chunks(
                    ordered_page_indices=[0], book_specs=[(200, 300, _items())],
                    stem="book", compile_workers=1, temp_root=tmp_path,
                )
    assert raised.value is runtime_error
    compile_pdf.assert_called_once()


@pytest.mark.parametrize("route", ["page", "chunk", "probe"])
def test_runtime_failure_cancels_pending_compiles(tmp_path, runtime_error, route, monkeypatch):
    failed = Future()
    failed.set_exception(runtime_error)
    pending = Future()
    module = {"page": page_compile, "chunk": overlay_chunk_compile, "probe": book_renderer}[route]
    executor = mock.MagicMock()
    executor.__enter__.return_value = executor
    executor.submit.side_effect = [failed, pending]
    monkeypatch.setenv("RETAIN_TYPST_OVERLAY_CHUNK_PAGES", "1")
    with mock.patch.object(module, "ThreadPoolExecutor", return_value=executor):
        with pytest.raises(compiler.TypstCompileError) as raised:
            if route == "page":
                page_compile.compile_overlay_page_specs(
                    [(index, 200, 300, _items(), f"page-{index}") for index in range(2)],
                    compile_workers=1, temp_root=tmp_path,
                )
            elif route == "chunk":
                overlay_chunk_compile.compile_book_overlay_pdf_chunks(
                    ordered_page_indices=[0, 1], book_specs=[(200, 300, _items())] * 2,
                    stem="book", compile_workers=1, temp_root=tmp_path,
                )
            else:
                book_renderer._locate_bad_render_page_indices(
                    background_pdf_path=tmp_path / "source.pdf", page_specs=[object()] * 8,
                    font_family="test", font_paths=None, work_dir=tmp_path, compile_workers=1,
                )
    assert raised.value is runtime_error
    assert pending.cancelled()

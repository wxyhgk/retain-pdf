"""Stage process entries dispatch to the existing workers without changes."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


PIPELINE_ROOT = Path(__file__).resolve().parents[3]


def _run_stage(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", *args],
        cwd=PIPELINE_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_ocr_help_lists_workers() -> None:
    proc = _run_stage("retainpdf_pipeline.ocr", "--help")
    assert proc.returncode == 0
    assert "provider-ocr" in proc.stdout
    assert "normalize-ocr" in proc.stdout


def test_ocr_unknown_worker_fails() -> None:
    proc = _run_stage("retainpdf_pipeline.ocr", "bogus")
    assert proc.returncode == 2
    assert "unknown OCR worker: bogus" in proc.stderr


def test_translate_help_passthrough() -> None:
    proc = _run_stage("retainpdf_pipeline.translate", "--help")
    assert proc.returncode == 0
    assert "--spec" in proc.stdout


def test_render_help_passthrough() -> None:
    proc = _run_stage("retainpdf_pipeline.render", "--help")
    assert proc.returncode == 0
    assert "--spec" in proc.stdout


def test_ocr_normalize_help_passthrough() -> None:
    proc = _run_stage("retainpdf_pipeline.ocr", "normalize-ocr", "--help")
    assert proc.returncode == 0
    assert "--spec" in proc.stdout


def test_render_stage_main_runs_runtime_orchestrator() -> None:
    # Rust 起渲染阶段用的是 `python -m retainpdf_pipeline.render`。它必须和
    # `retainpdf-pipeline render-only` 走同一个 runtime 编排（渲染前精修、渲染后重算 QA），
    # 直接调 render.workflow.render_only 会把这两步静默跳过。
    import importlib

    stage_main = importlib.import_module("retainpdf_pipeline.render.__main__")
    from retainpdf_pipeline.runtime.pipeline import render_only_pipeline

    # worker 模块在结构化失败的包装里面才 import，所以这里比的是模块名
    assert stage_main.WORKER_MODULE == render_only_pipeline.__name__


def _assert_import_crash_is_structured(proc: subprocess.CompletedProcess[str], stage: str) -> dict:
    import json

    assert proc.returncode == 1, proc.stderr
    lines = [line for line in proc.stderr.splitlines() if line.startswith("structured failure json:")]
    assert lines, proc.stderr
    payload = json.loads(lines[-1].split(":", 1)[1])
    assert payload["failure_code"] == "runtime_environment_broken"
    assert payload["failure_category"] == "environment"
    assert payload["retryable"] is False
    assert payload["failed_stage"] == stage
    return payload


def _run_with_broken_module(tmp_path: Path, module: str, *args: str) -> subprocess.CompletedProcess[str]:
    """让 worker 模块 import 期就崩（像 #135 缺数据文件、#7 缺 fitz）：用 sitecustomize 往 sys.modules
    里塞一个导入时报错的假模块。"""
    hook = tmp_path / "hook"
    hook.mkdir(parents=True)
    (hook / "sitecustomize.py").write_text(
        "import importlib.abc, importlib.machinery, sys\n"
        f"_BROKEN = {module!r}\n"
        "class _Finder(importlib.abc.MetaPathFinder):\n"
        "    def find_spec(self, name, path=None, target=None):\n"
        "        if name == _BROKEN:\n"
        "            raise ModuleNotFoundError(\"No module named 'fitz'\", name='fitz')\n"
        "        return None\n"
        "sys.meta_path.insert(0, _Finder())\n",
        encoding="utf-8",
    )
    import os

    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join([str(hook), str(PIPELINE_ROOT), env.get("PYTHONPATH", "")])
    return subprocess.run(
        [sys.executable, "-m", *args],
        cwd=PIPELINE_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )


def test_ocr_worker_import_crash_emits_structured_failure(tmp_path: Path) -> None:
    # #135：OCR worker 在 import 期崩溃，以前没有结构化失败，Rust 兜底把它猜成了渲染失败
    proc = _run_with_broken_module(
        tmp_path,
        "retainpdf_pipeline.ocr.document_schema.normalize_pipeline",
        "retainpdf_pipeline.ocr",
        "normalize-ocr",
        "--spec",
        "missing.json",
    )
    _assert_import_crash_is_structured(proc, "normalization")


def test_render_and_translate_import_crash_emit_structured_failure(tmp_path: Path) -> None:
    proc = _run_with_broken_module(
        tmp_path / "render",
        "retainpdf_pipeline.runtime.pipeline.render_only_pipeline",
        "retainpdf_pipeline.render",
    )
    _assert_import_crash_is_structured(proc, "rendering")
    proc = _run_with_broken_module(
        tmp_path / "translate",
        "retainpdf_pipeline.translate.entrypoints.translate_only_pipeline",
        "retainpdf_pipeline.translate",
    )
    _assert_import_crash_is_structured(proc, "translation")


def test_console_import_crash_emits_structured_failure(tmp_path: Path) -> None:
    proc = _run_with_broken_module(
        tmp_path,
        "retainpdf_pipeline.ocr.ocr_provider.provider_pipeline",
        "retainpdf_pipeline.entrypoints.console",
        "provider-ocr",
    )
    _assert_import_crash_is_structured(proc, "provider")

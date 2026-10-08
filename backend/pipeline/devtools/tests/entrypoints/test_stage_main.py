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

    assert stage_main.main is render_only_pipeline.main

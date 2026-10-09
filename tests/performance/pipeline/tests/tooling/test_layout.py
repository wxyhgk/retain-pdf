"""Executable paths remain usable without repository cwd or inherited secrets."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys

import pytest

from support.paths import BACKEND, HERE, PIPELINE, ROOT
from support.translation_io_support import PROBE
from support.offline import child_command, child_environment


ENTRYPOINTS = (
    "run.py", "live_smoke.py", "offline_profile.py", "checkpoint_benchmark.py",
    "audit_prompts.py", "compare.py", "compare_optimization.py", "inspect_capture.py",
    "replay_capture.py", "probe_thinking.py",
    "tools/analysis/audit_prompts.py", "tools/analysis/compare.py",
    "tools/analysis/compare_optimization.py", "tools/analysis/inspect_capture.py",
    "tools/analysis/replay_capture.py", "tools/experiments/probe_thinking.py",
)


@pytest.mark.parametrize("entrypoint", ENTRYPOINTS)
def test_cli_help_from_unrelated_cwd_without_pythonpath(entrypoint, tmp_path):
    env = child_environment(tmp_path)
    env.pop("PYTHONPATH")
    process = subprocess.run(
        child_command(HERE / entrypoint, "--help"),
        cwd=tmp_path, env=env, capture_output=True, text=True, timeout=20,
    )
    assert process.returncode == 0, process.stdout + process.stderr
    assert "usage:" in process.stdout.lower()
    assert list(tmp_path.iterdir()) == []


def test_shared_layout_resolves_probes_and_unchanged_baseline():
    assert (ROOT / "Cargo.toml").is_file()
    assert BACKEND == ROOT / "backend"
    assert PIPELINE == BACKEND / "pipeline"
    assert (PIPELINE / "retainpdf_pipeline").is_dir()
    assert PROBE == HERE / "support/translation_io_probe.py"
    assert PROBE.is_file()
    assert (HERE / "support/production_translation_probe.py").is_file()
    # 基线文件的哈希是第二道守卫:改基线必须同时改这里,防止为了让重构测试变绿
    # 而顺手重生成(见 README「不要为了通过重构测试重新生成基线」)。
    # 更早一次:公式指引改成明确要求 LaTeX 并去掉降级要求后,逐例审阅过范围——
    # 12 个 direct_typst 用例的消息变了,16 个 placeholder 用例只有 prompt_hash 变。
    # 最近一次:引用规则改成「行内方括号 [n] 原样、原文是上标才输出上标」。同样逐例审阅:
    # 12 个用例的消息变化只落在那一行引用规则上,其余 16 个只有 prompt_hash 变,成员与其它指纹不变。
    # 2026-10-09:提示词去重并补「术语 / 引用 / 标点」三条中文体例(0b015660)。逐例审阅:28 个用例
    # 的 system 消息都只变在这几行;9 个 placeholder 用例的 user 消息只变在 task 说明(删去与 system
    # 重复的要求);prompt_hash 随之变化,成员与其它指纹不变。
    baseline = HERE / "fixtures/refactor_baseline.json"
    assert hashlib.sha256(baseline.read_bytes()).hexdigest() == "5eb61b90d6a3163bc637b0d52422e462f87edee265ae1950930bf9cfcf6a5649"

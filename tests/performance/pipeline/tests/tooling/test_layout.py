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
    baseline = HERE / "fixtures/refactor_baseline.json"
    assert hashlib.sha256(baseline.read_bytes()).hexdigest() == "7a3d6fb32e656983518739bd207ed6b10131833f484ba56ff998ac5ca4aae2ca"

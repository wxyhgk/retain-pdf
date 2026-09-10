"""Legacy CLI shims preserve exit status and argv without executing live tools."""
import json
import runpy
import subprocess
import sys
from types import ModuleType

import pytest

from support.paths import HERE
from support.offline import child_command, child_environment


SHIMS = (
    ("audit_prompts", "tools.analysis.audit_prompts"),
    ("compare", "tools.analysis.compare"),
    ("compare_optimization", "tools.analysis.compare_optimization"),
    ("inspect_capture", "tools.analysis.inspect_capture"),
    ("replay_capture", "tools.analysis.replay_capture"),
    ("probe_thinking", "tools.experiments.probe_thinking"),
)


@pytest.mark.parametrize("name,module_name", SHIMS)
@pytest.mark.parametrize("outcome", [None, 0, 1, "usage_error"])
def test_shim_preserves_exit_status_argv_and_single_invocation(monkeypatch, name, module_name, outcome):
    # Install a synthetic implementation before running the shim. In particular,
    # the thinking probe must never load config, a credential vault or a model.
    implementation = ModuleType(module_name)
    calls = []
    argv = [str(HERE / f"{name}.py"), "synthetic input.json", "--synthetic-option", "value"]

    def main():
        calls.append(list(sys.argv))
        if outcome == "usage_error":
            raise SystemExit(2)
        return outcome

    implementation.main = main
    monkeypatch.setitem(sys.modules, module_name, implementation)
    monkeypatch.setattr(sys, "argv", argv)
    monkeypatch.setattr(sys, "path", list(sys.path))
    with pytest.raises(SystemExit) as raised:
        runpy.run_path(str(HERE / f"{name}.py"), run_name="__main__")
    assert raised.value.code == (2 if outcome == "usage_error" else outcome)
    assert calls == [argv]
    assert sys.argv == argv


def test_compare_legacy_and_relocated_cli_emit_equivalent_json(tmp_path):
    before = tmp_path / "before.json"
    after = tmp_path / "after.json"
    before.write_text(json.dumps({
        "status": "succeeded", "stage": "translate", "wall_seconds": 10,
        "checkpoint_timing": {"update_elapsed_ms": 4},
    }))
    after.write_text(json.dumps({
        "status": "succeeded", "stage": "translate", "wall_seconds": 8,
        "checkpoint_timing": {"update_elapsed_ms": 3, "snapshot_elapsed_ms": 1},
    }))
    results = []
    for entrypoint in (HERE / "compare.py", HERE / "tools/analysis/compare.py"):
        process = subprocess.run(
            child_command(entrypoint, before, after),
            env=child_environment(tmp_path), cwd=tmp_path,
            capture_output=True, text=True, timeout=20,
        )
        assert process.returncode == 0, process.stderr
        assert process.stderr == ""
        results.append(json.loads(process.stdout))
    assert results[0] == results[1]
    assert results[0]["metrics"]["wall_seconds"]["change_percent"] == -20
    assert results[0]["metrics"]["checkpoint_timing.snapshot_elapsed_ms"]["before"] is None
